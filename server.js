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

app.post('/api/login', async (req, res) => {
  const { email, senha } = req.body
  const [rows] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [email])
  if (rows.length === 0) return res.status(401).json({ erro: 'E-mail ou senha incorretos.' })
  const usuario = rows[0]
  const senhaCorreta = await bcrypt.compare(senha, usuario.senha)
  if (!senhaCorreta) return res.status(401).json({ erro: 'E-mail ou senha incorretos.' })
  const token = jwt.sign(
    { id: usuario.id, nome: usuario.nome, papel: usuario.papel },
    JWT_SECRET,
    { expiresIn: '8h' }
  )
  res.json({ token, papel: usuario.papel, nome: usuario.nome })
})

app.get('/api/pedidos', autenticar(['admin', 'almoxarifado', 'deposito']), async (req, res) => {
  const incluirConcluidas = req.query.incluirConcluidas === 'true'
  const condicao = incluirConcluidas ? '' : 'WHERE concluida = 0'
  const [pedidos] = await pool.query(`SELECT * FROM pedidos ${condicao} ORDER BY numero_pi DESC`)
  res.json(pedidos)
})

app.get('/api/pedidos/completo', autenticar(['admin']), async (req, res) => {
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
      'SELECT * FROM recebimentos_b2 WHERE pi_id = ?', [pedido.id]
    )
    pedido.recebimentos_b2 = recebimentos
  }
  res.json(pedidos)
})

app.post('/api/pedidos', autenticar(['admin']), async (req, res) => {
  const { numero_pi, data_embarque, cliente, destino } = req.body
  const [resultado] = await pool.query(
    'INSERT INTO pedidos (numero_pi, data_embarque, cliente, destino) VALUES (?, ?, ?, ?)',
    [numero_pi, data_embarque || null, cliente || null, destino || null]
  )
  const piId = resultado.insertId
  const tiposRecebimento = ['embalagem', 'rotulo', 'caixa']
  for (const tipo of tiposRecebimento) {
    await pool.query(
      'INSERT INTO recebimentos_b2 (pi_id, tipo, status_recebimento) VALUES (?, ?, ?)',
      [piId, tipo, 'pendente']
    )
  }
  res.json({ id: piId })
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

app.get('/api/pedidos/:piId/produtos', autenticar(['admin', 'almoxarifado', 'deposito']), async (req, res) => {
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
  res.json({ id: produtoId })
})

app.get('/api/produtos/:produtoId/insumos', autenticar(['admin', 'almoxarifado']), async (req, res) => {
  const [produto] = await pool.query('SELECT * FROM produtos_pi WHERE id = ?', [req.params.produtoId])
  const [insumos] = await pool.query('SELECT * FROM insumos_produto WHERE produto_id = ?', [req.params.produtoId])
  res.json({ produto: produto[0], insumos })
})

app.patch('/api/produtos/:produtoId/insumos', autenticar(['admin', 'almoxarifado']), async (req, res) => {
  const { insumos, observacoes, quantidade } = req.body
  for (const insumo of insumos) {
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
  if (observacoes !== undefined) {
    await pool.query('UPDATE produtos_pi SET observacoes = ? WHERE id = ?', [observacoes, req.params.produtoId])
  }
  res.json({ ok: true })
})

app.get('/api/recebimentos/pendentes', autenticar(['admin', 'deposito']), async (req, res) => {
  const [rows] = await pool.query(`
    SELECT r.id, r.tipo, p.numero_pi, p.cliente
    FROM recebimentos_b2 r
    JOIN pedidos p ON p.id = r.pi_id
    WHERE r.status_recebimento = 'pendente' AND p.concluida = 0
    ORDER BY r.id ASC
  `)
  res.json(rows)
})

app.patch('/api/recebimentos/:id', autenticar(['admin', 'deposito']), upload.single('foto'), async (req, res) => {
  const { quantidade_recebida } = req.body
  let fotoUrl = null

  if (req.file) {
    const resultado = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { folder: 'recebimentos', resource_type: 'image' },
        (erro, resultado) => erro ? reject(erro) : resolve(resultado)
      ).end(req.file.buffer)
    })
    fotoUrl = resultado.secure_url
  }

  await pool.query(
    'UPDATE recebimentos_b2 SET status_recebimento = ?, recebido_em = NOW(), quantidade_recebida = ?, foto_url = ? WHERE id = ?',
    ['recebido', quantidade_recebida || null, fotoUrl, req.params.id]
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

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'))
})

const PORTA = process.env.PORT || 8080
app.listen(PORTA, '0.0.0.0', () => console.log(`Servidor rodando na porta ${PORTA}`))