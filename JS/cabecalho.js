import { sair } from './auth.js'

export function montarCabecalho(papel) {
  const paginaAtual = document.body.dataset.pagina

  const links = [
    { href: '/HTML/cadastro.html', texto: 'Cadastro', papeis: ['admin', 'convidado'] },
    { href: '/HTML/recebimento.html', texto: 'Recebimento B2', papeis: ['admin', 'deposito', 'convidado'] },
    { href: '/HTML/almoxarifado.html', texto: 'Almoxarifado', papeis: ['admin', 'almoxarifado', 'convidado'] },
    { href: '/HTML/admin.html', texto: 'Painel Admin', papeis: ['admin', 'convidado'] },
    { href: '/HTML/referencia.html', texto: 'Rendimentos', papeis: ['admin', 'almoxarifado', 'deposito', 'convidado'] }
  ].filter((l) => l.papeis.includes(papel))

  const nav = document.createElement('nav')
  nav.className = 'navbar navbar-expand-lg navbar-pietrobon sticky-top'
  nav.innerHTML = `
    <div class="container-fluid px-3">
      <a class="navbar-brand d-flex align-items-center gap-2" href="/HTML/admin.html">
        <img src="/logo.png" alt="Pietrobon" style="height:36px;object-fit:contain;">
      </a>
      <div class="d-flex align-items-center gap-2 ms-auto d-lg-none">
        <button id="btn-instalar-mobile" title="Instalar app" style="display:none;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.4);border-radius:8px;color:#fff;padding:5px 10px;font-size:0.8rem;font-weight:600;cursor:pointer;">
          📲 Instalar
        </button>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navMenu">
          <span class="navbar-toggler-icon"></span>
        </button>
      </div>
      <div class="collapse navbar-collapse" id="navMenu">
        <ul class="navbar-nav ms-auto mb-2 mb-lg-0 align-items-lg-center">
          ${links.map((link) => `
            <li class="nav-item">
              <a class="nav-link ${link.href.endsWith(paginaAtual) ? 'active fw-bold' : ''}" href="${link.href}">
                ${link.texto}
              </a>
            </li>`).join('')}
          <li class="nav-item d-none d-lg-block">
            <button id="btn-instalar-desktop" title="Instalar app" style="display:none;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.4);border-radius:8px;color:#fff;padding:6px 12px;font-size:0.85rem;font-weight:600;cursor:pointer;margin-right:6px;">
              📲 Instalar
            </button>
          </li>
          <li class="nav-item">
            <a class="nav-link nav-link-sair" href="#" id="btn-sair">Sair</a>
          </li>
        </ul>
      </div>
    </div>
  `
  document.getElementById('cabecalho').appendChild(nav)
  document.getElementById('btn-sair').addEventListener('click', (e) => { e.preventDefault(); sair() })

  let promptInstalacao = null

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    promptInstalacao = e

    const btnMobile = document.getElementById('btn-instalar-mobile')
    const btnDesktop = document.getElementById('btn-instalar-desktop')
    if (btnMobile) btnMobile.style.display = 'block'
    if (btnDesktop) btnDesktop.style.display = 'inline-block'

    const instalar = async () => {
      if (!promptInstalacao) return
      promptInstalacao.prompt()
      const { outcome } = await promptInstalacao.userChoice
      if (outcome === 'accepted') {
        if (btnMobile) btnMobile.style.display = 'none'
        if (btnDesktop) btnDesktop.style.display = 'none'
      }
      promptInstalacao = null
    }

    if (btnMobile) btnMobile.addEventListener('click', instalar)
    if (btnDesktop) btnDesktop.addEventListener('click', instalar)
  })

  window.addEventListener('appinstalled', () => {
    const btnMobile = document.getElementById('btn-instalar-mobile')
    const btnDesktop = document.getElementById('btn-instalar-desktop')
    if (btnMobile) btnMobile.style.display = 'none'
    if (btnDesktop) btnDesktop.style.display = 'none'
  })
}