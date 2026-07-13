import { api } from './api.js'
import { exigirPapel } from './auth.js'
import { montarCabecalho } from './cabecalho.js'
import { iniciarPedidosCompra } from './demandas.js'

const tipoLabel = { embalagem: 'Embalagem', rotulo: 'Rótulo', caixa: 'Caixa', etiqueta: 'Etiqueta', outro: 'Outro' }
const statusLabel = { pendente: 'Pendente', comprado: 'Comprado', em_transito: 'Em trânsito', recebido: 'Recebido' }
const statusCor = { pendente: 'bg-secondary', comprado: 'bg-primary', em_transito: 'bg-warning text-dark', recebido: 'bg-success' }
let podeComprar = false
let podeCriarDemanda = false

function dataInput(v) { return v ? String(v).slice(0, 10) : '' }
function dataBR(v) { return v ? new Date(dataInput(v) + 'T00:00:00').toLocaleDateString('pt-BR') : '—' }
function hojeMeiaNoite() { const d = new Date(); d.setHours(0, 0, 0, 0); return d }

function diasAtraso(compra) {
  if (compra.status === 'recebido' || !compra.data_prevista) return null
  const prev = new Date(dataInput(compra.data_prevista) + 'T00:00:00')
  const d = Math.floor((hojeMeiaNoite() - prev) / 86400000)
  return d > 0 ? d : null
}

// ---- Lista de compras ----
async function carregarCompras() {
  const container = document.getElementById('lista-compras')
  const compras = await api.compras.listar()
  if (!Array.isArray(compras)) { container.innerHTML = '<p class="text-danger">Erro ao carregar.</p>'; return }

  const ocultarRecebidas = document.getElementById('toggle-ocultar-recebidas').checked
  const lista = ocultarRecebidas ? compras.filter((c) => c.status !== 'recebido') : compras

  if (!lista.length) {
    container.innerHTML = '<p class="text-muted fst-italic">Nenhuma compra registrada.</p>'
    return
  }

  container.innerHTML = lista.map((c) => {
    const atraso = diasAtraso(c)
    const alerta = atraso ? ' card-alerta-embarque' : ''
    const opcoesStatus = Object.keys(statusLabel).map((s) => `<option value="${s}" ${c.status === s ? 'selected' : ''}>${statusLabel[s]}</option>`).join('')
    return `
      <div class="card border-0 shadow-sm mb-2${alerta}" id="compra-${c.id}">
        ${atraso ? `<div class="banner-alerta-embarque">🚨 ENTREGA ATRASADA ${atraso} DIA(S)</div>` : ''}
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-1">
            <div>
              <div class="fw-bold">${c.descricao}</div>
              <div class="small text-muted">
                ${c.quantidade > 0 ? `${c.quantidade} ${c.unidade || ''}` : ''}
                ${c.fornecedor ? ` · 🏭 ${c.fornecedor}` : ''}
              </div>
            </div>
            <span class="badge ${statusCor[c.status] || 'bg-secondary'}">${statusLabel[c.status] || c.status}</span>
          </div>
          <div class="small text-muted mb-2">
            🛒 Compra: ${dataBR(c.data_compra)} · 🚚 Chegada prevista: <span class="${atraso ? 'text-danger fw-bold' : 'fw-semibold'}">${dataBR(c.data_prevista)}</span>
          </div>
          ${podeComprar ? `<div class="d-flex gap-2 flex-wrap align-items-center">
            <select class="form-select form-select-sm" style="max-width:160px" onchange="mudarStatusCompra(${c.id}, this.value)">${opcoesStatus}</select>
            ${c.status !== 'recebido' ? `<button class="btn btn-sm btn-pietrobon" onclick="receberCompra(${c.id})">✅ Recebida</button>` : ''}
            <button class="btn btn-sm btn-outline-danger" onclick="excluirCompra(${c.id})">🗑 Excluir</button>
          </div>` : ''}
        </div>
      </div>`
  }).join('')
}

window.mudarStatusCompra = async function (id, status) {
  if (status === 'recebido') { receberCompra(id); return }
  await api.compras.editar(id, { status })
  carregarCompras()
}

window.receberCompra = async function (id) {
  if (!confirm('Marcar como recebida? O depósito será notificado para lançar no estoque B2.')) return
  const r = await api.compras.receber(id)
  if (r?.erro) { alert('Erro ao marcar recebida.'); return }
  carregarCompras()
}

window.excluirCompra = async function (id) {
  if (!confirm('Excluir esta compra?')) return
  await api.compras.excluir(id)
  carregarCompras()
}

// ---- Sugestões (o que comprar) ----
async function carregarSugestoes() {
  const container = document.getElementById('conteudo-sugestoes')
  const rows = await api.compras.sugestoes()
  if (!Array.isArray(rows)) { container.innerHTML = '<p class="text-danger">Erro ao carregar.</p>'; return }
  if (!rows.length) {
    container.innerHTML = '<div class="card border-0 shadow-sm"><div class="card-body text-success fw-semibold">✅ Nenhum insumo pendente nas PIs abertas.</div></div>'
    return
  }

  const porPi = {}
  rows.forEach((r) => {
    if (!porPi[r.numero_pi]) porPi[r.numero_pi] = { cliente: r.cliente, data_embarque: r.data_embarque, itens: [] }
    porPi[r.numero_pi].itens.push(r)
  })

  container.innerHTML = `
    <div class="alert alert-warning fw-semibold">💡 Insumos em falta nas PIs abertas — sugestão do que precisa ser comprado.</div>
    ${Object.entries(porPi).map(([numeroPi, info]) => `
      <div class="card border-0 shadow-sm mb-2">
        <div class="card-body">
          <div class="fw-bold mb-1">PI ${numeroPi}${info.cliente ? ` — ${info.cliente}` : ''}
            ${info.data_embarque ? `<span class="small text-muted">· 🚢 ${dataBR(info.data_embarque)}</span>` : ''}
          </div>
          ${info.itens.map((i) => `
            <div class="small d-flex justify-content-between border-bottom py-1">
              <span>${i.produto} <span class="badge bg-light text-dark border">${tipoLabel[i.insumo_tipo] || i.insumo_tipo}</span></span>
              <span class="text-danger fw-semibold">${i.insumo_tipo === 'etiqueta' ? `${i.sobra} un (baixo)` : 'em falta'}</span>
            </div>`).join('')}
        </div>
      </div>`).join('')}`
}

// ---- Entradas do B2 ----
async function carregarEntradasB2() {
  const container = document.getElementById('conteudo-entradas')
  const entradas = await api.estoque.historico()
  if (!Array.isArray(entradas)) { container.innerHTML = '<p class="text-danger">Erro ao carregar.</p>'; return }
  if (!entradas.length) {
    container.innerHTML = '<p class="text-muted fst-italic">Nenhuma entrada registrada pelo B2.</p>'
    return
  }

  container.innerHTML = `
    <div class="alert alert-info fw-semibold">📦 Entradas registradas pelo depósito B2.</div>
    ${entradas.map((e) => {
      const data = new Date(e.criado_em).toLocaleString('pt-BR')
      return `
        <div class="card border-0 shadow-sm mb-2">
          <div class="card-body">
            <div class="d-flex justify-content-between flex-wrap gap-1 mb-1">
              <span class="${e.produto ? 'fw-semibold' : 'text-muted fst-italic'}">${e.produto || 'Produto não informado'}</span>
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
          </div>
        </div>`
    }).join('')}`
}

document.getElementById('form-compra').addEventListener('submit', async (e) => {
  e.preventDefault()
  const descricao = document.getElementById('c-descricao').value.trim()
  if (!descricao) return
  const btn = document.getElementById('btn-salvar-compra')
  btn.disabled = true
  btn.textContent = 'Salvando...'

  const dados = {
    descricao,
    quantidade: document.getElementById('c-quantidade').value || 0,
    unidade: document.getElementById('c-unidade').value.trim() || null,
    fornecedor: document.getElementById('c-fornecedor').value.trim() || null,
    data_compra: document.getElementById('c-data-compra').value || null,
    data_prevista: document.getElementById('c-data-prevista').value || null,
    status: 'comprado'
  }

  const r = await api.compras.criar(dados)
  btn.disabled = false
  btn.textContent = '✔ Registrar Compra'
  if (r?.erro) { alert(r.erro || 'Erro ao registrar compra.'); return }

  e.target.reset()
  carregarCompras()
})

document.getElementById('toggle-ocultar-recebidas').addEventListener('change', carregarCompras)

document.querySelectorAll('[data-aba-compra]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-aba-compra]').forEach((b) => b.classList.remove('active'))
    btn.classList.add('active')
    const aba = btn.dataset.abaCompra
    document.getElementById('aba-registro').style.display = aba === 'registro' ? 'block' : 'none'
    document.getElementById('aba-demandas').style.display = aba === 'demandas' ? 'block' : 'none'
    document.getElementById('aba-sugestoes').style.display = aba === 'sugestoes' ? 'block' : 'none'
    document.getElementById('aba-entradas').style.display = aba === 'entradas' ? 'block' : 'none'
    if (aba === 'demandas') iniciarPedidosCompra(document.getElementById('wrap-pedidos-compra'), { podeCriar: podeCriarDemanda, podeResponder: podeComprar })
    if (aba === 'sugestoes') carregarSugestoes()
    if (aba === 'entradas') carregarEntradasB2()
  })
})

async function iniciar() {
  const perfil = exigirPapel('todos')
  if (!perfil) return
  podeComprar = ['admin', 'compras'].includes(perfil.papel)
  podeCriarDemanda = ['admin', 'almoxarifado'].includes(perfil.papel)
  montarCabecalho(perfil.papel)
  if (!podeComprar) {
    const formCard = document.getElementById('form-compra').closest('.card')
    if (formCard) formCard.style.display = 'none'
  }
  carregarCompras()
}

iniciar()