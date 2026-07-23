import { api } from './api.js'
import { exigirPapel } from './auth.js'
import { montarCabecalho } from './cabecalho.js'

const EMAILS = ['export2@pietrobon.com.br', 'export@pietrobon.com.br', 'joaoantonio@pietrobon.com.br']
let editId = null
let pis = []

const $ = (id) => document.getElementById(id)
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const nl = (s) => esc(s).replace(/\n/g, '<br>')
const dISO = (v) => v ? String(v).slice(0, 10) : ''
const dBR = (v) => { const s = dISO(v); return s ? s.split('-').reverse().join('/') : '' }
const CAMPOS = ['pais', 'cliente_curto', 'imp_nome', 'imp_endereco', 'imp_contato', 'imp_tel', 'imp_email', 'porto_embarque', 'local_entrega', 'data_carregamento', 'total_caixas', 'formula', 'mix_produtos', 'rotulos', 'embalagem', 'rotulos_embalagem', 'caixa_info', 'observacoes']

// ---------- LISTA ----------
async function verLista() {
  editId = null
  const cont = $('conteudo-op')
  cont.innerHTML = '<p class="text-muted">Carregando...</p>'
  const rows = await api.ordemProducao.listar()
  if (!Array.isArray(rows)) { cont.innerHTML = '<p class="text-danger">Erro ao carregar.</p>'; return }
  cont.innerHTML = `
    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
      <h5 class="secao-titulo-card mb-0">Ordens de Produção</h5>
      <button class="btn btn-ok-grande" id="btn-nova-op">+ Nova ordem de produção</button>
    </div>
    ${rows.length ? `<div class="card"><div class="table-responsive"><table class="table table-sm table-hover mb-0">
      <thead><tr><th>PI</th><th>Cliente</th><th>País</th><th>Carregamento</th><th></th></tr></thead>
      <tbody>${rows.map((o) => `<tr>
        <td class="fw-semibold">${esc(o.numero_pi || '-')}</td><td>${esc(o.cliente_curto || o.cliente || '-')}</td>
        <td>${esc(o.pais || '-')}</td><td>${dBR(o.data_carregamento)}</td>
        <td style="white-space:nowrap" class="text-end">
          <button class="btn btn-sm btn-outline-primary py-0 px-2" onclick="editarOp(${o.id})">Abrir</button>
          <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="excluirOp(${o.id})">🗑</button>
        </td></tr>`).join('')}</tbody></table></div></div>`
      : '<p class="text-muted fst-italic">Nenhuma ordem de produção cadastrada.</p>'}`
  $('btn-nova-op').addEventListener('click', () => editar(null))
}
window.editarOp = (id) => editar(id)
window.excluirOp = async function (id) {
  if (!confirm('Excluir esta ordem de produção?')) return
  await api.ordemProducao.excluir(id)
  verLista()
}

// ---------- EDITOR ----------
function linhaItem(it) {
  it = it || {}
  return `<tr class="op-item">
    <td><input class="form-control form-control-sm it-qtd" value="${esc(it.qtd || '')}" style="min-width:70px"></td>
    <td><input class="form-control form-control-sm it-unidade" value="${esc(it.unidade || 'Caixa')}" style="min-width:70px"></td>
    <td><input class="form-control form-control-sm it-descricao" value="${esc(it.descricao || '')}"></td>
    <td><input class="form-control form-control-sm it-codigo" value="${esc(it.codigo || '')}" style="min-width:80px"></td>
    <td class="text-end"><button type="button" class="btn btn-sm btn-outline-danger py-0 px-2 btn-rem-item">✕</button></td>
  </tr>`
}
function textarea(id, label, val, rows) {
  return `<div class="mb-2"><label class="form-label small fw-semibold mb-0">${label}</label><textarea id="op-${id}" class="form-control form-control-sm" rows="${rows || 2}">${esc(val || '')}</textarea></div>`
}

async function editar(id) {
  editId = id
  let d = { itens: [{}] }
  if (id) { d = await api.ordemProducao.obter(id); if (!d.itens || !d.itens.length) d.itens = [{}] }
  if (!pis.length) { const p = await api.pedidos.listar(); pis = Array.isArray(p) ? p : [] }
  const optPis = pis.map((p) => `<option value="${p.id}" ${d.pi_id == p.id ? 'selected' : ''}>PI ${esc(p.numero_pi)}${p.cliente ? ' — ' + esc(p.cliente) : ''}</option>`).join('')

  $('conteudo-op').innerHTML = `
    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
      <h5 class="secao-titulo-card mb-0">${id ? 'Editar ordem de produção' : 'Nova ordem de produção'}</h5>
      <button class="btn btn-sm btn-outline-secondary" id="btn-voltar">← Voltar</button>
    </div>

    <div class="card mb-3"><div class="card-body">
      <div class="row g-2">
        <div class="col-12 col-md-5"><label class="form-label small mb-0">PI (selecione)</label>
          <select id="op-pi_id" class="form-select form-select-sm"><option value="">—</option>${optPis}</select></div>
        <div class="col-6 col-md-3"><label class="form-label small mb-0">País</label><input id="op-pais" class="form-control form-control-sm" value="${esc(d.pais || '')}"></div>
        <div class="col-6 col-md-4"><label class="form-label small mb-0">Cliente (curto p/ título)</label><input id="op-cliente_curto" class="form-control form-control-sm" value="${esc(d.cliente_curto || d.cliente || '')}"></div>
      </div>
      <button type="button" class="btn btn-sm btn-outline-primary mt-2" id="btn-puxar-itens">Puxar produtos da PI</button>
    </div></div>

    <div class="card mb-3"><div class="card-body">
      <h6 class="fw-bold small text-uppercase text-muted">Dados do importador</h6>
      <div class="row g-2">
        <div class="col-12 col-md-6"><label class="form-label small mb-0">Importador</label><input id="op-imp_nome" class="form-control form-control-sm" value="${esc(d.imp_nome || '')}"></div>
        <div class="col-12 col-md-6"><label class="form-label small mb-0">Endereço</label><input id="op-imp_endereco" class="form-control form-control-sm" value="${esc(d.imp_endereco || '')}"></div>
        <div class="col-6 col-md-4"><label class="form-label small mb-0">Contato</label><input id="op-imp_contato" class="form-control form-control-sm" value="${esc(d.imp_contato || '')}"></div>
        <div class="col-6 col-md-4"><label class="form-label small mb-0">Tel</label><input id="op-imp_tel" class="form-control form-control-sm" value="${esc(d.imp_tel || '')}"></div>
        <div class="col-12 col-md-4"><label class="form-label small mb-0">E-mail</label><input id="op-imp_email" class="form-control form-control-sm" value="${esc(d.imp_email || '')}"></div>
      </div>
    </div></div>

    <div class="card mb-3"><div class="card-body">
      <h6 class="fw-bold small text-uppercase text-muted">Dados do pedido</h6>
      <div class="row g-2">
        <div class="col-6 col-md-3"><label class="form-label small mb-0">Porto de embarque</label><input id="op-porto_embarque" class="form-control form-control-sm" value="${esc(d.porto_embarque || '')}"></div>
        <div class="col-6 col-md-3"><label class="form-label small mb-0">Local de entrega</label><input id="op-local_entrega" class="form-control form-control-sm" value="${esc(d.local_entrega || '')}"></div>
        <div class="col-6 col-md-3"><label class="form-label small mb-0">Data de carregamento</label><input type="date" id="op-data_carregamento" class="form-control form-control-sm" value="${dISO(d.data_carregamento)}"></div>
        <div class="col-6 col-md-3"><label class="form-label small mb-0">Total de caixas</label><input id="op-total_caixas" class="form-control form-control-sm" value="${esc(d.total_caixas || '')}"></div>
      </div>
    </div></div>

    <div class="card mb-3"><div class="card-body">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <h6 class="fw-bold mb-0">Itens do pedido</h6>
        <button type="button" class="btn btn-sm btn-outline-danger" id="btn-add-item">+ Adicionar item</button>
      </div>
      <div class="table-responsive"><table class="table table-sm mb-0" style="font-size:.85rem">
        <thead><tr><th>Quantidade</th><th>Item</th><th>Descrição do Produto</th><th>Código</th><th></th></tr></thead>
        <tbody id="op-itens">${d.itens.map(linhaItem).join('')}</tbody>
      </table></div>
    </div></div>

    <div class="card mb-3"><div class="card-body">
      <h6 class="fw-bold small text-uppercase text-muted">Detalhes de produção</h6>
      ${textarea('formula', 'Produto — Fórmula', d.formula, 4)}
      ${textarea('mix_produtos', 'Mix de Produtos', d.mix_produtos, 4)}
      ${textarea('rotulos', 'Rótulos', d.rotulos, 3)}
      ${textarea('embalagem', 'Embalagem', d.embalagem, 3)}
      ${textarea('rotulos_embalagem', 'Rótulos / Embalagem (balança, etiqueta)', d.rotulos_embalagem, 3)}
      ${textarea('caixa_info', 'Caixa (códigos)', d.caixa_info, 2)}
      ${textarea('observacoes', 'Observações da produção', d.observacoes, 2)}
    </div></div>

    <div class="d-flex gap-2 flex-wrap">
      <button class="btn btn-ok-grande" id="btn-salvar-op">Salvar</button>
      <button class="btn btn-outline-danger" id="btn-pdf-op">Salvar e exportar PDF</button>
      <button class="btn btn-outline-success" id="btn-excel-op">Salvar e exportar Excel</button>
    </div>`

  $('btn-voltar').addEventListener('click', verLista)
  $('btn-add-item').addEventListener('click', () => $('op-itens').insertAdjacentHTML('beforeend', linhaItem({})))
  $('op-itens').addEventListener('click', (e) => { const b = e.target.closest('.btn-rem-item'); if (b) b.closest('tr').remove() })
  $('btn-puxar-itens').addEventListener('click', puxarItens)
  $('btn-salvar-op').addEventListener('click', async () => { const r = await salvar(); if (r) verLista() })
  $('btn-pdf-op').addEventListener('click', async () => { const r = await salvar(); if (r) exportarPDF(r) })
  $('btn-excel-op').addEventListener('click', async () => { const r = await salvar(); if (r) exportarExcel(r) })
}

async function puxarItens() {
  const piId = $('op-pi_id').value
  if (!piId) { alert('Selecione uma PI primeiro.'); return }
  const produtos = await api.produtos.listar(piId)
  if (!Array.isArray(produtos) || !produtos.length) { alert('Esta PI não tem produtos cadastrados.'); return }
  $('op-itens').innerHTML = produtos.map((p) => linhaItem({ qtd: p.quantidade, unidade: 'Caixa', descricao: p.produto, codigo: '' })).join('')
  const pi = pis.find((x) => x.id == piId)
  if (pi && pi.cliente && !$('op-cliente_curto').value) $('op-cliente_curto').value = pi.cliente
}

function coletar() {
  const d = { pi_id: $('op-pi_id').value || null }
  CAMPOS.forEach((k) => { d[k] = $('op-' + k).value })
  d.itens = [...document.querySelectorAll('#op-itens .op-item')].map((tr) => ({
    qtd: tr.querySelector('.it-qtd').value, unidade: tr.querySelector('.it-unidade').value,
    descricao: tr.querySelector('.it-descricao').value, codigo: tr.querySelector('.it-codigo').value
  })).filter((it) => it.descricao || it.qtd || it.codigo)
  return d
}

async function salvar() {
  const dados = coletar()
  let r
  if (editId) { r = await api.ordemProducao.editar(editId, dados); if (r?.erro) { alert(r.erro); return null } }
  else { r = await api.ordemProducao.criar(dados); if (r?.erro) { alert(r.erro); return null }; editId = r.id }
  const pi = pis.find((x) => x.id == dados.pi_id)
  return { id: editId, ...dados, numero_pi: pi ? pi.numero_pi : '' }
}

// ---------- PDF ----------
function exportarPDF(d) {
  const itens = d.itens || []
  const NAVY = '#1f2d50', RED = '#c0392b', LBL = '#eef1f5', BORD = '#d5dae2'
  const secao = (t) => `<div style="background:${NAVY};color:#fff;font-weight:bold;font-size:11px;padding:7px 12px;margin-top:12px">${esc(t)}</div>`
  const lbl = `border:1px solid ${BORD};padding:8px 12px;font-size:10.5px;font-weight:bold;background:${LBL};width:210px;color:#1f2d50`
  const val = `border:1px solid ${BORD};padding:8px 12px;font-size:10.5px`
  const th = `border:1px solid ${NAVY};padding:6px 8px;font-size:10px;font-weight:bold;background:${NAVY};color:#fff;text-align:center`
  const td = (al) => `border:1px solid ${BORD};padding:6px 8px;font-size:10px;text-align:${al}`
  const linhaLV = (l, v, corVal) => `<tr><td style="${lbl}">${esc(l)}</td><td style="${val}${corVal ? ';color:' + corVal + ';font-weight:bold' : ''}">${esc(v || '')}</td></tr>`
  const blocoTexto = (t, txt) => txt ? `${secao(t)}<div style="border:1px solid ${BORD};border-top:none;padding:8px 12px;font-size:10.5px;line-height:1.55">${nl(txt)}</div>` : ''

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid ${NAVY};padding-bottom:8px">
      <div>
        <div style="font-weight:bold;font-size:13px;color:#1a1a1a">PIETROBON &amp; CIA. LTDA.</div>
        <div style="font-weight:bold;font-size:14px;color:#1a1a1a">ORDEM DE PRODUÇÃO</div>
        <div style="font-size:11px;color:#333">PI ${esc(d.numero_pi || '')} • ${esc(d.pais || '')} • ${esc(d.cliente_curto || '')}</div>
      </div>
      <div style="font-weight:bold;font-size:15px;color:${RED}">Pietrobon</div>
    </div>

    ${secao('DADOS DO IMPORTADOR')}
    <table style="width:100%;border-collapse:collapse">
      ${linhaLV('Importador', d.imp_nome)}${linhaLV('Endereço', d.imp_endereco)}${linhaLV('Contato', d.imp_contato)}${linhaLV('Tel', d.imp_tel)}${linhaLV('E-mail', d.imp_email)}
    </table>

    ${secao('DADOS DO PEDIDO')}
    <table style="width:100%;border-collapse:collapse">
      ${linhaLV('Pedido / PI', 'PI ' + (d.numero_pi || ''))}${linhaLV('Importador', d.cliente_curto)}${linhaLV('Porto de Embarque', d.porto_embarque)}${linhaLV('Local de Entrega', d.local_entrega)}${linhaLV('Data de Carregamento', dBR(d.data_carregamento), RED)}${linhaLV('Total de Caixas', d.total_caixas)}
    </table>

    ${secao('ITENS DO PEDIDO')}
    <table style="width:100%;border-collapse:collapse">
      <thead><tr><th style="${th}">Quantidade</th><th style="${th}">Item</th><th style="${th};text-align:left">Descrição do Produto</th><th style="${th}">Código</th></tr></thead>
      <tbody>${itens.map((it) => `<tr><td style="${td('center')}">${esc(it.qtd || '')}</td><td style="${td('center')}">${esc(it.unidade || '')}</td><td style="${td('left')}">${esc(it.descricao || '')}</td><td style="${td('center')}">${esc(it.codigo || '')}</td></tr>`).join('')}</tbody>
    </table>
    <div style="font-weight:bold;font-size:10.5px;padding:6px 2px">Total: ${esc(d.total_caixas || itens.reduce((s, it) => s + (parseFloat(String(it.qtd || '').replace(/\./g, '').replace(',', '.')) || 0), 0).toLocaleString('pt-BR'))}</div>

    ${d.formula ? `${secao('Produto - Fórmula')}<div style="background:${RED};color:#fff;font-weight:bold;text-align:center;padding:16px 18px;font-size:11px;line-height:1.7">${nl(d.formula)}</div>` : ''}
    ${blocoTexto('Mix de Produtos', d.mix_produtos)}
    ${blocoTexto('Rótulos', d.rotulos)}
    ${blocoTexto('Embalagem', d.embalagem)}
    ${blocoTexto('Rótulos / Embalagem', d.rotulos_embalagem)}
    ${blocoTexto('Caixa', d.caixa_info)}
    ${secao('OBSERVAÇÕES DA PRODUÇÃO')}<div style="border:1px solid ${BORD};border-top:none;padding:8px 12px;font-size:10.5px;line-height:1.55;min-height:60px">${nl(d.observacoes || '')}</div>

    ${secao('CONTROLE DE LOTE — Preencher lote, elaboração e vencimento durante a produção')}
    <table style="width:100%;border-collapse:collapse">
      <thead><tr><th style="${th};text-align:left">Produto</th><th style="${th}">QTD (CX)</th><th style="${th}">Lote</th><th style="${th}">Elaboração</th><th style="${th}">Vence</th></tr></thead>
      <tbody>
        ${itens.map((it) => `<tr><td style="${td('left')};height:34px">${esc(it.descricao || '')}</td><td style="${td('center')}">${esc(it.qtd || '')}</td><td style="${td('center')}"></td><td style="${td('center')}"></td><td style="${td('center')}"></td></tr>`).join('')}
        <tr style="font-weight:bold;background:${LBL}"><td style="${td('left')}">TOTAL</td><td style="${td('center')}">${esc(d.total_caixas || '')}</td><td style="${td('center')}"></td><td style="${td('center')}"></td><td style="${td('center')}"></td></tr>
      </tbody>
    </table>

    ${secao('RESPONSÁVEL PELA BALANÇA / QUALIDADE')}
    <table style="width:100%;border-collapse:collapse;table-layout:fixed">
      <tr>
        <td style="border:1px solid ${BORD};padding:0;vertical-align:top;width:50%">
          <div style="background:${NAVY};color:#fff;font-weight:bold;font-size:10px;padding:5px 10px">RESPONSÁVEL PELA BALANÇA</div>
          <table style="width:100%;border-collapse:collapse">${['1º Turno', '2º Turno', '3º Turno'].map((t) => `<tr><td style="${td('left')};width:80px;height:26px">${t}</td><td style="${td('left')}"></td></tr>`).join('')}</table>
        </td>
        <td style="border:1px solid ${BORD};padding:0;vertical-align:top;width:50%">
          <div style="background:${NAVY};color:#fff;font-weight:bold;font-size:10px;padding:5px 10px">QUALIDADE</div>
          <table style="width:100%;border-collapse:collapse">${['1º Turno', '2º Turno', '3º Turno'].map((t) => `<tr><td style="${td('left')};width:80px;height:26px">${t}</td><td style="${td('left')}"></td></tr>`).join('')}</table>
        </td>
      </tr>
    </table>

    <table style="width:100%;border-collapse:collapse;margin-top:40px">
      <tr>
        <td style="width:50%;text-align:center;font-size:10.5px;padding:0 20px">
          <div style="border-top:1px solid #000;padding-top:4px">Responsável pela Expedição</div>
        </td>
        <td style="width:50%;text-align:center;font-size:10.5px;padding:0 20px">
          <div style="border-top:1px solid #000;padding-top:4px">Data: ____ / ____ / ______</div>
        </td>
      </tr>
    </table>
    <div style="text-align:center;font-size:9.5px;color:#666;margin-top:6px">Tapejara - RS, Brasil</div>
  </div>`

  let area = document.getElementById('area-impressao')
  if (!area) { area = document.createElement('div'); area.id = 'area-impressao'; area.style.display = 'none'; document.body.appendChild(area) }
  area.innerHTML = html
  document.body.classList.add('imprimindo')
  const limpar = () => { document.body.classList.remove('imprimindo'); window.removeEventListener('afterprint', limpar) }
  window.addEventListener('afterprint', limpar)
  window.print()
}

// ---------- Excel ----------
async function exportarExcel(d) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Ordem de Produção', { views: [{ showGridLines: false }] })
  const NAVY = 'FF1F2D50', RED = 'FFC0392B', CAB = 'FFEEF1F5'
  let r = 1
  const titulo = (txt, sz) => { ws.mergeCells(r, 1, r, 4); const c = ws.getCell(r, 1); c.value = txt; c.font = { bold: true, size: sz || 12 }; c.alignment = { horizontal: 'center' }; r++ }
  const secao = (txt) => { ws.mergeCells(r, 1, r, 4); const c = ws.getCell(r, 1); c.value = txt; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }; r++ }
  const par = (l, v) => { const a = ws.getCell(r, 1); a.value = l; a.font = { bold: true }; a.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CAB } }; const b = ws.getCell(r, 2); ws.mergeCells(r, 2, r, 4); b.value = v || ''; r++ }
  const bloco = (t, txt, red) => { if (!txt) return; secao(t); ws.mergeCells(r, 1, r, 4); const c = ws.getCell(r, 1); c.value = txt; c.alignment = { wrapText: true, vertical: 'top', horizontal: red ? 'center' : 'left' }; if (red) { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED } }; c.font = { bold: true, color: { argb: 'FFFFFFFF' } } } ws.getRow(r).height = Math.min(130, 16 + String(txt).split('\n').length * 12); r++ }

  titulo('PIETROBON & CIA. LTDA. — ORDEM DE PRODUÇÃO')
  titulo(`PI ${d.numero_pi || ''} • ${d.pais || ''} • ${d.cliente_curto || ''}`)
  secao('DADOS DO IMPORTADOR')
  par('Importador', d.imp_nome); par('Endereço', d.imp_endereco); par('Contato', d.imp_contato); par('Tel', d.imp_tel); par('E-mail', d.imp_email)
  secao('DADOS DO PEDIDO')
  par('Pedido / PI', 'PI ' + (d.numero_pi || '')); par('Porto de Embarque', d.porto_embarque); par('Local de Entrega', d.local_entrega); par('Data de Carregamento', dBR(d.data_carregamento)); par('Total de Caixas', d.total_caixas)
  secao('ITENS DO PEDIDO')
  ;['Quantidade', 'Item', 'Descrição do Produto', 'Código'].forEach((h, i) => { const c = ws.getCell(r, i + 1); c.value = h; c.font = { bold: true }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CAB } } })
  r++
  ;(d.itens || []).forEach((it) => { ws.getCell(r, 1).value = it.qtd; ws.getCell(r, 2).value = it.unidade; ws.getCell(r, 3).value = it.descricao; ws.getCell(r, 4).value = it.codigo; r++ })
  bloco('Produto - Fórmula', d.formula, true); bloco('MIX DE PRODUTOS', d.mix_produtos); bloco('RÓTULOS', d.rotulos)
  bloco('EMBALAGEM', d.embalagem); bloco('RÓTULOS / EMBALAGEM', d.rotulos_embalagem); bloco('CAIXA', d.caixa_info); bloco('OBSERVAÇÕES DA PRODUÇÃO', d.observacoes)
  secao('CONTROLE DE LOTE')
  ;['Produto', 'QTD (CX)', 'Lote', 'Elaboração', 'Vence'].forEach((h, i) => { const c = ws.getCell(r, i + 1); c.value = h; c.font = { bold: true }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CAB } } })
  r++
  ;(d.itens || []).forEach((it) => { ws.getCell(r, 1).value = it.descricao; ws.getCell(r, 2).value = it.qtd; r++ })
  r += 2
  secao('RESPONSÁVEL PELA EXPEDIÇÃO')
  ws.getCell(r, 1).value = 'Assinatura:'; ws.getCell(r, 1).font = { bold: true }; ws.getCell(r, 2).value = '____________________________________'; r++
  ws.getCell(r, 1).value = 'Data:'; ws.getCell(r, 1).font = { bold: true }; ws.getCell(r, 2).value = '____ / ____ / ______'; r++
  ws.getCell(r, 1).value = 'Tapejara - RS, Brasil'; r++
  ws.columns = [{ width: 30 }, { width: 22 }, { width: 40 }, { width: 16 }, { width: 16 }]
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob); const a = document.createElement('a')
  a.href = url; a.download = `Ordem_Producao_PI_${(d.numero_pi || '').replace(/\W+/g, '_')}.xlsx`; a.click(); URL.revokeObjectURL(url)
}

async function iniciar() {
  const perfil = exigirPapel(['admin'])
  if (!perfil) return
  if (!EMAILS.includes((perfil.email || '').toLowerCase())) { window.location.href = '/HTML/admin.html'; return }
  montarCabecalho(perfil.papel)
  verLista()
}

iniciar()