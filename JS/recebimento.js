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
    card.className = 'card-recebimento'

    const info = document.createElement('div')
    info.className = 'card-info'
    info.innerHTML = `
      <span class="pi-numero">PI ${item.numero_pi ?? ''}</span>
      <span class="cliente">${item.cliente ?? ''}</span>
      <span class="tipo-insumo">${labelPorTipo[item.tipo] ?? item.tipo}</span>
    `

    const campoQuantidade = document.createElement('label')
    campoQuantidade.className = 'campo-quantidade-recebimento'
    campoQuantidade.innerHTML = `
      <span>Quantidade recebida (${unidade})</span>
      <input type="number" class="input-quantidade" placeholder="ex: ${unidade === 'kg' ? '300' : '4'}" min="0" step="any">
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

    const areaBotoes = document.createElement('div')
    areaBotoes.className = 'area-botoes-recebimento'

    const botaoProduto = document.createElement('button')
    botaoProduto.className = 'btn-foto'
    botaoProduto.innerHTML = '📦 Foto do produto'
    botaoProduto.addEventListener('click', () => inputFotoProduto.click())

    const botaoNota = document.createElement('button')
    botaoNota.className = 'btn-foto'
    botaoNota.innerHTML = '🧾 Foto da nota fiscal'
    botaoNota.addEventListener('click', () => inputFotoNota.click())

    const previewProduto = document.createElement('img')
    previewProduto.className = 'preview-foto'
    previewProduto.hidden = true

    const previewNota = document.createElement('img')
    previewNota.className = 'preview-foto'
    previewNota.hidden = true

    inputFotoProduto.addEventListener('change', () => {
      const arquivo = inputFotoProduto.files[0]
      if (arquivo) {
        previewProduto.src = URL.createObjectURL(arquivo)
        previewProduto.hidden = false
        btnRemoverProduto.hidden = false
        botaoProduto.innerHTML = '📦 Produto ✅'
        botaoProduto.className = 'btn-foto btn-foto-ok'
      }
    })

    inputFotoNota.addEventListener('change', () => {
      const arquivo = inputFotoNota.files[0]
      if (arquivo) {
        previewNota.src = URL.createObjectURL(arquivo)
        previewNota.hidden = false
        btnRemoverNota.hidden = false
        botaoNota.innerHTML = '🧾 Nota ✅'
        botaoNota.className = 'btn-foto btn-foto-ok'
      }
    })

    const btnRemoverProduto = document.createElement('button')
    btnRemoverProduto.className = 'btn-remover-foto'
    btnRemoverProduto.textContent = '✕ Remover foto do produto'
    btnRemoverProduto.hidden = true
    btnRemoverProduto.addEventListener('click', () => {
      inputFotoProduto.value = ''
      previewProduto.hidden = true
      previewProduto.src = ''
      btnRemoverProduto.hidden = true
      botaoProduto.innerHTML = '📦 Foto do produto'
      botaoProduto.className = 'btn-foto'
    })

    const btnRemoverNota = document.createElement('button')
    btnRemoverNota.className = 'btn-remover-foto'
    btnRemoverNota.textContent = '✕ Remover foto da nota'
    btnRemoverNota.hidden = true
    btnRemoverNota.addEventListener('click', () => {
      inputFotoNota.value = ''
      previewNota.hidden = true
      previewNota.src = ''
      btnRemoverNota.hidden = true
      botaoNota.innerHTML = '🧾 Foto da nota fiscal'
      botaoNota.className = 'btn-foto'
    })
    botaoRegistrar.className = 'btn-ok'
    botaoRegistrar.textContent = '✔ Confirmar recebimento'
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

    areaBotoes.appendChild(botaoProduto)
    areaBotoes.appendChild(botaoNota)

    card.appendChild(info)
    card.appendChild(campoQuantidade)
    card.appendChild(previewProduto)
    card.appendChild(btnRemoverProduto)
    card.appendChild(previewNota)
    card.appendChild(btnRemoverNota)
    card.appendChild(areaBotoes)
    card.appendChild(inputFotoProduto)
    card.appendChild(inputFotoNota)
    card.appendChild(botaoRegistrar)
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