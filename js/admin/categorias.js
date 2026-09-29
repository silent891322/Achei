// Aba "Categorias" do painel — categorias com campos personalizados
import { db } from "../firebase.js";
import {
  ref, onValue, push, set, update, remove, get, query, orderByChild, equalTo
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { toast, carregandoBotao } from "./ui.js";

const TIPOS = {
  texto: "Texto livre",
  numero: "Número",
  opcoes: "Lista de opções",
  simnao: "Sim / Não"
};

// Modelos prontos para agilizar o cadastro
const MODELOS = {
  rodas: {
    nome: "Rodas e Pneus",
    campos: [
      { rotulo: "Aro", tipo: "opcoes", opcoes: ["13", "14", "15", "16", "17", "18", "19", "20"], filtro: true },
      { rotulo: "Furação", tipo: "texto", filtro: true },
      { rotulo: "Marca", tipo: "texto" },
      { rotulo: "Acompanha pneus", tipo: "simnao", filtro: true }
    ]
  },
  piscina: {
    nome: "Piscina",
    campos: [
      { rotulo: "Tipo", tipo: "opcoes", opcoes: ["Filtro", "Bomba", "Aquecedor", "Acessório"], filtro: true },
      { rotulo: "Vazão", tipo: "numero", unidade: "m³/h" },
      { rotulo: "Voltagem", tipo: "opcoes", opcoes: ["110V", "220V", "Bivolt"], filtro: true },
      { rotulo: "Marca", tipo: "texto" }
    ]
  },
  decoracao: {
    nome: "Quadros e Decoração",
    campos: [
      { rotulo: "Largura", tipo: "numero", unidade: "cm" },
      { rotulo: "Altura", tipo: "numero", unidade: "cm" },
      { rotulo: "Material", tipo: "texto" }
    ]
  },
  eletronicos: {
    nome: "Eletrônicos",
    campos: [
      { rotulo: "Marca", tipo: "texto", filtro: true },
      { rotulo: "Modelo", tipo: "texto" },
      { rotulo: "Voltagem", tipo: "opcoes", opcoes: ["110V", "220V", "Bivolt"], filtro: true },
      { rotulo: "Acompanha carregador/cabos", tipo: "simnao" }
    ]
  },
  moveis: {
    nome: "Móveis",
    campos: [
      { rotulo: "Material", tipo: "texto" },
      { rotulo: "Cor", tipo: "texto" },
      { rotulo: "Largura", tipo: "numero", unidade: "cm" },
      { rotulo: "Altura", tipo: "numero", unidade: "cm" },
      { rotulo: "Profundidade", tipo: "numero", unidade: "cm" }
    ]
  }
};

const $ = (id) => document.getElementById(id);

let categorias = {};   // tudo que está no banco
let editando = null;   // { id, nome, ativa, campos: [...] }

// ---------- Utilidades ----------

export function slugify(texto) {
  return String(texto || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

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

function listaOrdenada() {
  return Object.entries(categorias)
    .map(([id, c]) => ({ id, ...c }))
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
}

function copiarCampos(campos) {
  return (campos || []).map((c) => ({
    id: c.id || "",
    rotulo: c.rotulo || "",
    tipo: c.tipo || "texto",
    opcoes: Array.isArray(c.opcoes) ? [...c.opcoes] : [],
    unidade: c.unidade || "",
    filtro: !!c.filtro
  }));
}

// ---------- Lista de categorias ----------

function renderLista() {
  const lista = $("listaCategorias");
  lista.innerHTML = "";
  const itens = listaOrdenada();

  if (!itens.length) {
    lista.append(
      el("div", { class: "cartao vazio" },
        el("strong", { text: "Nenhuma categoria ainda" }),
        "Clique em \"Nova categoria\" para começar. Você pode usar um modelo pronto."
      )
    );
    return;
  }

  itens.forEach((cat, i) => {
    const qtd = (cat.campos || []).length;
    const chips = el("div", { class: "chips" },
      (cat.campos || []).map((c) => el("span", { class: "chip", text: c.rotulo }))
    );

    const card = el("div", { class: "cartao cat-card" + (cat.ativa === false ? " inativa" : "") },
      el("div", { class: "cat-info" },
        el("div", { class: "cat-nome" },
          el("span", { text: cat.nome }),
          cat.ativa === false ? el("span", { class: "selo selo-cinza", text: "Oculta" }) : null
        ),
        el("div", { class: "cat-meta", text: qtd === 1 ? "1 campo personalizado" : `${qtd} campos personalizados` }),
        qtd ? chips : null
      ),
      el("div", { class: "cat-acoes" },
        el("button", {
          type: "button", class: "btn-icone", "aria-label": "Subir " + cat.nome,
          disabled: i === 0, onclick: () => mover(cat.id, -1)
        }, "↑"),
        el("button", {
          type: "button", class: "btn-icone", "aria-label": "Descer " + cat.nome,
          disabled: i === itens.length - 1, onclick: () => mover(cat.id, 1)
        }, "↓"),
        el("button", { type: "button", class: "btn btn-secundario btn-pequeno", onclick: () => abrirEditor(cat.id) }, "Editar"),
        el("button", { type: "button", class: "btn btn-perigo btn-pequeno", onclick: () => excluir(cat.id) }, "Excluir")
      )
    );
    lista.append(card);
  });
}

async function mover(id, direcao) {
  const itens = listaOrdenada();
  const i = itens.findIndex((c) => c.id === id);
  const j = i + direcao;
  if (i < 0 || j < 0 || j >= itens.length) return;

  // Regrava a ordem de todas para evitar empates
  const nova = [...itens];
  [nova[i], nova[j]] = [nova[j], nova[i]];
  const mudancas = {};
  nova.forEach((c, idx) => { mudancas[`categorias/${c.id}/ordem`] = idx; });

  try {
    await update(ref(db), mudancas);
  } catch (err) {
    console.error(err);
    toast("Não foi possível reordenar.", "erro");
  }
}

async function excluir(id) {
  const cat = categorias[id];
  if (!cat) return;

  try {
    const snap = await get(query(ref(db, "produtos"), orderByChild("categoriaId"), equalTo(id)));
    if (snap.exists()) {
      const qtd = Object.keys(snap.val()).length;
      alert(`A categoria "${cat.nome}" tem ${qtd} produto(s). Mova esses produtos para outra categoria antes de excluir.`);
      return;
    }
  } catch (err) {
    console.error(err);
    toast("Não foi possível verificar os produtos dessa categoria.", "erro");
    return;
  }

  if (!confirm(`Excluir a categoria "${cat.nome}"? Essa ação não pode ser desfeita.`)) return;

  try {
    await remove(ref(db, "categorias/" + id));
    toast("Categoria excluída.");
  } catch (err) {
    console.error(err);
    toast("Erro ao excluir.", "erro");
  }
}

// ---------- Editor (janela) ----------

function abrirEditor(id = null) {
  if (id && categorias[id]) {
    const c = categorias[id];
    editando = { id, nome: c.nome || "", ativa: c.ativa !== false, campos: copiarCampos(c.campos) };
    $("dlgCatTitulo").textContent = "Editar categoria";
    $("grupoModelo").hidden = true;
  } else {
    editando = { id: null, nome: "", ativa: true, campos: [] };
    $("dlgCatTitulo").textContent = "Nova categoria";
    $("grupoModelo").hidden = false;
    $("catModelo").value = "";
  }
  $("catNome").value = editando.nome;
  $("catAtiva").checked = editando.ativa;
  renderCampos();
  $("dlgCategoria").showModal();
  setTimeout(() => $("catNome").focus(), 50);
}

function fecharEditor() {
  $("dlgCategoria").close();
  editando = null;
}

function aplicarModelo(chave) {
  const modelo = MODELOS[chave];
  if (!modelo || !editando) return;
  if (editando.campos.length && !confirm("Substituir os campos atuais pelos do modelo?")) {
    $("catModelo").value = "";
    return;
  }
  if (!$("catNome").value.trim()) $("catNome").value = modelo.nome;
  editando.campos = copiarCampos(modelo.campos);
  renderCampos();
}

function renderCampos() {
  const box = $("listaCampos");
  box.innerHTML = "";

  if (!editando.campos.length) {
    box.append(el("p", {
      class: "ajuda campos-vazio",
      text: "Nenhum campo extra. Todo produto já tem título, fotos, preço, estado e descrição. Adicione aqui só o que for específico dessa categoria."
    }));
    return;
  }

  editando.campos.forEach((campo, i) => {
    const idBase = "cp" + i;

    const selTipo = el("select", { id: idBase + "tipo" },
      Object.entries(TIPOS).map(([v, t]) => el("option", { value: v, selected: campo.tipo === v }, t))
    );
    selTipo.addEventListener("change", () => {
      campo.tipo = selTipo.value;
      renderCampos();
    });

    const inpRotulo = el("input", { type: "text", id: idBase + "rot", maxlength: "40", placeholder: "Ex.: Aro", value: campo.rotulo });
    inpRotulo.addEventListener("input", () => { campo.rotulo = inpRotulo.value; });

    let extra = null;
    if (campo.tipo === "opcoes") {
      const inpOp = el("input", {
        type: "text", id: idBase + "op", placeholder: "Ex.: 13, 14, 15, 16",
        value: campo.opcoes.join(", ")
      });
      inpOp.addEventListener("input", () => {
        campo.opcoes = inpOp.value.split(",").map((s) => s.trim()).filter(Boolean);
      });
      extra = el("div", { class: "campo campo-largo" },
        el("label", { for: idBase + "op", text: "Opções (separe por vírgula)" }),
        inpOp
      );
    } else if (campo.tipo === "numero") {
      const inpUn = el("input", { type: "text", id: idBase + "un", maxlength: "10", placeholder: "Ex.: cm, kg, m²", value: campo.unidade });
      inpUn.addEventListener("input", () => { campo.unidade = inpUn.value; });
      extra = el("div", { class: "campo" },
        el("label", { for: idBase + "un", text: "Unidade (opcional)" }),
        inpUn
      );
    }

    const chkFiltro = el("input", { type: "checkbox", id: idBase + "fil", checked: campo.filtro });
    chkFiltro.addEventListener("change", () => { campo.filtro = chkFiltro.checked; });

    const item = el("div", { class: "campo-item" },
      el("div", { class: "campo-item-topo" },
        el("span", { class: "campo-item-num", text: "Campo " + (i + 1) }),
        el("div", { class: "campo-item-acoes" },
          el("button", {
            type: "button", class: "btn-icone", "aria-label": "Subir campo",
            disabled: i === 0, onclick: () => moverCampo(i, -1)
          }, "↑"),
          el("button", {
            type: "button", class: "btn-icone", "aria-label": "Descer campo",
            disabled: i === editando.campos.length - 1, onclick: () => moverCampo(i, 1)
          }, "↓"),
          el("button", {
            type: "button", class: "btn-icone btn-icone-perigo", "aria-label": "Remover campo",
            onclick: () => { editando.campos.splice(i, 1); renderCampos(); }
          }, "✕")
        )
      ),
      el("div", { class: "form-grid" },
        el("div", { class: "campo" }, el("label", { for: idBase + "rot", text: "Nome do campo" }), inpRotulo),
        el("div", { class: "campo" }, el("label", { for: idBase + "tipo", text: "Tipo" }), selTipo),
        extra,
        el("div", { class: "campo campo-largo" },
          el("label", { class: "checkbox", for: idBase + "fil" },
            chkFiltro,
            el("span", { text: "Usar como filtro na vitrine" })
          )
        )
      )
    );
    box.append(item);
  });
}

function moverCampo(i, direcao) {
  const j = i + direcao;
  if (j < 0 || j >= editando.campos.length) return;
  const c = editando.campos;
  [c[i], c[j]] = [c[j], c[i]];
  renderCampos();
}

function adicionarCampo() {
  editando.campos.push({ id: "", rotulo: "", tipo: "texto", opcoes: [], unidade: "", filtro: false });
  renderCampos();
  const ultimo = editando.campos.length - 1;
  setTimeout(() => {
    const inp = $("cp" + ultimo + "rot");
    if (inp) { inp.focus(); inp.scrollIntoView({ block: "center", behavior: "smooth" }); }
  }, 30);
}

function slugUnico(base, ignorarId) {
  const usados = new Set(
    Object.entries(categorias)
      .filter(([id]) => id !== ignorarId)
      .map(([, c]) => c.slug)
  );
  let slug = base || "categoria";
  let n = 2;
  while (usados.has(slug)) slug = `${base}-${n++}`;
  return slug;
}

async function salvar(e) {
  e.preventDefault();
  const btn = $("btnSalvarCat");
  const nome = $("catNome").value.trim();

  if (!nome) {
    toast("Informe o nome da categoria.", "erro");
    $("catNome").focus();
    return;
  }

  // Valida e monta os campos, com ids únicos
  const idsUsados = new Set();
  const campos = [];
  for (let i = 0; i < editando.campos.length; i++) {
    const c = editando.campos[i];
    const rotulo = c.rotulo.trim();
    if (!rotulo) {
      toast(`Dê um nome ao campo ${i + 1}.`, "erro");
      return;
    }
    if (c.tipo === "opcoes" && c.opcoes.length < 2) {
      toast(`O campo "${rotulo}" precisa de pelo menos 2 opções.`, "erro");
      return;
    }
    let id = c.id || slugify(rotulo) || "campo";
    const base = id;
    let n = 2;
    while (idsUsados.has(id)) id = `${base}-${n++}`;
    idsUsados.add(id);

    const campo = { id, rotulo, tipo: c.tipo, filtro: !!c.filtro };
    if (c.tipo === "opcoes") campo.opcoes = [...new Set(c.opcoes)];
    if (c.tipo === "numero" && c.unidade.trim()) campo.unidade = c.unidade.trim();
    campos.push(campo);
  }

  const ativa = $("catAtiva").checked;
  carregandoBotao(btn, true);

  try {
    if (editando.id) {
      const atual = categorias[editando.id] || {};
      await update(ref(db, "categorias/" + editando.id), {
        nome,
        slug: atual.slug || slugUnico(slugify(nome), editando.id),
        ativa,
        campos,
        atualizadoEm: Date.now()
      });
      toast("Categoria atualizada!");
    } else {
      const maiorOrdem = listaOrdenada().reduce((m, c) => Math.max(m, c.ordem ?? 0), -1);
      const novaRef = push(ref(db, "categorias"));
      await set(novaRef, {
        nome,
        slug: slugUnico(slugify(nome), null),
        ativa,
        campos,
        ordem: maiorOrdem + 1,
        criadoEm: Date.now(),
        atualizadoEm: Date.now()
      });
      toast("Categoria criada!");
    }
    fecharEditor();
  } catch (err) {
    console.error(err);
    toast("Erro ao salvar a categoria.", "erro");
  } finally {
    carregandoBotao(btn, false);
  }
}

// ---------- Início ----------

export function iniciarCategorias() {
  $("btnNovaCategoria").addEventListener("click", () => abrirEditor());
  $("btnAddCampo").addEventListener("click", adicionarCampo);
  $("btnCancelarCat").addEventListener("click", fecharEditor);
  $("btnFecharCat").addEventListener("click", fecharEditor);
  $("formCategoria").addEventListener("submit", salvar);
  $("catModelo").addEventListener("change", (e) => aplicarModelo(e.target.value));

  // Mantém a lista sempre atualizada em tempo real
  onValue(ref(db, "categorias"), (snap) => {
    categorias = snap.val() || {};
    renderLista();
  }, (err) => {
    console.error(err);
    toast("Erro ao carregar categorias.", "erro");
  });
}
