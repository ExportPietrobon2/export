import { api } from './api.js'
import { exigirPapel } from './auth.js'
import { montarCabecalho } from './cabecalho.js'

const containerCards = document.getElementById('cards-recebimento')
const mensagemVazio = document.getElementById('mensagem-vazio')

async function carregarHistorico() {
  const entradas = await api.estoque.historico()
  if (!entradas) return

  const container = document.getElementById('historico-entradas')
  if (!container) return

  if (!entradas.length) {
    container.innerHTML = '<p class="text-muted fst-italic small">Nenhuma entrada registrada ainda.</p>'
    return
  }

  container.innerHTML = entradas.map((e) => {
    const data = new Date(e.criado_em).toLocaleString('pt-BR')
    return `
      <div class="border rounded-3 p-3 mb-2 bg-light" id="entrada-${e.id}">
        <div class="d-flex justify-content-between align-items-start mb-1">
          <div class="small text-muted">${data}</div>
          ${!window._convidado ? `<button class="btn btn-sm btn-outline-danger py-0 px-2" style="font-size:0.75rem;border-radius:8px" onclick="deletarEntrada(${e.id})">🗑 Apagar</button>` : ''}
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
  }).join('')
}

window.deletarEntrada = async function(id) {
  if (!confirm('Apagar esta entrada?')) return
  const resultado = await api.estoque.deletarEntrada(id)
  if (resultado?.erro) { alert('Erro ao apagar.'); return }
  document.getElementById(`entrada-${id}`)?.remove()
}

function criarFormEntrada() {
  const form = document.createElement('div')
  form.className = 'card border-0 shadow-sm mb-4'
  form.innerHTML = `
    <div class="card-body">
      <h5 class="fw-bold mb-3">📥 Registrar Entrada</h5>

      <div class="mb-3">
        <label class="form-label fw-semibold small">Produto (opcional)</label>
        <input type="text" id="inp-produto" class="form-control" placeholder="Ex: Bala Dura Cola 34x250g">
      </div>

      <div class="row g-3 mb-3">
        <div class="col-12 col-md-4">
          <label class="form-label fw-semibold small">Embalagem (kg)</label>
          <input type="number" id="inp-embalagem" class="form-control" placeholder="0" min="0" step="any">
        </div>
        <div class="col-12 col-md-4">
          <label class="form-label fw-semibold small">Rótulo (kg)</label>
          <input type="number" id="inp-rotulo" class="form-control" placeholder="0" min="0" step="any">
        </div>
        <div class="col-12 col-md-4">
          <label class="form-label fw-semibold small">Pallet de caixas</label>
          <input type="number" id="inp-pallet" class="form-control" placeholder="0" min="0" step="1">
        </div>
      </div>

      <div class="d-flex gap-2 mb-3 flex-wrap">
        <button class="btn btn-sm btn-outline-secondary btn-foto" id="btn-foto-produto">📦 Foto produto</button>
        <button class="btn btn-sm btn-outline-secondary btn-foto" id="btn-foto-nota">🧾 Foto nota</button>
      </div>

      <div class="d-flex gap-3 mb-3" id="area-remover-fotos"></div>
      <div class="d-flex gap-2 flex-wrap mb-3" id="previews-fotos"></div>

      <input type="file" id="input-foto-produto" accept="image/*" capture="environment" hidden>
      <input type="file" id="input-foto-nota" accept="image/*" capture="environment" hidden>

      <button class="btn btn-ok-grande w-100" id="btn-confirmar-entrada">✔ Confirmar Entrada</button>
    </div>
  `
  return form
}

function iniciarForm() {
  const form = criarFormEntrada()
  containerCards.appendChild(form)

  const inpProduto = document.getElementById('inp-produto')
  const inpEmbalagem = document.getElementById('inp-embalagem')
  const inpRotulo = document.getElementById('inp-rotulo')
  const inpPallet = document.getElementById('inp-pallet')
  const inputFotoProduto = document.getElementById('input-foto-produto')
  const inputFotoNota = document.getElementById('input-foto-nota')
  const btnFotoProduto = document.getElementById('btn-foto-produto')
  const btnFotoNota = document.getElementById('btn-foto-nota')
  const previews = document.getElementById('previews-fotos')
  const areaRemover = document.getElementById('area-remover-fotos')

  btnFotoProduto.addEventListener('click', () => inputFotoProduto.click())
  btnFotoNota.addEventListener('click', () => inputFotoNota.click())

  inputFotoProduto.addEventListener('change', () => {
    const f = inputFotoProduto.files[0]
    if (!f) return
    atualizarPreview('produto', f, previews, areaRemover, btnFotoProduto, inputFotoProduto)
  })

  inputFotoNota.addEventListener('change', () => {
    const f = inputFotoNota.files[0]
    if (!f) return
    atualizarPreview('nota', f, previews, areaRemover, btnFotoNota, inputFotoNota)
  })

  document.getElementById('btn-confirmar-entrada').addEventListener('click', async () => {
    const embalagem = parseFloat(inpEmbalagem.value) || 0
    const rotulo = parseFloat(inpRotulo.value) || 0
    const pallet = parseInt(inpPallet.value) || 0

    if (embalagem === 0 && rotulo === 0 && pallet === 0) {
      alert('Informe ao menos uma quantidade.')
      return
    }

    const btn = document.getElementById('btn-confirmar-entrada')
    btn.disabled = true
    btn.textContent = 'Enviando...'

    const resultado = await api.estoque.registrarEntrada(
      inpProduto.value.trim(),
      embalagem, rotulo, pallet,
      inputFotoProduto.files[0] || null,
      inputFotoNota.files[0] || null
    )

    if (resultado?.erro || !resultado?.ok) {
      alert('Erro ao registrar entrada.')
      btn.disabled = false
      btn.textContent = '✔ Confirmar Entrada'
      return
    }

    inpProduto.value = ''
    inpEmbalagem.value = ''
    inpRotulo.value = ''
    inpPallet.value = ''
    inputFotoProduto.value = ''
    inputFotoNota.value = ''
    previews.innerHTML = ''
    areaRemover.innerHTML = ''
    btnFotoProduto.className = 'btn btn-sm btn-outline-secondary btn-foto'
    btnFotoProduto.innerHTML = '📦 Foto produto'
    btnFotoNota.className = 'btn btn-sm btn-outline-secondary btn-foto'
    btnFotoNota.innerHTML = '🧾 Foto nota'
    btn.textContent = '✔ Registrado!'
    btn.style.background = 'var(--green-ok)'
    setTimeout(() => {
      btn.disabled = false
      btn.textContent = '✔ Confirmar Entrada'
      btn.style.background = ''
    }, 1800)

    carregarHistorico()
  })
}

function atualizarPreview(tipo, file, previews, areaRemover, btnFoto, input) {
  const idImg = `preview-${tipo}`
  const idBtn = `btn-remover-${tipo}`

  let img = document.getElementById(idImg)
  if (!img) {
    img = document.createElement('img')
    img.id = idImg
    img.className = 'foto-detalhe-img rounded-2'
    previews.appendChild(img)
  }
  img.src = URL.createObjectURL(file)

  let btnRemover = document.getElementById(idBtn)
  if (!btnRemover) {
    btnRemover = document.createElement('button')
    btnRemover.id = idBtn
    btnRemover.className = 'btn btn-sm btn-outline-danger fw-semibold'
    btnRemover.style.cssText = 'border-radius:8px;font-size:0.8rem;padding:5px 10px;'
    btnRemover.innerHTML = tipo === 'produto' ? '🗑 Foto Produto' : '🗑 Nota Fiscal'
    btnRemover.addEventListener('click', () => {
      input.value = ''
      img.remove()
      btnRemover.remove()
      btnFoto.className = 'btn btn-sm btn-outline-secondary btn-foto'
      btnFoto.innerHTML = tipo === 'produto' ? '📦 Foto produto' : '🧾 Foto nota'
    })
    areaRemover.appendChild(btnRemover)
  }

  btnFoto.className = 'btn btn-sm btn-foto btn-foto-ok'
  btnFoto.innerHTML = tipo === 'produto' ? '📦 ✅' : '🧾 ✅'
}

async function iniciar() {
  const perfil = exigirPapel(['admin', 'deposito', 'convidado'])
  if (!perfil) return
  montarCabecalho(perfil.papel)
  window._convidado = perfil.papel === 'convidado'

  mensagemVazio.innerHTML = ''

  if (!window._convidado) {
    iniciarForm()
  }

  const secaoHistorico = document.createElement('div')
  secaoHistorico.innerHTML = `
    <h5 class="fw-bold mb-3 mt-2">📋 Últimas Entradas</h5>
    <div id="historico-entradas"><p class="text-muted small">Carregando...</p></div>
  `
  containerCards.appendChild(secaoHistorico)

  carregarHistorico()
}

iniciar()