import { sair } from './auth.js'

export function montarCabecalho(papel) {
  const paginaAtual = document.body.dataset.pagina

  const links = [
    { href: '/HTML/cadastro.html', texto: 'Cadastro', papeis: ['admin'] },
    { href: '/HTML/recebimento.html', texto: 'Recebimento B2', papeis: ['admin', 'deposito'] },
    { href: '/HTML/almoxarifado.html', texto: 'Almoxarifado', papeis: ['admin', 'almoxarifado'] },
    { href: '/HTML/admin.html', texto: 'Painel Admin', papeis: ['admin'] }
  ].filter((l) => l.papeis.includes(papel))

  const nav = document.createElement('nav')
  nav.className = 'navbar navbar-expand-lg navbar-pietrobon sticky-top'
  nav.innerHTML = `
    <div class="container-fluid px-3">
      <a class="navbar-brand" href="/HTML/admin.html">🏭 Pietrobon · Insumos</a>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navMenu">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" id="navMenu">
        <ul class="navbar-nav ms-auto mb-2 mb-lg-0 align-items-lg-center">
          ${links.map((link) => `
            <li class="nav-item">
              <a class="nav-link ${link.href.endsWith(paginaAtual) ? 'active fw-bold' : ''}" href="${link.href}">
                ${link.texto}
              </a>
            </li>`).join('')}
          <li class="nav-item">
            <a class="nav-link nav-link-sair" href="#" id="btn-sair">Sair</a>
          </li>
        </ul>
      </div>
    </div>
  `
  document.getElementById('cabecalho').appendChild(nav)
  document.getElementById('btn-sair').addEventListener('click', (e) => { e.preventDefault(); sair() })
}