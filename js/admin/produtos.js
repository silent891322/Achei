// Aba "Produtos" do painel — cadastro, edição, status e exclusão
import { db } from "../firebase.js";
import {
  ref, onValue, push, get, update, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { toast, carregandoBotao } from "./ui.js";
import { processarFoto, MAX_FOTOS } from "./imagens.js";

export const ESTADOS = {
  novo: "Novo (nunca usado)",
  seminovo: "Seminovo",
  bom: "Usado — bom estado",
  marcas: "Usado — com marcas de uso",
  pecas: "Com defeito / para peças"
};

export const STATUS = {
  disponivel: "Disponível",
  reservado: "Reservado",
  vendido: "Vendido"
};

const $ = (id) => document.getElementById(id);
const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

let categorias = {};
let produtos = {};
let editando = null;       // produto aberto na janela
let processando = 0;       // fotos sendo processadas
const cacheMini = {};      // miniaturas da lista: { produtoId: dataURL }

// ---------- Utilidades ----------

function el(tag, attrs = {}, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v;
    else if (k === "text") e.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, "");
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  filhos.flat().forEach((f) => f != null && e.append(f));
  return e;
}

function normalizar(txt) {
  return String(txt || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function formatarPreco(valor) {
  if (valor === null || valor === undefined || valor === "") return "A combinar";
  return moeda.format(Number(valor));
}

// Aceita "1.250,00", "1250", "1250.5", "R$ 99,90"
function lerPreco(texto) {
  let t = String(texto || "").replace(/[R$\s]/g, "");
  if (!t) return NaN;
  if (t.includes(",")) {
    t = t.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
    t = t.replace(/\./g, "");
  }
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN;
}

function precoParaCampo(valor) {
  if (valor === null || valor === undefined) return "";
  return Number(valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function categoriasOrdenadas() {
  return Object.entries(categorias)
    .map(([id, c]) => ({ id, ...c }))
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
}

// ---------- Lista ----------

function produtosFiltrados() {
  const busca = normalizar($("filtroBusca").value.trim());
  const status = $("filtroStatus").value;
  const cat = $("filtroCategoria").value;

  return Object.entries(produtos)
    .map(([id, p]) => ({ id, ...p }))
    .filter((p) => !status || p.status === status)
    .filter((p) => !cat || p.categoriaId === cat)
    .filter((p) => {
      if (!busca) return true;
      return normalizar(`${p.titulo} ${p.codigo} ${p.descricao || ""}`).includes(busca);
    })
    .sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
}

function atualizarFiltroCategorias() {
  const sel = $("filtroCategoria");
  const atual = sel.value;
  sel.innerHTML = "";
  sel.append(el("option", { value: "" }, "Todas as categorias"));
  categoriasOrdenadas().forEach((c) => sel.append(el("option", { value: c.id }, c.nome)));
  sel.value = categorias[atual] ? atual : "";
}

function atualizarResumo() {
  const lista = Object.values(produtos);
  const cont = { disponivel: 0, reservado: 0, vendido: 0 };
  lista.forEach((p) => { if (cont[p.status] !== undefined) cont[p.status]++; });
  $("resumoProdutos").textContent =
    `${lista.length} no total · ${cont.disponivel} disponíveis · ${cont.reservado} reservados · ${cont.vendido} vendidos`;
}

async function carregarMini(produto, imgEl) {
  const capa = (produto.fotos || [])[0];
  if (!capa) return;
  const chave = produto.id + "/" + capa;
  if (cacheMini[chave]) {
    imgEl.src = cacheMini[chave];
    return;
  }
  try {
    const snap = await get(ref(db, `fotos/${produto.id}/${capa}/t`));
    if (snap.exists()) {
      cacheMini[chave] = snap.val();
      imgEl.src = snap.val();
    }
  } catch (err) {
    console.error(err);
  }
}

function renderLista() {
  const box = $("listaProdutos");
  box.innerHTML = "";
  atualizarResumo();

  if (!Object.keys(produtos).length) {
    box.append(el("div", { class: "cartao vazio" },
      el("strong", { text: "Nenhum produto ainda" }),
      Object.keys(categorias).length
        ? "Clique em \"+ Novo produto\" para cadastrar o primeiro."
        : "Antes, crie pelo menos uma categoria na aba Categorias."
    ));
    return;
  }

  const itens = produtosFiltrados();
  if (!itens.length) {
    box.append(el("div", { class: "cartao vazio" },
      el("strong", { text: "Nada encontrado" }),
      "Nenhum produto com esses filtros."
    ));
    return;
  }

  itens.forEach((p) => {
    const img = el("img", { class: "prod-mini", alt: "", loading: "lazy" });
    carregarMini(p, img);

    const selStatus = el("select", { class: "sel-status status-" + p.status, "aria-label": "Status de " + p.titulo },
      Object.entries(STATUS).map(([v, t]) => el("option", { value: v, selected: p.status === v }, t))
    );
    selStatus.addEventListener("change", () => mudarStatus(p.id, selStatus.value));

    const nomeCat = categorias[p.categoriaId]?.nome || "Sem categoria";

    box.append(el("div", { class: "cartao prod-card" },
      el("div", { class: "prod-mini-box" }, img),
      el("div", { class: "prod-info" },
        el("div", { class: "prod-codigo", text: "Cód. " + p.codigo }),
        el("div", { class: "prod-titulo", text: p.titulo }),
        el("div", { class: "prod-meta", text: `${nomeCat} · ${formatarPreco(p.preco)}` })
      ),
      el("div", { class: "prod-acoes" },
        selStatus,
        el("button", { type: "button", class: "btn btn-secundario btn-pequeno", onclick: () => abrirEditor(p.id) }, "Editar"),
        el("button", { type: "button", class: "btn btn-perigo btn-pequeno", onclick: () => excluir(p.id) }, "Excluir")
      )
    ));
  });
}

async function mudarStatus(id, status) {
  try {
    await update(ref(db, "produtos/" + id), {
      status,
      vendidoEm: status === "vendido" ? Date.now() : null,
      atualizadoEm: Date.now()
    });
    toast(`Marcado como ${STATUS[status].toLowerCase()}.`);
  } catch (err) {
    console.error(err);
    toast("Erro ao mudar o status.", "erro");
  }
}

async function excluir(id) {
  const p = produtos[id];
  if (!p) return;
  if (!confirm(`Excluir "${p.titulo}" (cód. ${p.codigo})? As fotos também serão apagadas.`)) return;
  try {
    await update(ref(db), {
      [`produtos/${id}`]: null,
      [`fotos/${id}`]: null,
      [`metricas/${id}`]: null
    });
    toast("Produto excluído.");
  } catch (err) {
    console.error(err);
    toast("Erro ao excluir.", "erro");
  }
}

// ---------- Editor ----------

function preencherSelectCategorias(selecionada) {
  const sel = $("prodCategoria");
  sel.innerHTML = "";
  sel.append(el("option", { value: "" }, "Selecione..."));
  categoriasOrdenadas().forEach((c) => {
    sel.append(el("option", { value: c.id, selected: c.id === selecionada },
      c.ativa === false ? `${c.nome} (oculta)` : c.nome));
  });
}

async function abrirEditor(id = null) {
  if (!Object.keys(categorias).length) {
    toast("Crie pelo menos uma categoria antes de cadastrar produtos.", "erro");
    return;
  }

  if (id && produtos[id]) {
    const p = produtos[id];
    editando = {
      id,
      novo: false,
      codigo: p.codigo,
      criadoEm: p.criadoEm,
      vendidoEm: p.vendidoEm || null,
      campos: { ...(p.campos || {}) },
      fotos: (p.fotos || []).map((fid) => ({ id: fid, t: null, nova: false })),
      removidas: []
    };
    $("dlgProdTitulo").textContent = `Editar produto · Cód. ${p.codigo}`;
    $("prodTitulo").value = p.titulo || "";
    preencherSelectCategorias(p.categoriaId);
    $("prodACombinar").checked = p.preco === null || p.preco === undefined;
    $("prodPreco").value = precoParaCampo(p.preco);
    $("prodEstado").value = p.estado || "";
    $("prodStatus").value = p.status || "disponivel";
    $("prodDescricao").value = p.descricao || "";
    $("prodDetalhes").value = p.detalhes || "";
    $("prodDestaque").checked = !!p.destaque;
  } else {
    editando = {
      id: push(ref(db, "produtos")).key, // só gera o ID, não grava nada ainda
      novo: true,
      codigo: null,
      criadoEm: null,
      vendidoEm: null,
      campos: {},
      fotos: [],
      removidas: []
    };
    $("dlgProdTitulo").textContent = "Novo produto";
    $("formProduto").reset();
    preencherSelectCategorias("");
    $("prodStatus").value = "disponivel";
  }

  atualizarCampoPreco();
  renderCamposCategoria();
  renderFotos();
  $("dlgProduto").showModal();
  $("dlgProduto").querySelector(".janela-corpo").scrollTop = 0;

  // Carrega as miniaturas das fotos já salvas
  if (!editando.novo) {
    const atual = editando;
    await Promise.all(atual.fotos.map(async (f) => {
      try {
        const snap = await get(ref(db, `fotos/${atual.id}/${f.id}/t`));
        f.t = snap.val();
      } catch (err) {
        console.error(err);
      }
    }));
    if (editando === atual) renderFotos();
  }
}

function fecharEditor() {
  if (processando > 0 && !confirm("Ainda há fotos sendo processadas. Fechar mesmo assim?")) return;
  $("dlgProduto").close();
  editando = null;
}

function atualizarCampoPreco() {
  const aCombinar = $("prodACombinar").checked;
  $("prodPreco").disabled = aCombinar;
  if (aCombinar) $("prodPreco").value = "";
}

// Campos personalizados da categoria escolhida
function renderCamposCategoria() {
  const box = $("camposCategoria");
  box.innerHTML = "";
  const cat = categorias[$("prodCategoria").value];
  const campos = cat?.campos || [];

  if (!cat) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  box.append(el("h3", { text: "Ficha técnica — " + cat.nome }));

  if (!campos.length) {
    box.append(el("p", { class: "ajuda", text: "Essa categoria não tem campos extras." }));
    return;
  }

  const grid = el("div", { class: "form-grid" });
  campos.forEach((c) => {
    const idInput = "pc_" + c.id;
    const valor = editando.campos[c.id] ?? "";
    let input;

    if (c.tipo === "opcoes") {
      input = el("select", { id: idInput },
        el("option", { value: "" }, "—"),
        (c.opcoes || []).map((o) => el("option", { value: o, selected: String(valor) === o }, o))
      );
    } else if (c.tipo === "simnao") {
      input = el("select", { id: idInput },
        el("option", { value: "" }, "—"),
        el("option", { value: "Sim", selected: valor === "Sim" }, "Sim"),
        el("option", { value: "Não", selected: valor === "Não" }, "Não")
      );
    } else if (c.tipo === "numero") {
      input = el("input", { type: "text", inputmode: "decimal", id: idInput, value: String(valor) });
    } else {
      input = el("input", { type: "text", id: idInput, maxlength: "80", value: String(valor) });
    }

    const atualizar = () => { editando.campos[c.id] = input.value.trim(); };
    input.addEventListener("input", atualizar);
    input.addEventListener("change", atualizar);

    const rotulo = c.unidade ? `${c.rotulo} (${c.unidade})` : c.rotulo;
    grid.append(el("div", { class: "campo" }, el("label", { for: idInput, text: rotulo }), input));
  });
  box.append(grid);
}

// ---------- Fotos ----------

function renderFotos() {
  const box = $("gradeFotos");
  box.innerHTML = "";
  const fotos = editando.fotos;

  fotos.forEach((f, i) => {
    box.append(el("div", { class: "foto-item" + (i === 0 ? " capa" : "") },
      f.t ? el("img", { src: f.t, alt: "Foto " + (i + 1) }) : el("div", { class: "foto-carregando", text: "..." }),
      i === 0 ? el("span", { class: "foto-selo", text: "Capa" }) : null,
      el("div", { class: "foto-acoes" },
        el("button", {
          type: "button", class: "foto-btn", "aria-label": "Mover foto para a esquerda",
          disabled: i === 0, onclick: () => moverFoto(i, -1)
        }, "←"),
        el("button", {
          type: "button", class: "foto-btn", "aria-label": "Mover foto para a direita",
          disabled: i === fotos.length - 1, onclick: () => moverFoto(i, 1)
        }, "→"),
        el("button", {
          type: "button", class: "foto-btn foto-btn-perigo", "aria-label": "Remover foto",
          onclick: () => removerFoto(i)
        }, "✕")
      )
    ));
  });

  for (let i = 0; i < processando; i++) {
    box.append(el("div", { class: "foto-item" }, el("div", { class: "foto-carregando", text: "Processando..." })));
  }

  if (fotos.length + processando < MAX_FOTOS) {
    box.append(el("label", { class: "foto-add", for: "inputFotos" },
      el("span", { class: "foto-add-mais", text: "+" }),
      el("span", { text: `Adicionar fotos (${fotos.length}/${MAX_FOTOS})` })
    ));
  }
}

function moverFoto(i, direcao) {
  const j = i + direcao;
  const f = editando.fotos;
  if (j < 0 || j >= f.length) return;
  [f[i], f[j]] = [f[j], f[i]];
  renderFotos();
}

function removerFoto(i) {
  const [removida] = editando.fotos.splice(i, 1);
  if (removida && !removida.nova) editando.removidas.push(removida.id);
  renderFotos();
}

async function adicionarFotos(arquivos) {
  const atual = editando;
  const vagas = MAX_FOTOS - atual.fotos.length - processando;
  const lista = Array.from(arquivos).slice(0, Math.max(0, vagas));
  if (arquivos.length > lista.length) {
    toast(`Máximo de ${MAX_FOTOS} fotos por produto.`, "erro");
  }

  for (const arq of lista) {
    processando++;
    renderFotos();
    try {
      const { t, g } = await processarFoto(arq);
      if (editando !== atual) continue;
      atual.fotos.push({ id: push(ref(db, "fotos/" + atual.id)).key, t, g, nova: true });
    } catch (err) {
      console.error(err);
      toast(`Não foi possível usar a imagem "${arq.name}". Use JPG ou PNG.`, "erro");
    } finally {
      processando--;
      if (editando === atual) renderFotos();
    }
  }
}

// ---------- Salvar ----------

async function salvar(e) {
  e.preventDefault();
  if (processando > 0) {
    toast("Aguarde as fotos terminarem de processar.", "erro");
    return;
  }

  const titulo = $("prodTitulo").value.trim();
  const categoriaId = $("prodCategoria").value;
  const estado = $("prodEstado").value;
  const status = $("prodStatus").value;
  const aCombinar = $("prodACombinar").checked;
  const preco = aCombinar ? null : lerPreco($("prodPreco").value);

  if (!editando.fotos.length) return toast("Adicione pelo menos 1 foto.", "erro");
  if (!titulo) { $("prodTitulo").focus(); return toast("Informe o título do produto.", "erro"); }
  if (!categoriaId) { $("prodCategoria").focus(); return toast("Escolha a categoria.", "erro"); }
  if (!aCombinar && Number.isNaN(preco)) {
    $("prodPreco").focus();
    return toast("Preço inválido. Ex.: 250 ou 1.250,00 — ou marque \"A combinar\".", "erro");
  }
  if (!estado) { $("prodEstado").focus(); return toast("Informe o estado do produto.", "erro"); }

  // Só guarda os campos da categoria atual que foram preenchidos
  const campos = {};
  (categorias[categoriaId]?.campos || []).forEach((c) => {
    const v = String(editando.campos[c.id] ?? "").trim();
    if (v) campos[c.id] = v;
  });

  const btn = $("btnSalvarProd");
  carregandoBotao(btn, true, editando.fotos.some((f) => f.nova) ? "Enviando fotos..." : "Salvando...");

  try {
    let codigo = editando.codigo;
    if (editando.novo) {
      const res = await runTransaction(ref(db, "contadores/produto"), (n) => (n || 0) + 1);
      codigo = String(res.snapshot.val()).padStart(3, "0");
    }

    const agora = Date.now();
    const produto = {
      codigo,
      titulo,
      categoriaId,
      preco,
      estado,
      status,
      campos,
      descricao: $("prodDescricao").value.trim(),
      detalhes: $("prodDetalhes").value.trim(),
      destaque: $("prodDestaque").checked,
      fotos: editando.fotos.map((f) => f.id),
      criadoEm: editando.criadoEm || agora,
      atualizadoEm: agora,
      vendidoEm: status === "vendido" ? (editando.vendidoEm || agora) : null
    };

    const id = editando.id;
    const mudancas = { [`produtos/${id}`]: produto };
    editando.fotos.filter((f) => f.nova).forEach((f) => {
      mudancas[`fotos/${id}/${f.id}`] = { t: f.t, g: f.g };
    });
    editando.removidas.forEach((fid) => {
      mudancas[`fotos/${id}/${fid}`] = null;
    });

    await update(ref(db), mudancas);
    toast(editando.novo ? `Produto cadastrado! Código ${codigo}` : "Produto atualizado!");
    $("dlgProduto").close();
    editando = null;
  } catch (err) {
    console.error(err);
    toast("Erro ao salvar o produto. Tente novamente.", "erro");
  } finally {
    carregandoBotao(btn, false);
  }
}

// ---------- Início ----------

export function iniciarProdutos() {
  $("btnNovoProduto").addEventListener("click", () => abrirEditor());
  $("btnFecharProd").addEventListener("click", fecharEditor);
  $("btnCancelarProd").addEventListener("click", fecharEditor);
  $("dlgProduto").addEventListener("cancel", (e) => { e.preventDefault(); fecharEditor(); });
  $("formProduto").addEventListener("submit", salvar);
  $("prodCategoria").addEventListener("change", renderCamposCategoria);
  $("prodACombinar").addEventListener("change", atualizarCampoPreco);
  $("prodPreco").addEventListener("blur", () => {
    const v = lerPreco($("prodPreco").value);
    if (!Number.isNaN(v)) $("prodPreco").value = precoParaCampo(v);
  });
  $("inputFotos").addEventListener("change", (e) => {
    if (e.target.files?.length) adicionarFotos(e.target.files);
    e.target.value = "";
  });

  ["filtroBusca", "filtroStatus", "filtroCategoria"].forEach((id) => {
    $(id).addEventListener("input", renderLista);
  });

  onValue(ref(db, "categorias"), (snap) => {
    categorias = snap.val() || {};
    atualizarFiltroCategorias();
    renderLista();
  });

  onValue(ref(db, "produtos"), (snap) => {
    produtos = snap.val() || {};
    renderLista();
  }, (err) => {
    console.error(err);
    toast("Erro ao carregar produtos.", "erro");
  });
}
