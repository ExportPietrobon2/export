import { exigirPapel } from './auth.js'
import { montarCabecalho } from './cabecalho.js'

const DADOS = [
  {
    categoria: 'Rótulos',
    itens: [
      { produto: 'Bala Mastigável 2,8g — Rótulo 55mm', pesoPct: '25,41 g', rendimento: '39,35 kg de bala por kg de rótulo' },
      { produto: 'Bala Mastigável 2,8g — Rótulo 65mm', pesoPct: '33,92 g', rendimento: '30 kg de bala por kg de rótulo' },
      { produto: 'Bala Mastigável 4,7g — Rótulo 65mm', pesoPct: '24,74 g', rendimento: '48,83 kg de bala por kg de rótulo' },
      { produto: 'Bala Dura 6,5g', pesoPct: '21,20 g', rendimento: '47,1 kg de bala por kg de rótulo' },
      { produto: 'Bala Sabor Tropical 6,5g', pesoPct: '21,20 g', rendimento: '47,1 kg de bala por kg de rótulo' },
      { produto: 'Pirulito Bola 20g', pesoPct: '15,00 g', rendimento: '66 kg de pirulito por kg de rótulo' },
      { produto: 'Pirulito Bola 20g Uva', pesoPct: '16,56 g', rendimento: '60 kg de pirulito por kg de rótulo' },
      { produto: 'Pirulito Plano 9g Fan Pop Laranja', pesoPct: '8,67 g', rendimento: '115 kg de pirulito por kg de rótulo' },
      { produto: 'Forro Pirulito Plano 9g (30 micras)', pesoPct: '9,88 g', rendimento: '101 kg de pirulito por kg de forro' },
    ]
  },
  {
    categoria: 'Embalagem Bala KG',
    itens: [
      { produto: 'Bala KG Menta', pesoPct: '8,76 g', rendimento: '≈ 114 pct/kg' },
      { produto: 'Bala Mix 500', pesoPct: '13,35 g', rendimento: '≈ 75 pct/kg' },
    ]
  },
  {
    categoria: 'Embalagem Bala 600g',
    itens: [
      { produto: 'Bala 600g Yogurte Sortida', pesoPct: '7,35 g', rendimento: '≈ 136 pct/kg' },
      { produto: 'Bala 600g Yogurte Morango', pesoPct: '7,99 g', rendimento: '≈ 125 pct/kg' },
      { produto: 'Bala 600g Yogurte Uva', pesoPct: '7,70 g', rendimento: '≈ 130 pct/kg' },
      { produto: 'Bala 600g Piteco Frutas', pesoPct: '7,91 g', rendimento: '≈ 126 pct/kg' },
      { produto: 'Bala 600g Framboesa Mast.', pesoPct: '7,56 g', rendimento: '≈ 132 pct/kg' },
      { produto: 'Bala 600g Tutti Frutti', pesoPct: '7,50 g', rendimento: '≈ 133 pct/kg' },
      { produto: 'Bala 600g Yogurte Morango (v2)', pesoPct: '7,97 g', rendimento: '≈ 125 pct/kg' },
      { produto: 'Bala 600g Toffee', pesoPct: '8,16 g', rendimento: '≈ 123 pct/kg' },
      { produto: 'Bala 600g Menta Mastigável', pesoPct: '7,81 g', rendimento: '≈ 128 pct/kg' },
      { produto: 'Bala 600g Caramelo Castanha', pesoPct: '8,05 g', rendimento: '≈ 124 pct/kg' },
      { produto: 'Bala 600g Frutalli', pesoPct: '7,46 g', rendimento: '≈ 134 pct/kg' },
      { produto: 'Bala 600g Super Fresh Sortida', pesoPct: '6,26 g', rendimento: '≈ 160 pct/kg' },
      { produto: 'Bala 600g Hortelã', pesoPct: '6,90 g', rendimento: '≈ 145 pct/kg' },
      { produto: 'Bala 600g Canela', pesoPct: '6,16 g', rendimento: '≈ 162 pct/kg' },
      { produto: 'Bala 600g Cola', pesoPct: '8,22 g', rendimento: '≈ 122 pct/kg' },
      { produto: 'Bala 600g Mel', pesoPct: '7,52 g', rendimento: '≈ 133 pct/kg' },
      { produto: 'Bala 600g Happy Mix', pesoPct: '8,22 g', rendimento: '≈ 122 pct/kg' },
      { produto: 'Bala 600g Sortidas Tropicais', pesoPct: '7,15 g', rendimento: '≈ 140 pct/kg' },
      { produto: 'Bala 600g Algodão Doce', pesoPct: '8,36 g', rendimento: '≈ 120 pct/kg' },
      { produto: 'Bala 600g Banana', pesoPct: '7,99 g', rendimento: '≈ 125 pct/kg' },
    ]
  },
  {
    categoria: 'Embalagem Bala 480g',
    itens: [
      { produto: 'Bala 480g Recheada Gigante', pesoPct: '6,53 g', rendimento: '≈ 153 pct/kg' },
      { produto: 'Bala 480g Recheada Sortida', pesoPct: '7,00 g', rendimento: '≈ 143 pct/kg' },
      { produto: 'Bala 480g Frutas Recheadas', pesoPct: '6,30 g', rendimento: '≈ 159 pct/kg' },
      { produto: 'Bala 480g Framboesa Premium', pesoPct: '6,37 g', rendimento: '≈ 157 pct/kg' },
      { produto: 'Bala 480g Café', pesoPct: '6,80 g', rendimento: '≈ 147 pct/kg' },
      { produto: 'Bala 480g Morango Flowpack', pesoPct: '6,70 g', rendimento: '≈ 149 pct/kg' },
    ]
  },
  {
    categoria: 'Embalagem Bala 250g',
    itens: [
      { produto: 'Bala 250g Frutalli', pesoPct: '4,90 g', rendimento: '≈ 204 pct/kg' },
      { produto: 'Bala 250g Hortelã', pesoPct: '5,11 g', rendimento: '≈ 196 pct/kg' },
      { produto: 'Bala 250g Canela', pesoPct: '5,69 g', rendimento: '≈ 176 pct/kg' },
      { produto: 'Bala 250g Piteco Frutas', pesoPct: '4,94 g', rendimento: '≈ 202 pct/kg' },
      { produto: 'Bala 250g Framboesa Mast.', pesoPct: '4,74 g', rendimento: '≈ 211 pct/kg' },
      { produto: 'Bala 250g Yogurte Morango', pesoPct: '5,11 g', rendimento: '≈ 196 pct/kg' },
      { produto: 'Bala 250g Yogurte Sortida', pesoPct: '5,54 g', rendimento: '≈ 180 pct/kg' },
      { produto: 'Bala 250g Yogurte Uva', pesoPct: '5,62 g', rendimento: '≈ 178 pct/kg' },
      { produto: 'Bala 250g Algodão Doce', pesoPct: '5,17 g', rendimento: '≈ 193 pct/kg' },
      { produto: 'Bala 250g Toffee', pesoPct: '4,80 g', rendimento: '≈ 208 pct/kg' },
      { produto: 'Bala 250g Mel', pesoPct: '5,75 g', rendimento: '≈ 174 pct/kg' },
      { produto: 'Bala 250g Cola', pesoPct: '5,34 g', rendimento: '≈ 187 pct/kg' },
      { produto: 'Bala 250g Azedinha', pesoPct: '5,48 g', rendimento: '≈ 182 pct/kg' },
      { produto: 'Bala 250g Tutti Frutti', pesoPct: '5,62 g', rendimento: '≈ 178 pct/kg' },
      { produto: 'Bala 250g Fresh Sortida', pesoPct: '5,40 g', rendimento: '≈ 185 pct/kg' },
      { produto: 'Bala 250g Recheada Gigante', pesoPct: '5,09 g', rendimento: '≈ 197 pct/kg' },
      { produto: 'Bala 250g Caramelo Castanha', pesoPct: '4,92 g', rendimento: '≈ 203 pct/kg' },
      { produto: 'Bala 250g Caramelo Brigadeiro', pesoPct: '4,90 g', rendimento: '≈ 204 pct/kg' },
      { produto: 'Bala 250g Caramelo Sortido', pesoPct: '5,29 g', rendimento: '≈ 189 pct/kg' },
      { produto: 'Bala 250g Cacau Castanha', pesoPct: '5,34 g', rendimento: '≈ 187 pct/kg' },
      { produto: 'Bala 250g Cacau Amendoim', pesoPct: '5,46 g', rendimento: '≈ 183 pct/kg' },
      { produto: 'Bala 250g Caramelo Toffee', pesoPct: '4,92 g', rendimento: '≈ 203 pct/kg' },
      { produto: 'Bala 250g Caramelo Leite Quadradinha', pesoPct: '4,45 g', rendimento: '≈ 225 pct/kg' },
      { produto: 'Bala 250g Framboesa Premium', pesoPct: '5,36 g', rendimento: '≈ 187 pct/kg' },
      { produto: 'Bala 250g Banana', pesoPct: '5,05 g', rendimento: '≈ 198 pct/kg' },
      { produto: 'Bala 250g Sortidas Tropicais', pesoPct: '5,17 g', rendimento: '≈ 193 pct/kg' },
      { produto: 'Bala 250g Recheadas Sortidas', pesoPct: '4,94 g', rendimento: '≈ 202 pct/kg' },
      { produto: 'Bala 250g Frutas Recheadas', pesoPct: '5,19 g', rendimento: '≈ 193 pct/kg' },
      { produto: 'Bala 250g Confeito Am. Colorido', pesoPct: '4,76 g', rendimento: '≈ 210 pct/kg' },
    ]
  },
  {
    categoria: 'Embalagem Bala 190g',
    itens: [
      { produto: 'Bala 190g Café', pesoPct: '5,05 g', rendimento: '≈ 198 pct/kg' },
      { produto: 'Bala 190g Energy Guaraná', pesoPct: '5,52 g', rendimento: '≈ 181 pct/kg' },
      { produto: 'Bala 190g Toffee Fukito', pesoPct: '6,57 g', rendimento: '≈ 152 pct/kg' },
      { produto: 'Bala 190g Fukito Sortida', pesoPct: '4,49 g', rendimento: '≈ 223 pct/kg' },
    ]
  },
  {
    categoria: 'Embalagem Bala 170g',
    itens: [
      { produto: 'Bala 170g Toffee', pesoPct: '3,56 g', rendimento: '≈ 281 pct/kg' },
      { produto: 'Bala 170g Cola', pesoPct: '4,84 g', rendimento: '≈ 207 pct/kg' },
      { produto: 'Bala 170g Tutti Frutti', pesoPct: '4,70 g', rendimento: '≈ 213 pct/kg' },
      { produto: 'Bala 170g Hortelã', pesoPct: '4,41 g', rendimento: '≈ 227 pct/kg' },
    ]
  },
  {
    categoria: 'Embalagem Bala 150g',
    itens: [
      { produto: 'Bala 150g Mel', pesoPct: '3,91 g', rendimento: '≈ 255 pct/kg' },
      { produto: 'Bala 150g Menta', pesoPct: '4,14 g', rendimento: '≈ 242 pct/kg' },
      { produto: 'Bala 150g Sabor Tropical', pesoPct: '3,87 g', rendimento: '≈ 258 pct/kg' },
      { produto: 'Bala 150g Canela', pesoPct: '3,77 g', rendimento: '≈ 265 pct/kg' },
      { produto: 'Bala 150g Caramelo Castanha', pesoPct: '3,71 g', rendimento: '≈ 270 pct/kg' },
      { produto: 'Bala 150g Yogurte Morango', pesoPct: '3,48 g', rendimento: '≈ 287 pct/kg' },
      { produto: 'Bala 150g Caramelo Leite', pesoPct: '3,54 g', rendimento: '≈ 282 pct/kg' },
    ]
  },
  {
    categoria: 'Embalagem Bala 100g',
    itens: [
      { produto: 'Bala 100g Gengibre', pesoPct: '3,32 g', rendimento: '≈ 302 pct/kg' },
      { produto: 'Bala 100g Café', pesoPct: '3,98 g', rendimento: '≈ 252 pct/kg' },
    ]
  },
  {
    categoria: 'Embalagem Bala 60g e 50g',
    itens: [
      { produto: 'Bala 60g Canela', pesoPct: '2,93 g', rendimento: '≈ 342 pct/kg' },
      { produto: 'Bala 60g Tutti Frutti', pesoPct: '2,86 g', rendimento: '≈ 349 pct/kg' },
      { produto: 'Bala 50g Diet Morango e Hortelã', pesoPct: '3,19 g', rendimento: '≈ 313 pct/kg' },
    ]
  },
  {
    categoria: 'Embalagem Pirulitos',
    itens: [
      { produto: 'Pirulito Bola 200g Tutti Frutti', pesoPct: '5,11 g', rendimento: '≈ 201 pct/kg' },
      { produto: 'Pirulito Bola 200g Algodão Doce', pesoPct: '5,15 g', rendimento: '≈ 194 pct/kg' },
      { produto: 'Pirulito Bola 200g Morango', pesoPct: '5,23 g', rendimento: '≈ 191 pct/kg' },
      { produto: 'Pirulito Bola 200g Uva', pesoPct: '5,31 g', rendimento: '≈ 188 pct/kg' },
      { produto: 'Pirulito Bola 200g Framboesa', pesoPct: '5,15 g', rendimento: '≈ 194 pct/kg' },
      { produto: 'Pirulito Bola 200g Halloween', pesoPct: '5,31 g', rendimento: '≈ 188 pct/kg' },
      { produto: 'Pirulito Bola 200g Grande Amor', pesoPct: '5,48 g', rendimento: '≈ 182 pct/kg' },
      { produto: 'Pirulito Bola 200g Sortido', pesoPct: '5,38 g', rendimento: '≈ 186 pct/kg' },
      { produto: 'Pirulito Bola 200g Cereja', pesoPct: '5,52 g', rendimento: '≈ 181 pct/kg' },
      { produto: 'Pirulito Bola 200g Space Pop', pesoPct: '5,29 g', rendimento: '≈ 189 pct/kg' },
      { produto: 'Pirulito Bola 480g Uva', pesoPct: '7,17 g', rendimento: '≈ 139 pct/kg' },
      { produto: 'Pirulito Bola 480g Algodão Doce', pesoPct: '7,73 g', rendimento: '≈ 129 pct/kg' },
      { produto: 'Pirulito Bola 480g Tutti Frutti', pesoPct: '7,91 g', rendimento: '≈ 126 pct/kg' },
      { produto: 'Pirulito Bola 480g Framboesa', pesoPct: '7,17 g', rendimento: '≈ 139 pct/kg' },
      { produto: 'Pirulito Bola 480g Sortido', pesoPct: '9,76 g', rendimento: '≈ 102 pct/kg' },
      { produto: 'Pirulito Bola 480g Cereja', pesoPct: '7,56 g', rendimento: '≈ 132 pct/kg' },
      { produto: 'Pirulito Bola 480g Space Pop', pesoPct: '7,54 g', rendimento: '≈ 133 pct/kg' },
      { produto: 'Pirulito Bola KG Sortido', pesoPct: '13,06 g', rendimento: '≈ 77 pct/kg' },
      { produto: 'Pirulito Bola 120g Morango', pesoPct: '3,83 g', rendimento: '≈ 261 pct/kg' },
      { produto: 'Pirulito Bola 120g Tutti Frutti', pesoPct: '3,96 g', rendimento: '≈ 253 pct/kg' },
      { produto: 'Pirulito Plano 480g Fan Pop', pesoPct: '8,47 g', rendimento: '≈ 118 pct/kg' },
      { produto: 'Pirulito Plano 480g Circo do Piteco', pesoPct: '9,66 g', rendimento: '≈ 104 pct/kg' },
      { produto: 'Pirulito Plano 480g Tutti Frutti', pesoPct: '8,47 g', rendimento: '≈ 118 pct/kg' },
      { produto: 'Pirulito Plano 480g Algodão Doce', pesoPct: '8,05 g', rendimento: '≈ 124 pct/kg' },
      { produto: 'Pirulito Plano 350g Fan Pop', pesoPct: '8,84 g', rendimento: '≈ 113 pct/kg' },
      { produto: 'Pirulito Plano 190g Fan Pop', pesoPct: '6,51 g', rendimento: '≈ 154 pct/kg' },
      { produto: 'Pirulito Plano 190g Circo do Piteco', pesoPct: '8,03 g', rendimento: '≈ 124 pct/kg' },
      { produto: 'Pirulito Plano 190g Tutti Frutti', pesoPct: '6,08 g', rendimento: '≈ 165 pct/kg' },
      { produto: 'Pirulito Plano 190g Algodão Doce', pesoPct: '6,51 g', rendimento: '≈ 154 pct/kg' },
    ]
  },
  {
    categoria: 'Exportações',
    itens: [
      { produto: 'Bala 300g Piteco Frutas', pesoPct: '5,44 g', rendimento: '≈ 184 pct/kg' },
      { produto: 'Bala 300g Toffee', pesoPct: '5,01 g', rendimento: '≈ 200 pct/kg' },
      { produto: 'Bala 300g Tutti Frutti', pesoPct: '4,76 g', rendimento: '≈ 210 pct/kg' },
      { produto: 'Bala 300g Yogurte Sortida', pesoPct: '4,74 g', rendimento: '≈ 211 pct/kg' },
      { produto: 'Bala 300g Yogurte Morango', pesoPct: '5,58 g', rendimento: '≈ 179 pct/kg' },
      { produto: 'Bala 280g Export. Miel', pesoPct: '4,88 g', rendimento: '≈ 179 pct/kg' },
      { produto: 'Bala 1,5 KG Party Mix (pct laranja)', pesoPct: '15,60 g', rendimento: '≈ 64 pct/kg' },
      { produto: 'Bala 1,5 KG Jumbo Party Mix (pct transp.)', pesoPct: '15,18 g', rendimento: '≈ 66 pct/kg' },
      { produto: 'Bala 0,900 KG Party Mix (pct transp.)', pesoPct: '12,26 g', rendimento: '≈ 82 pct/kg' },
      { produto: 'Pirulito 20g Algodão Doce 1 KG', pesoPct: '14,97 g', rendimento: '≈ 67 pct/kg' },
      { produto: 'Pirulito 20g Gourmet 1 KG (Emb. Roxa Haitti)', pesoPct: '11,78 g', rendimento: '≈ 85 pct/kg' },
      { produto: 'Emb. 85g Ovinho de Chocolate 5g', pesoPct: '3,96 g', rendimento: '≈ 253 pct/kg' },
      { produto: 'Emb. 85g Bolinha de Chocolate 5g', pesoPct: '3,93 g', rendimento: '≈ 254 pct/kg' },
      { produto: 'Emb. 4 LBS Party Mix', pesoPct: '15,84 g', rendimento: '≈ 63 pct/kg' },
      { produto: 'Emb. 20 OZ Party Mix', pesoPct: '9,48 g', rendimento: '≈ 105 pct/kg' },
      { produto: 'Holanda 200g Heart Pop / Fruity Ball / Smiley / Morango', pesoPct: '6,80 g', rendimento: '≈ 143 pct/kg' },
      { produto: 'Holanda 300g Heart Pop / Fruity Ball / Smiley / Morango', pesoPct: '6,95 g', rendimento: '≈ 143 pct/kg' },
      { produto: 'Holanda 200g Heart Pop Pirulito Plano', pesoPct: '7,31 g', rendimento: '≈ 137 pct/kg' },
      { produto: 'Holanda 460g Halloween', pesoPct: '10,71 g', rendimento: '≈ 93 pct/kg' },
      { produto: 'Bala 700g Family Favourites', pesoPct: '12,61 g', rendimento: '≈ 79 pct/kg' },
    ]
  }
]

function renderizar(filtro) {
  const container = document.getElementById('conteudo-referencia')
  const termo = (filtro || '').toLowerCase().trim()

  container.innerHTML = ''

  DADOS.forEach((secao) => {
    const itensFiltrados = termo
      ? secao.itens.filter((i) => i.produto.toLowerCase().includes(termo))
      : secao.itens

    if (itensFiltrados.length === 0) return

    const bloco = document.createElement('div')
    bloco.className = 'mb-4'
    bloco.innerHTML = `
      <h5 class="secao-titulo-card mb-3">${secao.categoria}</h5>
      <div class="card">
        <div class="table-responsive">
          <table class="table table-sm table-hover mb-0">
            <thead>
              <tr>
                <th>Produto</th>
                <th class="text-center" style="white-space:nowrap">Peso embal./pct</th>
                <th class="text-center" style="white-space:nowrap">Rendimento (c/ 3% perda)</th>
              </tr>
            </thead>
            <tbody>
              ${itensFiltrados.map((item) => `
                <tr>
                  <td>${item.produto}</td>
                  <td class="text-center">${item.pesoPct}</td>
                  <td class="text-center fw-semibold text-success">${item.rendimento}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `
    container.appendChild(bloco)
  })

  if (container.innerHTML === '') {
    container.innerHTML = '<p class="text-muted fst-italic">Nenhum produto encontrado.</p>'
  }
}

export function iniciarReferencia(elementoContainer) {
  const wrapper = elementoContainer || document.getElementById('conteudo-referencia-wrapper')
  if (!wrapper) return

  wrapper.innerHTML = `
    <div class="mb-3">
      <input type="text" id="busca-referencia" class="form-control" placeholder="🔍 Buscar produto...">
    </div>
    <div id="conteudo-referencia"></div>
  `

  renderizar('')

  wrapper.querySelector('#busca-referencia').addEventListener('input', (e) => {
    renderizar(e.target.value)
  })
}

async function iniciar() {
  const perfil = exigirPapel('todos')
  if (!perfil) return
  montarCabecalho(perfil.papel)
  iniciarReferencia(null)
}

if (document.body.dataset.pagina === 'referencia.html') {
  iniciar()
}