import { api } from './api.js'
import { exigirPapel } from './auth.js'
import { montarCabecalho } from './cabecalho.js'

const EMAIL_CONTABIL = 'export2@pietrobon.com.br'
const MESES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const MODULOS = {
  exterior: { titulo: 'Clientes Exterior', tipoEnt: 'clientes', rotA: 'Débito (fatura)', rotD: 'Baixa (recebimento)', tipoA: 'debito', tipoD: 'baixa', temFatura: true, colA: 'Débito do mês', colD: 'Baixa do mês' },
  adiant_clientes: { titulo: 'Adiantamentos de Clientes', tipoEnt: 'clientes', rotA: 'Crédito (adiantamento)', rotD: 'Débito (uso)', tipoA: 'credito', tipoD: 'debito', temFatura: false, colA: 'Crédito do mês', colD: 'Débito do mês' },
  adiant_fornecedores: { titulo: 'Adiantamentos a Fornecedores', tipoEnt: 'fornecedores', rotA: 'Débito (adiantado)', rotD: 'Pagamento (abatimento)', tipoA: 'debito', tipoD: 'pagamento', temFatura: false, colA: 'Débito do mês', colD: 'Pagamento do mês' }
}

let meses = []
let mesId = null
let modulo = 'exterior'
let saldoCache = null

const $ = (id) => document.getElementById(id)
function money(n) { return 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function dISO(v) { return v ? String(v).slice(0, 10) : '' }
function dBR(v) { const s = dISO(v); return s ? s.split('-').reverse().join('/') : '-' }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }

async function carregarMeses(selecionar) {
  meses = await api.ec.meses()
  if (!Array.isArray(meses)) meses = []
  if (selecionar) mesId = selecionar
  if (!mesId && meses.length) mesId = meses[0].id
  renderTopo()
  if (mesId) carregarSaldos()
  else $('area-saldos').innerHTML = '<div class="card"><div class="card-body text-muted">Crie um período (mês) acima para começar.</div></div>'
}

function renderTopo() {
  const opts = meses.map((m) => `<option value="${m.id}" ${m.id === mesId ? 'selected' : ''}>${esc(m.nome)}</option>`).join('')
  $('sel-mes').innerHTML = opts || '<option value="">Nenhum período</option>'
}

async function carregarSaldos() {
  const area = $('area-saldos')
  area.innerHTML = '<p class="text-muted">Carregando...</p>'
  const r = await api.ec.saldos(modulo, mesId)
  if (!r || r.erro) { area.innerHTML = `<p class="text-danger">${esc(r?.erro || 'Erro ao carregar.')}</p>`; return }
  saldoCache = r
  const cfg = MODULOS[modulo]
  const linhas = r.linhas
  const t = linhas.reduce((a, l) => ({ ant: a.ant + l.anterior, au: a.au + l.aumenta, di: a.di + l.diminui, at: a.at + l.atual }), { ant: 0, au: 0, di: 0, at: 0 })

  area.innerHTML = `
    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
      <h5 class="secao-titulo-card mb-0">${cfg.titulo}</h5>
      <button class="btn btn-sm btn-outline-success no-print" id="btn-ec-excel">Exportar Excel</button>
    </div>
    <div class="card"><div class="table-responsive"><table class="table table-sm table-hover mb-0" style="font-size:.85rem">
      <thead><tr>
        <th>Entidade</th>
        <th class="text-end">Saldo anterior</th>
        <th class="text-end">${cfg.colA}</th>
        <th class="text-end">${cfg.colD}</th>
        <th class="text-end">Saldo atual</th>
        <th class="no-print"></th>
      </tr></thead>
      <tbody>
        ${linhas.map((l) => `<tr>
          <td>${esc(l.nome)}</td>
          <td class="text-end">${money(l.anterior)}</td>
          <td class="text-end">${money(l.aumenta)}</td>
          <td class="text-end">${money(l.diminui)}</td>
          <td class="text-end fw-semibold ${l.atual > 0 ? 'text-success' : 'text-muted'}">${money(l.atual)}</td>
          <td class="no-print text-end"><button class="btn btn-sm btn-outline-primary py-0 px-2" onclick="abrirLancamentos(${l.id}, '${esc(l.nome).replace(/'/g, "\\'")}')">Lançar</button></td>
        </tr>`).join('')}
        <tr class="fw-bold" style="background:#f8fafc">
          <td>TOTAL</td>
          <td class="text-end">${money(t.ant)}</td>
          <td class="text-end">${money(t.au)}</td>
          <td class="text-end">${money(t.di)}</td>
          <td class="text-end">${money(t.at)}</td>
          <td class="no-print"></td>
        </tr>
      </tbody>
    </table></div></div>
    ${linhas.length ? '' : '<p class="text-muted fst-italic mt-2">Nenhum cliente/fornecedor ativo. Cadastre na aba "Cadastros".</p>'}`
  $('btn-ec-excel').addEventListener('click', exportarExcel)
}

// ---------- Lançamentos (modal) ----------
window.abrirLancamentos = async function (entidadeId, nome) {
  window._ecEntidadeAtual = entidadeId
  const cfg = MODULOS[modulo]
  const r = await api.ec.lancamentos(modulo, mesId, entidadeId)
  const lancs = (r && r.lancamentos) || []
  const box = $('modal-ec-body')
  box.innerHTML = `
    <h5 class="mb-1">${esc(nome)}</h5>
    <div class="text-muted small mb-3">${cfg.titulo} · ${esc(meses.find((m) => m.id === mesId)?.nome || '')}</div>
    <div class="row g-2 align-items-end mb-3">
      <div class="col-6 col-md-3"><label class="form-label small mb-0">Tipo</label>
        <select id="l-tipo" class="form-select form-select-sm">
          <option value="${cfg.tipoA}">${cfg.rotA}</option>
          <option value="${cfg.tipoD}">${cfg.rotD}</option>
        </select></div>
      <div class="col-6 col-md-2"><label class="form-label small mb-0">Data</label><input type="date" id="l-data" class="form-control form-control-sm"></div>
      <div class="col-6 col-md-2"><label class="form-label small mb-0">Valor</label><input type="text" id="l-valor" class="form-control form-control-sm" placeholder="0,00"></div>
      ${cfg.temFatura ? '<div class="col-6 col-md-2"><label class="form-label small mb-0">Nº Fatura</label><input type="text" id="l-fatura" class="form-control form-control-sm"></div>' : ''}
      <div class="col-12 col-md-${cfg.temFatura ? '3' : '5'}"><label class="form-label small mb-0">Observação</label><input type="text" id="l-obs" class="form-control form-control-sm"></div>
    </div>
    <button class="btn btn-ok-grande" id="l-salvar">Salvar lançamento</button>
    <hr>
    <div id="l-lista"></div>`
  $('l-data').value = new Date().toISOString().slice(0, 10)
  renderListaLanc(lancs)
  $('l-salvar').addEventListener('click', () => salvarLanc(entidadeId, nome))
  window._modalEc.show()
}

function renderListaLanc(lancs) {
  const cfg = MODULOS[modulo]
  const el = $('l-lista')
  if (!lancs.length) { el.innerHTML = '<p class="text-muted fst-italic mb-0">Nenhum lançamento neste mês.</p>'; return }
  const rot = { [cfg.tipoA]: cfg.rotA, [cfg.tipoD]: cfg.rotD }
  el.innerHTML = `<table class="table table-sm mb-0" style="font-size:.85rem">
    <thead><tr><th>Data</th><th>Tipo</th><th class="text-end">Valor</th>${cfg.temFatura ? '<th>Fatura</th>' : ''}<th>Obs.</th><th></th></tr></thead>
    <tbody>${lancs.map((l) => `<tr>
      <td>${dBR(l.data_lanc)}</td>
      <td>${esc(rot[l.tipo] || l.tipo)}</td>
      <td class="text-end">${money(l.valor)}</td>
      ${cfg.temFatura ? `<td>${esc(l.fatura || '-')}</td>` : ''}
      <td>${esc(l.observacao || '-')}</td>
      <td class="text-end"><button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="excluirLanc(${l.id})">Excluir</button></td>
    </tr>`).join('')}</tbody></table>`
}

async function salvarLanc(entidadeId, nome) {
  const cfg = MODULOS[modulo]
  const dados = {
    modulo, mesId, entidadeId,
    tipo: $('l-tipo').value,
    data_lanc: $('l-data').value,
    valor: $('l-valor').value,
    observacao: $('l-obs').value
  }
  if (cfg.temFatura) dados.fatura = $('l-fatura').value
  const btn = $('l-salvar'); btn.disabled = true
  const r = await api.ec.criarLancamento(dados)
  btn.disabled = false
  if (r?.erro) { alert(r.erro || 'Erro ao salvar.'); return }
  const lr = await api.ec.lancamentos(modulo, mesId, entidadeId)
  renderListaLanc((lr && lr.lancamentos) || [])
  $('l-valor').value = ''; $('l-obs').value = ''
  if (cfg.temFatura) $('l-fatura').value = ''
  carregarSaldos()
}

window.excluirLanc = async function (id) {
  if (!confirm('Excluir este lançamento?')) return
  await api.ec.excluirLancamento(modulo, id)
  const entidadeId = window._ecEntidadeAtual
  if (entidadeId) {
    const lr = await api.ec.lancamentos(modulo, mesId, entidadeId)
    renderListaLanc((lr && lr.lancamentos) || [])
  }
  carregarSaldos()
}

// ---------- Cadastros ----------
async function abrirCadastros() {
  const [clientes, fornecedores] = await Promise.all([api.ec.entidades('clientes'), api.ec.entidades('fornecedores')])
  const linhaEnt = (e, tipo) => `<tr>
    <td>${esc(e.nome)}</td>${tipo === 'clientes' ? `<td>${esc(e.pais || '-')}</td>` : ''}
    <td>${e.ativo ? '<span class="badge bg-success">Ativo</span>' : '<span class="badge bg-secondary">Inativo</span>'}</td>
    <td class="text-end"><button class="btn btn-sm ${e.ativo ? 'btn-outline-danger' : 'btn-outline-secondary'} py-0 px-2" onclick="toggleEnt(${e.id}, '${tipo}')">${e.ativo ? 'Desativar' : 'Ativar'}</button></td>
  </tr>`
  $('modal-ec-body').innerHTML = `
    <h5 class="mb-3">Cadastros</h5>
    <div class="card mb-3"><div class="card-body">
      <h6 class="fw-bold">Clientes (exterior)</h6>
      <div class="row g-2 align-items-end mb-2">
        <div class="col-6 col-md-5"><label class="form-label small mb-0">Nome</label><input type="text" id="c-nome" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-4"><label class="form-label small mb-0">País</label><input type="text" id="c-pais" class="form-control form-control-sm"></div>
        <div class="col-12 col-md-3"><button class="btn btn-sm btn-pietrobon w-100" onclick="addEnt('clientes')">Adicionar</button></div>
      </div>
      <div class="table-responsive"><table class="table table-sm mb-0" style="font-size:.85rem"><thead><tr><th>Nome</th><th>País</th><th>Status</th><th></th></tr></thead><tbody>${clientes.map((c) => linhaEnt(c, 'clientes')).join('')}</tbody></table></div>
    </div></div>
    <div class="card"><div class="card-body">
      <h6 class="fw-bold">Fornecedores (importação)</h6>
      <div class="row g-2 align-items-end mb-2">
        <div class="col-8 col-md-9"><label class="form-label small mb-0">Nome</label><input type="text" id="f-nome" class="form-control form-control-sm"></div>
        <div class="col-4 col-md-3"><button class="btn btn-sm btn-pietrobon w-100" onclick="addEnt('fornecedores')">Adicionar</button></div>
      </div>
      <div class="table-responsive"><table class="table table-sm mb-0" style="font-size:.85rem"><thead><tr><th>Nome</th><th>Status</th><th></th></tr></thead><tbody>${fornecedores.map((f) => linhaEnt(f, 'fornecedores')).join('')}</tbody></table></div>
    </div></div>`
  window._modalEc.show()
}

window.addEnt = async function (tipo) {
  const nome = (tipo === 'clientes' ? $('c-nome') : $('f-nome')).value.trim()
  if (!nome) return
  const dados = { tipo, nome }
  if (tipo === 'clientes') dados.pais = $('c-pais').value
  await api.ec.criarEntidade(dados)
  abrirCadastros()
}
window.toggleEnt = async function (id, tipo) {
  await api.ec.toggleEntidade(id, tipo)
  abrirCadastros()
}

// ---------- Exportar Excel ----------
async function exportarExcel() {
  if (!saldoCache) return
  const cfg = MODULOS[modulo]
  const AZUL = 'FF000080', VERDE = 'FF99CC00', BORDA = { style: 'thin', color: { argb: 'FF808080' } }
  const b = { top: BORDA, left: BORDA, bottom: BORDA, right: BORDA }
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Contab', { views: [{ showGridLines: false }] })
  ws.mergeCells(1, 1, 1, 5)
  const t = ws.getCell(1, 1); t.value = `${cfg.titulo.toUpperCase()} — ${saldoCache.mes.nome}`; t.font = { bold: true, size: 14, color: { argb: AZUL } }; t.alignment = { horizontal: 'center' }
  const head = ['Entidade', 'Saldo anterior', cfg.colA, cfg.colD, 'Saldo atual']
  head.forEach((h, i) => { const c = ws.getCell(3, i + 1); c.value = h; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } }; c.border = b; c.alignment = { horizontal: 'center' } })
  let r = 4
  const tot = { ant: 0, au: 0, di: 0, at: 0 }
  saldoCache.linhas.forEach((l) => {
    const vals = [l.nome, l.anterior, l.aumenta, l.diminui, l.atual]
    vals.forEach((v, i) => { const c = ws.getCell(r, i + 1); c.value = v; if (i > 0) c.numFmt = '#,##0.00'; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE } }; c.border = b; c.font = { bold: true }; if (i > 0) c.alignment = { horizontal: 'right' } })
    tot.ant += l.anterior; tot.au += l.aumenta; tot.di += l.diminui; tot.at += l.atual; r++
  })
  const totv = ['TOTAL', tot.ant, tot.au, tot.di, tot.at]
  totv.forEach((v, i) => { const c = ws.getCell(r, i + 1); c.value = v; if (i > 0) { c.numFmt = '#,##0.00'; c.alignment = { horizontal: 'right' } } c.font = { bold: true }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }; c.border = b })
  ws.columns = [{ width: 42 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }]
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob); const a = document.createElement('a')
  a.href = url; a.download = `Contabilidade_${saldoCache.mes.nome.replace(/\s+/g, '_')}_${modulo}.xlsx`; a.click(); URL.revokeObjectURL(url)
}

// ---------- Interface ----------
function montarInterface() {
  const cont = $('conteudo-ec')
  cont.innerHTML = `
    <div class="card mb-3 no-print"><div class="card-body">
      <div class="d-flex flex-wrap align-items-end gap-2">
        <div><label class="form-label small mb-0 fw-semibold">Período</label><br>
          <select id="sel-mes" class="form-select form-select-sm d-inline-block" style="width:auto"></select></div>
        <button class="btn btn-sm btn-outline-secondary" id="btn-novo-mes">+ Novo mês</button>
        <button class="btn btn-sm btn-outline-danger" id="btn-excluir-mes">Excluir mês</button>
        <div class="ms-auto"><button class="btn btn-sm btn-pietrobon" id="btn-cadastros">Cadastros (clientes/fornecedores)</button></div>
      </div>
    </div></div>

    <ul class="nav nav-tabs mb-3 no-print" id="tabs-ec">
      <li class="nav-item"><a class="nav-link active" href="#" data-mod="exterior">Clientes Exterior</a></li>
      <li class="nav-item"><a class="nav-link" href="#" data-mod="adiant_clientes">Adiant. de Clientes</a></li>
      <li class="nav-item"><a class="nav-link" href="#" data-mod="adiant_fornecedores">Adiant. a Fornecedores</a></li>
    </ul>

    <div id="area-saldos"></div>

    <div class="modal fade" id="modal-ec" tabindex="-1"><div class="modal-dialog modal-lg modal-dialog-scrollable">
      <div class="modal-content"><div class="modal-header"><h6 class="modal-title fw-bold">Contabilidade de Exportação</h6>
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body" id="modal-ec-body"></div>
      </div></div></div>`

  window._modalEc = new bootstrap.Modal($('modal-ec'))

  $('sel-mes').addEventListener('change', (e) => { mesId = parseInt(e.target.value); carregarSaldos() })
  $('btn-novo-mes').addEventListener('click', async () => {
    const ano = parseInt(prompt('Ano do período:', String(new Date().getFullYear())))
    if (!ano) return
    const mes = parseInt(prompt('Mês (1 a 12):', String(new Date().getMonth() + 1)))
    if (!(mes >= 1 && mes <= 12)) { alert('Mês inválido.'); return }
    const r = await api.ec.criarMes(ano, mes)
    if (r?.erro) { alert(r.erro); return }
    carregarMeses(r.id)
  })
  $('btn-excluir-mes').addEventListener('click', async () => {
    if (!mesId) return
    const m = meses.find((x) => x.id === mesId)
    if (!confirm(`Excluir o período ${m?.nome} e TODOS os lançamentos dele?`)) return
    await api.ec.excluirMes(mesId)
    mesId = null
    carregarMeses()
  })
  $('btn-cadastros').addEventListener('click', abrirCadastros)

  document.querySelectorAll('#tabs-ec .nav-link').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault()
      document.querySelectorAll('#tabs-ec .nav-link').forEach((x) => x.classList.remove('active'))
      a.classList.add('active')
      modulo = a.dataset.mod
      if (mesId) carregarSaldos()
    })
  })
}

async function iniciar() {
  const perfil = exigirPapel(['admin'])
  if (!perfil) return
  if ((perfil.email || '').toLowerCase() !== EMAIL_CONTABIL) { window.location.href = '/HTML/admin.html'; return }
  montarCabecalho(perfil.papel)
  montarInterface()
  carregarMeses()
}

iniciar()