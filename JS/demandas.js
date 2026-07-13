import { api } from './api.js'

const statusInfo = {
  pendente: { label: 'Pendente', cor: 'bg-warning text-dark' },
  tem: { label: '✔ Tem', cor: 'bg-success' },
  nao_tem: { label: '✖ Não tem', cor: 'bg-danger' }
}

let _wrap = null
let _podeCriar = false
let _podeResponder = false

function formHtml() {
  return `
    <div class="card border-0 shadow-sm mb-4" id="card-novo-pedido">
      <div class="card-body">
        <h5 class="fw-bold mb-3">📌 Novo Pedido ao Compras</h5>
        <form id="form-pedido-compra">
          <div class="row g-3">
            <div class="col-12 col-md-6">
              <label class="form-label fw-semibold small">O que está faltando *</label>
              <input type="text" id="pc-descricao" class="form-control" placeholder="Ex: Embalagem da Bala Dura 250g" required>
            </div>
            <div class="col-6 col-md-2">
              <label class="form-label fw-semibold small">Quantidade</label>
              <input type="number" id="pc-quantidade" class="form-control" placeholder="0" min="0" step="any">
            </div>
            <div class="col-6 col-md-2">
              <label class="form-label fw-semibold small">Unidade</label>
              <input type="text" id="pc-unidade" class="form-control" placeholder="kg / un / cx">
            </div>
            <div class="col-12 col-md-2">
              <label class="form-label fw-semibold small">PI (opcional)</label>
              <select id="pc-pi" class="form-select"><option value="">—</option></select>
            </div>
          </div>
          <button type="submit" class="btn btn-ok-grande w-100 mt-3" id="pc-btn">✔ Enviar Pedido</button>
        </form>
      </div>
    </div>`
}

async function preencherPis() {
  const select = _wrap.querySelector('#pc-pi')
  if (!select) return
  const pedidos = await api.pedidos.listar()
  if (!Array.isArray(pedidos)) return
  pedidos.forEach((p) => {
    const o = document.createElement('option')
    o.value = p.id
    o.textContent = `PI ${p.numero_pi}${p.cliente ? ' — ' + p.cliente : ''}`
    select.appendChild(o)
  })
}

async function carregar() {
  const cont = _wrap.querySelector('#lista-pedidos-compra')
  if (!cont) return
  const rows = await api.demandas.listar()
  if (!Array.isArray(rows)) { cont.innerHTML = '<p class="text-danger">Erro ao carregar.</p>'; return }
  if (!rows.length) { cont.innerHTML = '<p class="text-muted fst-italic">Nenhum pedido ao compras.</p>'; return }

  cont.innerHTML = rows.map((d) => {
    const st = statusInfo[d.status] || statusInfo.pendente
    return `
      <div class="card border-0 shadow-sm mb-2">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-1">
            <div>
              <div class="fw-bold">${d.descricao}</div>
              <div class="small text-muted">
                ${d.quantidade > 0 ? `${d.quantidade} ${d.unidade || ''}` : ''}
                ${d.numero_pi ? ` · 🔗 PI ${d.numero_pi}` : ''}
                ${d.solicitante ? ` · 🙋 ${d.solicitante}` : ''}
              </div>
            </div>
            <span class="badge ${st.cor}">${st.label}</span>
          </div>
          ${d.respondido_por ? `<div class="small text-muted mb-2">Respondido por ${d.respondido_por}</div>` : ''}
          ${_podeResponder ? `<div class="d-flex gap-2 flex-wrap">
            <button class="btn btn-sm ${d.status === 'tem' ? 'btn-success' : 'btn-outline-success'}" onclick="responderPedidoCompra(${d.id}, 'tem')">✔ Tenho</button>
            <button class="btn btn-sm ${d.status === 'nao_tem' ? 'btn-danger' : 'btn-outline-danger'}" onclick="responderPedidoCompra(${d.id}, 'nao_tem')">✖ Não tenho</button>
          </div>` : ''}
          ${_podeCriar ? `<button class="btn btn-sm btn-outline-secondary mt-2" onclick="excluirPedidoCompra(${d.id})">🗑 Excluir</button>` : ''}
        </div>
      </div>`
  }).join('')
}

async function enviar(e) {
  e.preventDefault()
  const descricao = _wrap.querySelector('#pc-descricao').value.trim()
  if (!descricao) return
  const btn = _wrap.querySelector('#pc-btn')
  btn.disabled = true
  btn.textContent = 'Enviando...'
  const dados = {
    descricao,
    quantidade: _wrap.querySelector('#pc-quantidade').value || 0,
    unidade: _wrap.querySelector('#pc-unidade').value.trim() || null,
    pi_id: _wrap.querySelector('#pc-pi').value || null
  }
  const r = await api.demandas.criar(dados)
  btn.disabled = false
  btn.textContent = '✔ Enviar Pedido'
  if (r?.erro) { alert(r.erro || 'Erro ao enviar.'); return }
  e.target.reset()
  carregar()
}

window.responderPedidoCompra = async function (id, status) {
  const r = await api.demandas.responder(id, status)
  if (r?.erro) { alert(r.erro || 'Erro ao responder.'); return }
  carregar()
}

window.excluirPedidoCompra = async function (id) {
  if (!confirm('Excluir este pedido?')) return
  await api.demandas.excluir(id)
  carregar()
}

export async function iniciarPedidosCompra(wrapper, opts) {
  if (!wrapper) return
  _wrap = wrapper
  _podeCriar = !!(opts && opts.podeCriar)
  _podeResponder = !!(opts && opts.podeResponder)
  wrapper.innerHTML = `${_podeCriar ? formHtml() : ''}<div id="lista-pedidos-compra"><p class="text-muted">Carregando...</p></div>`
  if (_podeCriar) {
    await preencherPis()
    const form = wrapper.querySelector('#form-pedido-compra')
    if (form) form.addEventListener('submit', enviar)
  }
  carregar()
}