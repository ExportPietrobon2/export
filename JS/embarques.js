import { api } from './api.js'
import { calcularStatusProduto, formatarQuantidade } from './constants.js'
import { exigirPapel } from './auth.js'
import { montarCabecalho } from './cabecalho.js'
import { piEmAlerta, bannerAlertaHtml, resumoAlertasHtml } from './alertas.js'

const containerPis = document.getElementById('container-pis')
const toggleConcluidas = document.getElementById('toggle-concluidas')
const toggleSoProntas = document.getElementById('toggle-so-prontas')
const abertos = new Set()
let podeEditarEmbarque = false

const rotuloInsumo = { embalagem: 'Embalagem', rotulo: 'Rótulo', caixa: 'Caixa', etiqueta: 'Etiqueta' }

function prontaParaProduzir(pedido) {
  const produtos = pedido.produtos_pi || []
  if (produtos.length === 0) return false
  return produtos.every((p) => calcularStatusProduto(p.insumos_produto || []) === 'LIBERADO')
}

function dataParaInput(valor) {
  if (!valor) return ''
  return String(valor).slice(0, 10)
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
  const pronta = prontaParaProduzir(pedido)
  const totalRecb = (pedido.recebimentos_b2 || []).length
  const recebidos = (pedido.recebimentos_b2 || []).filter((r) => r.status_recebimento === 'recebido').length

  const emAlerta = piEmAlerta(pedido)
  const aberto = abertos.has(String(pedido.id))
  const card = document.createElement('div')
  card.className = `card card-pi-admin mb-3${pedido.concluida ? ' pi-concluida' : ''}${emAlerta ? ' card-alerta-embarque' : ''}`

  if (emAlerta) {
    const banner = document.createElement('div')
    banner.innerHTML = bannerAlertaHtml(pedido)
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
        ${pedido.data_embarque ? '· 🚢 ' + new Date(dataParaInput(pedido.data_embarque) + 'T00:00:00').toLocaleDateString('pt-BR') : ''}
      </div>
      <div class="mt-1 d-flex align-items-center gap-2 flex-wrap">
        <span class="badge ${pronta ? 'bg-success' : 'bg-danger'}">${pronta ? '✅ Pronto para produzir' : '⏳ Não pronto'}</span>
        ${totalRecb > 0 ? `<span class="small text-muted">📦 Receb. B2: ${recebidos}/${totalRecb}</span>` : ''}
      </div>
    </div>
    <button class="btn btn-sm btn-outline-danger btn-expandir" data-id="${pedido.id}">${aberto ? 'Fechar ▴' : 'Ver detalhes ▾'}</button>
  `

  const detalhe = document.createElement('div')
  detalhe.id = `detalhe-${pedido.id}`
  detalhe.style.display = aberto ? 'block' : 'none'
  detalhe.className = 'border-top px-3 pb-3'

  const secEmbarque = document.createElement('div')
  secEmbarque.className = 'mt-3'
  secEmbarque.innerHTML = podeEditarEmbarque ? `
    <div class="secao-titulo-card mb-2">🚢 Data de Embarque</div>
    <div class="d-flex align-items-end gap-2 flex-wrap">
      <div>
        <label class="form-label small fw-semibold mb-1">Data</label>
        <input type="date" id="embarque-input-${pedido.id}" class="form-control form-control-sm" value="${dataParaInput(pedido.data_embarque)}" style="max-width:200px">
      </div>
      <button class="btn btn-sm btn-pietrobon" id="embarque-btn-${pedido.id}">💾 Salvar data</button>
      <span class="small ms-1" id="embarque-msg-${pedido.id}"></span>
    </div>
  ` : `
    <div class="secao-titulo-card mb-2">🚢 Data de Embarque</div>
    <div class="fw-semibold">${pedido.data_embarque ? new Date(dataParaInput(pedido.data_embarque) + 'T00:00:00').toLocaleDateString('pt-BR') : '— não definida'}</div>
  `

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

  detalhe.appendChild(secEmbarque)
  detalhe.appendChild(secAlmox)
  detalhe.appendChild(secEstoque)
  detalhe.appendChild(secB2)

  card.appendChild(cabecalho)
  card.appendChild(detalhe)
  return card
}

async function salvarEmbarque(piId, numeroPi) {
  const input = document.getElementById(`embarque-input-${piId}`)
  const btn = document.getElementById(`embarque-btn-${piId}`)
  const msg = document.getElementById(`embarque-msg-${piId}`)
  if (!input || !btn) return

  btn.disabled = true
  btn.textContent = 'Salvando...'
  msg.textContent = ''

  const resultado = await api.pedidos.editarEmbarque(piId, input.value || null)
  if (resultado?.erro) {
    msg.className = 'small ms-1 text-danger'
    msg.textContent = 'Erro ao salvar.'
    btn.disabled = false
    btn.textContent = '💾 Salvar data'
    return
  }

  msg.className = 'small ms-1 text-success fw-semibold'
  msg.textContent = input.value ? '✔ Data salva' : '✔ Data removida'
  btn.disabled = false
  btn.textContent = '💾 Salvar data'

  setTimeout(carregar, 900)
}

async function carregar() {
  const incluirConcluidas = toggleConcluidas.checked
  containerPis.innerHTML = '<p class="text-muted">Carregando...</p>'
  const pedidos = await api.pedidos.completo(incluirConcluidas)
  if (!pedidos) {
    containerPis.innerHTML = '<p class="text-danger">Erro ao carregar. Verifique a conexão.</p>'
    return
  }

  const prontas = pedidos.filter((p) => prontaParaProduzir(p) && !p.concluida).length
  const naoProntas = pedidos.filter((p) => !prontaParaProduzir(p) && !p.concluida).length
  const comEmbarque = pedidos.filter((p) => p.data_embarque && !p.concluida).length
  document.getElementById('numero-prontas').textContent = prontas
  document.getElementById('numero-nao-prontas').textContent = naoProntas
  document.getElementById('numero-com-embarque').textContent = comEmbarque

  let lista = pedidos
  if (toggleSoProntas.checked) lista = lista.filter((p) => prontaParaProduzir(p))

  containerPis.innerHTML = ''

  const resumoAlerta = resumoAlertasHtml(pedidos)
  if (resumoAlerta) containerPis.insertAdjacentHTML('beforeend', resumoAlerta)

  if (!lista.length) {
    const vazio = document.createElement('p')
    vazio.className = 'text-muted fst-italic'
    vazio.textContent = 'Nenhuma PI para exibir.'
    containerPis.appendChild(vazio)
    return
  }

  lista.forEach((pedido) => {
    containerPis.appendChild(renderCard(pedido))
  })

  lista.forEach((pedido) => {
    const btn = document.getElementById(`embarque-btn-${pedido.id}`)
    if (btn) btn.addEventListener('click', () => salvarEmbarque(pedido.id, pedido.numero_pi))
  })
}

containerPis.addEventListener('click', (e) => {
  const btnExpandir = e.target.closest('.btn-expandir')
  if (!btnExpandir) return
  const id = btnExpandir.dataset.id
  const detalhe = document.getElementById(`detalhe-${id}`)
  if (!detalhe) return
  const aberto = detalhe.style.display !== 'none'
  detalhe.style.display = aberto ? 'none' : 'block'
  btnExpandir.textContent = aberto ? 'Ver detalhes ▾' : 'Fechar ▴'
  if (aberto) abertos.delete(String(id)); else abertos.add(String(id))
})

toggleConcluidas.addEventListener('change', carregar)
toggleSoProntas.addEventListener('change', carregar)

function editandoData() {
  const el = document.activeElement
  return !!(el && el.id && el.id.startsWith('embarque-input-'))
}
setInterval(() => { if (!editandoData()) carregar() }, 5 * 60 * 1000)

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !editandoData()) carregar()
})

async function iniciar() {
  const perfil = exigirPapel('todos')
  if (!perfil) return
  podeEditarEmbarque = ['admin', 'gerente_producao'].includes(perfil.papel)
  montarCabecalho(perfil.papel)
  carregar()
}

iniciar()