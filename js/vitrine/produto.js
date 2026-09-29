// Página do produto (/p/{codigo}) — desenha a página a partir dos dados entregues pela função
import {
  lerDB, paraLista, cardProduto, formatarPreco, esc, nomeLojaHTML, urlFoto,
  linkWhatsapp, mensagemProduto, registrarMetrica, aviso, ESTADOS, ICONE_CHAT
} from "./comum.js";

const $ = (id) => document.getElementById(id);
const dados = JSON.parse($("dadosPagina").textContent || "{}");
const config = dados.config || {};
const app = $("app");

$("logoLoja").innerHTML = nomeLojaHTML(config.nomeLoja);

// ---------- Produto não encontrado ----------

if (dados.naoEncontrado) {
  app.innerHTML = `
    <div class="nao-encontrado">
      <strong>Produto não encontrado</strong>
      <p>Esse produto pode ter sido vendido ou removido. Veja os outros itens da vitrine.</p>
      <a href="/" class="btn-principal">Ver todos os produtos</a>
    </div>`;
  $("btnCompartilhar").hidden = true;
} else {
  montarPagina();
}

// ---------- Página ----------

function montarPagina() {
  const { id, produto: p } = dados;
  const fotos = p.fotos || [];
  const vendido = p.status === "vendido";
  const reservado = p.status === "reservado";

  let seloStatus = "";
  if (vendido) seloStatus = `<span class="selo selo-vendido">Vendido</span>`;
  else if (reservado) seloStatus = `<span class="selo selo-reservado">Reservado</span>`;
  else seloStatus = `<span class="selo selo-disponivel">Disponível</span>`;

  const galeria = fotos.length ? `
    <div class="galeria">
      <div class="galeria-trilho" id="galeriaTrilho">
        ${fotos.map((f, i) => `
          <div class="galeria-slide">
            <img src="${urlFoto(id, f, "g")}" alt="${esc(p.titulo)} — foto ${i + 1}"
              ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">
          </div>`).join("")}
      </div>
      ${fotos.length > 1 ? `
        <button type="button" class="galeria-seta esquerda" id="setaEsq" aria-label="Foto anterior">‹</button>
        <button type="button" class="galeria-seta direita" id="setaDir" aria-label="Próxima foto">›</button>
        <span class="galeria-contador" id="galeriaContador">1 / ${fotos.length}</span>
        <div class="galeria-pontos" id="galeriaPontos">
          ${fotos.map((_, i) => `<span class="${i === 0 ? "ativo" : ""}"></span>`).join("")}
        </div>` : ""}
      ${vendido ? `<div class="galeria-faixa">VENDIDO</div>` : ""}
    </div>` : `<div class="galeria galeria-vazia">Sem fotos</div>`;

  const condicoes = [];
  if (config.textoPagamento) condicoes.push(["Pagamento", config.textoPagamento]);
  if (config.textoEntrega) condicoes.push(["Entrega", config.textoEntrega]);
  if (config.localRetirada) condicoes.push(["Retirada", config.localRetirada]);
  if (config.aceitaTroca) condicoes.push(["Troca", config.textoTroca || "Aceito propostas de troca"]);
  if (config.horario) condicoes.push(["Atendimento", config.horario]);
  if (config.regiao) condicoes.push(["Região", config.regiao]);

  app.innerHTML = `
    <div class="produto-layout">
      <div class="produto-col-fotos">${galeria}</div>

      <div class="produto-col-info">
        <div class="produto-cabecalho">
          <div class="produto-selos">
            ${seloStatus}
            <span class="produto-codigo">Cód. ${esc(p.codigo)}</span>
          </div>
          <h1 class="produto-titulo">${esc(p.titulo)}</h1>
          <div class="produto-preco">${esc(formatarPreco(p.preco))}</div>
          <div class="produto-estado">
            <span class="estado-rotulo">Estado:</span> ${esc(ESTADOS[p.estado] || "Não informado")}
          </div>
        </div>

        ${vendido ? `
          <div class="aviso-status aviso-vendido">
            Este produto já foi vendido. Veja abaixo outros produtos parecidos.
          </div>` : reservado ? `
          <div class="aviso-status aviso-reservado">
            Este produto está reservado. Chame no WhatsApp para entrar na fila caso a venda não se concretize.
          </div>` : ""}

        <div id="fichaTecnica"></div>

        ${p.descricao ? `
          <section class="bloco">
            <h2>Descrição</h2>
            <p class="texto-longo">${esc(p.descricao)}</p>
          </section>` : ""}

        ${p.detalhes ? `
          <section class="bloco bloco-detalhes">
            <h2>Detalhes e defeitos</h2>
            <p class="texto-longo">${esc(p.detalhes)}</p>
          </section>` : ""}

        ${condicoes.length ? `
          <section class="bloco">
            <h2>Condições</h2>
            <dl class="lista-dados">
              ${condicoes.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}
            </dl>
          </section>` : ""}
      </div>
    </div>

    <section class="veja-tambem" id="vejaTambem" hidden>
      <h2 class="titulo-secao">Veja também</h2>
      <div class="grade" id="gradeRelacionados"></div>
      <a href="/" class="btn-secundario-grande">Ver todos os produtos</a>
    </section>

    <div class="barra-compra">
      <div class="barra-compra-inner">
        <div class="barra-preco">
          <span>${vendido ? "Vendido" : "Preço"}</span>
          <strong>${esc(formatarPreco(p.preco))}</strong>
        </div>
        <a class="btn-whats" id="btnWhats" href="#" target="_blank" rel="noopener">
          ${ICONE_CHAT}<span>${vendido ? "Pedir similar" : "Chamar no WhatsApp"}</span>
        </a>
      </div>
    </div>`;

  configurarWhatsapp(p, vendido);
  configurarGaleria(fotos.length);
  configurarCompartilhar(p);
  contarVisualizacao(id);
  carregarExtras(id, p);
}

// ---------- WhatsApp ----------

function configurarWhatsapp(p, vendido) {
  const btn = $("btnWhats");
  const texto = vendido
    ? `Olá! Vi que o ${p.titulo} (cód. ${p.codigo}) já foi vendido. Você tem algo parecido?`
    : mensagemProduto(config, p);
  const link = linkWhatsapp(config, texto);

  if (!link) {
    btn.hidden = true;
    return;
  }
  btn.href = link;
  btn.addEventListener("click", () => registrarMetrica(dados.id, "cliquesWhats"));
}

// ---------- Galeria (arrastar para o lado) ----------

function configurarGaleria(total) {
  if (total < 2) return;
  const trilho = $("galeriaTrilho");
  const pontos = $("galeriaPontos").children;
  const contador = $("galeriaContador");

  const atual = () => Math.round(trilho.scrollLeft / trilho.clientWidth);
  const irPara = (i) => {
    const alvo = Math.max(0, Math.min(total - 1, i));
    trilho.scrollTo({ left: alvo * trilho.clientWidth, behavior: "smooth" });
  };

  let quadro = null;
  trilho.addEventListener("scroll", () => {
    cancelAnimationFrame(quadro);
    quadro = requestAnimationFrame(() => {
      const i = atual();
      contador.textContent = `${i + 1} / ${total}`;
      Array.from(pontos).forEach((p, idx) => p.classList.toggle("ativo", idx === i));
      $("setaEsq").disabled = i === 0;
      $("setaDir").disabled = i === total - 1;
    });
  }, { passive: true });

  $("setaEsq").disabled = true;
  $("setaEsq").addEventListener("click", () => irPara(atual() - 1));
  $("setaDir").addEventListener("click", () => irPara(atual() + 1));
}

// ---------- Compartilhar ----------

function configurarCompartilhar(p) {
  $("btnCompartilhar").addEventListener("click", async () => {
    const url = `${location.origin}/p/${p.codigo}`;
    const texto = `${p.titulo} — ${formatarPreco(p.preco)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: p.titulo, text: texto, url });
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      aviso("Link copiado!");
    } catch (e) {
      prompt("Copie o link do produto:", url);
    }
  });
}

// ---------- Visualizações ----------

function contarVisualizacao(id) {
  const chave = "achei_v_" + id;
  try {
    if (sessionStorage.getItem(chave)) return;
    sessionStorage.setItem(chave, "1");
  } catch (e) { /* navegação privada: conta mesmo assim */ }
  registrarMetrica(id, "views");
}

// ---------- Ficha técnica e "Veja também" ----------

async function carregarExtras(id, p) {
  try {
    const [categorias, produtos] = await Promise.all([lerDB("categorias"), lerDB("produtos")]);
    const cat = categorias?.[p.categoriaId];

    // Ficha técnica: segue a ordem dos campos da categoria
    const linhas = (cat?.campos || [])
      .map((c) => {
        const v = p.campos?.[c.id];
        if (v === undefined || v === null || v === "") return null;
        const valor = c.tipo === "numero" && c.unidade ? `${v} ${c.unidade}` : v;
        return `<div><dt>${esc(c.rotulo)}</dt><dd>${esc(valor)}</dd></div>`;
      })
      .filter(Boolean);

    $("fichaTecnica").innerHTML = `
      <section class="bloco">
        <h2>Ficha técnica</h2>
        <dl class="lista-dados">
          ${cat ? `<div><dt>Categoria</dt><dd><a href="/?cat=${encodeURIComponent(cat.slug || "")}">${esc(cat.nome)}</a></dd></div>` : ""}
          ${linhas.join("")}
        </dl>
      </section>`;

    // Veja também: primeiro da mesma categoria, depois os mais recentes
    const catsAtivas = new Set(Object.entries(categorias || {}).filter(([, c]) => c.ativa !== false).map(([cid]) => cid));
    const outros = paraLista(produtos)
      .filter((x) => x.id !== id && x.status === "disponivel" && catsAtivas.has(x.categoriaId))
      .sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
    const mesmaCat = outros.filter((x) => x.categoriaId === p.categoriaId);
    const resto = outros.filter((x) => x.categoriaId !== p.categoriaId);
    const relacionados = [...mesmaCat, ...resto].slice(0, 6);

    if (relacionados.length) {
      $("gradeRelacionados").innerHTML = relacionados.map(cardProduto).join("");
      $("vejaTambem").hidden = false;
    }
  } catch (err) {
    console.error(err);
  }
}
