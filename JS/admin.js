import { api } from './api.js'
import { calcularStatusProduto, formatarQuantidade } from './constants.js'
import { exigirPapel } from './auth.js'
import { montarCabecalho } from './cabecalho.js'
import { piEmAlerta, bannerAlertaHtml, resumoAlertasHtml, piNaoDeclarada, bannerDeclaracaoHtml, resumoDeclaracaoHtml, seloPrazoDeclaracaoPiHtml, seloPrazoDeclaracaoHtml } from './alertas.js'

const containerPis = document.getElementById('container-pis')
const toggleConcluidas = document.getElementById('toggle-concluidas')
const abertos = new Set()

const rotuloInsumo = { embalagem: 'Embalagem', rotulo: 'Rótulo', caixa: 'Caixa', etiqueta: 'Etiqueta' }

function statusDoPi(pedido) {
  const produtos = pedido.produtos_pi || []
  if (produtos.length === 0) return 'SEM PRODUTOS'
  return produtos.some((p) => calcularStatusProduto(p.insumos_produto || []) === 'NÃO PRODUZ') ? 'NÃO PRODUZ' : 'LIBERADO'
}

async function concluirPi(piId, concluida, btn) {
  const acao = concluida ? 'reabrir' : 'concluir'
  if (!confirm(`Deseja ${acao} esta PI?`)) return
  btn.disabled = true
  await api.pedidos.concluir(piId, !concluida)
  carregar()
}

function renderAlmoxarifado(produtos) {
  if (!produtos || produtos.length === 0) {
    return '<p class="text-muted fst-italic small">Nenhum produto cadastrado.</p>'
  }
  return produtos.map((produto) => {
    const insumos = produto.insumos_produto || []
    const status = calcularStatusProduto(insumos)
    const liberado = status === 'LIBERADO'

    const linhasInsumos = insumos.map((insumo) => {
      let detalhes = ''
      if (insumo.tipo === 'caixa') {
        const sobra = Number(insumo.sobra) || 0
        const necessario = Number(produto.quantidade) || 0
        const suf = sobra >= necessario
        detalhes = `Sobra: ${sobra} cx · ${suf
          ? `<span class="texto-ok">Suficiente (+${sobra - necessario} cx)</span>`
          : `<span class="texto-erro">Faltam ${necessario - sobra} cx</span>`}`
      } else if (insumo.tipo === 'etiqueta') {
        const sobra = Number(insumo.sobra) || 0
        detalhes = sobra === 0
          ? '<span class="texto-erro">Sem estoque</span>'
          : sobra < 100 ? `<span class="texto-alerta">⚠ Baixo (${sobra} un)</span>`
          : `${sobra} unidades`
      } else {
        const sobra = Number(insumo.sobra) || 0
        const pacotes = Number(insumo.quantidade_por_pacote) || 0
        detalhes = `Sobra: ${sobra} kg${pacotes > 0 ? ` · ${pacotes} pacotes` : ''}`
      }
      return `<tr>
        <td>${rotuloInsumo[insumo.tipo] || insumo.tipo}</td>
        <td>${insumo.confirmado ? '✅' : '❌'}</td>
        <td>${detalhes}</td>
      </tr>`
    }).join('')

    return `
      <div class="card border-0 bg-light rounded-3 p-3 mb-2">
        <div class="d-flex align-items-center gap-2 flex-wrap mb-2">
          <strong>${produto.produto}</strong>
          <span class="badge bg-secondary">${formatarQuantidade(produto.quantidade)}</span>
          <span class="badge ${liberado ? 'bg-success' : 'bg-danger'}">${status}</span>
          ${seloPrazoDeclaracaoHtml(produto)}
        </div>
        ${insumos.length > 0
          ? `<table class="table table-sm table-bordered mb-0 tabela-insumos-admin">
              <thead><tr><th>Insumo</th><th>OK</th><th>Estoque</th></tr></thead>
              <tbody>${linhasInsumos}</tbody>
             </table>`
          : '<p class="text-muted small mb-0 fst-italic">Sem dados do almoxarifado.</p>'}
        ${produto.observacoes ? `<div class="small text-muted mt-2">📝 ${produto.observacoes}</div>` : ''}
      </div>`
  }).join('')
}

function renderEntradasB2Geral(entradas) {
  if (!entradas || entradas.length === 0) {
    return '<p class="text-muted fst-italic small">Nenhuma entrada registrada pelo B2.</p>'
  }
  return entradas.map((e) => {
    const data = new Date(e.criado_em).toLocaleString('pt-BR')
    return `
      <div class="border rounded-3 p-3 mb-2 bg-light">
        <div class="d-flex justify-content-between flex-wrap gap-1 mb-1">
          <span class="${e.produto ? 'fw-semibold small' : 'text-muted small fst-italic'}">${e.produto || 'Produto não informado'}</span>
          <span class="small text-muted">${data}</span>
        </div>
        ${e.localizacao ? `<div class="small mb-1">📍 <span class="fw-semibold">${e.localizacao}</span></div>` : ''}
        <div class="d-flex gap-2 flex-wrap">
          ${e.embalagem_kg > 0 ? `<span class="badge bg-primary">📦 ${e.embalagem_kg} kg emb.</span>` : ''}
          ${e.rotulo_kg > 0 ? `<span class="badge bg-info text-dark">🏷 ${e.rotulo_kg} kg rót.</span>` : ''}
          ${e.pallet_caixas > 0 ? `<span class="badge bg-secondary">🪵 ${e.pallet_caixas} pallet(s)</span>` : ''}
        </div>
        ${e.foto_url || e.foto_nota_url ? `
          <div class="d-flex gap-2 mt-2 flex-wrap">
            ${e.foto_url ? `<a href="${e.foto_url}" target="_blank"><img src="${e.foto_url}" class="foto-detalhe-img rounded-2" alt="Foto produto"></a>` : ''}
            ${e.foto_nota_url ? `<a href="${e.foto_nota_url}" target="_blank"><img src="${e.foto_nota_url}" class="foto-detalhe-img rounded-2" alt="Foto nota"></a>` : ''}
          </div>` : ''}
      </div>`
  }).join('')
}

function renderVinculosEstoque(vinculos) {
  if (!vinculos || vinculos.length === 0) {
    return '<p class="text-muted fst-italic small">Nenhum insumo do estoque geral vinculado a esta PI.</p>'
  }
  return vinculos.map((v) => {
    const dataEntrada = new Date(v.entrada_data).toLocaleString('pt-BR')
    const dataVinculo = new Date(v.criado_em).toLocaleString('pt-BR')
    return `
      <div class="border rounded-3 p-3 mb-2 bg-light">
        <div class="d-flex justify-content-between flex-wrap gap-1 mb-1">
          ${v.produto_entrada ? `<span class="fw-semibold small">📦 ${v.produto_entrada}</span>` : '<span class="text-muted small">Produto não informado</span>'}
          <span class="small text-muted">Vinculado em ${dataVinculo}</span>
        </div>
        <div class="d-flex gap-2 flex-wrap mb-1">
          ${v.embalagem_kg > 0 ? `<span class="badge bg-primary">📦 ${v.embalagem_kg} kg emb.</span>` : ''}
          ${v.rotulo_kg > 0 ? `<span class="badge bg-info text-dark">🏷 ${v.rotulo_kg} kg rót.</span>` : ''}
          ${v.pallet_caixas > 0 ? `<span class="badge bg-secondary">🪵 ${v.pallet_caixas} pallet(s)</span>` : ''}
        </div>
        ${v.entrada_localizacao ? `<div class="small mb-1">📍 <span class="fw-semibold">${v.entrada_localizacao}</span></div>` : ''}
        <div class="small text-muted">Entrada do B2: ${dataEntrada}</div>
        ${v.entrada_foto || v.entrada_foto_nota ? `
          <div class="d-flex gap-2 mt-2 flex-wrap">
            ${v.entrada_foto ? `<a href="${v.entrada_foto}" target="_blank"><img src="${v.entrada_foto}" class="foto-detalhe-img rounded-2" alt="Foto produto"></a>` : ''}
            ${v.entrada_foto_nota ? `<a href="${v.entrada_foto_nota}" target="_blank"><img src="${v.entrada_foto_nota}" class="foto-detalhe-img rounded-2" alt="Foto nota"></a>` : ''}
          </div>` : ''}
      </div>`
  }).join('')
}

function renderRecebimentosB2(recebimentos) {
  if (!recebimentos || recebimentos.length === 0) {
    return '<p class="text-muted small fst-italic">Nenhum recebimento por PI registrado.</p>'
  }

  const porProduto = {}
  recebimentos.forEach((r) => {
    const chave = r.nome_produto || 'Geral'
    if (!porProduto[chave]) porProduto[chave] = []
    porProduto[chave].push(r)
  })

  return Object.entries(porProduto).map(([nomeProduto, itens]) => {
    const linhas = itens.map((r) => {
      const recebido = r.status_recebimento === 'recebido'
      const fotos = [
        r.foto_url ? `<a href="${r.foto_url}" target="_blank"><img src="${r.foto_url}" class="foto-detalhe-img rounded-2 me-1"></a>` : '',
        r.foto_nota_url ? `<a href="${r.foto_nota_url}" target="_blank"><img src="${r.foto_nota_url}" class="foto-detalhe-img rounded-2"></a>` : ''
      ].filter(Boolean).join('')

      return `<div class="d-flex align-items-start gap-2 flex-wrap mb-1">
        <span class="badge ${recebido ? 'bg-success' : 'bg-danger'}" style="min-width:90px;text-align:center">${rotuloInsumo[r.tipo] || r.tipo}</span>
        ${recebido && r.quantidade_recebida ? `<span class="badge bg-light text-dark border">${r.quantidade_recebida}</span>` : ''}
        ${!recebido ? '<span class="text-muted small">Pendente</span>' : ''}
        ${fotos ? `<div class="d-flex">${fotos}</div>` : ''}
      </div>`
    }).join('')

    return `<div class="mb-2">
      <div class="small fw-bold text-secondary mb-1">• ${nomeProduto}</div>
      <div class="ps-2">${linhas}</div>
    </div>`
  }).join('<hr class="my-2">')
}

function renderCard(pedido) {
  const status = statusDoPi(pedido)
  const liberado = status === 'LIBERADO'
  const bloqueado = status === 'NÃO PRODUZ'
  const temVinculos = (pedido.vinculos_estoque || []).length > 0
  const temRecebimentos = (pedido.recebimentos_b2 || []).some(r => r.status_recebimento === 'recebido')
  const totalRecb = (pedido.recebimentos_b2 || []).length
  const recebidos = (pedido.recebimentos_b2 || []).filter(r => r.status_recebimento === 'recebido').length

  const emAlerta = piEmAlerta(pedido)
  const naoDeclarada = piNaoDeclarada(pedido)
  const aberto = abertos.has(String(pedido.id))
  const card = document.createElement('div')
  card.className = `card card-pi-admin mb-3${pedido.concluida ? ' pi-concluida' : ''}${emAlerta ? ' card-alerta-embarque' : ''}${naoDeclarada ? ' card-alerta-declaracao' : ''}`

  if (emAlerta) {
    const banner = document.createElement('div')
    banner.innerHTML = bannerAlertaHtml(pedido)
    card.appendChild(banner.firstElementChild)
  }
  if (naoDeclarada) {
    const banner = document.createElement('div')
    banner.innerHTML = bannerDeclaracaoHtml(pedido)
    card.appendChild(banner.firstElementChild)
  }

  const cabecalho = document.createElement('div')
  cabecalho.className = 'card-body d-flex justify-content-between align-items-start flex-wrap gap-2'
  cabecalho.innerHTML = `
    <div>
      <div class="fw-bold fs-6">PI ${pedido.numero_pi}</div>
      <div class="text-muted small">
        ${pedido.cliente || ''}
        ${pedido.destino ? '· ' + pedido.destino : ''}
        ${pedido.data_embarque ? '· 🗓 ' + new Date(String(pedido.data_embarque).slice(0, 10) + 'T00:00:00').toLocaleDateString('pt-BR') : ''}
      </div>
      <div class="mt-1 d-flex align-items-center gap-2 flex-wrap">
        <span class="badge ${liberado ? 'bg-success' : bloqueado ? 'bg-danger' : 'bg-secondary'}">${status}</span>
        ${seloPrazoDeclaracaoPiHtml(pedido)}
        ${totalRecb > 0 ? `<span class="small text-muted">📦 Receb. PI: ${recebidos}/${totalRecb}</span>` : ''}
        ${temVinculos ? `<span class="small text-muted">🔗 ${pedido.vinculos_estoque.length} vínculo(s)</span>` : ''}
      </div>
    </div>
    <div class="d-flex gap-2 flex-wrap">
      <button class="btn btn-sm btn-outline-danger btn-expandir" data-id="${pedido.id}">${aberto ? 'Fechar ▴' : 'Ver detalhes ▾'}</button>
      ${!window._convidado ? `<button class="btn btn-sm ${pedido.concluida ? 'btn-outline-warning' : 'btn-outline-success'} btn-concluir" data-id="${pedido.id}" data-concluida="${pedido.concluida ? 'true' : 'false'}">
        ${pedido.concluida ? '↩ Reabrir' : '✔ Concluir'}
      </button>` : ''}
    </div>
  `

  const detalhe = document.createElement('div')
  detalhe.id = `detalhe-${pedido.id}`
  detalhe.style.display = aberto ? 'block' : 'none'
  detalhe.className = 'border-top px-3 pb-3'

  const secAlmox = document.createElement('div')
  secAlmox.className = 'mt-3'
  secAlmox.innerHTML = `
    <div class="secao-titulo-card mb-2">🏭 Insumos por Produto (Almoxarifado)</div>
    ${renderAlmoxarifado(pedido.produtos_pi)}
  `

  const secEstoque = document.createElement('div')
  secEstoque.className = 'mt-3'
  secEstoque.innerHTML = `
    <div class="secao-titulo-card mb-2">🔗 Estoque Geral Vinculado</div>
    ${renderVinculosEstoque(pedido.vinculos_estoque)}
  `

  const secB2 = document.createElement('div')
  secB2.className = 'mt-3'
  secB2.innerHTML = `
    <div class="secao-titulo-card mb-2">🚚 Recebimentos B2 por PI</div>
    ${renderRecebimentosB2(pedido.recebimentos_b2)}
  `

  detalhe.appendChild(secAlmox)
  detalhe.appendChild(secEstoque)
  detalhe.appendChild(secB2)

  card.appendChild(cabecalho)
  card.appendChild(detalhe)
  return card
}

async function carregar() {
  const incluirConcluidas = toggleConcluidas.checked
  containerPis.innerHTML = '<p class="text-muted">Carregando...</p>'
  const pedidos = await api.pedidos.completo(incluirConcluidas)
  if (!pedidos) {
    containerPis.innerHTML = '<p class="text-danger">Erro ao carregar. Verifique a conexão.</p>'
    return
  }

  const ativas = pedidos.filter((p) => !p.concluida).length
  const concluidas = pedidos.filter((p) => p.concluida).length

  document.getElementById('numero-liberados').textContent = pedidos.filter((p) => statusDoPi(p) === 'LIBERADO' && !p.concluida).length
  document.getElementById('numero-bloqueados').textContent = pedidos.filter((p) => statusDoPi(p) === 'NÃO PRODUZ' && !p.concluida).length
  document.getElementById('numero-total').textContent = ativas
  document.getElementById('numero-concluidas').textContent = concluidas

  containerPis.innerHTML = ''

  const resumoAlerta = resumoAlertasHtml(pedidos)
  if (resumoAlerta) containerPis.insertAdjacentHTML('beforeend', resumoAlerta)

  const resumoDecl = resumoDeclaracaoHtml(pedidos)
  if (resumoDecl) containerPis.insertAdjacentHTML('beforeend', resumoDecl)

  const entradas = await api.estoque.historico()
  if (entradas && entradas.length) {
    const cardEntradas = document.createElement('div')
    cardEntradas.className = 'card border-0 shadow-sm mb-4'
    cardEntradas.innerHTML = `
      <div class="card-body">
        <div class="secao-titulo-card mb-3">🚚 Todas as Entradas do B2</div>
        ${renderEntradasB2Geral(entradas)}
      </div>
    `
    containerPis.appendChild(cardEntradas)
  }

  if (!pedidos.length) {
    const vazio = document.createElement('p')
    vazio.className = 'text-muted fst-italic'
    vazio.textContent = 'Nenhuma PI cadastrada.'
    containerPis.appendChild(vazio)
    return
  }

  pedidos.forEach((pedido) => {
    containerPis.appendChild(renderCard(pedido))
  })
}

containerPis.addEventListener('click', (e) => {
  const btnExpandir = e.target.closest('.btn-expandir')
  if (btnExpandir) {
    const id = btnExpandir.dataset.id
    const detalhe = document.getElementById(`detalhe-${id}`)
    if (!detalhe) return
    const aberto = detalhe.style.display !== 'none'
    detalhe.style.display = aberto ? 'none' : 'block'
    btnExpandir.textContent = aberto ? 'Ver detalhes ▾' : 'Fechar ▴'
    if (aberto) abertos.delete(String(id)); else abertos.add(String(id))
    return
  }
  const btnConcluir = e.target.closest('.btn-concluir')
  if (btnConcluir) {
    concluirPi(btnConcluir.dataset.id, btnConcluir.dataset.concluida === 'true', btnConcluir)
  }
})

toggleConcluidas.addEventListener('change', carregar)

setInterval(carregar, 5 * 60 * 1000)

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') carregar()
})

async function iniciar() {
  const perfil = exigirPapel('todos')
  if (!perfil) return
  montarCabecalho(perfil.papel)
  window._convidado = perfil.papel !== 'admin'
  carregar()
}

iniciar()