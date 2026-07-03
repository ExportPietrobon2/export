import { api } from './api.js'
import { exigirPapel } from './auth.js'
import { montarCabecalho } from './cabecalho.js'

const labelPorTipo = { embalagem: 'Embalagem', rotulo: 'Rótulo', caixa: 'Caixa' }
const unidadePorTipo = { embalagem: 'kg', rotulo: 'kg', caixa: 'paletes' }

const containerCards = document.getElementById('cards-recebimento')
const mensagemVazio = document.getElementById('mensagem-vazio')

async function carregarPendentes() {
  const itens = await api.recebimentos.pendentes()
  if (!itens) return

  containerCards.innerHTML = ''
  mensagemVazio.innerHTML = ''

  if (itens.length === 0) {
    mensagemVazio.innerHTML = '<p class="vazio">Nenhum item pendente no momento. ✅</p>'
    return
  }

  itens.forEach((item) => {
    const unidade = unidadePorTipo[item.tipo] || 'unidades'

    const card = document.createElement('div')
    card.className = 'card card-recebimento mb-3'

    const body = document.createElement('div')
    body.className = 'card-body'

    const info = document.createElement('div')
    info.className = 'd-flex justify-content-between align-items-start mb-3'
    info.innerHTML = `
      <div>
        <div class="fw-bold fs-5 text-danger">PI ${item.numero_pi ?? ''}</div>
        <div class="text-muted small">${item.cliente ?? ''}</div>
        <span class="badge bg-warning text-dark mt-1">${labelPorTipo[item.tipo] ?? item.tipo}</span>
      </div>
    `

    const campoQuantidade = document.createElement('div')
    campoQuantidade.className = 'mb-3'
    campoQuantidade.innerHTML = `
      <label class="form-label fw-semibold small">Quantidade recebida (${unidade})</label>
      <input type="number" class="form-control form-control-lg input-quantidade" placeholder="ex: ${unidade === 'kg' ? '300' : '4'}" min="0" step="any">
    `

    const inputFotoProduto = document.createElement('input')
    inputFotoProduto.type = 'file'
    inputFotoProduto.accept = 'image/*'
    inputFotoProduto.capture = 'environment'
    inputFotoProduto.hidden = true

    const inputFotoNota = document.createElement('input')
    inputFotoNota.type = 'file'
    inputFotoNota.accept = 'image/*'
    inputFotoNota.capture = 'environment'
    inputFotoNota.hidden = true

    const previewProduto = document.createElement('img')
    previewProduto.className = 'preview-foto img-fluid rounded mb-2'
    previewProduto.hidden = true

    const previewNota = document.createElement('img')
    previewNota.className = 'preview-foto img-fluid rounded mb-2'
    previewNota.hidden = true

    const btnRemoverProduto = document.createElement('button')
    btnRemoverProduto.className = 'btn-remover-foto btn btn-sm btn-link text-danger d-block mb-2 text-decoration-none'
    btnRemoverProduto.textContent = '✕ Remover foto do produto'
    btnRemoverProduto.hidden = true

    const btnRemoverNota = document.createElement('button')
    btnRemoverNota.className = 'btn-remover-foto btn btn-sm btn-link text-danger d-block mb-2 text-decoration-none'
    btnRemoverNota.textContent = '✕ Remover foto da nota'
    btnRemoverNota.hidden = true

    const botaoProduto = document.createElement('button')
    botaoProduto.className = 'btn btn-outline-secondary btn-foto flex-fill'
    botaoProduto.innerHTML = '📦 Foto do produto'

    const botaoNota = document.createElement('button')
    botaoNota.className = 'btn btn-outline-secondary btn-foto flex-fill'
    botaoNota.innerHTML = '🧾 Foto da nota fiscal'

    const botaoRegistrar = document.createElement('button')
    botaoRegistrar.className = 'btn btn-ok-grande mt-2 w-100'
    botaoRegistrar.textContent = '✔ Confirmar recebimento'

    botaoProduto.addEventListener('click', () => inputFotoProduto.click())
    botaoNota.addEventListener('click', () => inputFotoNota.click())

    inputFotoProduto.addEventListener('change', () => {
      const arquivo = inputFotoProduto.files[0]
      if (!arquivo) return
      previewProduto.src = URL.createObjectURL(arquivo)
      previewProduto.hidden = false
      btnRemoverProduto.hidden = false
      botaoProduto.innerHTML = '📦 Produto ✅'
      botaoProduto.className = 'btn btn-success btn-foto flex-fill btn-foto-ok'
    })

    inputFotoNota.addEventListener('change', () => {
      const arquivo = inputFotoNota.files[0]
      if (!arquivo) return
      previewNota.src = URL.createObjectURL(arquivo)
      previewNota.hidden = false
      btnRemoverNota.hidden = false
      botaoNota.innerHTML = '🧾 Nota ✅'
      botaoNota.className = 'btn btn-success btn-foto flex-fill btn-foto-ok'
    })

    btnRemoverProduto.addEventListener('click', () => {
      inputFotoProduto.value = ''
      previewProduto.hidden = true
      previewProduto.src = ''
      btnRemoverProduto.hidden = true
      botaoProduto.innerHTML = '📦 Foto do produto'
      botaoProduto.className = 'btn btn-outline-secondary btn-foto flex-fill'
    })

    btnRemoverNota.addEventListener('click', () => {
      inputFotoNota.value = ''
      previewNota.hidden = true
      previewNota.src = ''
      btnRemoverNota.hidden = true
      botaoNota.innerHTML = '🧾 Foto da nota fiscal'
      botaoNota.className = 'btn btn-outline-secondary btn-foto flex-fill'
    })

    botaoRegistrar.addEventListener('click', () => {
      const quantidade = campoQuantidade.querySelector('.input-quantidade').value
      if (!quantidade) {
        alert(`Informe a quantidade recebida em ${unidade}.`)
        return
      }
      const fotoProduto = inputFotoProduto.files[0] || null
      const fotoNota = inputFotoNota.files[0] || null
      registrar(item.id, quantidade, unidade, fotoProduto, fotoNota, botaoRegistrar)
    })

    const areaBotoes = document.createElement('div')
    areaBotoes.className = 'd-flex gap-2 mb-2'
    areaBotoes.appendChild(botaoProduto)
    areaBotoes.appendChild(botaoNota)

    body.appendChild(info)
    body.appendChild(campoQuantidade)
    body.appendChild(previewProduto)
    body.appendChild(btnRemoverProduto)
    body.appendChild(previewNota)
    body.appendChild(btnRemoverNota)
    body.appendChild(areaBotoes)
    body.appendChild(inputFotoProduto)
    body.appendChild(inputFotoNota)
    body.appendChild(botaoRegistrar)
    card.appendChild(body)
    containerCards.appendChild(card)
  })
}

async function registrar(id, quantidade, unidade, fotoProduto, fotoNota, botao) {
  botao.disabled = true
  botao.textContent = 'Enviando...'
  const resultado = await api.recebimentos.registrar(id, `${quantidade} ${unidade}`, fotoProduto, fotoNota)
  if (resultado?.erro) {
    alert('Erro ao registrar. Tente novamente.')
    botao.disabled = false
    botao.textContent = '✔ Confirmar recebimento'
    return
  }
  carregarPendentes()
}

async function iniciar() {
  const perfil = exigirPapel(['admin', 'deposito'])
  if (!perfil) return
  montarCabecalho(perfil.papel)
  carregarPendentes()
}

iniciar()