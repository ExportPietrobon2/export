import { api } from './api.js'
import { TIPOS_INSUMO, formatarQuantidade } from './constants.js'
import { exigirPapel } from './auth.js'
import { montarCabecalho } from './cabecalho.js'
import { iniciarReferencia } from './referencia.js'

const selectPi = document.getElementById('select-pi')
const containerConteudo = document.getElementById('conteudo-pi')

function statusAutomatico(insumos, quantidade) {
  return TIPOS_INSUMO.every((tipo) => {
    if (tipo.chave === 'etiqueta') return true
    const insumo = insumos[tipo.chave]
    const sobra = Number(insumo?.sobra ?? 0)
    if (tipo.chave === 'caixa') return sobra >= Number(quantidade)
    return sobra > 0
  }) ? 'LIBERADO' : 'NÃO PRODUZ'
}

async function carregarPedidos() {
  const pedidos = await api.pedidos.listar()
  if (!pedidos) return
  pedidos.forEach((pedido) => {
    const opcao = document.createElement('option')
    opcao.value = pedido.id
    opcao.textContent = `PI ${pedido.numero_pi}${pedido.cliente ? ' — ' + pedido.cliente : ''}`
    selectPi.appendChild(opcao)
  })
}

async function carregarPi(piId) {
  containerConteudo.innerHTML = '<p class="loading">Carregando...</p>'
  if (!piId) { containerConteudo.innerHTML = ''; return }

  const produtos = await api.produtos.listar(piId)
  if (!produtos || produtos.length === 0) {
    containerConteudo.innerHTML = '<p class="vazio">Nenhum produto cadastrado nesta PI.</p>'
    return
  }

  containerConteudo.innerHTML = ''

  for (const produto of produtos) {
    const { insumos: itensInsumo } = await api.produtos.insumos(produto.id)
    const insumos = {}
    TIPOS_INSUMO.forEach((tipo) => {
      const existente = (itensInsumo || []).find((i) => i.tipo === tipo.chave)
      insumos[tipo.chave] = existente || { tipo: tipo.chave, sobra: 0, quantidade_por_pacote: 0 }
    })

    const status = statusAutomatico(insumos, produto.quantidade)
    const liberado = status === 'LIBERADO'

    const linha = document.createElement('div')
    linha.className = 'linha-produto-almox'

    const topo = document.createElement('div')
    topo.className = 'linha-produto-topo d-flex'
    topo.innerHTML = `
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 w-100">
        <div class="d-flex align-items-center gap-2 flex-wrap">
          <span class="fw-semibold">${produto.produto}</span>
          <span class="badge bg-secondary">${formatarQuantidade(produto.quantidade)}</span>
          <span class="indicador-status ${liberado ? 'indicador-ok' : 'indicador-nok'}" data-status="${produto.id}">
            ${liberado ? '✔ OK' : '✗ Pendente'}
          </span>
        </div>
        <button class="btn btn-sm btn-outline-danger btn-expandir-produto" data-id="${produto.id}">Editar ▾</button>
      </div>
    `

    const formulario = document.createElement('div')
    formulario.className = 'formulario-produto-almox'
    formulario.id = `form-produto-${produto.id}`
    formulario.style.display = 'none'
    formulario.innerHTML = `
      <div class="row g-3 mt-1">
        ${TIPOS_INSUMO.map((tipo) => {
          const insumo = insumos[tipo.chave]
          const unidade = tipo.chave === 'caixa' ? 'cx' : tipo.chave === 'etiqueta' ? 'un' : 'kg'
          const sobra = Number(insumo.sobra) || 0
          const necessario = Number(produto.quantidade) || 0

          let resultado = ''
          if (tipo.chave === 'caixa') {
            const suf = sobra >= necessario
            resultado = `<div class="saldo-valor ${suf ? 'saldo-positivo' : 'saldo-negativo'} resultado-${produto.id}-caixa">
              ${suf ? `Suficiente (sobram ${sobra - necessario} cx)` : `Faltam ${necessario - sobra} cx`}
            </div>`
          } else if (tipo.chave === 'etiqueta') {
            const baixo = sobra > 0 && sobra < 100
            const sem = sobra === 0
            resultado = `<div class="saldo-valor ${sem ? 'saldo-negativo' : baixo ? 'saldo-alerta' : 'saldo-positivo'} resultado-${produto.id}-etiqueta">
              ${sem ? 'Sem estoque' : baixo ? `⚠ Baixo (${sobra} un)` : `${sobra} unidades`}
            </div>`
          } else {
            const pacotes = Number(insumo.quantidade_por_pacote) || 0
            resultado = pacotes > 0 ? `<div class="saldo-valor saldo-positivo">${pacotes} pacotes possíveis</div>` : ''
          }

          return `<div class="col-6 col-md-3">
            <div class="card-insumo-almox h-100">
              <h4>${tipo.rotulo}</h4>
            <label class="form-label small fw-semibold">Sobra (${unidade})</label>
            <input type="number" class="form-control"
                data-produto="${produto.id}"
                data-campo="sobra"
                data-tipo="${tipo.chave}"
                value="${sobra}"
                placeholder="0">
            ${tipo.chave !== 'caixa' && tipo.chave !== 'etiqueta' ? `<label class="form-label small fw-semibold mt-2">Pacotes possíveis</label>
              <input type="number" class="form-control"
                data-produto="${produto.id}"
                data-campo="quantidade_por_pacote"
                data-tipo="${tipo.chave}"
                value="${insumo.quantidade_por_pacote}"
                placeholder="0">` : ''}
            ${resultado}
          </div></div>`
        }).join('')}
      </div>

      <div class="mt-3">
        <label class="form-label small fw-semibold">Observações</label>
        <textarea class="form-control" data-produto="${produto.id}" data-campo="observacoes" rows="2">${produto.observacoes || ''}</textarea>
      </div>

      <button class="btn btn-pietrobon w-100 mt-3 btn-salvar-produto${window._convidado ? ' d-none' : ''}" data-produto="${produto.id}" data-quantidade="${produto.quantidade}">
        Salvar
      </button>
    `

    linha.appendChild(topo)
    linha.appendChild(formulario)
    containerConteudo.appendChild(linha)
  }

  adicionarListeners()
}

function adicionarListeners() {
  containerConteudo.querySelectorAll('.btn-expandir-produto').forEach((btn) => {
    btn.addEventListener('click', () => {
      const form = document.getElementById(`form-produto-${btn.dataset.id}`)
      const aberto = form.style.display !== 'none'
      form.style.display = aberto ? 'none' : 'block'
      btn.textContent = aberto ? 'Editar ▾' : 'Fechar ▴'
    })
  })

  containerConteudo.querySelectorAll('input[data-campo="sobra"]').forEach((input) => {
    input.addEventListener('input', () => atualizarResultado(input))
  })

  containerConteudo.querySelectorAll('.btn-salvar-produto').forEach((btn) => {
    btn.addEventListener('click', () => salvarProduto(btn.dataset.produto, btn.dataset.quantidade))
  })
}

function atualizarResultado(input) {
  const produtoId = input.dataset.produto
  const tipo = input.dataset.tipo
  const sobra = Number(input.value) || 0

  if (tipo === 'caixa') {
    const btn = containerConteudo.querySelector(`.btn-salvar-produto[data-produto="${produtoId}"]`)
    const necessario = Number(btn?.dataset.quantidade) || 0
    const suf = sobra >= necessario
    const el = containerConteudo.querySelector(`.resultado-${produtoId}-caixa`)
    if (el) {
      el.textContent = suf ? `Suficiente (sobram ${sobra - necessario} cx)` : `Faltam ${necessario - sobra} cx`
      el.className = `saldo-valor ${suf ? 'saldo-positivo' : 'saldo-negativo'} resultado-${produtoId}-caixa`
    }
  } else if (tipo === 'etiqueta') {
    const baixo = sobra > 0 && sobra < 100
    const sem = sobra === 0
    const el = containerConteudo.querySelector(`.resultado-${produtoId}-etiqueta`)
    if (el) {
      el.textContent = sem ? 'Sem estoque' : baixo ? `⚠ Baixo (${sobra} un)` : `${sobra} unidades`
      el.className = `saldo-valor ${sem ? 'saldo-negativo' : baixo ? 'saldo-alerta' : 'saldo-positivo'} resultado-${produtoId}-etiqueta`
    }
  }

  atualizarIndicador(produtoId)
}

function atualizarIndicador(produtoId) {
  const btn = containerConteudo.querySelector(`.btn-salvar-produto[data-produto="${produtoId}"]`)
  const quantidade = Number(btn?.dataset.quantidade) || 0
  const insumosAtuais = {}
  TIPOS_INSUMO.forEach((tipo) => {
    const inputSobra = containerConteudo.querySelector(`input[data-produto="${produtoId}"][data-campo="sobra"][data-tipo="${tipo.chave}"]`)
    insumosAtuais[tipo.chave] = { sobra: inputSobra ? inputSobra.value : 0 }
  })
  const novoStatus = statusAutomatico(insumosAtuais, quantidade)
  const liberado = novoStatus === 'LIBERADO'
  const indicador = containerConteudo.querySelector(`[data-status="${produtoId}"]`)
  if (indicador) {
    indicador.textContent = liberado ? '✔ OK' : '✗ Pendente'
    indicador.className = `indicador-status ${liberado ? 'indicador-ok' : 'indicador-nok'}`
  }
}

async function salvarProduto(produtoId, quantidade) {
  const insumosParaSalvar = TIPOS_INSUMO.map((tipo) => {
    const inputSobra = containerConteudo.querySelector(`input[data-produto="${produtoId}"][data-campo="sobra"][data-tipo="${tipo.chave}"]`)
    const inputPacotes = containerConteudo.querySelector(`input[data-produto="${produtoId}"][data-campo="quantidade_por_pacote"][data-tipo="${tipo.chave}"]`)
    return {
      tipo: tipo.chave,
      sobra: inputSobra ? inputSobra.value : 0,
      quantidade_por_pacote: inputPacotes ? inputPacotes.value : 0
    }
  })

  const textarea = containerConteudo.querySelector(`textarea[data-produto="${produtoId}"]`)
  const resultado = await api.produtos.salvarInsumos(produtoId, {
    insumos: insumosParaSalvar,
    observacoes: textarea ? textarea.value : '',
    quantidade
  })

  if (resultado?.erro) { alert('Erro ao salvar.'); return }

  const btn = containerConteudo.querySelector(`.btn-salvar-produto[data-produto="${produtoId}"]`)
  const form = document.getElementById(`form-produto-${produtoId}`)
  const btnExpandir = containerConteudo.querySelector(`.btn-expandir-produto[data-id="${produtoId}"]`)

  btn.textContent = '✔ Salvo!'
  btn.style.background = 'var(--green-ok)'
  setTimeout(() => {
    btn.textContent = 'Salvar'
    btn.style.background = ''
    form.style.display = 'none'
    if (btnExpandir) btnExpandir.textContent = 'Editar ▾'
  }, 1500)
}

selectPi.addEventListener('change', () => carregarPi(selectPi.value))

const rotuloInsumo = { embalagem: 'Embalagem', rotulo: 'Rótulo', caixa: 'Caixa', etiqueta: 'Etiqueta' }

async function carregarRecebimentos() {
  const container = document.getElementById('conteudo-recebimentos')
  container.innerHTML = '<p class="text-muted">Carregando...</p>'

  // Mostrar entradas do estoque geral (B2) com produto
  const entradas = await api.estoque.historico()
  if (entradas && entradas.length) {
    const secao = document.createElement('div')
    secao.className = 'mb-4'
    secao.innerHTML = `
      <h6 class="fw-bold text-muted mb-2">📦 Entradas registradas pelo B2</h6>
      ${entradas.map((e) => {
        const data = new Date(e.criado_em).toLocaleString('pt-BR')
        return `
          <div class="border rounded-3 p-3 mb-2 bg-light">
            <div class="d-flex justify-content-between mb-1">
              <span class="small text-muted">${data}</span>
            </div>
            ${e.produto ? `<div class="fw-semibold small mb-1">📦 ${e.produto}</div>` : ''}
            <div class="d-flex gap-2 flex-wrap">
              ${e.embalagem_kg > 0 ? `<span class="badge bg-primary">📦 ${e.embalagem_kg} kg embalagem</span>` : ''}
              ${e.rotulo_kg > 0 ? `<span class="badge bg-info text-dark">🏷 ${e.rotulo_kg} kg rótulo</span>` : ''}
              ${e.pallet_caixas > 0 ? `<span class="badge bg-secondary">🪵 ${e.pallet_caixas} pallet(s) caixa</span>` : ''}
            </div>
            ${e.foto_url || e.foto_nota_url ? `
              <div class="d-flex gap-2 mt-2 flex-wrap">
                ${e.foto_url ? `<a href="${e.foto_url}" target="_blank"><img src="${e.foto_url}" class="foto-detalhe-img rounded-2" alt="Foto produto"></a>` : ''}
                ${e.foto_nota_url ? `<a href="${e.foto_nota_url}" target="_blank"><img src="${e.foto_nota_url}" class="foto-detalhe-img rounded-2" alt="Foto nota"></a>` : ''}
              </div>` : ''}
          </div>`
      }).join('')}
    `
    container.appendChild(secao)
  }

  const pis = await api.recebimentos.pendentes()
  if (!pis || !pis.length) {
    const vazio = document.createElement('p')
    vazio.className = 'text-muted fst-italic'
    vazio.textContent = 'Nenhum recebimento por PI registrado.'
    container.appendChild(vazio)
    return
  }

  pis.forEach((pi) => {
    const card = document.createElement('div')
    card.className = 'card border-0 shadow-sm mb-3'

    const topo = document.createElement('div')
    topo.className = 'card-body pb-2'
    topo.innerHTML = `
      <div class="d-flex align-items-center gap-2 mb-2">
        <span class="badge bg-danger">PI ${pi.numero_pi}</span>
        <span class="badge bg-secondary">${pi.cliente ?? ''}</span>
      </div>
    `
    card.appendChild(topo)

    pi.produtos.forEach((produto) => {
      const bloco = document.createElement('div')
      bloco.className = 'px-3 pb-3'

      const nomeProduto = document.createElement('div')
      nomeProduto.className = 'small fw-bold text-secondary mb-1'
      nomeProduto.textContent = `• ${produto.produto}`
      bloco.appendChild(nomeProduto)

      const filaBotoes = document.createElement('div')
      filaBotoes.className = 'd-flex gap-2 flex-wrap'

      produto.insumos.forEach((insumo) => {
        const recebido = insumo.status_recebimento === 'recebido'

        const blocoInsumo = document.createElement('div')
        blocoInsumo.className = 'd-flex flex-column gap-1 mb-1'

        const badge = document.createElement('span')
        badge.className = `badge ${recebido ? 'bg-success' : 'bg-danger'}`
        badge.style.borderRadius = '20px'
        badge.style.padding = '6px 12px'
        badge.style.fontSize = '0.82rem'
        badge.style.width = 'fit-content'
        badge.innerHTML = `${recebido ? '✔' : '○'} ${rotuloInsumo[insumo.tipo] ?? insumo.tipo}${recebido && insumo.quantidade_recebida ? ' · ' + insumo.quantidade_recebida : ''}`
        blocoInsumo.appendChild(badge)

        if (recebido && (insumo.foto_url || insumo.foto_nota_url)) {
          const fotos = document.createElement('div')
          fotos.className = 'd-flex gap-2 flex-wrap mt-1'

          if (insumo.foto_url) {
            const link = document.createElement('a')
            link.href = insumo.foto_url
            link.target = '_blank'
            const img = document.createElement('img')
            img.src = insumo.foto_url
            img.className = 'foto-detalhe-img rounded-2'
            img.alt = 'Foto produto'
            link.appendChild(img)
            fotos.appendChild(link)
          }

          if (insumo.foto_nota_url) {
            const link = document.createElement('a')
            link.href = insumo.foto_nota_url
            link.target = '_blank'
            const img = document.createElement('img')
            img.src = insumo.foto_nota_url
            img.className = 'foto-detalhe-img rounded-2'
            img.alt = 'Foto nota'
            link.appendChild(img)
            fotos.appendChild(link)
          }

          blocoInsumo.appendChild(fotos)
        }

        filaBotoes.appendChild(blocoInsumo)
      })

      bloco.appendChild(filaBotoes)

      if (pi.produtos.indexOf(produto) < pi.produtos.length - 1) {
        const hr = document.createElement('hr')
        hr.className = 'my-2 mx-0'
        bloco.appendChild(hr)
      }

      card.appendChild(bloco)
    })

    container.appendChild(card)
  })
}

document.querySelectorAll('[data-aba]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-aba]').forEach((b) => b.classList.remove('active'))
    btn.classList.add('active')

    const aba = btn.dataset.aba
    document.getElementById('aba-estoque').style.display = aba === 'estoque' ? 'block' : 'none'
    document.getElementById('aba-estoque-geral').style.display = aba === 'estoque-geral' ? 'block' : 'none'
    document.getElementById('aba-recebimentos').style.display = aba === 'recebimentos' ? 'block' : 'none'
    document.getElementById('aba-rendimentos').style.display = aba === 'rendimentos' ? 'block' : 'none'

    if (aba === 'estoque-geral') carregarEstoqueGeral()
    if (aba === 'recebimentos') carregarRecebimentos()
    if (aba === 'rendimentos') iniciarReferencia(document.getElementById('conteudo-referencia-wrapper-almox'))
  })
})

async function iniciar() {
  const perfil = exigirPapel(['admin', 'almoxarifado', 'convidado'])
  if (!perfil) return
  montarCabecalho(perfil.papel)
  window._convidado = perfil.papel === 'convidado'
  carregarPedidos()
}

iniciar()
// =============================================
// ESTOQUE GERAL (entradas B2 + vínculos PI)
// =============================================

async function carregarEstoqueGeral() {
  const container = document.getElementById('conteudo-estoque-geral')
  container.innerHTML = '<p class="text-muted">Carregando...</p>'

  const [saldo, pis, vinculos] = await Promise.all([
    api.estoque.saldo(),
    api.pedidos.listar(),
    api.estoque.vinculos()
  ])

  if (!saldo) { container.innerHTML = '<p class="text-danger">Erro ao carregar.</p>'; return }

  container.innerHTML = ''

  // --- Saldo disponível ---
  const cardSaldo = document.createElement('div')
  cardSaldo.className = 'card border-0 shadow-sm mb-4'
  cardSaldo.innerHTML = `
    <div class="card-body">
      <h5 class="fw-bold mb-3">📊 Saldo Disponível</h5>
      <div class="row g-3">
        <div class="col-4">
          <div class="card-insumo-almox h-100 text-center">
            <h4>Embalagem</h4>
            <div class="fs-4 fw-bold ${saldo.embalagem_kg > 0 ? 'text-success' : 'text-danger'}">${saldo.embalagem_kg} kg</div>
          </div>
        </div>
        <div class="col-4">
          <div class="card-insumo-almox h-100 text-center">
            <h4>Rótulo</h4>
            <div class="fs-4 fw-bold ${saldo.rotulo_kg > 0 ? 'text-success' : 'text-danger'}">${saldo.rotulo_kg} kg</div>
          </div>
        </div>
        <div class="col-4">
          <div class="card-insumo-almox h-100 text-center">
            <h4>Pallets Caixa</h4>
            <div class="fs-4 fw-bold ${saldo.pallet_caixas > 0 ? 'text-success' : 'text-danger'}">${saldo.pallet_caixas}</div>
          </div>
        </div>
      </div>
    </div>
  `
  container.appendChild(cardSaldo)

  if (window._convidado) return

  // --- Vincular ao PI ---
  const cardVincular = document.createElement('div')
  cardVincular.className = 'card border-0 shadow-sm mb-4'
  cardVincular.innerHTML = `
    <div class="card-body">
      <h5 class="fw-bold mb-3">🔗 Vincular Estoque a uma PI</h5>
      <div class="mb-3">
        <label class="form-label fw-semibold small">PI</label>
        <select id="select-pi-vinculo" class="form-select">
          <option value="">Selecione a PI</option>
          ${(pis || []).map((p) => `<option value="${p.id}">PI ${p.numero_pi}${p.cliente ? ' — ' + p.cliente : ''}</option>`).join('')}
        </select>
      </div>
      <div class="row g-3 mb-3">
        <div class="col-12 col-md-4">
          <label class="form-label fw-semibold small">Embalagem (kg)</label>
          <input type="number" id="vinc-embalagem" class="form-control" placeholder="0" min="0" step="any">
        </div>
        <div class="col-12 col-md-4">
          <label class="form-label fw-semibold small">Rótulo (kg)</label>
          <input type="number" id="vinc-rotulo" class="form-control" placeholder="0" min="0" step="any">
        </div>
        <div class="col-12 col-md-4">
          <label class="form-label fw-semibold small">Pallets de caixa</label>
          <input type="number" id="vinc-pallet" class="form-control" placeholder="0" min="0" step="1">
        </div>
      </div>
      <button class="btn btn-pietrobon w-100" id="btn-vincular">🔗 Vincular</button>
    </div>
  `
  container.appendChild(cardVincular)

  document.getElementById('btn-vincular').addEventListener('click', async () => {
    const piId = document.getElementById('select-pi-vinculo').value
    const embalagem = parseFloat(document.getElementById('vinc-embalagem').value) || 0
    const rotulo = parseFloat(document.getElementById('vinc-rotulo').value) || 0
    const pallet = parseInt(document.getElementById('vinc-pallet').value) || 0

    if (!piId) { alert('Selecione uma PI.'); return }
    if (embalagem === 0 && rotulo === 0 && pallet === 0) { alert('Informe ao menos uma quantidade.'); return }

    const btn = document.getElementById('btn-vincular')
    btn.disabled = true
    btn.textContent = 'Salvando...'

    const resultado = await api.estoque.vincular({ pi_id: piId, embalagem_kg: embalagem, rotulo_kg: rotulo, pallet_caixas: pallet })
    if (resultado?.erro) {
      alert(resultado.erro)
      btn.disabled = false
      btn.textContent = '🔗 Vincular'
      return
    }

    document.getElementById('vinc-embalagem').value = ''
    document.getElementById('vinc-rotulo').value = ''
    document.getElementById('vinc-pallet').value = ''
    document.getElementById('select-pi-vinculo').value = ''
    btn.textContent = '✔ Vinculado!'
    btn.style.background = 'var(--green-ok)'
    setTimeout(() => {
      btn.disabled = false
      btn.textContent = '🔗 Vincular'
      btn.style.background = ''
    }, 1800)

    carregarEstoqueGeral()
  })

  // --- Histórico de vínculos ---
  if (vinculos && vinculos.length) {
    const cardHistorico = document.createElement('div')
    cardHistorico.className = 'card border-0 shadow-sm mb-4'
    cardHistorico.innerHTML = `
      <div class="card-body">
        <h5 class="fw-bold mb-3">📋 Vínculos Registrados</h5>
        <div id="lista-vinculos">
        ${vinculos.map((v) => renderVinculo(v, pis)).join('')}
        </div>
      </div>
    `
    container.appendChild(cardHistorico)
    adicionarListenersVinculos(vinculos, pis)
  }
}

function renderVinculo(v, pis) {
  const data = new Date(v.criado_em).toLocaleString('pt-BR')
  const opcoesPI = (pis || []).map((p) =>
    `<option value="${p.id}" ${p.id == v.pi_id ? 'selected' : ''}>PI ${p.numero_pi}${p.cliente ? ' — ' + p.cliente : ''}</option>`
  ).join('')

  return `
    <div class="border rounded-3 p-3 mb-2 bg-light" id="vinculo-${v.id}">
      <div class="d-flex justify-content-between align-items-start flex-wrap gap-1 mb-2">
        <div>
          <span class="badge bg-danger me-1">PI ${v.numero_pi}</span>
          ${v.cliente ? `<span class="badge bg-secondary">${v.cliente}</span>` : ''}
        </div>
        <div class="d-flex gap-1">
          <span class="small text-muted me-2">${data}</span>
          <button class="btn btn-sm btn-outline-primary py-0 px-2" style="font-size:0.75rem;border-radius:8px" onclick="toggleEditarVinculo(${v.id})">✏️ Editar</button>
          <button class="btn btn-sm btn-outline-danger py-0 px-2" style="font-size:0.75rem;border-radius:8px" onclick="deletarVinculo(${v.id})">🗑 Apagar</button>
        </div>
      </div>

      ${v.produto ? `<div class="fw-semibold small mb-1">📦 ${v.produto}</div>` : ''}
      <div class="view-vinculo-${v.id} d-flex gap-2 flex-wrap">
        ${v.embalagem_kg > 0 ? `<span class="badge bg-primary">📦 ${v.embalagem_kg} kg emb.</span>` : ''}
        ${v.rotulo_kg > 0 ? `<span class="badge bg-info text-dark">🏷 ${v.rotulo_kg} kg rót.</span>` : ''}
        ${v.pallet_caixas > 0 ? `<span class="badge bg-secondary">🪵 ${v.pallet_caixas} pallet(s)</span>` : ''}
      </div>

      <div class="edit-vinculo-${v.id}" style="display:none">
        <div class="mb-2">
          <label class="form-label small fw-semibold mb-1">Produto (opcional)</label>
          <input type="text" class="form-control form-control-sm edit-prod-${v.id}" value="${v.produto || ''}" placeholder="Ex: Bala Dura Cola 34x250g">
        </div>
        <div class="mb-2">
          <label class="form-label small fw-semibold mb-1">PI</label>
          <select class="form-select form-select-sm edit-pi-${v.id}">${opcoesPI}</select>
        </div>
        <div class="row g-2 mb-2">
          <div class="col-4">
            <label class="form-label small fw-semibold mb-1">Embalagem (kg)</label>
            <input type="number" class="form-control form-control-sm edit-emb-${v.id}" value="${v.embalagem_kg}" min="0" step="any">
          </div>
          <div class="col-4">
            <label class="form-label small fw-semibold mb-1">Rótulo (kg)</label>
            <input type="number" class="form-control form-control-sm edit-rot-${v.id}" value="${v.rotulo_kg}" min="0" step="any">
          </div>
          <div class="col-4">
            <label class="form-label small fw-semibold mb-1">Pallets</label>
            <input type="number" class="form-control form-control-sm edit-pal-${v.id}" value="${v.pallet_caixas}" min="0" step="1">
          </div>
        </div>
        <button class="btn btn-sm btn-pietrobon w-100" onclick="salvarEdicaoVinculo(${v.id})">💾 Salvar</button>
      </div>
    </div>`
}

function adicionarListenersVinculos(vinculos, pis) {
  window.toggleEditarVinculo = function(id) {
    const view = document.querySelector(`.view-vinculo-${id}`)
    const edit = document.querySelector(`.edit-vinculo-${id}`)
    if (!view || !edit) return
    const editando = edit.style.display !== 'none'
    view.style.display = editando ? 'flex' : 'none'
    edit.style.display = editando ? 'none' : 'block'
  }

  window.deletarVinculo = async function(id) {
    if (!confirm('Apagar este vínculo?')) return
    const resultado = await api.estoque.deletarVinculo(id)
    if (resultado?.erro) { alert('Erro ao apagar.'); return }
    document.getElementById(`vinculo-${id}`)?.remove()
    carregarEstoqueGeral()
  }

  window.salvarEdicaoVinculo = async function(id) {
    const piId = document.querySelector(`.edit-pi-${id}`)?.value
    const embalagem = parseFloat(document.querySelector(`.edit-emb-${id}`)?.value) || 0
    const rotulo = parseFloat(document.querySelector(`.edit-rot-${id}`)?.value) || 0
    const pallet = parseInt(document.querySelector(`.edit-pal-${id}`)?.value) || 0

    if (!piId) { alert('Selecione uma PI.'); return }

    const btn = document.querySelector(`#vinculo-${id} .btn-pietrobon`)
    btn.disabled = true
    btn.textContent = 'Salvando...'

    const produto = document.querySelector(`.edit-prod-${id}`)?.value?.trim() || ''
    const resultado = await api.estoque.editarVinculo(id, { pi_id: piId, produto, embalagem_kg: embalagem, rotulo_kg: rotulo, pallet_caixas: pallet })
    if (resultado?.erro) {
      alert(resultado.erro)
      btn.disabled = false
      btn.textContent = '💾 Salvar'
      return
    }

    carregarEstoqueGeral()
  }
}