import { sair, getPerfil } from './auth.js'
import { api } from './api.js'
import { iniciarChat } from './chat.js'

const EMAILS_FINANCEIRO = ['export2@pietrobon.com.br', 'export@pietrobon.com.br', 'joaoantonio@pietrobon.com.br']

async function carregarBadgesPendencias() {
 try {
 const p = await api.pendencias()
 if (!p || p.erro) return
 const add = (href, n, cor) => {
 if (!n) return
 const link = document.querySelector(`#menu-principal a[href="${href}"]`)
 if (!link) return
 const b = document.createElement('span')
 b.className = `badge rounded-pill ${cor} ms-2`
 b.style.fontSize = '0.68rem'
 b.textContent = n
 link.appendChild(b)
 }
 add('/HTML/almoxarifado.html', p.estoqueNaoDeclarado, 'bg-warning text-dark')
 add('/HTML/embarques.html', p.embarquesPendentes, 'bg-secondary')
 add('/HTML/compras.html', (p.pedidosCompra || 0) + (p.comprasAtrasadas || 0), 'bg-danger')
 } catch (e) { /* silencioso */ }
}

export function montarCabecalho(papel) {
 const paginaAtual = document.body.dataset.pagina
 const perfil = getPerfil()
 const emailAtual = perfil ? (perfil.email || '').toLowerCase() : ''
 const ehContabil = EMAILS_FINANCEIRO.includes(emailAtual)
 const ehChecklist = ['export2@pietrobon.com.br', 'export@pietrobon.com.br'].includes(emailAtual)

 const links = [
 { href: '/HTML/admin.html', texto: 'Visão Geral das PIs' },
 { href: '/HTML/cadastro.html', texto: 'Cadastrar PIs' },
 { href: '/HTML/almoxarifado.html', texto: 'Almoxarifado' },
 { href: '/HTML/recebimento.html', texto: 'Recebimento B2' },
 { href: '/HTML/referencia.html', texto: 'Rendimentos' },
 { href: '/HTML/embarques.html', texto: 'Embarques' },
 { href: '/HTML/compras.html', texto: 'Compras' }
 ]

 const brandHref = '/HTML/admin.html'

 const itensMenu = links.map((link) => `
 <li><a class="dropdown-item ${link.href.endsWith(paginaAtual) ? 'active' : ''}" href="${link.href}">${link.texto}</a></li>`).join('')

 const itemContabil = ehContabil ? `
 <li><hr class="dropdown-divider"></li><li><a class="dropdown-item item-contabil ${'/HTML/contabil.html'.endsWith(paginaAtual) ? 'active' : ''}" href="/HTML/contabil.html">Contábil / Faturamento</a></li><li><a class="dropdown-item item-contabil ${'/HTML/exp-contabil.html'.endsWith(paginaAtual) ? 'active' : ''}" href="/HTML/exp-contabil.html">Contab. de Exportação</a></li><li><a class="dropdown-item item-contabil ${'/HTML/financeiro.html'.endsWith(paginaAtual) ? 'active' : ''}" href="/HTML/financeiro.html">Financeiro (Importações)</a></li><li><a class="dropdown-item item-contabil ${'/HTML/ordem-producao.html'.endsWith(paginaAtual) ? 'active' : ''}" href="/HTML/ordem-producao.html">Ordem de Produção</a></li>` : ''

 const itemChecklist = ehChecklist ? `
 <li><a class="dropdown-item item-contabil ${'/HTML/checklist.html'.endsWith(paginaAtual) ? 'active' : ''}" href="/HTML/checklist.html">Check-list de Expedição</a></li>` : ''

 const nav = document.createElement('nav')
 nav.className = 'navbar navbar-pietrobon sticky-top'
 nav.innerHTML = `
 <div class="container-fluid px-3"><a class="navbar-brand d-flex align-items-center gap-2" href="${brandHref}"><img src="/logo.png" alt="Pietrobon" style="height:36px;object-fit:contain;"></a><div class="d-flex align-items-center gap-2 ms-auto"><button id="btn-instalar-topo" title="Instalar app" style="display:none;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.4);border-radius:8px;color:#fff;padding:6px 12px;font-size:0.82rem;font-weight:600;cursor:pointer;">
 Instalar
 </button><div class="dropdown"><button class="btn btn-menu-pietrobon dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
 Menu
 </button><ul class="dropdown-menu dropdown-menu-end shadow" id="menu-principal">
 ${itensMenu}
 ${itemContabil}
 ${itemChecklist}
 <li><hr class="dropdown-divider"></li><li><a class="dropdown-item text-danger fw-semibold" href="#" id="btn-sair">Sair</a></li></ul></div></div></div>
 `
 document.getElementById('cabecalho').appendChild(nav)
 document.getElementById('btn-sair').addEventListener('click', (e) => { e.preventDefault(); sair() })
 carregarBadgesPendencias()
 iniciarChat(papel)

 let promptInstalacao = null
 window.addEventListener('beforeinstallprompt', (e) => {
 e.preventDefault()
 promptInstalacao = e
 const btn = document.getElementById('btn-instalar-topo')
 if (btn) {
 btn.style.display = 'inline-block'
 btn.addEventListener('click', async () => {
 if (!promptInstalacao) return
 promptInstalacao.prompt()
 const { outcome } = await promptInstalacao.userChoice
 if (outcome === 'accepted') btn.style.display = 'none'
 promptInstalacao = null
 })
 }
 })
 window.addEventListener('appinstalled', () => {
 const btn = document.getElementById('btn-instalar-topo')
 if (btn) btn.style.display = 'none'
 })
}