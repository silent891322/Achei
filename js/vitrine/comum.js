// Funções compartilhadas da vitrine pública (home e página do produto)

export const DB = "https://achei-c6dc8-default-rtdb.firebaseio.com";

export const ESTADOS = {
  novo: "Novo (nunca usado)",
  seminovo: "Seminovo",
  bom: "Usado — bom estado",
  marcas: "Usado — com marcas de uso",
  pecas: "Com defeito / para peças"
};

export const ESTADOS_CURTOS = {
  novo: "Novo",
  seminovo: "Seminovo",
  bom: "Usado",
  marcas: "Marcas de uso",
  pecas: "Para peças"
};

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// Lê um caminho do banco (somente leitura pública)
export async function lerDB(caminho) {
  const resp = await fetch(`${DB}/${caminho}.json`);
  if (!resp.ok) throw new Error("Erro " + resp.status + " ao ler " + caminho);
  return resp.json();
}

// Soma +1 em visualizações ou cliques (não atrapalha a página se falhar)
export function registrarMetrica(produtoId, campo) {
  try {
    fetch(`${DB}/metricas/${produtoId}/${campo}.json`, {
      method: "PUT",
      body: JSON.stringify({ ".sv": { increment: 1 } }),
      keepalive: true
    }).catch(() => {});
  } catch (e) { /* ignora */ }
}

export function formatarPreco(valor) {
  if (valor === null || valor === undefined || valor === "") return "A combinar";
  return moeda.format(Number(valor));
}

export function esc(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function normalizar(texto) {
  return String(texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function urlFoto(produtoId, fotoId, tamanho = "t") {
  return `/img/${produtoId}/${fotoId}/${tamanho}`;
}

// Nome da loja com o "!" final em laranja (ex.: Achei!)
export function nomeLojaHTML(nome) {
  const n = String(nome || "Achei!").trim();
  if (n.endsWith("!")) return `${esc(n.slice(0, -1))}<span>!</span>`;
  return esc(n);
}

export function linkWhatsapp(config, texto) {
  if (!config || !config.whatsapp) return null;
  return `https://wa.me/${config.whatsapp}?text=${encodeURIComponent(texto)}`;
}

export function mensagemProduto(config, produto) {
  const modelo = (config && config.mensagemWhats) ||
    "Olá! Tenho interesse no {produto} (cód. {codigo}). Ainda está disponível?";
  return modelo.replaceAll("{produto}", produto.titulo).replaceAll("{codigo}", produto.codigo);
}

// Transforma o objeto do banco em lista com id
export function paraLista(objeto) {
  return Object.entries(objeto || {}).map(([id, v]) => ({ id, ...v }));
}

// Card de produto usado na home e no "Veja também"
export function cardProduto(p) {
  const capa = (p.fotos || [])[0];
  const img = capa
    ? `<img src="${urlFoto(p.id, capa, "t")}" alt="${esc(p.titulo)}" loading="lazy" decoding="async">`
    : `<div class="card-sem-foto">Sem foto</div>`;

  let selo = "";
  if (p.status === "reservado") selo = `<span class="selo selo-reservado">Reservado</span>`;
  else if (p.status === "vendido") selo = `<span class="selo selo-vendido">Vendido</span>`;
  else if (p.destaque) selo = `<span class="selo selo-destaque">Destaque</span>`;

  return `
    <a class="card${p.status === "vendido" ? " card-vendido" : ""}" href="/p/${esc(p.codigo)}">
      <div class="card-img">${img}${selo}</div>
      <div class="card-corpo">
        <span class="card-estado">${esc(ESTADOS_CURTOS[p.estado] || "")}</span>
        <h3 class="card-titulo">${esc(p.titulo)}</h3>
        <strong class="card-preco">${esc(formatarPreco(p.preco))}</strong>
      </div>
    </a>`;
}

// Aviso rápido no rodapé
let timerAviso = null;
export function aviso(texto) {
  let el = document.getElementById("aviso");
  if (!el) {
    el = document.createElement("div");
    el.id = "aviso";
    el.className = "aviso";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    document.body.appendChild(el);
  }
  el.textContent = texto;
  el.classList.add("visivel");
  clearTimeout(timerAviso);
  timerAviso = setTimeout(() => el.classList.remove("visivel"), 2600);
}

export const ICONE_CHAT = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.6-5.3A8.4 8.4 0 1 1 21 11.5z"/></svg>`;
