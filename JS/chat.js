import { api } from './api.js'

const TITULOS = {
  admin: 'Assistente Geral',
  almoxarifado: 'Assistente do Almoxarifado',
  compras: 'Assistente de Compras',
  compras_aromas: 'Assistente de Aromas',
  gerente_producao: 'Assistente de Embarques',
  deposito: 'Assistente do Depósito',
  convidado: 'Assistente'
}

const SUGESTOES = {
  almoxarifado: ['O que ainda falta declarar?', 'Quais PIs estão pendentes?'],
  compras: ['Tenho pedidos pendentes?', 'Alguma compra atrasada?'],
  compras_aromas: ['Tenho pedidos de aroma pendentes?'],
  gerente_producao: ['Quais PIs estão sem data de embarque?'],
  admin: ['Resumo das pendências de hoje', 'O que está atrasado?'],
  deposito: ['O que preciso lançar no B2?'],
  convidado: ['Como funciona o sistema?']
}

let historico = []
let aberto = false

export function iniciarChat(papel) {
  if (document.getElementById('chat-ia-botao')) return
  const titulo = TITULOS[papel] || 'Assistente'

  const estilo = document.createElement('style')
  estilo.textContent = `
    #chat-ia-botao{position:fixed;right:18px;bottom:18px;z-index:1050;width:58px;height:58px;border-radius:50%;
      background:linear-gradient(135deg,#ED3237,#C6242A);color:#fff;border:none;font-size:1.5rem;cursor:pointer;
      box-shadow:0 6px 18px rgba(180,20,20,.4);transition:transform .15s;}
    #chat-ia-botao:hover{transform:scale(1.07);}
    #chat-ia-painel{position:fixed;right:18px;bottom:86px;z-index:1050;width:360px;max-width:calc(100vw - 24px);
      height:520px;max-height:calc(100vh - 120px);background:#fff;border-radius:16px;overflow:hidden;display:none;
      flex-direction:column;box-shadow:0 12px 40px rgba(0,0,0,.25);border:1px solid #f0d0d0;}
    #chat-ia-painel.aberto{display:flex;}
    .chat-ia-topo{background:linear-gradient(120deg,#ED3237,#C6242A);color:#fff;padding:12px 16px;font-weight:700;
      display:flex;align-items:center;justify-content:space-between;}
    .chat-ia-topo small{display:block;font-weight:400;opacity:.85;font-size:.72rem;}
    .chat-ia-fechar{background:none;border:none;color:#fff;font-size:1.3rem;cursor:pointer;line-height:1;}
    .chat-ia-msgs{flex:1;overflow-y:auto;padding:14px;background:#FDF1F1;display:flex;flex-direction:column;gap:8px;}
    .chat-ia-bolha{max-width:82%;padding:9px 12px;border-radius:14px;font-size:.9rem;line-height:1.4;white-space:pre-wrap;word-wrap:break-word;}
    .chat-ia-bolha.user{align-self:flex-end;background:#ED3237;color:#fff;border-bottom-right-radius:4px;}
    .chat-ia-bolha.bot{align-self:flex-start;background:#fff;color:#2E2E33;border:1px solid #f0d0d0;border-bottom-left-radius:4px;}
    .chat-ia-sugestoes{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 8px;background:#FDF1F1;}
    .chat-ia-sugestao{background:#fff;border:1px solid #f0d0d0;color:#C6242A;border-radius:16px;padding:5px 10px;
      font-size:.78rem;cursor:pointer;}
    .chat-ia-sugestao:hover{background:#fff8f8;}
    .chat-ia-form{display:flex;gap:8px;padding:10px;border-top:1px solid #f0d0d0;background:#fff;}
    .chat-ia-form input{flex:1;border:1px solid #e7d3d3;border-radius:10px;padding:9px 12px;font-size:.9rem;outline:none;}
    .chat-ia-form input:focus{border-color:#ED3237;}
    .chat-ia-form button{background:#2E7D32;color:#fff;border:none;border-radius:10px;padding:0 16px;font-weight:700;cursor:pointer;}
    .chat-ia-form button:disabled{opacity:.5;cursor:default;}
  `
  document.head.appendChild(estilo)

  const botao = document.createElement('button')
  botao.id = 'chat-ia-botao'
  botao.title = titulo
  botao.textContent = '💬'
  document.body.appendChild(botao)

  const sugestoes = (SUGESTOES[papel] || SUGESTOES.convidado)
    .map((s) => `<button class="chat-ia-sugestao" type="button">${s}</button>`).join('')

  const painel = document.createElement('div')
  painel.id = 'chat-ia-painel'
  painel.innerHTML = `
    <div class="chat-ia-topo">
      <div>${titulo}<small>Tire dúvidas e veja pendências do seu setor</small></div>
      <button class="chat-ia-fechar" title="Fechar">×</button>
    </div>
    <div class="chat-ia-msgs" id="chat-ia-msgs"></div>
    <div class="chat-ia-sugestoes" id="chat-ia-sugestoes">${sugestoes}</div>
    <form class="chat-ia-form" id="chat-ia-form">
      <input type="text" id="chat-ia-input" placeholder="Escreva sua pergunta..." autocomplete="off">
      <button type="submit" id="chat-ia-enviar">➤</button>
    </form>`
  document.body.appendChild(painel)

  const msgsEl = painel.querySelector('#chat-ia-msgs')
  const inputEl = painel.querySelector('#chat-ia-input')
  const btnEnviar = painel.querySelector('#chat-ia-enviar')

  function addBolha(texto, de) {
    const b = document.createElement('div')
    b.className = `chat-ia-bolha ${de}`
    b.textContent = texto
    msgsEl.appendChild(b)
    msgsEl.scrollTop = msgsEl.scrollHeight
    return b
  }

  function abrir() {
    aberto = true
    painel.classList.add('aberto')
    if (!historico.length) {
      addBolha(`Olá! Sou o ${titulo.toLowerCase()}. Como posso ajudar?`, 'bot')
    }
    inputEl.focus()
  }
  function fechar() { aberto = false; painel.classList.remove('aberto') }

  botao.addEventListener('click', () => (aberto ? fechar() : abrir()))
  painel.querySelector('.chat-ia-fechar').addEventListener('click', fechar)

  async function enviar(texto) {
    const msg = (texto || inputEl.value).trim()
    if (!msg) return
    inputEl.value = ''
    addBolha(msg, 'user')
    historico.push({ de: 'user', texto: msg })
    btnEnviar.disabled = true
    const pensando = addBolha('digitando...', 'bot')
    const r = await api.chat(msg, historico)
    pensando.remove()
    const resposta = (r && r.resposta) ? r.resposta : (r && r.erro) ? r.erro : 'Não consegui responder.'
    addBolha(resposta, 'bot')
    historico.push({ de: 'bot', texto: resposta })
    btnEnviar.disabled = false
    inputEl.focus()
  }

  painel.querySelector('#chat-ia-form').addEventListener('submit', (e) => { e.preventDefault(); enviar() })
  painel.querySelectorAll('.chat-ia-sugestao').forEach((s) => {
    s.addEventListener('click', () => enviar(s.textContent))
  })
}