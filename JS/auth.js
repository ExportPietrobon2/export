function getToken() {
  return sessionStorage.getItem('token') || localStorage.getItem('token_deposito')
}

export function getPerfil() {
  const token = getToken()
  if (!token) return null
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    if (payload.exp * 1000 < Date.now()) {
      sessionStorage.removeItem('token')
      localStorage.removeItem('token_deposito')
      return null
    }
    return payload
  } catch {
    return null
  }
}

export function exigirPapel(papeisPermitidos) {
  const perfil = getPerfil()
  if (!perfil) {
    window.location.href = '/index.html'
    return null
  }
  if (!papeisPermitidos.includes(perfil.papel)) {
    window.location.href = '/index.html'
    return null
  }
  return perfil
}

export function salvarToken(token, papel) {
  if (papel === 'deposito') {
    localStorage.setItem('token_deposito', token)
  } else {
    sessionStorage.setItem('token', token)
  }
}

export function sair() {
  sessionStorage.removeItem('token')
  localStorage.removeItem('token_deposito')
  window.location.href = '/index.html'
}