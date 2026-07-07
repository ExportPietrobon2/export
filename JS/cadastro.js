import { api } from './api.js'
import { TIPOS_INSUMO, formatarQuantidade } from './constants.js'
import { exigirPapel } from './auth.js'
import { montarCabecalho } from './cabecalho.js'

const selectPiDoProduto = document.getElementById('pi-do-produto')
const listaPedidos = document.getElementById('lista-pedidos')

async function carregarPedidos() {
  const pedidos = await api.pedidos.listar()
  if (!pedidos) return

  selectPiDoProduto.innerHTML = '<option value="">Selecione a PI</option>'
  listaPedidos.innerHTML = ''

  for (const pedido of pedidos) {
    const opcao = document.createElement('option')
    opcao.value = pedido.id
    opcao.textContent = `PI ${pedido.numero_pi}${pedido.cliente ? ' — ' + pedido.cliente : ''}`
    selectPiDoProduto.appendChild(opcao)

    const produtos = await api.produtos.listar(pedido.id)
    const bloco = document.createElement('div')
    bloco.className = 'card border-0 shadow-sm mb-3'

    const cabecalhoPi = document.createElement('div')
    cabecalhoPi.className = 'card-body d-flex justify-content-between align-items-center flex-wrap gap-2'

    const titulo = document.createElement('div')
    titulo.innerHTML = `<strong class="text-danger">PI ${pedido.numero_pi}</strong> <span class="text-muted small">— ${pedido.cliente || 'sem cliente'} — ${pedido.destino || 'sem destino'}</span>`
    cabecalhoPi.appendChild(titulo)

    const botaoExcluir = document.createElement('button')
    botaoExcluir.type = 'button'
    botaoExcluir.className = 'btn btn-sm btn-outline-danger'
    botaoExcluir.textContent = 'Excluir a PI'
    botaoExcluir.addEventListener('click', () => excluirPi(pedido.id, pedido.numero_pi))
    if (!window._convidado) cabecalhoPi.appendChild(botaoExcluir)

    bloco.appendChild(cabecalhoPi)

    const lista = document.createElement('ul')
    lista.className = 'list-group list-group-flush'
    if (!produtos || produtos.length === 0) {
      const item = document.createElement('li')
      item.className = 'list-group-item text-muted fst-italic small'
      item.textContent = 'Nenhum produto cadastrado ainda.'
      lista.appendChild(item)
    } else {
      produtos.forEach((produto) => {
        const item = document.createElement('li')
        item.className = 'list-group-item d-flex align-items-center justify-content-between gap-2 py-2'
        item.innerHTML = `
          <span class="small fw-semibold">${produto.produto}</span>
          <div class="d-flex align-items-center gap-2">
            <span class="badge bg-light text-dark border" id="qtd-label-${produto.id}">${formatarQuantidade(produto.quantidade)}</span>
            ${!window._convidado ? `<button class="btn btn-sm btn-outline-warning btn-editar-qtd d-flex align-items-center gap-1"
              data-produto-id="${produto.id}" data-quantidade="${produto.quantidade}"
              style="border-radius:8px">
              ✏️ Editar
            </button>` : ''}
          </div>
        `
        lista.appendChild(item)
      })
    }
    bloco.appendChild(lista)
    listaPedidos.appendChild(bloco)
  }

  document.querySelectorAll('.btn-editar-qtd').forEach((btn) => {
    btn.addEventListener('click', () => editarQuantidade(btn.dataset.produtoId, btn.dataset.quantidade))
  })
}

async function editarQuantidade(produtoId, quantidadeAtual) {
  const btn = document.querySelector(`.btn-editar-qtd[data-produto-id="${produtoId}"]`)
  const label = document.getElementById(`qtd-label-${produtoId}`)
  if (!btn || !label) return

  // Substituir label por input inline
  const wrapper = btn.closest('.d-flex')
  if (wrapper.querySelector('.input-qtd-inline')) return // já aberto

  const input = document.createElement('input')
  input.type = 'number'
  input.className = 'form-control form-control-sm input-qtd-inline'
  input.style.cssText = 'width:90px;border-radius:8px;'
  input.value = quantidadeAtual
  input.min = '1'

  const btnSalvar = document.createElement('button')
  btnSalvar.className = 'btn btn-sm btn-pietrobon'
  btnSalvar.style.cssText = 'border-radius:8px;padding:4px 10px;font-size:0.8rem;'
  btnSalvar.textContent = '✔'

  const btnCancelar = document.createElement('button')
  btnCancelar.className = 'btn btn-sm btn-outline-secondary'
  btnCancelar.style.cssText = 'border-radius:8px;padding:4px 10px;font-size:0.8rem;'
  btnCancelar.textContent = '✕'

  label.style.display = 'none'
  btn.style.display = 'none'
  wrapper.appendChild(input)
  wrapper.appendChild(btnSalvar)
  wrapper.appendChild(btnCancelar)
  input.focus()
  input.select()

  const cancelar = () => {
    input.remove()
    btnSalvar.remove()
    btnCancelar.remove()
    label.style.display = ''
    btn.style.display = ''
  }

  const salvar = async () => {
    const novaQtd = input.value
    if (!novaQtd || isNaN(novaQtd) || Number(novaQtd) <= 0) { input.focus(); return }
    btnSalvar.disabled = true
    btnSalvar.textContent = '...'
    const resultado = await api.produtos.editarQuantidade(produtoId, novaQtd)
    if (resultado?.erro) { alert('Erro ao atualizar quantidade.'); btnSalvar.disabled = false; btnSalvar.textContent = '✔'; return }
    label.textContent = formatarQuantidade(novaQtd)
    btn.dataset.quantidade = novaQtd
    cancelar()
  }

  btnSalvar.addEventListener('click', salvar)
  btnCancelar.addEventListener('click', cancelar)
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') salvar(); if (e.key === 'Escape') cancelar() })
}

async function excluirPi(piId, numeroPi) {
  if (!confirm(`Excluir a PI ${numeroPi}? Esta ação remove também os produtos, insumos e recebimentos. Não pode ser desfeito.`)) return
  await api.pedidos.excluir(piId)
  carregarPedidos()
}

document.getElementById('form-novo-pi').addEventListener('submit', async (evento) => {
  evento.preventDefault()
  const numeroPi = document.getElementById('numero-pi').value.trim()
  if (!numeroPi) return

  const resultado = await api.pedidos.criar({
    numero_pi: numeroPi,
    data_embarque: document.getElementById('data-embarque').value || null,
    cliente: document.getElementById('cliente-pi').value.trim() || null,
    destino: document.getElementById('destino-pi').value.trim() || null
  })

  if (resultado?.erro) { alert('Erro ao cadastrar PI.'); return }
  evento.target.reset()
  carregarPedidos()
})

document.getElementById('form-novo-produto').addEventListener('submit', async (evento) => {
  evento.preventDefault()
  const piId = selectPiDoProduto.value
  const produto = document.getElementById('nome-produto').value.trim()
  const quantidade = document.getElementById('quantidade-produto').value
  if (!piId || !produto || !quantidade) return

  const resultado = await api.produtos.criar({
    pi_id: piId,
    produto,
    quantidade,
    observacoes: document.getElementById('observacoes-produto').value.trim() || null
  })

  if (resultado?.erro) { alert('Erro ao cadastrar produto.'); return }
  const piSelecionado = piId
  evento.target.reset()
  selectPiDoProduto.value = piSelecionado
  carregarPedidos()
})

async function iniciar() {
  const perfil = exigirPapel(['admin', 'convidado'])
  if (!perfil) return
  montarCabecalho(perfil.papel)
  window._convidado = perfil.papel === 'convidado'
  if (window._convidado) {
    document.querySelectorAll('.card').forEach((c, i) => { if (i < 2) c.style.display = 'none' })
  }
  carregarPedidos()
}

iniciar()