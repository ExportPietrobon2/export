import { api } from './api.js'
import { exigirPapel } from './auth.js'
import { montarCabecalho } from './cabecalho.js'

const labelTipo = { embalagem: 'Embalagem', rotulo: 'Rótulo', caixa: 'Caixa' }
const unidadeTipo = { embalagem: 'kg', rotulo: 'kg', caixa: 'paletes' }

const containerCards = document.getElementById('cards-recebimento')
const mensagemVazio = document.getElementById('mensagem-vazio')

async function carregarRecebimentos() {
  const pis = await api.recebimentos.pendentes()
  if (!pis) return

  containerCards.innerHTML = ''
  mensagemVazio.innerHTML = ''

  if (!pis.length) {
    mensagemVazio.innerHTML = `
      <div class="text-center py-5">
        <div style="font-size:3rem">✅</div>
        <p class="fw-semibold mt-2 text-muted">Tudo recebido por hoje.</p>
      </div>`
    return
  }

  pis.forEach((pi) => {
    const card = document.createElement('div')
    card.className = 'card card-recebimento mb-3'

    const topo = document.createElement('div')
    topo.className = 'card-body pb-2'
    topo.innerHTML = `
      <div class="d-flex align-items-center gap-1 mb-3">
        <span class="badge bg-danger">PI ${pi.numero_pi}</span>
        <span class="badge bg-secondary">${pi.cliente ?? ''}</span>
      </div>
      <div class="d-flex flex-column gap-2" id="produtos-${pi.id}"></div>
    `
    card.appendChild(topo)
    containerCards.appendChild(card)

    const containerProdutos = card.querySelector(`#produtos-${pi.id}`)

    pi.produtos.forEach((produto) => {
      const todoRecebido = produto.insumos.length > 0 && produto.insumos.every((i) => i.status_recebimento === 'recebido')
      const algumRecebido = produto.insumos.some((i) => i.status_recebimento === 'recebido')

      const btnProduto = document.createElement('button')
      btnProduto.className = `btn btn-sm text-start w-100 ${todoRecebido ? 'btn-success' : 'btn-outline-secondary'}`
      btnProduto.style.borderRadius = '10px'
      btnProduto.style.padding = '10px 14px'
      btnProduto.dataset.produtoId = produto.id
      btnProduto.innerHTML = `
        <span class="fw-semibold">${produto.produto}</span>
        <span class="ms-2 small opacity-75">${todoRecebido ? '✔ Tudo recebido' : algumRecebido ? '⚠ Parcial' : '○ Pendente'}</span>
      `

      const containerInsumos = document.createElement('div')
      containerInsumos.className = 'd-none d-flex flex-column gap-2 ps-2 pt-2'
      containerInsumos.id = `insumos-${produto.id}`

      produto.insumos.forEach((insumo) => {
        const recebido = insumo.status_recebimento === 'recebido'

        const blocoInsumo = document.createElement('div')
        blocoInsumo.className = 'd-flex flex-column gap-1'

        const btnInsumo = document.createElement('button')
        btnInsumo.className = `btn btn-sm ${recebido ? 'btn-success' : 'btn-outline-danger'}`
        btnInsumo.style.borderRadius = '20px'
        btnInsumo.style.width = 'fit-content'
        btnInsumo.innerHTML = `${recebido ? '✔' : '○'} ${labelTipo[insumo.tipo]}${recebido && insumo.quantidade_recebida ? ' · ' + insumo.quantidade_recebida : ''}`

        blocoInsumo.appendChild(btnInsumo)

        if (!recebido) {
          const form = criarForm(insumo, produto)
          form.style.display = 'none'
          blocoInsumo.appendChild(form)

          btnInsumo.addEventListener('click', () => {
            const aberto = form.style.display !== 'none'
            document.querySelectorAll('.form-insumo-expansivel').forEach((f) => f.style.display = 'none')
            form.style.display = aberto ? 'none' : 'block'
          })
        }

        containerInsumos.appendChild(blocoInsumo)
      })

      btnProduto.addEventListener('click', () => {
        const aberto = !containerInsumos.classList.contains('d-none')
        document.querySelectorAll('[id^="insumos-"]').forEach((c) => c.classList.add('d-none'))
        document.querySelectorAll('.form-insumo-expansivel').forEach((f) => f.style.display = 'none')
        if (!aberto) containerInsumos.classList.remove('d-none')
      })

      containerProdutos.appendChild(btnProduto)
      containerProdutos.appendChild(containerInsumos)
    })
  })
}

function criarForm(insumo, produto) {
  const unidade = unidadeTipo[insumo.tipo] || 'unidades'
  const form = document.createElement('div')
  form.className = 'form-insumo-expansivel border rounded-3 p-2 bg-light'

  const inputQtd = document.createElement('input')
  inputQtd.type = 'number'
  inputQtd.className = 'form-control form-control-sm mb-2'
  inputQtd.placeholder = `Quantidade em ${unidade}`
  inputQtd.min = '0'
  inputQtd.step = 'any'

  const previewProduto = document.createElement('img')
  previewProduto.className = 'preview-foto'
  previewProduto.hidden = true

  const previewNota = document.createElement('img')
  previewNota.className = 'preview-foto'
  previewNota.hidden = true

  const inputFotoProduto = criarInputFoto()
  const inputFotoNota = criarInputFoto()

  const btnRemoverProduto = criarBtnRemover('✕ Produto')
  btnRemoverProduto.hidden = true

  const btnRemoverNota = criarBtnRemover('✕ Nota')
  btnRemoverNota.hidden = true

  const btnFotoProduto = document.createElement('button')
  btnFotoProduto.className = 'btn btn-sm btn-outline-secondary btn-foto'
  btnFotoProduto.innerHTML = '📦 Foto produto'
  btnFotoProduto.addEventListener('click', () => inputFotoProduto.click())

  const btnFotoNota = document.createElement('button')
  btnFotoNota.className = 'btn btn-sm btn-outline-secondary btn-foto'
  btnFotoNota.innerHTML = '🧾 Foto nota'
  btnFotoNota.addEventListener('click', () => inputFotoNota.click())

  inputFotoProduto.addEventListener('change', () => {
    const f = inputFotoProduto.files[0]
    if (!f) return
    previewProduto.src = URL.createObjectURL(f)
    previewProduto.hidden = false
    btnRemoverProduto.hidden = false
    btnFotoProduto.className = 'btn btn-sm btn-foto btn-foto-ok'
    btnFotoProduto.innerHTML = '📦 ✅'
  })

  inputFotoNota.addEventListener('change', () => {
    const f = inputFotoNota.files[0]
    if (!f) return
    previewNota.src = URL.createObjectURL(f)
    previewNota.hidden = false
    btnRemoverNota.hidden = false
    btnFotoNota.className = 'btn btn-sm btn-foto btn-foto-ok'
    btnFotoNota.innerHTML = '🧾 ✅'
  })

  btnRemoverProduto.addEventListener('click', () => {
    inputFotoProduto.value = ''
    previewProduto.hidden = true
    previewProduto.src = ''
    btnRemoverProduto.hidden = true
    btnFotoProduto.className = 'btn btn-sm btn-outline-secondary btn-foto'
    btnFotoProduto.innerHTML = '📦 Foto produto'
  })

  btnRemoverNota.addEventListener('click', () => {
    inputFotoNota.value = ''
    previewNota.hidden = true
    previewNota.src = ''
    btnRemoverNota.hidden = true
    btnFotoNota.className = 'btn btn-sm btn-outline-secondary btn-foto'
    btnFotoNota.innerHTML = '🧾 Foto nota'
  })

  const btnConfirmar = document.createElement('button')
  btnConfirmar.className = 'btn btn-ok-grande mt-1'
  btnConfirmar.textContent = `✔ Confirmar ${labelTipo[insumo.tipo]}`
  btnConfirmar.addEventListener('click', () => {
    if (!inputQtd.value) { alert(`Informe a quantidade em ${unidade}.`); return }
    registrar(insumo.id, inputQtd.value, unidade, inputFotoProduto.files[0] || null, inputFotoNota.files[0] || null, btnConfirmar)
  })

  const areaBotoesFoto = document.createElement('div')
  areaBotoesFoto.className = 'd-flex gap-2 mb-1'
  areaBotoesFoto.appendChild(btnFotoProduto)
  areaBotoesFoto.appendChild(btnFotoNota)

  const areaRemover = document.createElement('div')
  areaRemover.className = 'd-flex gap-3'
  areaRemover.appendChild(btnRemoverProduto)
  areaRemover.appendChild(btnRemoverNota)

  form.appendChild(inputQtd)
  form.appendChild(previewProduto)
  form.appendChild(previewNota)
  form.appendChild(areaBotoesFoto)
  form.appendChild(areaRemover)
  form.appendChild(inputFotoProduto)
  form.appendChild(inputFotoNota)
  form.appendChild(btnConfirmar)

  return form
}

function criarInputFoto() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.capture = 'environment'
  input.hidden = true
  return input
}

function criarBtnRemover(texto) {
  const btn = document.createElement('button')
  btn.className = 'btn btn-sm btn-outline-danger d-flex align-items-center gap-1'
  btn.style.borderRadius = '8px'
  btn.innerHTML = `<span>🗑</span> ${texto}`
  return btn
}

async function registrar(id, quantidade, unidade, fotoProduto, fotoNota, botao) {
  botao.disabled = true
  botao.textContent = 'Enviando...'
  const resultado = await api.recebimentos.registrar(id, `${quantidade} ${unidade}`, fotoProduto, fotoNota)
  if (resultado?.erro) {
    alert('Erro ao registrar.')
    botao.disabled = false
    botao.textContent = 'Tentar de novo'
    return
  }
  carregarRecebimentos()
}

async function iniciar() {
  const perfil = exigirPapel(['admin', 'deposito'])
  if (!perfil) return
  montarCabecalho(perfil.papel)
  carregarRecebimentos()
}

iniciar()