// Função da Netlify: entrega as fotos salvas no Firebase como imagem normal,
// com cache longo na CDN (a foto é lida do banco uma vez e depois servida pela Netlify).
// Endereço: /img/{produtoId}/{fotoId}/{t|g}   (t = miniatura, g = grande)

const DB = "https://achei-c6dc8-default-rtdb.firebaseio.com";
const ID_VALIDO = /^[A-Za-z0-9_-]{1,40}$/;

function naoEncontrado() {
  return new Response("Imagem não encontrada", {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "Netlify-CDN-Cache-Control": "no-store"
    }
  });
}

export default async (req, context) => {
  const { produto, foto, tam } = context.params || {};

  if (!ID_VALIDO.test(produto || "") || !ID_VALIDO.test(foto || "") || !["t", "g"].includes(tam)) {
    return naoEncontrado();
  }

  try {
    const resp = await fetch(`${DB}/fotos/${produto}/${foto}/${tam}.json`);
    if (!resp.ok) return naoEncontrado();

    const dataUrl = await resp.json();
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
      return naoEncontrado();
    }

    const virgula = dataUrl.indexOf(",");
    const cabecalho = dataUrl.slice(5, virgula);           // ex.: image/jpeg;base64
    const tipo = cabecalho.split(";")[0] || "image/jpeg";
    const bytes = Buffer.from(dataUrl.slice(virgula + 1), "base64");

    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": tipo,
        // Cada foto nova ganha um ID novo, então pode guardar em cache "para sempre"
        "Cache-Control": "public, max-age=31536000, immutable",
        "Netlify-CDN-Cache-Control": "public, s-maxage=31536000, durable"
      }
    });
  } catch (err) {
    console.error(err);
    return new Response("Erro ao carregar imagem", {
      status: 502,
      headers: { "Cache-Control": "no-store", "Netlify-CDN-Cache-Control": "no-store" }
    });
  }
};

export const config = {
  path: "/img/:produto/:foto/:tam"
};
