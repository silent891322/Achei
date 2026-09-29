// Função da Netlify: página do produto em /p/{codigo}
// Monta o HTML com as informações de preview (foto, título e preço) para o WhatsApp,
// Facebook e Instagram. O restante da página é desenhado por /js/vitrine/produto.js

const DB = "https://achei-c6dc8-default-rtdb.firebaseio.com";

const ESTADOS = {
  novo: "Novo",
  seminovo: "Seminovo",
  bom: "Usado — bom estado",
  marcas: "Usado — com marcas de uso",
  pecas: "Com defeito / para peças"
};

function esc(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function preco(valor) {
  if (valor === null || valor === undefined || valor === "") return "Preço a combinar";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(valor));
}

function resumo(texto, max) {
  const t = String(texto || "").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1).trim() + "…" : t;
}

function paginaHTML({ titulo, descricao, imagem, url, nomeLoja, dados, status = 200 }) {
  // JSON seguro para colocar dentro de <script>
  const json = JSON.stringify(dados).replace(/</g, "\\u003c");

  return new Response(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>${esc(titulo)}</title>
  <meta name="description" content="${esc(descricao)}">
  <meta name="theme-color" content="#1B2A4A">
  <meta property="og:type" content="product">
  <meta property="og:site_name" content="${esc(nomeLoja)}">
  <meta property="og:title" content="${esc(titulo)}">
  <meta property="og:description" content="${esc(descricao)}">
  <meta property="og:url" content="${esc(url)}">
  ${imagem ? `<meta property="og:image" content="${esc(imagem)}">
  <meta property="og:image:type" content="image/jpeg">
  <meta name="twitter:image" content="${esc(imagem)}">` : ""}
  <meta name="twitter:card" content="summary_large_image">
  <link rel="canonical" href="${esc(url)}">
  <link rel="stylesheet" href="/css/vitrine.css">
</head>
<body class="pagina-produto">
  <header class="topo topo-produto">
    <div class="topo-inner">
      <a href="/" class="btn-voltar" aria-label="Voltar para a vitrine">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>
        <span>Vitrine</span>
      </a>
      <a href="/" class="logo logo-pequeno" id="logoLoja">${esc(nomeLoja)}</a>
      <button type="button" class="btn-compartilhar" id="btnCompartilhar" aria-label="Compartilhar produto">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>
      </button>
    </div>
  </header>

  <main id="app" class="produto-app">
    <div class="carregando-pagina">Carregando...</div>
  </main>

  <script id="dadosPagina" type="application/json">${json}</script>
  <script type="module" src="/js/vitrine/produto.js"></script>
</body>
</html>`, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
      // A CDN guarda por 60s: mudanças de preço/status aparecem em até 1 minuto
      "Netlify-CDN-Cache-Control": status === 200
        ? "public, s-maxage=60, stale-while-revalidate=600"
        : "no-store"
    }
  });
}

export default async (req, context) => {
  const origem = new URL(req.url).origin;
  const numero = String(context.params?.codigo || "").replace(/\D/g, "");
  const codigo = numero ? numero.padStart(3, "0") : "";

  let config = {};
  let id = null;
  let produto = null;

  try {
    const consultas = [fetch(`${DB}/config.json`)];
    if (codigo) {
      const filtro = `orderBy=${encodeURIComponent('"codigo"')}&equalTo=${encodeURIComponent(`"${codigo}"`)}`;
      consultas.push(fetch(`${DB}/produtos.json?${filtro}`));
    }
    const [respCfg, respProd] = await Promise.all(consultas);
    config = (respCfg.ok ? await respCfg.json() : null) || {};

    if (respProd && respProd.ok) {
      const encontrados = (await respProd.json()) || {};
      id = Object.keys(encontrados)[0] || null;
      produto = id ? encontrados[id] : null;
    }
  } catch (err) {
    console.error(err);
  }

  const nomeLoja = config.nomeLoja || "Achei!";

  if (!produto) {
    return paginaHTML({
      titulo: `Produto não encontrado — ${nomeLoja}`,
      descricao: "Esse produto não está mais disponível. Veja os outros produtos da vitrine.",
      imagem: null,
      url: `${origem}/`,
      nomeLoja,
      dados: { naoEncontrado: true, codigo, config },
      status: 404
    });
  }

  const capa = (produto.fotos || [])[0];
  const statusTexto = produto.status === "vendido" ? " (VENDIDO)" : produto.status === "reservado" ? " (reservado)" : "";
  const titulo = `${produto.titulo} — ${preco(produto.preco)}${statusTexto}`;
  const descricao = resumo(
    `${ESTADOS[produto.estado] || ""}. ${produto.descricao || ""}`.replace(/^\.\s*/, ""),
    180
  ) || `Veja fotos e detalhes na vitrine ${nomeLoja}.`;

  return paginaHTML({
    titulo,
    descricao,
    imagem: capa ? `${origem}/img/${id}/${capa}/g` : null,
    url: `${origem}/p/${produto.codigo}`,
    nomeLoja,
    dados: { id, produto, config }
  });
};

export const config = {
  path: "/p/:codigo"
};
