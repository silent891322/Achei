// Processamento de fotos no navegador (antes de salvar no banco)
// Cada foto vira duas versões em JPEG: miniatura (t) e grande (g)

export const MAX_FOTOS = 10;

const TAM_GRANDE = 1280;
const TAM_MINI = 400;

function carregarImagem(arquivo) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("formato"));
    };
    img.src = url;
  });
}

function redimensionar(img, tamanhoMax, qualidade) {
  const largura = img.naturalWidth || img.width;
  const altura = img.naturalHeight || img.height;
  const escala = Math.min(1, tamanhoMax / Math.max(largura, altura));
  const w = Math.max(1, Math.round(largura * escala));
  const h = Math.max(1, Math.round(altura * escala));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#FFFFFF"; // fundo branco para PNG com transparência
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", qualidade);
}

// Recebe um arquivo de imagem e devolve { t, g } em base64 (data URL)
export async function processarFoto(arquivo) {
  if (!arquivo.type || !arquivo.type.startsWith("image/")) {
    throw new Error("formato");
  }
  const img = await carregarImagem(arquivo);

  let g = redimensionar(img, TAM_GRANDE, 0.72);
  // Se ainda ficou pesada (acima de ~300 KB), comprime mais
  if (g.length > 400000) g = redimensionar(img, TAM_GRANDE, 0.6);
  if (g.length > 400000) g = redimensionar(img, 1024, 0.6);

  const t = redimensionar(img, TAM_MINI, 0.7);
  return { t, g };
}
