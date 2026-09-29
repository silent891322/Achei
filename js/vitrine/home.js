// Home da vitrine: categorias, busca, filtros, destaques e grade de produtos
import {
  lerDB, paraLista, cardProduto, normalizar, nomeLojaHTML, esc,
  linkWhatsapp, ICONE_CHAT
} from "./comum.js";

const $ = (id) => document.getElementById(id);

const estado = {
  config: {},
  categorias: [],
  produtos: [],
  categoria: "",     // slug da categoria selecionada
  busca: "",
  ordem: "recentes",
  filtros: {}        // { campoId: valor }
};

// ---------- Topo e rodapé ----------

function renderMarca() {
  const c = estado.config;
  $("logoLoja").innerHTML = nomeLojaHTML(c.nomeLoja);
  $("sloganLoja").textContent = c.slogan || "";
  $("sloganLoja").hidden = !c.slogan;
  document.title = `${c.nomeLoja || "Achei!"}${c.slogan ? " — " + c.slogan : ""}`;

  const link = linkWhatsapp(c, "Olá! Vi sua vitrine e gostaria de mais informações.");
  if (link) {
    const btn = $("whatsFlutuante");
    btn.href = link;
    btn.innerHTML = ICONE_CHAT + "<span>WhatsApp</span>";
    btn.hidden = false;
  }
}

function renderRodape() {
  const c = estado.config;
  const itens = [];
  if (c.horario) itens.push(`<li><strong>Atendimento:</strong> ${esc(c.horario)}</li>`);
  if (c.regiao) itens.push(`<li><strong>Região:</strong> ${esc(c.regiao)}</li>`);
  if (c.textoPagamento) itens.push(`<li><strong>Pagamento:</strong> ${esc(c.textoPagamento)}</li>`);
  if (c.textoEntrega) itens.push(`<li><strong>Entrega:</strong> ${esc(c.textoEntrega)}</li>`);
  if (c.instagram) {
    const user = esc(c.instagram);
    itens.push(`<li><strong>Instagram:</strong> <a href="https://instagram.com/${user}" target="_blank" rel="noopener">@${user}</a></li>`);
  }

  $("rodape").innerHTML = `
    <div class="rodape-inner">
      <div class="logo logo-rodape">${nomeLojaHTML(c.nomeLoja)}</div>
      ${itens.length ? `<ul class="rodape-lista">${itens.join("")}</ul>` : ""}
      <p class="rodape-copy">© ${new Date().getFullYear()} ${esc(c.nomeLoja || "Achei!")}</p>
    </div>`;
}

// ---------- Categorias ----------

function produtosAtivos() {
  return estado.produtos.filter((p) => p.status !== "vendido");
}

function categoriaAtual() {
  return estado.categorias.find((c) => c.slug === estado.categoria) || null;
}

function renderCategorias() {
  const ativos = produtosAtivos();
  const contar = (id) => ativos.filter((p) => p.categoriaId === id).length;

  const chips = [`<button type="button" class="chip-cat${!estado.categoria ? " ativo" : ""}" data-slug="">Todos <span>${ativos.length}</span></button>`];
  estado.categorias.forEach((c) => {
    const n = contar(c.id);
    if (!n) return; // esconde categoria vazia
    chips.push(`<button type="button" class="chip-cat${estado.categoria === c.slug ? " ativo" : ""}" data-slug="${esc(c.slug)}">${esc(c.nome)} <span>${n}</span></button>`);
  });

  $("cats").innerHTML = chips.join("");
  $("cats").querySelectorAll(".chip-cat").forEach((b) => {
    b.addEventListener("click", () => selecionarCategoria(b.dataset.slug));
  });

  const ativo = $("cats").querySelector(".chip-cat.ativo");
  if (ativo) ativo.scrollIntoView({ inline: "center", block: "nearest" });
}

function selecionarCategoria(slug) {
  estado.categoria = slug;
  estado.filtros = {};
  atualizarURL();
  renderCategorias();
  renderFiltrosCampos();
  renderLista();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Filtros por campo (ex.: Aro, Voltagem) quando uma categoria está aberta
function renderFiltrosCampos() {
  const box = $("filtrosCampos");
  const cat = categoriaAtual();
  const campos = (cat?.campos || []).filter((c) => c.filtro);

  if (!cat || !campos.length) {
    box.hidden = true;
    box.innerHTML = "";
    return;
  }

  const daCategoria = produtosAtivos().filter((p) => p.categoriaId === cat.id);
  const html = campos.map((c) => {
    const valores = [...new Set(daCategoria.map((p) => p.campos?.[c.id]).filter(Boolean))]
      .sort((a, b) => String(a).localeCompare(String(b), "pt-BR", { numeric: true }));
    if (!valores.length) return "";
    const sel = estado.filtros[c.id] || "";
    const rotulo = c.unidade ? `${c.rotulo} (${c.unidade})` : c.rotulo;
    return `
      <div class="filtro">
        <label for="f_${esc(c.id)}">${esc(rotulo)}</label>
        <select id="f_${esc(c.id)}" data-campo="${esc(c.id)}">
          <option value="">Todos</option>
          ${valores.map((v) => `<option value="${esc(v)}"${String(v) === sel ? " selected" : ""}>${esc(v)}</option>`).join("")}
        </select>
      </div>`;
  }).join("");

  box.innerHTML = html;
  box.hidden = !html.trim();
  box.querySelectorAll("select").forEach((s) => {
    s.addEventListener("change", () => {
      if (s.value) estado.filtros[s.dataset.campo] = s.value;
      else delete estado.filtros[s.dataset.campo];
      renderLista();
    });
  });
}

// ---------- Lista ----------

function filtrar() {
  const cat = categoriaAtual();
  const busca = normalizar(estado.busca);
  const nomesCat = Object.fromEntries(estado.categorias.map((c) => [c.id, c.nome]));

  let lista = produtosAtivos()
    .filter((p) => !cat || p.categoriaId === cat.id)
    .filter((p) => Object.entries(estado.filtros).every(([campo, valor]) => String(p.campos?.[campo] ?? "") === valor))
    .filter((p) => {
      if (!busca) return true;
      const texto = normalizar([
        p.titulo, p.codigo, p.descricao, nomesCat[p.categoriaId],
        ...Object.values(p.campos || {})
      ].join(" "));
      return busca.split(/\s+/).every((termo) => texto.includes(termo));
    });

  const precoOuInfinito = (p, dir) =>
    p.preco === null || p.preco === undefined ? (dir === "menor" ? Infinity : -Infinity) : Number(p.preco);

  if (estado.ordem === "menor") lista.sort((a, b) => precoOuInfinito(a, "menor") - precoOuInfinito(b, "menor"));
  else if (estado.ordem === "maior") lista.sort((a, b) => precoOuInfinito(b, "maior") - precoOuInfinito(a, "maior"));
  else lista.sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));

  // Reservados vão para o fim
  lista = [...lista.filter((p) => p.status !== "reservado"), ...lista.filter((p) => p.status === "reservado")];
  return lista;
}

function renderLista() {
  const cat = categoriaAtual();
  const lista = filtrar();

  $("tituloLista").textContent = estado.busca
    ? `Resultados para "${estado.busca}"`
    : cat ? cat.nome : "Todos os produtos";

  $("contador").textContent = lista.length === 1 ? "1 produto" : `${lista.length} produtos`;

  if (!lista.length) {
    $("grade").innerHTML = `
      <div class="vazio">
        <strong>Nenhum produto encontrado</strong>
        <span>Tente outra busca ou veja todas as categorias.</span>
        <button type="button" class="btn-limpar" id="btnLimpar">Ver todos os produtos</button>
      </div>`;
    $("btnLimpar").addEventListener("click", () => {
      estado.busca = "";
      $("busca").value = "";
      selecionarCategoria("");
    });
  } else {
    $("grade").innerHTML = lista.map(cardProduto).join("");
  }

  // Destaques e vendidos só aparecem na visão geral
  const visaoGeral = !cat && !estado.busca;
  const destaques = produtosAtivos()
    .filter((p) => p.destaque && p.status === "disponivel")
    .sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
  $("secDestaques").hidden = !(visaoGeral && destaques.length);
  if (visaoGeral && destaques.length) $("destaques").innerHTML = destaques.map(cardProduto).join("");

  const vendidos = estado.produtos
    .filter((p) => p.status === "vendido")
    .sort((a, b) => (b.vendidoEm || 0) - (a.vendidoEm || 0))
    .slice(0, 4);
  $("secVendidos").hidden = !(visaoGeral && vendidos.length);
  if (visaoGeral && vendidos.length) $("vendidos").innerHTML = vendidos.map(cardProduto).join("");
}

// ---------- URL (permite mandar link de uma categoria: /?cat=rodas-e-pneus) ----------

function atualizarURL() {
  const params = new URLSearchParams();
  if (estado.categoria) params.set("cat", estado.categoria);
  if (estado.busca) params.set("q", estado.busca);
  const qs = params.toString();
  history.replaceState(null, "", qs ? `/?${qs}` : "/");
}

function lerURL() {
  const params = new URLSearchParams(location.search);
  estado.categoria = params.get("cat") || "";
  estado.busca = params.get("q") || "";
  $("busca").value = estado.busca;
}

// ---------- Início ----------

async function iniciar() {
  lerURL();

  let timerBusca = null;
  $("busca").addEventListener("input", (e) => {
    clearTimeout(timerBusca);
    timerBusca = setTimeout(() => {
      estado.busca = e.target.value.trim();
      atualizarURL();
      renderLista();
    }, 200);
  });
  $("busca").addEventListener("keydown", (e) => {
    if (e.key === "Enter") e.target.blur();
  });
  $("ordem").addEventListener("change", (e) => {
    estado.ordem = e.target.value;
    renderLista();
  });

  try {
    const [config, categorias, produtos] = await Promise.all([
      lerDB("config"), lerDB("categorias"), lerDB("produtos")
    ]);
    estado.config = config || {};
    estado.categorias = paraLista(categorias)
      .filter((c) => c.ativa !== false)
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    const idsAtivas = new Set(estado.categorias.map((c) => c.id));
    estado.produtos = paraLista(produtos).filter((p) => idsAtivas.has(p.categoriaId));

    if (estado.categoria && !categoriaAtual()) estado.categoria = "";

    renderMarca();
    renderRodape();
    renderCategorias();
    renderFiltrosCampos();
    renderLista();
  } catch (err) {
    console.error(err);
    $("grade").innerHTML = `
      <div class="vazio">
        <strong>Não foi possível carregar a vitrine</strong>
        <span>Verifique sua conexão e tente novamente.</span>
        <button type="button" class="btn-limpar" onclick="location.reload()">Tentar de novo</button>
      </div>`;
  }
}

iniciar();
