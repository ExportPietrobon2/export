import { api } from './api.js'
import { getPerfil, salvarToken } from './auth.js'

const paginaPorPapel = {
  admin: '/HTML/admin.html',
  almoxarifado: '/HTML/almoxarifado.html',
  deposito: '/HTML/recebimento.html'
}

function redirecionarSeLogado() {
  const perfil = getPerfil()
  if (perfil && paginaPorPapel[perfil.papel]) {
    window.location.href = paginaPorPapel[perfil.papel]
  }
}

document.getElementById('form-login').addEventListener('submit', async (evento) => {
  evento.preventDefault()
  const email = document.getElementById('campo-email').value.trim()
  const senha = document.getElementById('campo-senha').value
  const mensagemErro = document.getElementById('mensagem-erro')
  mensagemErro.textContent = ''

  const resultado = await api.login(email, senha)

  if (resultado.erro) {
    mensagemErro.textContent = resultado.erro
    return
  }

  salvarToken(resultado.token, resultado.papel)
  window.location.href = paginaPorPapel[resultado.papel]
})

redirecionarSeLogado()