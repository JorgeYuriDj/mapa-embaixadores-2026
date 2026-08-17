/* ============================================================
   Gera a imagem de preview do link (og:image, 1200x630) —
   a "capa" que aparece quando o site é compartilhado no
   WhatsApp, Telegram, LinkedIn etc.
   Saídas (as duas versionadas): assets/og-image.html (fonte
   editável) e assets/og-image.png (o que as redes leem).
   Rodar:  node scripts/gera-og-image.mjs
   Precisa de Chrome ou Edge instalado (só para gerar; o site
   em si continua sem nenhuma dependência).
   ============================================================ */

import { writeFileSync, existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { MAPA_VIEWBOX, UF_PATHS, UFS } from "../js/mapa-brasil.js";

const raiz = new URL("../", import.meta.url);
const htmlURL = new URL("assets/og-image.html", raiz);
const pngURL = new URL("assets/og-image.png", raiz);

// Mesmas cores do tema claro do site (css/style.css)
const COR = {
  fundo: "#FAFAF7", texto: "#1B1B18", texto2: "#57554E",
  marca: "#0b5c37", ufZero: "#E7E5DC", borda: "rgba(27,27,24,0.35)",
  rampa: ["#72b28b", "#4a9c6d", "#27804f", "#0b5c37"],
};

// A capa é uma vitrine, não um retrato dos dados: as UFs recebem
// tons da rampa de forma estável (hash da sigla), sem ler cadastro
// nenhum — assim a imagem nunca expõe quem está no mapa.
function tomDaUF(sigla) {
  const soma = [...sigla].reduce((a, c) => a + c.charCodeAt(0), 0);
  return soma % 5 === 0 ? COR.ufZero : COR.rampa[soma % COR.rampa.length];
}

const paths = Object.entries(UF_PATHS)
  .map(([sigla, d]) => `      <path d="${d}" fill="${tomDaUF(sigla)}" stroke="${COR.borda}" stroke-width="1.2"/>`)
  .join("\n");

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>og:image — Mapa dos Embaixadores 2026</title>
<!-- GERADO por scripts/gera-og-image.mjs — não edite à mão: rode o script. -->
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; }
  body {
    background: ${COR.fundo};
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    display: flex; align-items: center; gap: 40px; padding: 56px 64px;
    color: ${COR.texto};
  }
  .texto { flex: 1; min-width: 0; }
  .eyebrow {
    font-size: 21px; font-weight: 700; letter-spacing: .04em;
    text-transform: uppercase; color: ${COR.marca}; margin-bottom: 18px;
  }
  h1 { font-size: 76px; line-height: 1.02; letter-spacing: -.02em; margin-bottom: 22px; }
  h1 span { color: ${COR.marca}; }
  p { font-size: 29px; line-height: 1.35; color: ${COR.texto2}; }
  .rodape {
    margin-top: 34px; font-size: 20px; color: ${COR.texto2};
    display: flex; align-items: center; gap: 12px; white-space: nowrap;
  }
  .pin { font-size: 24px; }
  .selo {
    border: 2px solid ${COR.marca}; color: ${COR.marca}; font-weight: 700;
    border-radius: 999px; padding: 4px 15px; font-size: 17px;
  }
  .mapa { width: 380px; flex-shrink: 0; }
  .mapa svg { width: 100%; height: auto; display: block; }
</style>
</head>
<body>
  <div class="texto">
    <p class="eyebrow">Iniciativa independente de estudantes</p>
    <h1>O Brasil dos <span>Embaixadores</span></h1>
    <p>De onde somos e o que estudamos — o mapa colaborativo dos Embaixadores
       Estudantis do Google 2026.</p>
    <div class="rodape">
      <span class="pin">📍</span>
      <span>jorgeyuridj.github.io/mapa-embaixadores-2026</span>
      <span class="selo">cadastro anônimo</span>
    </div>
  </div>
  <div class="mapa">
    <svg viewBox="${MAPA_VIEWBOX}" xmlns="http://www.w3.org/2000/svg" role="img"
         aria-label="Mapa do Brasil dividido por estados">
${paths}
    </svg>
  </div>
</body>
</html>
`;

writeFileSync(htmlURL, html);
console.log("HTML da capa gerado: assets/og-image.html (" + Object.keys(UFS).length + " estados)");

const navegadores = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
];
const navegador = navegadores.find((p) => existsSync(p));
if (!navegador) {
  console.log("Chrome/Edge não encontrado — o PNG não foi regerado (o HTML acima já está pronto).");
  process.exit(0);
}

execFileSync(navegador, [
  "--headless",
  "--disable-gpu",
  "--hide-scrollbars",
  "--force-device-scale-factor=1",
  "--default-background-color=00000000",
  "--window-size=1200,630",
  "--screenshot=" + fileURLToPath(pngURL),
  fileURLToPath(htmlURL),
], { stdio: "pipe" });

console.log("PNG gerado: assets/og-image.png (" + Math.round(statSync(pngURL).size / 1024) + " KB)");
