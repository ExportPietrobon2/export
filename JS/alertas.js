import { calcularStatusProduto } from './constants.js'

export function prontaParaProduzir(pedido) {
  const produtos = pedido.produtos_pi || []
  if (produtos.length === 0) return false
  return produtos.every((p) => calcularStatusProduto(p.insumos_produto || []) === 'LIBERADO')
}

export function diasParaEmbarque(dataStr) {
  if (!dataStr) return null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const alvo = new Date(String(dataStr).slice(0, 10) + 'T00:00:00')
  return Math.round((alvo - hoje) / 86400000)
}

export function piEmAlerta(pedido) {
  if (pedido.concluida) return false
  if (!pedido.data_embarque) return false
  if (prontaParaProduzir(pedido)) return false
  const dias = diasParaEmbarque(pedido.data_embarque)
  return dias !== null && dias <= 7
}

export function textoPrazoEmbarque(dias) {
  if (dias === null) return ''
  if (dias < 0) return `EMBARQUE VENCIDO há ${Math.abs(dias)} dia(s)`
  if (dias === 0) return 'EMBARQUE É HOJE'
  if (dias === 1) return 'EMBARQUE AMANHÃ'
  return `EMBARQUE EM ${dias} DIAS`
}

export function bannerAlertaHtml(pedido) {
  const dias = diasParaEmbarque(pedido.data_embarque)
  return `<div class="banner-alerta-embarque">🚨 ALERTA MÁXIMO — ${textoPrazoEmbarque(dias)} E A PI NÃO ESTÁ PRONTA PARA PRODUZIR</div>`
}

const PRAZO_DECLARACAO_MS = 48 * 3600 * 1000

export function horasDesde(dataStr) {
  if (!dataStr) return null
  return Math.floor((Date.now() - new Date(dataStr).getTime()) / 3600000)
}

function temAlgoDeclarado(produto) {
  return (produto.insumos_produto || []).some((i) => Number(i.sobra) > 0)
}

export function produtoPendenteDeclaracao(produto) {
  if (!produto || produto.declarado_em) return false
  if (!produto.criado_em) return false
  if (temAlgoDeclarado(produto)) return false
  return (Date.now() - new Date(produto.criado_em).getTime()) >= PRAZO_DECLARACAO_MS
}

export function piNaoDeclarada(pedido) {
  if (pedido.concluida) return false
  return (pedido.produtos_pi || []).some(produtoPendenteDeclaracao)
}

export function horasRestantesDeclaracao(produto) {
  if (!produto || produto.declarado_em || !produto.criado_em) return null
  if (temAlgoDeclarado(produto)) return null
  const restanteMs = PRAZO_DECLARACAO_MS - (Date.now() - new Date(produto.criado_em).getTime())
  return Math.ceil(restanteMs / 3600000)
}

export function seloPrazoDeclaracaoHtml(produto) {
  const h = horasRestantesDeclaracao(produto)
  if (h === null) return ''
  if (h > 0) return `<span class="selo-prazo-declaracao">⏳ faltam ${h}h para declarar</span>`
  return `<span class="selo-prazo-vencido">⏰ vencido há ${Math.abs(h)}h</span>`
}

export function seloPrazoDeclaracaoPiHtml(pedido) {
  if (pedido.concluida) return ''
  const pendentes = (pedido.produtos_pi || []).filter((p) => !p.declarado_em && p.criado_em)
  const dentroDoPrazo = pendentes.map(horasRestantesDeclaracao).filter((h) => h !== null && h > 0)
  if (!dentroDoPrazo.length) return ''
  const menor = Math.min(...dentroDoPrazo)
  return `<span class="selo-prazo-declaracao">⏳ Declarar estoque: faltam ${menor}h</span>`
}

export function bannerDeclaracaoHtml(pedido) {
  const pendentes = (pedido.produtos_pi || []).filter(produtoPendenteDeclaracao)
  const nomes = pendentes.map((p) => p.produto).join(', ')
  return `<div class="banner-alerta-declaracao">⏰ ESTOQUE NÃO DECLARADO — ${pendentes.length} produto(s) há mais de 48h sem informe do almoxarifado${nomes ? ': ' + nomes : ''}</div>`
}

export function resumoDeclaracaoHtml(pedidos) {
  const emAlerta = (pedidos || []).filter(piNaoDeclarada)
  if (!emAlerta.length) return ''
  const chips = emAlerta.map((p) => {
    const qtd = (p.produtos_pi || []).filter(produtoPendenteDeclaracao).length
    return `<span class="pi-chip">PI ${p.numero_pi} — ${qtd} produto(s)</span>`
  }).join('')
  return `
    <div class="resumo-alerta-declaracao-topo">
      <div style="font-size:1.1rem;margin-bottom:6px">⏰ ${emAlerta.length} PI(s) COM ESTOQUE NÃO DECLARADO (48h+)</div>
      <div style="font-weight:600;opacity:.95;margin-bottom:8px">PIs com produtos cadastrados há mais de 48h e ainda sem informe salvo no almoxarifado:</div>
      <div>${chips}</div>
    </div>`
}

export function resumoAlertasHtml(pedidos) {
  const emAlerta = (pedidos || []).filter(piEmAlerta)
    .sort((a, b) => diasParaEmbarque(a.data_embarque) - diasParaEmbarque(b.data_embarque))
  if (!emAlerta.length) return ''
  const chips = emAlerta.map((p) => {
    const dias = diasParaEmbarque(p.data_embarque)
    return `<span class="pi-chip">PI ${p.numero_pi} — ${textoPrazoEmbarque(dias)}</span>`
  }).join('')
  return `
    <div class="resumo-alerta-topo">
      <div style="font-size:1.1rem;margin-bottom:6px">🚨 ${emAlerta.length} PI(s) EM ALERTA MÁXIMO DE EMBARQUE</div>
      <div style="font-weight:600;opacity:.95;margin-bottom:8px">PIs próximas da data de embarque (ou vencidas) que ainda não estão prontas para produzir:</div>
      <div>${chips}</div>
    </div>`
}