// Utilidades de interface compartilhadas pelo painel

let timerToast = null;

// Mostra um aviso rápido no rodapé da tela
export function toast(texto, tipo = "sucesso") {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    document.body.appendChild(el);
  }
  el.textContent = texto;
  el.className = "toast visivel " + tipo;
  clearTimeout(timerToast);
  timerToast = setTimeout(() => {
    el.className = "toast " + tipo;
  }, 3200);
}

// Deixa só os números de um texto
export function somenteNumeros(texto) {
  return String(texto || "").replace(/\D/g, "");
}

// Normaliza telefone brasileiro para o formato do WhatsApp (55 + DDD + número)
export function normalizarWhatsapp(texto) {
  let num = somenteNumeros(texto);
  if (num.length === 10 || num.length === 11) num = "55" + num;
  return num;
}

// Formata para exibição: (21) 99999-9999
export function formatarTelefone(numero) {
  let n = somenteNumeros(numero);
  if (n.startsWith("55") && n.length > 11) n = n.slice(2);
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return n;
}

// Liga/desliga o estado de carregamento de um botão
export function carregandoBotao(botao, carregando, textoCarregando = "Salvando...") {
  if (carregando) {
    botao.dataset.textoOriginal = botao.textContent;
    botao.textContent = textoCarregando;
    botao.disabled = true;
  } else {
    botao.textContent = botao.dataset.textoOriginal || botao.textContent;
    botao.disabled = false;
  }
}
