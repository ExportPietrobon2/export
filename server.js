const express = require('express')
const mysql = require('mysql2/promise')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const cloudinary = require('cloudinary').v2
const multer = require('multer')
const path = require('path')
const { Resend } = require('resend')

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

const resend = new Resend(process.env.RESEND_API_KEY)

async function getDestinatarios() {
  if (MODO_TESTE) return [EMAIL_TESTE]
  const [rows] = await pool.query('SELECT email FROM usuarios')
  return rows.map((r) => r.email)
}

async function enviarEmail(assunto, corpo) {
  try {
    const destinatarios = await getDestinatarios()
    await resend.emails.send({
      from: 'Pietrobon · Insumos <onboarding@resend.dev>',
      to: destinatarios,
      subject: assunto,
      html: `
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
        </div>
      `
    })
    console.log('Email enviado:', assunto)
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

const TODOS = ['admin', 'almoxarifado', 'deposito', 'convidado']

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
      `SELECT r.tipo, r.status_recebimento, r.foto_url, r.foto_nota_url, r.quantidade_recebida,
              r.produto_id, pr.produto as nome_produto
       FROM recebimentos_b2 r
       LEFT JOIN produtos_pi pr ON pr.id = r.produto_id
       WHERE r.pi_id = ?`,
      [pedido.id]
    )
    pedido.recebimentos_b2 = recebimentos

    // Entradas do estoque geral vinculadas a esta PI
    const [vinculosEstoque] = await pool.query(
      `SELECT v.*, e.produto as produto_entrada, e.embalagem_kg as entrada_emb,
              e.rotulo_kg as entrada_rot, e.pallet_caixas as entrada_pal,
              e.foto_url as entrada_foto, e.foto_nota_url as entrada_foto_nota,
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
  const { numero_pi, data_embarque, cliente, destino } = req.body
  const [resultado] = await pool.query(
    'INSERT INTO pedidos (numero_pi, data_embarque, cliente, destino) VALUES (?, ?, ?, ?)',
    [numero_pi, data_embarque || null, cliente || null, destino || null]
  )
  const piId = resultado.insertId
  const tiposRecebimento = ['embalagem', 'rotulo', 'caixa']
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

    const etiqueta = todosInsumos.find((i) => i.tipo === 'etiqueta')
    if (etiqueta && Number(etiqueta.sobra) > 0 && Number(etiqueta.sobra) < 100) {
      enviarEmail(
        `⚠ Estoque baixo de etiquetas — PI ${numero_pi}`,
        `<h2 style="color:#E65100;margin:0 0 16px">⚠ Estoque Baixo de Etiquetas</h2>
         <table style="width:100%;border-collapse:collapse;">
           <tr><td style="padding:8px 0;color:#8a6a6a;width:140px">PI</td><td style="padding:8px 0;font-weight:600">${numero_pi}</td></tr>
           <tr><td style="padding:8px 0;color:#8a6a6a">Cliente</td><td style="padding:8px 0;font-weight:600">${cliente || '—'}</td></tr>
           <tr><td style="padding:8px 0;color:#8a6a6a">Produto</td><td style="padding:8px 0;font-weight:600">${produto}</td></tr>
           <tr><td style="padding:8px 0;color:#8a6a6a">Etiquetas</td><td style="padding:8px 0;font-weight:600;color:#E65100">${etiqueta.sobra} unidades restantes</td></tr>
         </table>`
      )
    }

    const semEtiqueta = todosInsumos.filter((i) => i.tipo !== 'etiqueta')
    const tudo = semEtiqueta.every((i) => i.confirmado)
    const algum = semEtiqueta.some((i) => i.confirmado)

    if (tudo) {
      enviarEmail(
        `✅ PI Liberada — ${numero_pi}`,
        `<h2 style="color:#2E7D32;margin:0 0 16px">✅ PI Liberada para Produção</h2>
         <table style="width:100%;border-collapse:collapse;">
           <tr><td style="padding:8px 0;color:#8a6a6a;width:140px">PI</td><td style="padding:8px 0;font-weight:600">${numero_pi}</td></tr>
           <tr><td style="padding:8px 0;color:#8a6a6a">Cliente</td><td style="padding:8px 0;font-weight:600">${cliente || '—'}</td></tr>
           <tr><td style="padding:8px 0;color:#8a6a6a">Produto</td><td style="padding:8px 0;font-weight:600">${produto}</td></tr>
         </table>
         <p style="margin:16px 0 0;color:#2E7D32;font-weight:600">Todos os insumos estão disponíveis para produção.</p>`
      )
    } else if (!algum) {
      enviarEmail(
        `🚫 PI Bloqueada — ${numero_pi}`,
        `<h2 style="color:#ED3237;margin:0 0 16px">🚫 PI com Insumos Insuficientes</h2>
         <table style="width:100%;border-collapse:collapse;">
           <tr><td style="padding:8px 0;color:#8a6a6a;width:140px">PI</td><td style="padding:8px 0;font-weight:600">${numero_pi}</td></tr>
           <tr><td style="padding:8px 0;color:#8a6a6a">Cliente</td><td style="padding:8px 0;font-weight:600">${cliente || '—'}</td></tr>
           <tr><td style="padding:8px 0;color:#8a6a6a">Produto</td><td style="padding:8px 0;font-weight:600">${produto}</td></tr>
         </table>
         <p style="margin:16px 0 0;color:#ED3237;font-weight:600">Um ou mais insumos estão com estoque insuficiente.</p>`
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
       </table>`
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


// =============================================
// ESTOQUE GERAL (entradas B2 sem PI)
// =============================================

app.post('/api/estoque/entrada', autenticar(['admin', 'deposito']), upload.fields([{ name: 'foto_produto', maxCount: 1 }, { name: 'foto_nota', maxCount: 1 }]), async (req, res) => {
  const { embalagem_kg, rotulo_kg, pallet_caixas, produto } = req.body
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
    'INSERT INTO estoque_insumos (produto, embalagem_kg, rotulo_kg, pallet_caixas, foto_url, foto_nota_url) VALUES (?, ?, ?, ?, ?, ?)',
    [produto || null, parseFloat(embalagem_kg) || 0, parseFloat(rotulo_kg) || 0, parseInt(pallet_caixas) || 0, fotoUrl, fotoNotaUrl]
  )

  const tipoEntrada = []
  if (parseFloat(embalagem_kg) > 0) tipoEntrada.push(`${embalagem_kg} kg embalagem`)
  if (parseFloat(rotulo_kg) > 0) tipoEntrada.push(`${rotulo_kg} kg rótulo`)
  if (parseInt(pallet_caixas) > 0) tipoEntrada.push(`${pallet_caixas} pallet(s) de caixa`)

  enviarEmail(
    '📥 Nova entrada no estoque B2',
    `<h2 style="color:#1565C0;margin:0 0 16px">📥 Entrada de Insumos — B2</h2>
     <table style="width:100%;border-collapse:collapse;">
       ${parseFloat(embalagem_kg) > 0 ? `<tr><td style="padding:8px 0;color:#8a6a6a;width:160px">Embalagem</td><td style="padding:8px 0;font-weight:600">${embalagem_kg} kg</td></tr>` : ''}
       ${parseFloat(rotulo_kg) > 0 ? `<tr><td style="padding:8px 0;color:#8a6a6a">Rótulo</td><td style="padding:8px 0;font-weight:600">${rotulo_kg} kg</td></tr>` : ''}
       ${parseInt(pallet_caixas) > 0 ? `<tr><td style="padding:8px 0;color:#8a6a6a">Pallets de caixa</td><td style="padding:8px 0;font-weight:600">${pallet_caixas} pallet(s)</td></tr>` : ''}
     </table>`
  )

  res.json({ ok: true })
})

app.get('/api/estoque/historico', autenticar(['admin', 'almoxarifado', 'deposito', 'convidado']), async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM estoque_insumos ORDER BY criado_em DESC LIMIT 50')
  res.json(rows)
})

app.get('/api/estoque/saldo', autenticar(['admin', 'almoxarifado', 'convidado']), async (req, res) => {
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

app.get('/api/estoque/vinculos', autenticar(['admin', 'almoxarifado', 'convidado']), async (req, res) => {
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

  // Verificar saldo disponível da entrada específica
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

  const [[pi]] = await pool.query('SELECT numero_pi, cliente FROM pedidos WHERE id = ?', [pi_id])

  enviarEmail(
    `🔗 Estoque vinculado — PI ${pi?.numero_pi}`,
    `<h2 style="color:#6A1B9A;margin:0 0 16px">🔗 Insumos Vinculados à PI</h2>
     <table style="width:100%;border-collapse:collapse;">
       <tr><td style="padding:8px 0;color:#8a6a6a;width:160px">PI</td><td style="padding:8px 0;font-weight:600">${pi?.numero_pi}</td></tr>
       ${pi?.cliente ? `<tr><td style="padding:8px 0;color:#8a6a6a">Cliente</td><td style="padding:8px 0;font-weight:600">${pi.cliente}</td></tr>` : ''}
       ${parseFloat(embalagem_kg) > 0 ? `<tr><td style="padding:8px 0;color:#8a6a6a">Embalagem</td><td style="padding:8px 0;font-weight:600">${embalagem_kg} kg</td></tr>` : ''}
       ${parseFloat(rotulo_kg) > 0 ? `<tr><td style="padding:8px 0;color:#8a6a6a">Rótulo</td><td style="padding:8px 0;font-weight:600">${rotulo_kg} kg</td></tr>` : ''}
       ${parseInt(pallet_caixas) > 0 ? `<tr><td style="padding:8px 0;color:#8a6a6a">Pallets caixa</td><td style="padding:8px 0;font-weight:600">${pallet_caixas}</td></tr>` : ''}
     </table>`
  )

  res.json({ ok: true })
})


app.delete('/api/estoque/entradas/:id', autenticar(['admin', 'deposito']), async (req, res) => {
  await pool.query('DELETE FROM estoque_insumos WHERE id = ?', [req.params.id])
  res.json({ ok: true })
})

app.patch('/api/estoque/vinculos/:id', autenticar(['admin', 'almoxarifado']), async (req, res) => {
  const { pi_id, embalagem_kg, rotulo_kg, pallet_caixas } = req.body

  // Calcular saldo excluindo o vínculo atual
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

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'))
})

const PORTA = process.env.PORT || 8080
app.listen(PORTA, '0.0.0.0', () => console.log(`Servidor rodando na porta ${PORTA}`))