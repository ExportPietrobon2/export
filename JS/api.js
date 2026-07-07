const BASE = ''

function getToken() {
  return sessionStorage.getItem('token') || localStorage.getItem('token_deposito')
}

async function requisitar(metodo, rota, corpo, formData) {
  const opcoes = {
    method: metodo,
    headers: { Authorization: `Bearer ${getToken()}` }
  }
  if (formData) {
    opcoes.body = formData
  } else if (corpo) {
    opcoes.headers['Content-Type'] = 'application/json'
    opcoes.body = JSON.stringify(corpo)
  }
  try {
    const resposta = await fetch(BASE + rota, opcoes)
    if (resposta.status === 401) {
      sessionStorage.removeItem('token')
      window.location.href = '/index.html'
      return null
    }
    if (!resposta.ok && resposta.status !== 400) {
      console.error(`Erro ${resposta.status} em ${metodo} ${rota}`)
      return { erro: `Erro de servidor (${resposta.status}). Tente novamente.` }
    }
    return resposta.json()
  } catch (e) {
    console.error('Erro de rede:', e)
    return { erro: 'Sem conexão com o servidor. Verifique sua internet.' }
  }
}

export const api = {
  login: (email, senha) =>
    fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha })
    }).then((r) => r.json()),

  logout: () => sessionStorage.removeItem('token'),

  pedidos: {
    listar: (incluirConcluidas = false) =>
      requisitar('GET', `/api/pedidos?incluirConcluidas=${incluirConcluidas}`),
    completo: (incluirConcluidas = false) =>
      requisitar('GET', `/api/pedidos/completo?incluirConcluidas=${incluirConcluidas}`),
    criar: (dados) => requisitar('POST', '/api/pedidos', dados),
    concluir: (id, concluida) => requisitar('PATCH', `/api/pedidos/${id}/concluir`, { concluida }),
    excluir: (id) => requisitar('DELETE', `/api/pedidos/${id}`)
  },

  produtos: {
    listar: (piId) => requisitar('GET', `/api/pedidos/${piId}/produtos`),
    criar: (dados) => requisitar('POST', '/api/produtos', dados),
    editarQuantidade: (id, quantidade) => requisitar('PATCH', `/api/produtos/${id}/quantidade`, { quantidade }),
    insumos: (produtoId) => requisitar('GET', `/api/produtos/${produtoId}/insumos`),
    salvarInsumos: (produtoId, dados) => requisitar('PATCH', `/api/produtos/${produtoId}/insumos`, dados)
  },

  recebimentos: {
    pendentes: () => requisitar('GET', '/api/recebimentos/pendentes'),
    registrar: (id, quantidadeRecebida, fotoProduto, fotoNota) => {
      const formData = new FormData()
      formData.append('quantidade_recebida', quantidadeRecebida)
      if (fotoProduto) formData.append('foto_produto', fotoProduto)
      if (fotoNota) formData.append('foto_nota', fotoNota)
      return requisitar('PATCH', `/api/recebimentos/${id}`, null, formData)
    }
  },

  usuarios: {
    listar: () => requisitar('GET', '/api/usuarios'),
    criar: (dados) => requisitar('POST', '/api/usuarios', dados),
    excluir: (id) => requisitar('DELETE', `/api/usuarios/${id}`)
  },

  estoque: {
    saldo: () => requisitar('GET', '/api/estoque/saldo'),
    historico: () => requisitar('GET', '/api/estoque/historico'),
    vinculos: () => requisitar('GET', '/api/estoque/vinculos'),
    vincular: (dados) => requisitar('POST', '/api/estoque/vincular', dados),
    editarVinculo: (id, dados) => requisitar('PATCH', `/api/estoque/vinculos/${id}`, dados),
    deletarVinculo: (id) => requisitar('DELETE', `/api/estoque/vinculos/${id}`),
    deletarEntrada: (id) => requisitar('DELETE', `/api/estoque/entradas/${id}`),
    registrarEntrada: (produto, embalagem_kg, rotulo_kg, pallet_caixas, fotoProduto, fotoNota) => {
      const formData = new FormData()
      formData.append('produto', produto)
      formData.append('embalagem_kg', embalagem_kg)
      formData.append('rotulo_kg', rotulo_kg)
      formData.append('pallet_caixas', pallet_caixas)
      if (fotoProduto) formData.append('foto_produto', fotoProduto)
      if (fotoNota) formData.append('foto_nota', fotoNota)
      return requisitar('POST', '/api/estoque/entrada', null, formData)
    }
  }
}