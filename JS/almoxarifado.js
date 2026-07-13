import { api } from './api.js'
import { TIPOS_INSUMO, formatarQuantidade } from './constants.js'
import { exigirPapel } from './auth.js'
import { montarCabecalho } from './cabecalho.js'
import { iniciarReferencia } from './referencia.js'
import { seloPrazoDeclaracaoHtml } from './alertas.js'
import { iniciarPedidosCompra } from './demandas.js'

let podeCriarPedido = false
let podeResponderPedido = false

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
          ${seloPrazoDeclaracaoHtml(produto)}
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

  carregarAlertaDeclaracao()

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


async function carregarRecebimentos() {
  const container = document.getElementById('conteudo-recebimentos')
  container.innerHTML = '<p class="text-muted">Carregando...</p>'

  const entradas = await api.estoque.historico()
  if (entradas && entradas.length) {
    const secao = document.createElement('div')
    secao.className = 'mb-4'
    secao.innerHTML = `
      <h6 class="fw-bold text-muted mb-2">📦 Entradas registradas pelo B2</h6>
      ${entradas.map((e) => {
        const data = new Date(e.criado_em).toLocaleString('pt-BR')
        return `
          <div class="border rounded-3 p-3 mb-2 bg-light" id="rec-entrada-${e.id}">
            <div class="d-flex justify-content-between align-items-start mb-1 flex-wrap gap-1">
              <span class="small text-muted">${data}</span>
              ${!window._convidado ? `<button class="btn btn-sm btn-outline-primary py-0 px-2" style="font-size:0.75rem;border-radius:8px" onclick="editarProdutoEntrada(${e.id}, '${(e.produto || '').replace(/'/g, "\'")}')">✏️ ${e.produto ? 'Editar produto' : 'Adicionar produto'}</button>` : ''}
            </div>
            <div id="rec-produto-label-${e.id}" class="${e.produto ? 'fw-semibold small mb-1' : 'text-muted small fst-italic mb-1'}">${e.produto || 'Produto não informado'}</div>
            <div id="rec-produto-form-${e.id}" style="display:none" class="mb-2">
              <div class="d-flex gap-2">
                <input type="text" id="rec-produto-input-${e.id}" class="form-control form-control-sm" value="${e.produto || ''}" placeholder="Nome do produto">
                <button class="btn btn-sm btn-pietrobon px-3" onclick="salvarProdutoEntrada(${e.id})">✔</button>
                <button class="btn btn-sm btn-outline-secondary px-3" onclick="cancelarProdutoEntrada(${e.id})">✕</button>
              </div>
            </div>
            <div class="d-flex justify-content-between align-items-center gap-2 mb-1 flex-wrap">
              <div id="rec-local-label-${e.id}" class="${e.localizacao ? 'small' : 'text-muted small fst-italic'}">📍 ${e.localizacao || 'Localização não informada'}</div>
              ${!window._convidado ? `<button class="btn btn-sm btn-outline-primary py-0 px-2" style="font-size:0.75rem;border-radius:8px" onclick="editarLocalizacaoEntrada(${e.id})">📍 ${e.localizacao ? 'Editar local' : 'Adicionar local'}</button>` : ''}
            </div>
            <div id="rec-local-form-${e.id}" style="display:none" class="mb-2">
              <div class="d-flex gap-2">
                <input type="text" id="rec-local-input-${e.id}" class="form-control form-control-sm" value="${e.localizacao || ''}" placeholder="Ex: Galpão 2, prateleira A3">
                <button class="btn btn-sm btn-pietrobon px-3" onclick="salvarLocalizacaoEntrada(${e.id})">✔</button>
                <button class="btn btn-sm btn-outline-secondary px-3" onclick="cancelarLocalizacaoEntrada(${e.id})">✕</button>
              </div>
            </div>
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

    window.editarProdutoEntrada = function(id, produtoAtual) {
      document.getElementById(`rec-produto-label-${id}`).style.display = 'none'
      document.getElementById(`rec-produto-form-${id}`).style.display = 'block'
      const input = document.getElementById(`rec-produto-input-${id}`)
      input.focus()
      input.select()
    }

    window.cancelarProdutoEntrada = function(id) {
      document.getElementById(`rec-produto-label-${id}`).style.display = ''
      document.getElementById(`rec-produto-form-${id}`).style.display = 'none'
    }

    window.salvarProdutoEntrada = async function(id) {
      const input = document.getElementById(`rec-produto-input-${id}`)
      const valor = input.value.trim()
      const btn = input.nextElementSibling
      btn.disabled = true
      btn.textContent = '...'

      const resultado = await api.estoque.editarProdutoEntrada(id, valor)
      if (resultado?.erro) {
        alert('Erro ao salvar.')
        btn.disabled = false
        btn.textContent = '✔'
        return
      }

      const label = document.getElementById(`rec-produto-label-${id}`)
      label.textContent = valor || 'Produto não informado'
      label.className = valor ? 'fw-semibold small mb-1' : 'text-muted small fst-italic mb-1'
      cancelarProdutoEntrada(id)

      const btnEditar = document.querySelector(`#rec-entrada-${id} .btn-outline-primary`)
      if (btnEditar) btnEditar.textContent = valor ? '✏️ Editar produto' : '✏️ Adicionar produto'
    }

    window.editarLocalizacaoEntrada = function(id) {
      document.getElementById(`rec-local-label-${id}`).parentElement.style.display = 'none'
      document.getElementById(`rec-local-form-${id}`).style.display = 'block'
      const input = document.getElementById(`rec-local-input-${id}`)
      input.focus()
      input.select()
    }

    window.cancelarLocalizacaoEntrada = function(id) {
      document.getElementById(`rec-local-label-${id}`).parentElement.style.display = ''
      document.getElementById(`rec-local-form-${id}`).style.display = 'none'
    }

    window.salvarLocalizacaoEntrada = async function(id) {
      const input = document.getElementById(`rec-local-input-${id}`)
      const valor = input.value.trim()
      const btn = input.nextElementSibling
      btn.disabled = true
      btn.textContent = '...'

      const resultado = await api.estoque.editarLocalizacaoEntrada(id, valor)
      if (resultado?.erro) {
        alert('Erro ao salvar.')
        btn.disabled = false
        btn.textContent = '✔'
        return
      }

      const label = document.getElementById(`rec-local-label-${id}`)
      label.textContent = `📍 ${valor || 'Localização não informada'}`
      label.className = valor ? 'small' : 'text-muted small fst-italic'
      cancelarLocalizacaoEntrada(id)

      const btnEditar = document.querySelector(`#rec-local-form-${id}`).previousElementSibling.querySelector('.btn-outline-primary')
      if (btnEditar) btnEditar.textContent = valor ? '📍 Editar local' : '📍 Adicionar local'
    }
  }
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
    document.getElementById('aba-pedidos').style.display = aba === 'pedidos' ? 'block' : 'none'

    if (aba === 'estoque-geral') carregarEstoqueGeral()
    if (aba === 'recebimentos') carregarRecebimentos()
    if (aba === 'rendimentos') iniciarReferencia(document.getElementById('conteudo-referencia-wrapper-almox'))
    if (aba === 'pedidos') iniciarPedidosCompra(document.getElementById('wrap-pedidos-compra-almox'), { podeCriar: podeCriarPedido, podeResponder: podeResponderPedido })
  })
})

async function carregarAlertaDeclaracao() {
  const container = document.getElementById('alerta-declaracao-almox')
  if (!container) return
  const rows = await api.alertas.declaracaoPendente()
  if (!Array.isArray(rows) || !rows.length) { container.innerHTML = ''; return }

  const porPi = {}
  rows.forEach((r) => {
    if (!porPi[r.numero_pi]) porPi[r.numero_pi] = { cliente: r.cliente, produtos: [] }
    const horas = Math.floor((Date.now() - new Date(r.criado_em).getTime()) / 3600000)
    porPi[r.numero_pi].produtos.push(`${r.produto} (há ${horas}h)`)
  })

  const blocos = Object.entries(porPi).map(([numeroPi, info]) => `
    <div class="mb-1">
      <span class="fw-bold">PI ${numeroPi}</span>${info.cliente ? ` — ${info.cliente}` : ''}:
      <span style="opacity:.95">${info.produtos.join(', ')}</span>
    </div>`).join('')

  container.innerHTML = `
    <div class="resumo-alerta-declaracao-topo">
      <div style="font-size:1.1rem;margin-bottom:8px">⏰ ${rows.length} PRODUTO(S) SEM ESTOQUE DECLARADO (48h+)</div>
      <div style="font-weight:600;opacity:.95;margin-bottom:8px">Declare o estoque destes produtos na aba "Estoque PI":</div>
      ${blocos}
    </div>`
}

async function iniciar() {
  const perfil = exigirPapel('todos')
  if (!perfil) return
  montarCabecalho(perfil.papel)
  window._convidado = !['admin', 'almoxarifado'].includes(perfil.papel)
  podeCriarPedido = ['admin', 'almoxarifado'].includes(perfil.papel)
  podeResponderPedido = ['admin', 'compras'].includes(perfil.papel)
  carregarPedidos()
  carregarAlertaDeclaracao()
  setInterval(carregarAlertaDeclaracao, 5 * 60 * 1000)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') carregarAlertaDeclaracao()
  })
}

iniciar()

async function carregarEstoqueGeral() {
  const container = document.getElementById('conteudo-estoque-geral')
  container.innerHTML = '<p class="text-muted">Carregando...</p>'

  const [entradas, vinculos, pis] = await Promise.all([
    api.estoque.historico(),
    api.estoque.vinculos(),
    api.pedidos.listar()
  ])

  if (!entradas) { container.innerHTML = '<p class="text-danger">Erro ao carregar.</p>'; return }
  container.innerHTML = ''

  if (!entradas.length) {
    container.innerHTML = '<p class="text-muted fst-italic">Nenhuma entrada registrada pelo B2.</p>'
    return
  }

  entradas.forEach((e) => {
    const vincsEntrada = (vinculos || []).filter((v) => v.entrada_id === e.id)
    e.vinculado_emb = vincsEntrada.reduce((s, v) => s + parseFloat(v.embalagem_kg || 0), 0)
    e.vinculado_rot = vincsEntrada.reduce((s, v) => s + parseFloat(v.rotulo_kg || 0), 0)
    e.vinculado_pal = vincsEntrada.reduce((s, v) => s + parseInt(v.pallet_caixas || 0), 0)
    e.saldo_emb = Math.max(0, parseFloat(e.embalagem_kg) - e.vinculado_emb)
    e.saldo_rot = Math.max(0, parseFloat(e.rotulo_kg) - e.vinculado_rot)
    e.saldo_pal = Math.max(0, parseInt(e.pallet_caixas) - e.vinculado_pal)
    e._vinculos = vincsEntrada
  })

  entradas.forEach((e) => {
    const data = new Date(e.criado_em).toLocaleString('pt-BR')
    const totalVinculado = e.vinculado_emb + e.vinculado_rot + e.vinculado_pal
    const totalEntrada = parseFloat(e.embalagem_kg) + parseFloat(e.rotulo_kg) + parseInt(e.pallet_caixas)
    const totDisp = e.saldo_emb + e.saldo_rot + e.saldo_pal
    const statusCor = totDisp === 0 ? 'border-success' : totalVinculado > 0 ? 'border-warning' : 'border-secondary'

    const card = document.createElement('div')
    card.className = `card border-2 ${statusCor} mb-3`
    card.id = `entrada-card-${e.id}`

    const vincsHtml = e._vinculos.length ? `
      <div class="mt-2 pt-2 border-top">
        <div class="small fw-semibold text-muted mb-1">Vínculos:</div>
        ${e._vinculos.map((v) => `
          <div class="d-flex justify-content-between align-items-center flex-wrap gap-1 mb-1" id="vinculo-${v.id}">
            <div class="d-flex gap-1 flex-wrap align-items-center">
              <span class="badge bg-danger">PI ${v.numero_pi}</span>
              ${v.cliente ? `<span class="badge bg-secondary">${v.cliente}</span>` : ''}
              ${v.embalagem_kg > 0 ? `<span class="badge bg-primary">📦 ${v.embalagem_kg} kg</span>` : ''}
              ${v.rotulo_kg > 0 ? `<span class="badge bg-info text-dark">🏷 ${v.rotulo_kg} kg</span>` : ''}
              ${v.pallet_caixas > 0 ? `<span class="badge bg-secondary">🪵 ${v.pallet_caixas} pallet(s)</span>` : ''}
            </div>
            ${!window._convidado ? `
              <div class="d-flex gap-1">
                <button class="btn btn-sm btn-outline-primary py-0 px-2" style="font-size:0.75rem;border-radius:8px" onclick="toggleEditarVinculo(${v.id}, ${e.id})">✏️</button>
                <button class="btn btn-sm btn-outline-danger py-0 px-2" style="font-size:0.75rem;border-radius:8px" onclick="deletarVinculo(${v.id})">🗑</button>
              </div>` : ''}
          </div>
          <div class="edit-vinculo-${v.id} mb-2" style="display:none">
            <div class="row g-2 mb-2">
              <div class="col-12">
                <select class="form-select form-select-sm edit-pi-${v.id}">
                  ${(pis || []).map((p) => `<option value="${p.id}" ${p.id == v.pi_id ? 'selected' : ''}>PI ${p.numero_pi}${p.cliente ? ' — ' + p.cliente : ''}</option>`).join('')}
                </select>
              </div>
              ${e.embalagem_kg > 0 ? `<div class="col-4"><label class="form-label small mb-0">Emb. (kg)</label><input type="number" class="form-control form-control-sm edit-emb-${v.id}" value="${v.embalagem_kg}" min="0" step="any"></div>` : ''}
              ${e.rotulo_kg > 0 ? `<div class="col-4"><label class="form-label small mb-0">Rót. (kg)</label><input type="number" class="form-control form-control-sm edit-rot-${v.id}" value="${v.rotulo_kg}" min="0" step="any"></div>` : ''}
              ${e.pallet_caixas > 0 ? `<div class="col-4"><label class="form-label small mb-0">Pallets</label><input type="number" class="form-control form-control-sm edit-pal-${v.id}" value="${v.pallet_caixas}" min="0" step="1"></div>` : ''}
            </div>
            <button class="btn btn-sm btn-pietrobon w-100" onclick="salvarEdicaoVinculo(${v.id})">💾 Salvar</button>
          </div>`
        ).join('')}
      </div>` : ''

    card.innerHTML = `
      <div class="card-body pb-2">
        <div class="d-flex justify-content-between align-items-start mb-2 flex-wrap gap-1">
          <div>
            ${e.produto ? `<div class="fw-bold mb-1">📦 ${e.produto}</div>` : ''}
            ${e.localizacao ? `<div class="small mb-1">📍 <span class="fw-semibold">${e.localizacao}</span></div>` : ''}
            <div class="small text-muted">${data}</div>
          </div>
          <span class="badge ${totDisp === 0 ? 'bg-success' : totalVinculado > 0 ? 'bg-warning text-dark' : 'bg-secondary'}">
            ${totDisp === 0 ? '✔ Totalmente vinculado' : totalVinculado > 0 ? '⚠ Parcialmente vinculado' : '○ Não vinculado'}
          </span>
        </div>

        <div class="row g-2 mb-2">
          ${e.embalagem_kg > 0 ? `
            <div class="col-auto">
              <div class="card-insumo-almox px-3 py-2 text-center">
                <div class="small text-muted">Embalagem</div>
                <div class="fw-bold">${e.embalagem_kg} kg</div>
                ${e.saldo_emb < parseFloat(e.embalagem_kg) ? `<div class="small ${e.saldo_emb === 0 ? 'text-success' : 'text-warning fw-semibold'}">Saldo: ${e.saldo_emb} kg</div>` : ''}
              </div>
            </div>` : ''}
          ${e.rotulo_kg > 0 ? `
            <div class="col-auto">
              <div class="card-insumo-almox px-3 py-2 text-center">
                <div class="small text-muted">Rótulo</div>
                <div class="fw-bold">${e.rotulo_kg} kg</div>
                ${e.saldo_rot < parseFloat(e.rotulo_kg) ? `<div class="small ${e.saldo_rot === 0 ? 'text-success' : 'text-warning fw-semibold'}">Saldo: ${e.saldo_rot} kg</div>` : ''}
              </div>
            </div>` : ''}
          ${e.pallet_caixas > 0 ? `
            <div class="col-auto">
              <div class="card-insumo-almox px-3 py-2 text-center">
                <div class="small text-muted">Pallets</div>
                <div class="fw-bold">${e.pallet_caixas}</div>
                ${e.saldo_pal < parseInt(e.pallet_caixas) ? `<div class="small ${e.saldo_pal === 0 ? 'text-success' : 'text-warning fw-semibold'}">Saldo: ${e.saldo_pal}</div>` : ''}
              </div>
            </div>` : ''}
        </div>

        ${vincsHtml}

        ${!window._convidado && totDisp > 0 ? `
          <button class="btn btn-sm btn-outline-danger mt-2 w-100" style="border-radius:10px" onclick="toggleFormVincular(${e.id})">
            🔗 Vincular a uma PI
          </button>
          <div id="form-vincular-${e.id}" style="display:none" class="mt-2 border rounded-3 p-3 bg-light">
            <div class="mb-2">
              <label class="form-label small fw-semibold mb-1">PI</label>
              <select id="vinc-pi-${e.id}" class="form-select form-select-sm">
                <option value="">Selecione</option>
                ${(pis || []).map((p) => `<option value="${p.id}">PI ${p.numero_pi}${p.cliente ? ' — ' + p.cliente : ''}</option>`).join('')}
              </select>
            </div>
            <div class="row g-2 mb-2">
              ${e.saldo_emb > 0 ? `<div class="col-4"><label class="form-label small mb-0">Emb. (kg) <span class="text-muted">máx ${e.saldo_emb}</span></label><input type="number" id="vinc-emb-${e.id}" class="form-control form-control-sm" placeholder="0" min="0" max="${e.saldo_emb}" step="any"></div>` : ''}
              ${e.saldo_rot > 0 ? `<div class="col-4"><label class="form-label small mb-0">Rót. (kg) <span class="text-muted">máx ${e.saldo_rot}</span></label><input type="number" id="vinc-rot-${e.id}" class="form-control form-control-sm" placeholder="0" min="0" max="${e.saldo_rot}" step="any"></div>` : ''}
              ${e.saldo_pal > 0 ? `<div class="col-4"><label class="form-label small mb-0">Pallets <span class="text-muted">máx ${e.saldo_pal}</span></label><input type="number" id="vinc-pal-${e.id}" class="form-control form-control-sm" placeholder="0" min="0" max="${e.saldo_pal}" step="1"></div>` : ''}
            </div>
            <button class="btn btn-pietrobon btn-sm w-100" onclick="confirmarVinculo(${e.id})">✔ Confirmar Vínculo</button>
          </div>` : ''}
      </div>
    `
    container.appendChild(card)
  })

  window.toggleFormVincular = function(entradaId) {
    const form = document.getElementById(`form-vincular-${entradaId}`)
    if (!form) return
    form.style.display = form.style.display === 'none' ? 'block' : 'none'
  }

  window.confirmarVinculo = async function(entradaId) {
    const piId = document.getElementById(`vinc-pi-${entradaId}`)?.value
    const embalagem = parseFloat(document.getElementById(`vinc-emb-${entradaId}`)?.value) || 0
    const rotulo = parseFloat(document.getElementById(`vinc-rot-${entradaId}`)?.value) || 0
    const pallet = parseInt(document.getElementById(`vinc-pal-${entradaId}`)?.value) || 0

    if (!piId) { alert('Selecione uma PI.'); return }
    if (embalagem === 0 && rotulo === 0 && pallet === 0) { alert('Informe ao menos uma quantidade.'); return }

    const btn = document.querySelector(`#form-vincular-${entradaId} .btn-pietrobon`)
    btn.disabled = true
    btn.textContent = 'Salvando...'

    const resultado = await api.estoque.vincular({ entrada_id: entradaId, pi_id: piId, embalagem_kg: embalagem, rotulo_kg: rotulo, pallet_caixas: pallet })
    if (resultado?.erro) {
      alert(resultado.erro)
      btn.disabled = false
      btn.textContent = '✔ Confirmar Vínculo'
      return
    }
    carregarEstoqueGeral()
  }

  window.toggleEditarVinculo = function(id) {
    const edit = document.querySelector(`.edit-vinculo-${id}`)
    if (!edit) return
    edit.style.display = edit.style.display === 'none' ? 'block' : 'none'
  }

  window.deletarVinculo = async function(id) {
    if (!confirm('Apagar este vínculo?')) return
    const resultado = await api.estoque.deletarVinculo(id)
    if (resultado?.erro) { alert('Erro ao apagar.'); return }
    carregarEstoqueGeral()
  }

  window.salvarEdicaoVinculo = async function(id) {
    const piId = document.querySelector(`.edit-pi-${id}`)?.value
    const embalagem = parseFloat(document.querySelector(`.edit-emb-${id}`)?.value) || 0
    const rotulo = parseFloat(document.querySelector(`.edit-rot-${id}`)?.value) || 0
    const pallet = parseInt(document.querySelector(`.edit-pal-${id}`)?.value) || 0

    if (!piId) { alert('Selecione uma PI.'); return }

    const btn = document.querySelector(`.edit-vinculo-${id} .btn-pietrobon`)
    btn.disabled = true
    btn.textContent = 'Salvando...'

    const resultado = await api.estoque.editarVinculo(id, { pi_id: piId, embalagem_kg: embalagem, rotulo_kg: rotulo, pallet_caixas: pallet })
    if (resultado?.erro) {
      alert(resultado.erro)
      btn.disabled = false
      btn.textContent = '💾 Salvar'
      return
    }
    carregarEstoqueGeral()
  }
}