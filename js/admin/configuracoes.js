// Aba "Configurações da loja" do painel
import { db } from "../firebase.js";
import { ref, get, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { toast, normalizarWhatsapp, formatarTelefone, carregandoBotao } from "./ui.js";

// Valores usados na primeira vez (antes de salvar qualquer coisa)
const PADRAO = {
  nomeLoja: "Achei!",
  slogan: "Usados & Oportunidades",
  whatsapp: "",
  instagram: "",
  regiao: "",
  localRetirada: "",
  horario: "Segunda a sábado, das 9h às 18h",
  textoPagamento: "PIX, dinheiro ou cartão (consulte as taxas).",
  textoEntrega: "Retirada no local ou entrega a combinar.",
  aceitaTroca: false,
  textoTroca: "",
  mensagemWhats: "Olá! Tenho interesse no {produto} (cód. {codigo}). Ainda está disponível?"
};

const $ = (id) => document.getElementById(id);

function preencherFormulario(cfg) {
  $("cfgNomeLoja").value = cfg.nomeLoja || "";
  $("cfgSlogan").value = cfg.slogan || "";
  $("cfgWhatsapp").value = cfg.whatsapp ? formatarTelefone(cfg.whatsapp) : "";
  $("cfgInstagram").value = cfg.instagram || "";
  $("cfgRegiao").value = cfg.regiao || "";
  $("cfgRetirada").value = cfg.localRetirada || "";
  $("cfgHorario").value = cfg.horario || "";
  $("cfgPagamento").value = cfg.textoPagamento || "";
  $("cfgEntrega").value = cfg.textoEntrega || "";
  $("cfgAceitaTroca").checked = !!cfg.aceitaTroca;
  $("cfgTextoTroca").value = cfg.textoTroca || "";
  $("cfgMensagem").value = cfg.mensagemWhats || "";
  atualizarCampoTroca();
  atualizarPreviaMensagem();
}

function lerFormulario() {
  return {
    nomeLoja: $("cfgNomeLoja").value.trim(),
    slogan: $("cfgSlogan").value.trim(),
    whatsapp: normalizarWhatsapp($("cfgWhatsapp").value),
    instagram: $("cfgInstagram").value.trim().replace(/^@/, ""),
    regiao: $("cfgRegiao").value.trim(),
    localRetirada: $("cfgRetirada").value.trim(),
    horario: $("cfgHorario").value.trim(),
    textoPagamento: $("cfgPagamento").value.trim(),
    textoEntrega: $("cfgEntrega").value.trim(),
    aceitaTroca: $("cfgAceitaTroca").checked,
    textoTroca: $("cfgTextoTroca").value.trim(),
    mensagemWhats: $("cfgMensagem").value.trim(),
    atualizadoEm: Date.now()
  };
}

function validar(cfg) {
  if (!cfg.nomeLoja) return "Informe o nome da loja.";
  if (!cfg.whatsapp) return "Informe o WhatsApp da loja.";
  if (cfg.whatsapp.length < 12 || cfg.whatsapp.length > 13) {
    return "WhatsApp inválido. Use DDD + número, ex.: (21) 99999-9999.";
  }
  if (!cfg.mensagemWhats) return "Informe a mensagem padrão do WhatsApp.";
  return null;
}

function atualizarCampoTroca() {
  $("grupoTextoTroca").hidden = !$("cfgAceitaTroca").checked;
}

function montarMensagemExemplo() {
  const modelo = $("cfgMensagem").value.trim() || PADRAO.mensagemWhats;
  return modelo
    .replaceAll("{produto}", "Roda aro 15")
    .replaceAll("{codigo}", "023");
}

function atualizarPreviaMensagem() {
  $("previaMensagem").textContent = montarMensagemExemplo();
}

export async function iniciarConfiguracoes() {
  const form = $("formConfig");
  const btnSalvar = $("btnSalvarConfig");

  // Carrega o que já está salvo
  try {
    const snap = await get(ref(db, "config"));
    const salvo = snap.exists() ? snap.val() : {};
    preencherFormulario({ ...PADRAO, ...salvo });
  } catch (err) {
    console.error(err);
    preencherFormulario(PADRAO);
    toast("Não foi possível carregar as configurações.", "erro");
  }

  $("cfgAceitaTroca").addEventListener("change", atualizarCampoTroca);
  $("cfgMensagem").addEventListener("input", atualizarPreviaMensagem);

  // Formata o telefone ao sair do campo
  $("cfgWhatsapp").addEventListener("blur", (e) => {
    const n = normalizarWhatsapp(e.target.value);
    if (n) e.target.value = formatarTelefone(n);
  });

  // Testa o link do WhatsApp com a mensagem de exemplo
  $("btnTestarWhats").addEventListener("click", () => {
    const numero = normalizarWhatsapp($("cfgWhatsapp").value);
    if (numero.length < 12) {
      toast("Digite um WhatsApp válido para testar.", "erro");
      $("cfgWhatsapp").focus();
      return;
    }
    const url = `https://wa.me/${numero}?text=${encodeURIComponent(montarMensagemExemplo())}`;
    window.open(url, "_blank", "noopener");
  });

  // Salvar
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const cfg = lerFormulario();
    const erro = validar(cfg);
    if (erro) {
      toast(erro, "erro");
      return;
    }

    carregandoBotao(btnSalvar, true);
    try {
      await set(ref(db, "config"), cfg);
      toast("Configurações salvas!");
    } catch (err) {
      console.error(err);
      toast("Erro ao salvar. Tente novamente.", "erro");
    } finally {
      carregandoBotao(btnSalvar, false);
    }
  });
}
