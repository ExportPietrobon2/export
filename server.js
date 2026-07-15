const express = require('express')
const mysql = require('mysql2/promise')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const cloudinary = require('cloudinary').v2
const multer = require('multer')
const path = require('path')

const app = express()
app.use(express.json())
app.use(express.static(path.join(__dirname, '.')))

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})

const upload = multer({ storage: multer.memoryStorage() })

const EMAIL_TESTE = process.env.EMAIL_TESTE || 'pietrobonexport2@gmail.com'
const MODO_TESTE = process.env.MODO_TESTE !== 'false'

const BREVO_API_KEY = process.env.BREVO_API_KEY
const EMAIL_REMETENTE = process.env.EMAIL_REMETENTE || 'export2@pietrobon.com.br'

if (!BREVO_API_KEY) console.warn('⚠ BREVO_API_KEY não configurada — e-mails não serão enviados.')

async function getDestinatarios(papeis) {
  if (MODO_TESTE) return [EMAIL_TESTE]
  if (papeis && papeis.length) {
    const [rows] = await pool.query('SELECT email FROM usuarios WHERE papel IN (?)', [papeis])
    return rows.map((r) => r.email)
  }
  const [rows] = await pool.query('SELECT email FROM usuarios')
  return rows.map((r) => r.email)
}

async function enviarEmail(assunto, corpo, papeis) {
  try {
    if (!BREVO_API_KEY) return
    const destinatarios = await getDestinatarios(papeis)
    if (!destinatarios.length) return

    const html = `
        <div style="font-family:'Segoe UI',sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:linear-gradient(120deg,#ED3237,#C6242A);padding:24px 28px;border-radius:12px 12px 0 0;">
            <p style="color:#fff;font-size:1.2rem;font-weight:800;margin:0;">🏭 Pietrobon · Insumos</p>
          </div>
          <div style="background:#fff;padding:28px;border:1px solid #f0d0d0;border-top:none;border-radius:0 0 12px 12px;">
            ${corpo}
            <hr style="border:none;border-top:1px solid #f0d0d0;margin:24px 0;">
            <p style="font-size:0.78rem;color:#8a6a6a;margin:0;">Pietrobon & Cia Ltda · Controle de Insumos Exportação<br>
            ${MODO_TESTE ? '<strong style="color:#ED3237">⚠ Modo teste — notificação enviada apenas para ' + EMAIL_TESTE + '</strong>' : ''}</p>
          </div>
        </div>`

    const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json', 'accept': 'application/json' },
      body: JSON.stringify({
        sender: { email: EMAIL_REMETENTE, name: 'Pietrobon · Insumos' },
        to: destinatarios.map((email) => ({ email })),
        subject: assunto,
        htmlContent: html
      })
    })

    if (!resp.ok) {
      const txt = await resp.text()
      console.error('Erro Brevo:', resp.status, txt)
    } else {
      console.log('Email enviado:', assunto)
    }
  } catch (e) {
    console.error('Erro ao enviar email:', e.message)
  }
}

const pool = mysql.createPool({
  host: process.env.MYSQLHOST,
  port: process.env.MYSQLPORT,
  database: process.env.MYSQLDATABASE,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  waitForConnections: true,
  connectionLimit: 10
})

const JWT_SECRET = process.env.JWT_SECRET || 'segredo-trocar-em-producao'

function autenticar(papeis) {
  return (req, res, next) => {
    const cabecalho = req.headers.authorization
    if (!cabecalho) return res.status(401).json({ erro: 'Não autenticado' })
    const token = cabecalho.replace('Bearer ', '')
    try {
      const payload = jwt.verify(token, JWT_SECRET)
      if (papeis && !papeis.includes(payload.papel)) {
        return res.status(403).json({ erro: 'Sem permissão' })
      }
      req.usuario = payload
      next()
    } catch {
      return res.status(401).json({ erro: 'Token inválido' })
    }
  }
}

const TODOS = ['admin', 'almoxarifado', 'deposito', 'convidado', 'gerente_producao', 'compras']

app.post('/api/login', async (req, res) => {
  const { email, senha } = req.body
  const [rows] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [email])
  if (rows.length === 0) return res.status(401).json({ erro: 'E-mail ou senha incorretos.' })
  const usuario = rows[0]
  const senhaCorreta = await bcrypt.compare(senha, usuario.senha)
  if (!senhaCorreta) return res.status(401).json({ erro: 'E-mail ou senha incorretos.' })
  const expiracao = usuario.papel === 'deposito' ? '30d' : '8h'
  const token = jwt.sign(
    { id: usuario.id, nome: usuario.nome, papel: usuario.papel },
    JWT_SECRET,
    { expiresIn: expiracao }
  )
  res.json({ token, papel: usuario.papel, nome: usuario.nome })
})

app.get('/api/pedidos', autenticar(TODOS), async (req, res) => {
  const incluirConcluidas = req.query.incluirConcluidas === 'true'
  const condicao = incluirConcluidas ? '' : 'WHERE concluida = 0'
  const [pedidos] = await pool.query(`SELECT * FROM pedidos ${condicao} ORDER BY numero_pi DESC`)
  res.json(pedidos)
})

app.get('/api/pedidos/completo', autenticar(TODOS), async (req, res) => {
  const incluirConcluidas = req.query.incluirConcluidas === 'true'
  const condicao = incluirConcluidas ? '' : 'WHERE p.concluida = 0'
  const [pedidos] = await pool.query(`SELECT * FROM pedidos p ${condicao} ORDER BY p.numero_pi DESC`)

  for (const pedido of pedidos) {
    const [produtos] = await pool.query(
      'SELECT * FROM produtos_pi WHERE pi_id = ?', [pedido.id]
    )
    for (const produto of produtos) {
      const [insumos] = await pool.query(
        'SELECT * FROM insumos_produto WHERE produto_id = ?', [produto.id]
      )
      produto.insumos_produto = insumos
    }
    pedido.produtos_pi = produtos
    const [recebimentos] = await pool.query(
      `SELECT r.tipo, r.status_recebimento, r.foto_url, r.foto_nota_url, r.quantidade_recebida,
              r.produto_id, pr.produto as nome_produto
       FROM recebimentos_b2 r
       LEFT JOIN produtos_pi pr ON pr.id = r.produto_id
       WHERE r.pi_id = ?`,
      [pedido.id]
    )
    pedido.recebimentos_b2 = recebimentos

    const [vinculosEstoque] = await pool.query(
      `SELECT v.*, e.produto as produto_entrada, e.embalagem_kg as entrada_emb,
              e.rotulo_kg as entrada_rot, e.pallet_caixas as entrada_pal,
              e.foto_url as entrada_foto, e.foto_nota_url as entrada_foto_nota,
              e.localizacao as entrada_localizacao,
              e.criado_em as entrada_data
       FROM vinculos_insumos v
       JOIN estoque_insumos e ON e.id = v.entrada_id
       WHERE v.pi_id = ?
       ORDER BY v.criado_em DESC`,
      [pedido.id]
    )
    pedido.vinculos_estoque = vinculosEstoque
  }
  res.json(pedidos)
})

app.post('/api/pedidos', autenticar(['admin']), async (req, res) => {
  const { numero_pi, data_cadastro, cliente, destino } = req.body
  const [resultado] = await pool.query(
    'INSERT INTO pedidos (numero_pi, data_cadastro, cliente, destino) VALUES (?, ?, ?, ?)',
    [numero_pi, data_cadastro || null, cliente || null, destino || null]
  )
  const piId = resultado.insertId
  const tiposRecebimento = ['embalagem', 'rotulo', 'caixa']
  res.json({ id: piId })
})

app.patch('/api/pedidos/:id/embarque', autenticar(['admin', 'gerente_producao']), async (req, res) => {
  const { data_embarque } = req.body
  await pool.query('UPDATE pedidos SET data_embarque = ? WHERE id = ?', [data_embarque || null, req.params.id])

  const [[pi]] = await pool.query('SELECT numero_pi, cliente, destino FROM pedidos WHERE id = ?', [req.params.id])
  if (pi) {
    const dataFmt = data_embarque ? new Date(data_embarque + 'T00:00:00').toLocaleDateString('pt-BR') : '—'
    enviarEmail(
      `🚢 Data de embarque definida — PI ${pi.numero_pi}`,
      `<h2 style="color:#1565C0;margin:0 0 16px">🚢 Data de Embarque Definida</h2>
       <table style="width:100%;border-collapse:collapse;">
         <tr><td style="padding:8px 0;color:#8a6a6a;width:160px">PI</td><td style="padding:8px 0;font-weight:600">${pi.numero_pi}</td></tr>
         ${pi.cliente ? `<tr><td style="padding:8px 0;color:#8a6a6a">Cliente</td><td style="padding:8px 0;font-weight:600">${pi.cliente}</td></tr>` : ''}
         ${pi.destino ? `<tr><td style="padding:8px 0;color:#8a6a6a">Destino</td><td style="padding:8px 0;font-weight:600">${pi.destino}</td></tr>` : ''}
         <tr><td style="padding:8px 0;color:#8a6a6a">Data de embarque</td><td style="padding:8px 0;font-weight:600;color:#1565C0">${dataFmt}</td></tr>
       </table>`,
      ['admin', 'gerente_producao', 'almoxarifado']
    )
  }
  res.json({ ok: true })
})

app.patch('/api/pedidos/:id/comentario-embarque', autenticar(['admin']), async (req, res) => {
  const { comentario } = req.body
  await pool.query('UPDATE pedidos SET comentario_embarque = ? WHERE id = ?', [comentario || null, req.params.id])
  const [[pi]] = await pool.query('SELECT numero_pi, cliente FROM pedidos WHERE id = ?', [req.params.id])
  if (pi && comentario && comentario.trim()) {
    enviarEmail(
      `💬 Cobrança de embarque — PI ${pi.numero_pi}`,
      `<h2 style="color:#1565C0;margin:0 0 16px">💬 Comentário do Admin — Data de Embarque</h2>
       <table style="width:100%;border-collapse:collapse;">
         <tr><td style="padding:8px 0;color:#8a6a6a;width:140px">PI</td><td style="padding:8px 0;font-weight:600">${pi.numero_pi}</td></tr>
         ${pi.cliente ? `<tr><td style="padding:8px 0;color:#8a6a6a">Cliente</td><td style="padding:8px 0;font-weight:600">${pi.cliente}</td></tr>` : ''}
         <tr><td style="padding:8px 0;color:#8a6a6a">Comentário</td><td style="padding:8px 0;font-weight:600">${comentario}</td></tr>
       </table>
       <p style="margin:16px 0 0;color:#1565C0;font-weight:600">Gerente: por favor, defina a data de embarque desta PI.</p>`,
      ['admin', 'gerente_producao']
    )
  }
  res.json({ ok: true })
})

app.patch('/api/pedidos/:id/concluir', autenticar(['admin']), async (req, res) => {
  const { concluida } = req.body
  await pool.query('UPDATE pedidos SET concluida = ? WHERE id = ?', [concluida ? 1 : 0, req.params.id])
  res.json({ ok: true })
})

app.delete('/api/pedidos/:id', autenticar(['admin']), async (req, res) => {
  await pool.query('DELETE FROM pedidos WHERE id = ?', [req.params.id])
  res.json({ ok: true })
})

app.patch('/api/produtos/:id/quantidade', autenticar(['admin']), async (req, res) => {
  const { quantidade } = req.body
  await pool.query('UPDATE produtos_pi SET quantidade = ? WHERE id = ?', [quantidade, req.params.id])
  res.json({ ok: true })
})

app.get('/api/pedidos/:piId/produtos', autenticar(TODOS), async (req, res) => {
  const [produtos] = await pool.query(
    'SELECT * FROM produtos_pi WHERE pi_id = ?', [req.params.piId]
  )
  res.json(produtos)
})

app.post('/api/produtos', autenticar(['admin']), async (req, res) => {
  const { pi_id, produto, quantidade, observacoes } = req.body
  const [resultado] = await pool.query(
    'INSERT INTO produtos_pi (pi_id, produto, quantidade, observacoes) VALUES (?, ?, ?, ?)',
    [pi_id, produto, quantidade, observacoes || null]
  )
  const produtoId = resultado.insertId
  const tiposInsumo = ['embalagem', 'rotulo', 'caixa', 'etiqueta']
  for (const tipo of tiposInsumo) {
    await pool.query(
      'INSERT INTO insumos_produto (produto_id, tipo, confirmado, sobra, quantidade_por_pacote) VALUES (?, ?, 0, 0, 0)',
      [produtoId, tipo]
    )
  }
  const tiposRecebimento = ['embalagem', 'rotulo', 'caixa']
  const piId = req.body.pi_id
  for (const tipo of tiposRecebimento) {
    await pool.query(
      'INSERT INTO recebimentos_b2 (pi_id, produto_id, tipo, status_recebimento) VALUES (?, ?, ?, ?)',
      [piId, produtoId, tipo, 'pendente']
    )
  }
  res.json({ id: produtoId })
})

app.get('/api/produtos/:produtoId/insumos', autenticar(TODOS), async (req, res) => {
  const [produto] = await pool.query('SELECT * FROM produtos_pi WHERE id = ?', [req.params.produtoId])
  const [insumos] = await pool.query('SELECT * FROM insumos_produto WHERE produto_id = ?', [req.params.produtoId])
  res.json({ produto: produto[0], insumos })
})

app.patch('/api/produtos/:produtoId/insumos', autenticar(['admin', 'almoxarifado']), async (req, res) => {
  const { insumos, rotulos, observacoes, quantidade } = req.body

  const [antesInsumos] = await pool.query('SELECT tipo, confirmado FROM insumos_produto WHERE produto_id = ?', [req.params.produtoId])
  const antesSemEtiqueta = antesInsumos.filter((i) => i.tipo !== 'etiqueta')
  const eraLiberado = antesSemEtiqueta.length > 0 && antesSemEtiqueta.every((i) => i.confirmado)

  for (const insumo of (insumos || [])) {
    if (insumo.tipo === 'rotulo') continue
    let confirmado = 0
    if (insumo.tipo === 'etiqueta') {
      confirmado = 1
    } else if (insumo.tipo === 'caixa') {
      confirmado = Number(insumo.sobra) >= Number(quantidade) ? 1 : 0
    } else {
      confirmado = Number(insumo.sobra) > 0 ? 1 : 0
    }
    await pool.query(
      'UPDATE insumos_produto SET sobra = ?, quantidade_por_pacote = ?, confirmado = ? WHERE produto_id = ? AND tipo = ?',
      [insumo.sobra, insumo.quantidade_por_pacote || 0, confirmado, req.params.produtoId, insumo.tipo]
    )
  }

  if (Array.isArray(rotulos)) {
    await pool.query('DELETE FROM insumos_produto WHERE produto_id = ? AND tipo = ?', [req.params.produtoId, 'rotulo'])
    for (const r of rotulos) {
      const confirmado = Number(r.sobra) > 0 ? 1 : 0
      await pool.query(
        'INSERT INTO insumos_produto (produto_id, tipo, nome, confirmado, sobra, quantidade_por_pacote) VALUES (?, ?, ?, ?, ?, ?)',
        [req.params.produtoId, 'rotulo', r.nome || null, confirmado, r.sobra || 0, r.quantidade_por_pacote || 0]
      )
    }
  }

  if (observacoes !== undefined) {
    await pool.query('UPDATE produtos_pi SET observacoes = ? WHERE id = ?', [observacoes, req.params.produtoId])
  }

  await pool.query('UPDATE produtos_pi SET declarado_em = NOW() WHERE id = ? AND declarado_em IS NULL', [req.params.produtoId])

  const [produtoInfo] = await pool.query(
    'SELECT pp.pi_id, pp.produto, p.numero_pi, p.cliente FROM produtos_pi pp JOIN pedidos p ON p.id = pp.pi_id WHERE pp.id = ?',
    [req.params.produtoId]
  )
  const [todosInsumos] = await pool.query(
    'SELECT tipo, confirmado, sobra FROM insumos_produto WHERE produto_id = ?',
    [req.params.produtoId]
  )

  if (produtoInfo[0]) {
    const { numero_pi, cliente, produto } = produtoInfo[0]

    const semEtiqueta = todosInsumos.filter((i) => i.tipo !== 'etiqueta')
    const tudo = semEtiqueta.length > 0 && semEtiqueta.every((i) => i.confirmado)

    if (tudo && !eraLiberado) {
      enviarEmail(
        `✅ PI Liberada — ${numero_pi}`,
        `<h2 style="color:#2E7D32;margin:0 0 16px">✅ PI Liberada para Produção</h2>
         <table style="width:100%;border-collapse:collapse;">
           <tr><td style="padding:8px 0;color:#8a6a6a;width:140px">PI</td><td style="padding:8px 0;font-weight:600">${numero_pi}</td></tr>
           <tr><td style="padding:8px 0;color:#8a6a6a">Cliente</td><td style="padding:8px 0;font-weight:600">${cliente || '—'}</td></tr>
           <tr><td style="padding:8px 0;color:#8a6a6a">Produto</td><td style="padding:8px 0;font-weight:600">${produto}</td></tr>
         </table>
         <p style="margin:16px 0 0;color:#2E7D32;font-weight:600">Todos os insumos estão disponíveis para produção.</p>`,
        ['admin', 'gerente_producao', 'almoxarifado']
      )
    }
  }

  res.json({ ok: true })
})

app.get('/api/recebimentos/pendentes', autenticar(TODOS), async (req, res) => {
  const [pedidos] = await pool.query(`
    SELECT DISTINCT p.id, p.numero_pi, p.cliente
    FROM pedidos p
    JOIN recebimentos_b2 r ON r.pi_id = p.id
    WHERE p.concluida = 0
    ORDER BY p.numero_pi ASC
  `)

  for (const pedido of pedidos) {
    const [produtos] = await pool.query(
      'SELECT id, produto FROM produtos_pi WHERE pi_id = ? ORDER BY criado_em',
      [pedido.id]
    )
    for (const produto of produtos) {
      const [insumos] = await pool.query(
        'SELECT id, tipo, status_recebimento, quantidade_recebida, foto_url, foto_nota_url FROM recebimentos_b2 WHERE pi_id = ? AND produto_id = ?',
        [pedido.id, produto.id]
      )
      produto.insumos = insumos
    }
    pedido.produtos = produtos
  }

  res.json(pedidos)
})

app.patch('/api/recebimentos/:id', autenticar(['admin', 'deposito']), upload.fields([{ name: 'foto_produto', maxCount: 1 }, { name: 'foto_nota', maxCount: 1 }]), async (req, res) => {
  const { quantidade_recebida } = req.body
  let fotoProdutoUrl = null
  let fotoNotaUrl = null

  async function uploadFoto(buffer, pasta) {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { folder: pasta, resource_type: 'image' },
        (erro, resultado) => erro ? reject(erro) : resolve(resultado.secure_url)
      ).end(buffer)
    })
  }

  if (req.files?.foto_produto?.[0]) {
    fotoProdutoUrl = await uploadFoto(req.files.foto_produto[0].buffer, 'recebimentos/produtos')
  }
  if (req.files?.foto_nota?.[0]) {
    fotoNotaUrl = await uploadFoto(req.files.foto_nota[0].buffer, 'recebimentos/notas')
  }

  await pool.query(
    'UPDATE recebimentos_b2 SET status_recebimento = ?, recebido_em = NOW(), quantidade_recebida = ?, foto_url = ?, foto_nota_url = ? WHERE id = ?',
    ['recebido', quantidade_recebida || null, fotoProdutoUrl, fotoNotaUrl, req.params.id]
  )

  const [rec] = await pool.query(`
    SELECT r.tipo, r.quantidade_recebida, p.numero_pi, p.cliente, pr.produto
    FROM recebimentos_b2 r
    JOIN pedidos p ON p.id = r.pi_id
    LEFT JOIN produtos_pi pr ON pr.id = r.produto_id
    WHERE r.id = ?
  `, [req.params.id])

  if (rec[0]) {
    const { tipo, quantidade_recebida: qtd, numero_pi, cliente, produto } = rec[0]
    const tipoLabel = { embalagem: 'Embalagem', rotulo: 'Rótulo', caixa: 'Caixa' }[tipo] || tipo
    enviarEmail(
      `📦 Recebimento confirmado — PI ${numero_pi}`,
      `<h2 style="color:#2E7D32;margin:0 0 16px">✅ Recebimento Confirmado</h2>
       <table style="width:100%;border-collapse:collapse;">
         <tr><td style="padding:8px 0;color:#8a6a6a;width:140px">PI</td><td style="padding:8px 0;font-weight:600">${numero_pi}</td></tr>
         <tr><td style="padding:8px 0;color:#8a6a6a">Cliente</td><td style="padding:8px 0;font-weight:600">${cliente || '—'}</td></tr>
         ${produto ? `<tr><td style="padding:8px 0;color:#8a6a6a">Produto</td><td style="padding:8px 0;font-weight:600">${produto}</td></tr>` : ''}
         <tr><td style="padding:8px 0;color:#8a6a6a">Insumo</td><td style="padding:8px 0;font-weight:600">${tipoLabel}</td></tr>
         ${qtd ? `<tr><td style="padding:8px 0;color:#8a6a6a">Quantidade</td><td style="padding:8px 0;font-weight:600">${qtd}</td></tr>` : ''}
       </table>`,
      ['admin', 'almoxarifado']
    )
  }

  res.json({ ok: true })
})

app.patch('/api/recebimentos/:id/excluir-foto', autenticar(['admin']), async (req, res) => {
  const { campo } = req.body
  if (!['foto_url', 'foto_nota_url'].includes(campo)) {
    return res.status(400).json({ erro: 'Campo inválido' })
  }

  const [rows] = await pool.query(`SELECT ${campo} FROM recebimentos_b2 WHERE id = ?`, [req.params.id])
  if (rows.length && rows[0][campo]) {
    const urlFoto = rows[0][campo]
    const partes = urlFoto.split('/')
    const publicId = partes.slice(partes.indexOf('recebimentos')).join('/').replace(/\.[^/.]+$/, '')
    try {
      await cloudinary.uploader.destroy(publicId)
    } catch (e) {
      console.error('Erro ao apagar foto do Cloudinary:', e.message)
    }
  }

  const outrosCampos = campo === 'foto_url' ? 'foto_nota_url' : 'foto_url'
  const [rec] = await pool.query(`SELECT ${outrosCampos}, status_recebimento FROM recebimentos_b2 WHERE id = ?`, [req.params.id])
  const outraFoto = rec[0]?.[outrosCampos]
  const novoStatus = outraFoto ? 'recebido' : 'pendente'

  await pool.query(
    `UPDATE recebimentos_b2 SET ${campo} = NULL, status_recebimento = ? WHERE id = ?`,
    [novoStatus, req.params.id]
  )
  res.json({ ok: true })
})

app.get('/api/usuarios', autenticar(['admin']), async (req, res) => {
  const [rows] = await pool.query('SELECT id, nome, email, papel FROM usuarios ORDER BY nome')
  res.json(rows)
})

app.post('/api/usuarios', autenticar(['admin']), async (req, res) => {
  const { nome, email, senha, papel } = req.body
  const hash = await bcrypt.hash(senha, 10)
  const [resultado] = await pool.query(
    'INSERT INTO usuarios (nome, email, senha, papel) VALUES (?, ?, ?, ?)',
    [nome, email, hash, papel]
  )
  res.json({ id: resultado.insertId })
})

app.delete('/api/usuarios/:id', autenticar(['admin']), async (req, res) => {
  await pool.query('DELETE FROM usuarios WHERE id = ?', [req.params.id])
  res.json({ ok: true })
})


app.post('/api/estoque/entrada', autenticar(['admin', 'deposito']), upload.fields([{ name: 'foto_produto', maxCount: 1 }, { name: 'foto_nota', maxCount: 1 }]), async (req, res) => {
  const { embalagem_kg, rotulo_kg, pallet_caixas, produto, localizacao } = req.body
  let fotoUrl = null
  let fotoNotaUrl = null

  async function uploadFoto(buffer, pasta) {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { folder: pasta, resource_type: 'image' },
        (erro, resultado) => erro ? reject(erro) : resolve(resultado.secure_url)
      ).end(buffer)
    })
  }

  if (req.files?.foto_produto?.[0]) {
    fotoUrl = await uploadFoto(req.files.foto_produto[0].buffer, 'estoque/produtos')
  }
  if (req.files?.foto_nota?.[0]) {
    fotoNotaUrl = await uploadFoto(req.files.foto_nota[0].buffer, 'estoque/notas')
  }

  await pool.query(
    'INSERT INTO estoque_insumos (produto, embalagem_kg, rotulo_kg, pallet_caixas, foto_url, foto_nota_url, localizacao) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [produto || null, parseFloat(embalagem_kg) || 0, parseFloat(rotulo_kg) || 0, parseInt(pallet_caixas) || 0, fotoUrl, fotoNotaUrl, localizacao || null]
  )

  res.json({ ok: true })
})

app.get('/api/estoque/historico', autenticar(TODOS), async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM estoque_insumos ORDER BY criado_em DESC LIMIT 50')
  res.json(rows)
})

app.get('/api/estoque/saldo', autenticar(TODOS), async (req, res) => {
  const [[entradas]] = await pool.query(
    'SELECT COALESCE(SUM(embalagem_kg),0) as emb, COALESCE(SUM(rotulo_kg),0) as rot, COALESCE(SUM(pallet_caixas),0) as pal FROM estoque_insumos'
  )
  const [[vinculos]] = await pool.query(
    'SELECT COALESCE(SUM(embalagem_kg),0) as emb, COALESCE(SUM(rotulo_kg),0) as rot, COALESCE(SUM(pallet_caixas),0) as pal FROM vinculos_insumos'
  )
  res.json({
    embalagem_kg: Math.max(0, parseFloat(entradas.emb) - parseFloat(vinculos.emb)),
    rotulo_kg: Math.max(0, parseFloat(entradas.rot) - parseFloat(vinculos.rot)),
    pallet_caixas: Math.max(0, parseInt(entradas.pal) - parseInt(vinculos.pal))
  })
})

app.get('/api/estoque/vinculos', autenticar(TODOS), async (req, res) => {
  const [rows] = await pool.query(`
    SELECT v.*, p.numero_pi, p.cliente
    FROM vinculos_insumos v
    JOIN pedidos p ON p.id = v.pi_id
    ORDER BY v.criado_em DESC LIMIT 100
  `)
  res.json(rows)
})

app.post('/api/estoque/vincular', autenticar(['admin', 'almoxarifado']), async (req, res) => {
  const { entrada_id, pi_id, produto, embalagem_kg, rotulo_kg, pallet_caixas } = req.body

  const [[entrada]] = await pool.query(
    'SELECT embalagem_kg, rotulo_kg, pallet_caixas FROM estoque_insumos WHERE id = ?', [entrada_id]
  )
  if (!entrada) return res.status(400).json({ erro: 'Entrada não encontrada.' })

  const [[vinculados]] = await pool.query(
    'SELECT COALESCE(SUM(embalagem_kg),0) as emb, COALESCE(SUM(rotulo_kg),0) as rot, COALESCE(SUM(pallet_caixas),0) as pal FROM vinculos_insumos WHERE entrada_id = ?',
    [entrada_id]
  )
  const saldoEmb = parseFloat(entrada.embalagem_kg) - parseFloat(vinculados.emb)
  const saldoRot = parseFloat(entrada.rotulo_kg) - parseFloat(vinculados.rot)
  const saldoPal = parseInt(entrada.pallet_caixas) - parseInt(vinculados.pal)

  if ((parseFloat(embalagem_kg) || 0) > saldoEmb) return res.status(400).json({ erro: `Saldo insuficiente de embalagem. Disponível: ${saldoEmb} kg` })
  if ((parseFloat(rotulo_kg) || 0) > saldoRot) return res.status(400).json({ erro: `Saldo insuficiente de rótulo. Disponível: ${saldoRot} kg` })
  if ((parseInt(pallet_caixas) || 0) > saldoPal) return res.status(400).json({ erro: `Saldo insuficiente de pallets. Disponível: ${saldoPal}` })

  await pool.query(
    'INSERT INTO vinculos_insumos (entrada_id, pi_id, produto, embalagem_kg, rotulo_kg, pallet_caixas) VALUES (?, ?, ?, ?, ?, ?)',
    [entrada_id, pi_id, produto || null, parseFloat(embalagem_kg) || 0, parseFloat(rotulo_kg) || 0, parseInt(pallet_caixas) || 0]
  )

  res.json({ ok: true })
})


app.delete('/api/estoque/entradas/:id', autenticar(['admin', 'deposito']), async (req, res) => {
  await pool.query('DELETE FROM estoque_insumos WHERE id = ?', [req.params.id])
  res.json({ ok: true })
})

app.patch('/api/estoque/entradas/:id/produto', autenticar(['admin', 'almoxarifado']), async (req, res) => {
  const { produto } = req.body
  await pool.query('UPDATE estoque_insumos SET produto = ? WHERE id = ?', [produto || null, req.params.id])
  res.json({ ok: true })
})

app.patch('/api/estoque/entradas/:id/localizacao', autenticar(['admin', 'almoxarifado', 'deposito']), async (req, res) => {
  const { localizacao } = req.body
  await pool.query('UPDATE estoque_insumos SET localizacao = ? WHERE id = ?', [localizacao || null, req.params.id])
  res.json({ ok: true })
})

app.patch('/api/estoque/vinculos/:id', autenticar(['admin', 'almoxarifado']), async (req, res) => {
  const { pi_id, embalagem_kg, rotulo_kg, pallet_caixas } = req.body

  const [[entradas]] = await pool.query(
    'SELECT COALESCE(SUM(embalagem_kg),0) as emb, COALESCE(SUM(rotulo_kg),0) as rot, COALESCE(SUM(pallet_caixas),0) as pal FROM estoque_insumos'
  )
  const [[outros]] = await pool.query(
    'SELECT COALESCE(SUM(embalagem_kg),0) as emb, COALESCE(SUM(rotulo_kg),0) as rot, COALESCE(SUM(pallet_caixas),0) as pal FROM vinculos_insumos WHERE id != ?',
    [req.params.id]
  )
  const saldoEmb = parseFloat(entradas.emb) - parseFloat(outros.emb)
  const saldoRot = parseFloat(entradas.rot) - parseFloat(outros.rot)
  const saldoPal = parseInt(entradas.pal) - parseInt(outros.pal)

  if ((parseFloat(embalagem_kg) || 0) > saldoEmb) return res.status(400).json({ erro: `Saldo insuficiente de embalagem. Disponível: ${saldoEmb} kg` })
  if ((parseFloat(rotulo_kg) || 0) > saldoRot) return res.status(400).json({ erro: `Saldo insuficiente de rótulo. Disponível: ${saldoRot} kg` })
  if ((parseInt(pallet_caixas) || 0) > saldoPal) return res.status(400).json({ erro: `Saldo insuficiente de pallets. Disponível: ${saldoPal}` })

  const { produto } = req.body
  await pool.query(
    'UPDATE vinculos_insumos SET pi_id = ?, produto = ?, embalagem_kg = ?, rotulo_kg = ?, pallet_caixas = ? WHERE id = ?',
    [pi_id, produto || null, parseFloat(embalagem_kg) || 0, parseFloat(rotulo_kg) || 0, parseInt(pallet_caixas) || 0, req.params.id]
  )
  res.json({ ok: true })
})

app.delete('/api/estoque/vinculos/:id', autenticar(['admin', 'almoxarifado']), async (req, res) => {
  await pool.query('DELETE FROM vinculos_insumos WHERE id = ?', [req.params.id])
  res.json({ ok: true })
})

async function verificarAlertasEmbarque() {
  try {
    const [pis] = await pool.query(
      `SELECT id, numero_pi, cliente, destino, data_embarque
       FROM pedidos
       WHERE concluida = 0 AND data_embarque IS NOT NULL
         AND data_embarque <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
       ORDER BY data_embarque ASC`
    )

    const alertas = []
    for (const pi of pis) {
      const [[tot]] = await pool.query('SELECT COUNT(*) as total FROM produtos_pi WHERE pi_id = ?', [pi.id])
      const [[pend]] = await pool.query(
        `SELECT COUNT(*) as pendentes
         FROM produtos_pi pp
         JOIN insumos_produto ip ON ip.produto_id = pp.id
         WHERE pp.pi_id = ? AND ip.confirmado = 0`,
        [pi.id]
      )
      const pronta = tot.total > 0 && pend.pendentes === 0
      if (!pronta) alertas.push(pi)
    }

    if (!alertas.length) return

    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const linhas = alertas.map((pi) => {
      const alvo = new Date(String(pi.data_embarque).slice(0, 10) + 'T00:00:00')
      const dias = Math.round((alvo - hoje) / 86400000)
      const quando = dias < 0 ? `VENCIDO há ${Math.abs(dias)} dia(s)` : dias === 0 ? 'HOJE' : `em ${dias} dia(s)`
      const dataFmt = alvo.toLocaleDateString('pt-BR')
      return `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #f0d0d0;font-weight:700">PI ${pi.numero_pi}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f0d0d0">${pi.cliente || '—'}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f0d0d0;color:#ED3237;font-weight:700">${dataFmt} (${quando})</td>
      </tr>`
    }).join('')

    enviarEmail(
      `🚨 ALERTA: ${alertas.length} PI(s) perto do embarque e SEM estar pronta`,
      `<h2 style="color:#ED3237;margin:0 0 16px">🚨 PIs em Risco de Embarque</h2>
       <p style="margin:0 0 12px;color:#8a6a6a">As PIs abaixo têm embarque em até 7 dias (ou já vencido) e ainda possuem itens pendentes no almoxarifado:</p>
       <table style="width:100%;border-collapse:collapse;">
         <thead><tr>
           <th style="text-align:left;padding:8px 10px;border-bottom:2px solid #ED3237">PI</th>
           <th style="text-align:left;padding:8px 10px;border-bottom:2px solid #ED3237">Cliente</th>
           <th style="text-align:left;padding:8px 10px;border-bottom:2px solid #ED3237">Embarque</th>
         </tr></thead>
         <tbody>${linhas}</tbody>
       </table>`,
      ['admin', 'gerente_producao']
    )
    console.log(`Alerta de embarque enviado: ${alertas.length} PI(s)`)
  } catch (e) {
    console.error('Erro no alerta de embarque:', e.message)
  }
}

setTimeout(verificarAlertasEmbarque, 60 * 1000)
setInterval(verificarAlertasEmbarque, 24 * 60 * 60 * 1000)

const SQL_DECLARACAO_PENDENTE = `
  SELECT pp.id as produto_id, pp.produto, pp.criado_em,
         p.id as pi_id, p.numero_pi, p.cliente
  FROM produtos_pi pp
  JOIN pedidos p ON p.id = pp.pi_id
  WHERE p.concluida = 0 AND pp.declarado_em IS NULL
    AND pp.criado_em <= DATE_SUB(NOW(), INTERVAL 48 HOUR)
    AND NOT EXISTS (SELECT 1 FROM insumos_produto ip WHERE ip.produto_id = pp.id AND ip.sobra > 0)
  ORDER BY pp.criado_em ASC`

async function verificarAlertasDeclaracao() {
  try {
    const [rows] = await pool.query(SQL_DECLARACAO_PENDENTE)
    if (!rows.length) return

    const linhas = rows.map((r) => {
      const horas = Math.floor((Date.now() - new Date(r.criado_em).getTime()) / 3600000)
      return `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #f0d0d0;font-weight:700">PI ${r.numero_pi}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f0d0d0">${r.cliente || '—'}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f0d0d0">${r.produto}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f0d0d0;color:#E65100;font-weight:700">há ${horas}h sem declarar</td>
      </tr>`
    }).join('')

    enviarEmail(
      `⏰ ALERTA: ${rows.length} produto(s) sem estoque declarado há mais de 48h`,
      `<h2 style="color:#E65100;margin:0 0 16px">⏰ Estoque não declarado pelo Almoxarifado</h2>
       <p style="margin:0 0 12px;color:#8a6a6a">Os produtos abaixo foram cadastrados há mais de 48h e ainda não tiveram o informe de estoque salvo no almoxarifado:</p>
       <table style="width:100%;border-collapse:collapse;">
         <thead><tr>
           <th style="text-align:left;padding:8px 10px;border-bottom:2px solid #E65100">PI</th>
           <th style="text-align:left;padding:8px 10px;border-bottom:2px solid #E65100">Cliente</th>
           <th style="text-align:left;padding:8px 10px;border-bottom:2px solid #E65100">Produto</th>
           <th style="text-align:left;padding:8px 10px;border-bottom:2px solid #E65100">Situação</th>
         </tr></thead>
         <tbody>${linhas}</tbody>
       </table>`,
      ['admin', 'almoxarifado']
    )
    console.log(`Alerta de declaração enviado: ${rows.length} produto(s)`)
  } catch (e) {
    console.error('Erro no alerta de declaração:', e.message)
  }
}

setTimeout(verificarAlertasDeclaracao, 90 * 1000)
setInterval(verificarAlertasDeclaracao, 24 * 60 * 60 * 1000)

app.get('/api/alertas/declaracao', autenticar(TODOS), async (req, res) => {
  const [rows] = await pool.query(SQL_DECLARACAO_PENDENTE)
  res.json(rows)
})

// =============================================
// COMPRAS
// =============================================

const tipoLabelCompra = { embalagem: 'Embalagem', rotulo: 'Rótulo', caixa: 'Caixa', etiqueta: 'Etiqueta', outro: 'Outro' }

app.get('/api/compras', autenticar(TODOS), async (req, res) => {
  const [rows] = await pool.query(`
    SELECT c.*, p.numero_pi, p.cliente, p.data_embarque
    FROM compras c
    LEFT JOIN pedidos p ON p.id = c.pi_id
    ORDER BY c.criado_em DESC LIMIT 300`)
  res.json(rows)
})

app.post('/api/compras', autenticar(['admin', 'compras']), async (req, res) => {
  const { descricao, tipo, quantidade, unidade, fornecedor, data_compra, data_prevista, custo, pi_id, observacoes, status } = req.body
  if (!descricao) return res.status(400).json({ erro: 'Informe o que está sendo comprado.' })

  const [r] = await pool.query(
    `INSERT INTO compras (descricao, tipo, quantidade, unidade, fornecedor, data_compra, data_prevista, custo, pi_id, observacoes, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [descricao, tipo || 'outro', parseFloat(quantidade) || 0, unidade || null, fornecedor || null,
     data_compra || null, data_prevista || null, (custo !== undefined && custo !== null && custo !== '') ? parseFloat(custo) : null,
     pi_id || null, observacoes || null, status || 'comprado']
  )

  res.json({ id: r.insertId })
})

app.patch('/api/compras/:id', autenticar(['admin', 'compras']), async (req, res) => {
  const campos = ['descricao', 'tipo', 'quantidade', 'unidade', 'fornecedor', 'data_compra', 'data_prevista', 'custo', 'pi_id', 'observacoes', 'status']
  const sets = []
  const vals = []
  for (const campo of campos) {
    if (campo in req.body) {
      let v = req.body[campo]
      if ((campo === 'quantidade' || campo === 'custo') && v !== '' && v !== null) v = parseFloat(v)
      if (v === '') v = null
      sets.push(`${campo} = ?`)
      vals.push(v)
    }
  }
  if (!sets.length) return res.json({ ok: true })
  vals.push(req.params.id)
  await pool.query(`UPDATE compras SET ${sets.join(', ')} WHERE id = ?`, vals)
  res.json({ ok: true })
})

app.patch('/api/compras/:id/receber', autenticar(['admin', 'compras']), async (req, res) => {
  await pool.query(`UPDATE compras SET status = 'recebido', recebido_em = NOW() WHERE id = ?`, [req.params.id])
  const [[c]] = await pool.query(`SELECT c.*, p.numero_pi FROM compras c LEFT JOIN pedidos p ON p.id = c.pi_id WHERE c.id = ?`, [req.params.id])
  if (c) {
    enviarEmail(
      `📦 Compra recebida — lançar no estoque B2 (${c.descricao})`,
      `<h2 style="color:#2E7D32;margin:0 0 16px">📦 Compra Recebida</h2>
       <p style="margin:0 0 12px;color:#8a6a6a">O setor de compras marcou este item como recebido. Depósito/almoxarifado: confiram e lancem no estoque B2.</p>
       <table style="width:100%;border-collapse:collapse;">
         <tr><td style="padding:8px 0;color:#8a6a6a;width:160px">Item</td><td style="padding:8px 0;font-weight:600">${c.descricao}</td></tr>
         <tr><td style="padding:8px 0;color:#8a6a6a">Tipo</td><td style="padding:8px 0;font-weight:600">${tipoLabelCompra[c.tipo] || 'Outro'}</td></tr>
         ${c.quantidade > 0 ? `<tr><td style="padding:8px 0;color:#8a6a6a">Quantidade</td><td style="padding:8px 0;font-weight:600">${c.quantidade} ${c.unidade || ''}</td></tr>` : ''}
         ${c.fornecedor ? `<tr><td style="padding:8px 0;color:#8a6a6a">Fornecedor</td><td style="padding:8px 0;font-weight:600">${c.fornecedor}</td></tr>` : ''}
         ${c.numero_pi ? `<tr><td style="padding:8px 0;color:#8a6a6a">PI vinculada</td><td style="padding:8px 0;font-weight:600">${c.numero_pi}</td></tr>` : ''}
       </table>`,
      ['admin', 'deposito', 'almoxarifado']
    )
  }
  res.json({ ok: true })
})

app.delete('/api/compras/:id', autenticar(['admin', 'compras']), async (req, res) => {
  await pool.query('DELETE FROM compras WHERE id = ?', [req.params.id])
  res.json({ ok: true })
})

app.patch('/api/compras/:id/observacao', autenticar(['admin', 'compras']), async (req, res) => {
  const { observacoes } = req.body
  await pool.query('UPDATE compras SET observacoes = ? WHERE id = ?', [observacoes || null, req.params.id])
  const [[c]] = await pool.query('SELECT descricao FROM compras WHERE id = ?', [req.params.id])
  if (c && observacoes && observacoes.trim()) {
    enviarEmail(
      `📝 Observação na compra — ${c.descricao}`,
      `<h2 style="color:#E65100;margin:0 0 16px">📝 Observação / Verificação de Compra</h2>
       <table style="width:100%;border-collapse:collapse;">
         <tr><td style="padding:8px 0;color:#8a6a6a;width:140px">Item</td><td style="padding:8px 0;font-weight:600">${c.descricao}</td></tr>
         <tr><td style="padding:8px 0;color:#8a6a6a">Observação</td><td style="padding:8px 0;font-weight:600">${observacoes}</td></tr>
       </table>`,
      ['compras', 'admin']
    )
  }
  res.json({ ok: true })
})

app.get('/api/compras/sugestoes', autenticar(TODOS), async (req, res) => {
  const [rows] = await pool.query(`
    SELECT p.id as pi_id, p.numero_pi, p.cliente, p.data_embarque,
           pp.id as produto_id, pp.produto, pp.quantidade,
           ip.tipo as insumo_tipo, ip.sobra
    FROM pedidos p
    JOIN produtos_pi pp ON pp.pi_id = p.id
    JOIN insumos_produto ip ON ip.produto_id = pp.id
    WHERE p.concluida = 0
      AND ( ip.confirmado = 0 OR (ip.tipo = 'etiqueta' AND ip.sobra < 100) )
    ORDER BY (p.data_embarque IS NULL), p.data_embarque ASC, p.numero_pi ASC`)
  res.json(rows)
})

async function verificarComprasAtrasadas() {
  try {
    const [rows] = await pool.query(`
      SELECT c.*, p.numero_pi FROM compras c
      LEFT JOIN pedidos p ON p.id = c.pi_id
      WHERE c.status <> 'recebido' AND c.data_prevista IS NOT NULL AND c.data_prevista < CURDATE()
      ORDER BY c.data_prevista ASC`)
    if (!rows.length) return

    const linhas = rows.map((c) => {
      const prev = new Date(String(c.data_prevista).slice(0, 10) + 'T00:00:00')
      const dias = Math.floor((Date.now() - prev.getTime()) / 86400000)
      return `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #f0d0d0;font-weight:700">${c.descricao}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f0d0d0">${c.fornecedor || '—'}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f0d0d0">${c.numero_pi ? 'PI ' + c.numero_pi : 'Estoque geral'}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f0d0d0;color:#ED3237;font-weight:700">atrasada ${dias} dia(s)</td>
      </tr>`
    }).join('')

    enviarEmail(
      `⏰ ALERTA: ${rows.length} compra(s) atrasada(s) na entrega`,
      `<h2 style="color:#ED3237;margin:0 0 16px">⏰ Compras com Entrega Atrasada</h2>
       <p style="margin:0 0 12px;color:#8a6a6a">As compras abaixo passaram da data prevista de chegada e ainda não foram marcadas como recebidas:</p>
       <table style="width:100%;border-collapse:collapse;">
         <thead><tr>
           <th style="text-align:left;padding:8px 10px;border-bottom:2px solid #ED3237">Item</th>
           <th style="text-align:left;padding:8px 10px;border-bottom:2px solid #ED3237">Fornecedor</th>
           <th style="text-align:left;padding:8px 10px;border-bottom:2px solid #ED3237">Destino</th>
           <th style="text-align:left;padding:8px 10px;border-bottom:2px solid #ED3237">Situação</th>
         </tr></thead>
         <tbody>${linhas}</tbody>
       </table>`,
      ['admin', 'compras']
    )
    console.log(`Alerta de compras atrasadas enviado: ${rows.length}`)
  } catch (e) {
    console.error('Erro no alerta de compras atrasadas:', e.message)
  }
}

setTimeout(verificarComprasAtrasadas, 120 * 1000)
setInterval(verificarComprasAtrasadas, 24 * 60 * 60 * 1000)

// =============================================
// DEMANDAS DE COMPRA
// =============================================

app.get('/api/demandas', autenticar(TODOS), async (req, res) => {
  const [rows] = await pool.query(`
    SELECT d.*, p.numero_pi, p.cliente
    FROM demandas d
    LEFT JOIN pedidos p ON p.id = d.pi_id
    ORDER BY (d.status <> 'pendente'), d.criado_em DESC LIMIT 300`)
  res.json(rows)
})

app.post('/api/demandas', autenticar(['admin', 'almoxarifado']), async (req, res) => {
  const { descricao, quantidade, unidade, pi_id, observacoes } = req.body
  if (!descricao) return res.status(400).json({ erro: 'Informe o que está faltando.' })

  const [r] = await pool.query(
    `INSERT INTO demandas (descricao, quantidade, unidade, pi_id, observacoes, solicitante)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [descricao, parseFloat(quantidade) || 0, unidade || null, pi_id || null, observacoes || null, req.usuario && req.usuario.nome ? req.usuario.nome : null]
  )

  const [[pi]] = pi_id ? await pool.query('SELECT numero_pi FROM pedidos WHERE id = ?', [pi_id]) : [[null]]
  enviarEmail(
    `📌 Nova demanda de compra — ${descricao}`,
    `<h2 style="color:#6A1B9A;margin:0 0 16px">📌 Nova Demanda de Compra</h2>
     <table style="width:100%;border-collapse:collapse;">
       <tr><td style="padding:8px 0;color:#8a6a6a;width:160px">Item</td><td style="padding:8px 0;font-weight:600">${descricao}</td></tr>
       ${parseFloat(quantidade) > 0 ? `<tr><td style="padding:8px 0;color:#8a6a6a">Quantidade</td><td style="padding:8px 0;font-weight:600">${quantidade} ${unidade || ''}</td></tr>` : ''}
       ${pi && pi.numero_pi ? `<tr><td style="padding:8px 0;color:#8a6a6a">PI</td><td style="padding:8px 0;font-weight:600">${pi.numero_pi}</td></tr>` : ''}
       ${req.usuario && req.usuario.nome ? `<tr><td style="padding:8px 0;color:#8a6a6a">Solicitante</td><td style="padding:8px 0;font-weight:600">${req.usuario.nome}</td></tr>` : ''}
     </table>
     <p style="margin:16px 0 0;color:#6A1B9A;font-weight:600">Compras: verificar disponibilidade e marcar "Tenho" ou "Não tenho".</p>`,
    ['admin', 'compras']
  )
  res.json({ id: r.insertId })
})

app.patch('/api/demandas/:id/status', autenticar(['admin', 'compras']), async (req, res) => {
  const { status } = req.body
  if (!['tem', 'nao_tem', 'pendente'].includes(status)) return res.status(400).json({ erro: 'Status inválido.' })
  const quem = req.usuario && req.usuario.nome ? req.usuario.nome : null
  await pool.query('UPDATE demandas SET status = ?, respondido_por = ?, respondido_em = NOW() WHERE id = ?', [status, quem, req.params.id])

  const [[d]] = await pool.query('SELECT d.*, p.numero_pi FROM demandas d LEFT JOIN pedidos p ON p.id = d.pi_id WHERE d.id = ?', [req.params.id])
  if (d) {
    const label = status === 'tem' ? '✔ TEM em estoque' : status === 'nao_tem' ? '✖ NÃO TEM — precisa comprar' : 'Pendente'
    const cor = status === 'nao_tem' ? '#ED3237' : '#2E7D32'
    enviarEmail(
      `📌 Demanda respondida (${status === 'nao_tem' ? 'NÃO TEM' : status === 'tem' ? 'TEM' : 'pendente'}) — ${d.descricao}`,
      `<h2 style="color:${cor};margin:0 0 16px">📌 Demanda de Compra Respondida</h2>
       <table style="width:100%;border-collapse:collapse;">
         <tr><td style="padding:8px 0;color:#8a6a6a;width:160px">Item</td><td style="padding:8px 0;font-weight:600">${d.descricao}</td></tr>
         ${d.numero_pi ? `<tr><td style="padding:8px 0;color:#8a6a6a">PI</td><td style="padding:8px 0;font-weight:600">${d.numero_pi}</td></tr>` : ''}
         <tr><td style="padding:8px 0;color:#8a6a6a">Resposta</td><td style="padding:8px 0;font-weight:700;color:${cor}">${label}</td></tr>
         ${quem ? `<tr><td style="padding:8px 0;color:#8a6a6a">Respondido por</td><td style="padding:8px 0;font-weight:600">${quem}</td></tr>` : ''}
       </table>`,
      ['admin', 'almoxarifado', 'compras']
    )
  }
  res.json({ ok: true })
})

app.delete('/api/demandas/:id', autenticar(['admin', 'almoxarifado']), async (req, res) => {
  await pool.query('DELETE FROM demandas WHERE id = ?', [req.params.id])
  res.json({ ok: true })
})

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'))
})

app.use((err, req, res, next) => {
  console.error('Erro na requisição:', err && err.message ? err.message : err)
  if (!res.headersSent) res.status(500).json({ erro: 'Erro no servidor. Tente novamente.' })
})

process.on('unhandledRejection', (err) => {
  console.error('Erro não tratado (promise):', err && err.message ? err.message : err)
})
process.on('uncaughtException', (err) => {
  console.error('Exceção não tratada:', err && err.message ? err.message : err)
})

const PORTA = process.env.PORT || 8080
app.listen(PORTA, '0.0.0.0', () => console.log(`Servidor rodando na porta ${PORTA}`))