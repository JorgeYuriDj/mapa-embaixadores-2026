/* ============================================================
   Mapa dos Embaixadores 2026 — aplicação
   Vanilla JS, sem dependências. Fluxo:
   1) carrega os dados (planilha ao vivo → CSV publicado → snapshot do repo)
   2) normaliza e valida cada registro
   3) desenha o coroplético + painel + listas
   Segurança: TODO texto vindo de dados entra no DOM via textContent
   (nunca innerHTML) — não remova isso ao contribuir.
   ============================================================ */

import { MAPA_VIEWBOX, UFS, UF_PATHS } from "./mapa-brasil.js";

const CFG = window.MAPA_CONFIG || {};
const MAX_CAMPO = 120;      // corte duro de tamanho por campo
const MAX_REGISTROS = 5000; // teto anti-flood: o form é aberto, o navegador dos visitantes não pode pagar por isso

// Só aceita http(s) — impede que um PR malicioso troque o config por "javascript:..."
function urlSegura(u) {
  if (!u) return "";
  try {
    const p = new URL(u, location.href);
    if (p.protocol === "https:" || p.protocol === "http:") return p.href;
  } catch (e) { /* URL inválida → trata como vazia */ }
  return "";
}
const URLS = {
  form: urlSegura(CFG.FORM_URL),
  repo: urlSegura(CFG.REPO_URL),
  remocao: urlSegura(CFG.REMOCAO_URL),
};

// ---------- utilidades ----------

const $ = (sel) => document.querySelector(sel);

function semAcento(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function limpaCampo(v) {
  if (v == null) return "";
  return String(v).replace(/\s+/g, " ").trim().slice(0, MAX_CAMPO);
}

// aceita "DF", "df", "Distrito Federal", "distrito federal"…
const NOME_PARA_UF = {};
for (const [sigla, info] of Object.entries(UFS)) {
  NOME_PARA_UF[sigla.toLowerCase()] = sigla;
  NOME_PARA_UF[semAcento(info.nome.toLowerCase())] = sigla;
}
function normalizaUF(v) {
  if (!v) return null;
  const chave = semAcento(String(v).trim().toLowerCase());
  if (NOME_PARA_UF[chave]) return NOME_PARA_UF[chave];
  // "DF - Distrito Federal" → sigla no início
  const sigla = chave.slice(0, 2);
  if (chave.length > 2 && NOME_PARA_UF[sigla] && /[^a-z]/.test(chave[2] || "")) return NOME_PARA_UF[sigla];
  // "Paraná (PR)" → sigla entre parênteses no fim
  const par = chave.match(/\(([a-z]{2})\)\s*$/);
  if (par && NOME_PARA_UF[par[1]]) return NOME_PARA_UF[par[1]];
  return null;
}

// ---------- carga de dados ----------

function normalizaCabecalho(h) {
  return semAcento(String(h || "").toLowerCase());
}

function mapeiaColunas(cabecalhos) {
  // Cadastro anônimo: não existe coluna de nome — se a planilha tiver uma
  // (resquício antigo), ela é ignorada e nunca chega ao DOM.
  const idx = { uf: -1, cidade: -1, curso: -1, instituicao: -1, area: -1 };
  const regras = [
    ["uf", /estado|\buf\b/], ["cidade", /cidade|municipio/], ["curso", /curso/],
    ["instituicao", /faculdade|universidade|instituicao|\bies\b/], ["area", /area|interesse/],
  ];
  cabecalhos.forEach((bruto, i) => {
    const h = normalizaCabecalho(bruto);
    for (const [campo, re] of regras) {
      if (idx[campo] === -1 && re.test(h)) { idx[campo] = i; break; }
    }
  });
  return idx;
}

function linhasParaRegistros(cabecalhos, linhas) {
  const idx = mapeiaColunas(cabecalhos);
  // se os cabeçalhos não casaram, tenta a ordem padrão do Form:
  // [carimbo, estado, cidade, curso, instituição, área]
  if (idx.uf === -1) {
    const desloc = cabecalhos.length >= 6 ? 1 : 0;
    idx.uf = desloc; idx.cidade = desloc + 1; idx.curso = desloc + 2;
    idx.instituicao = desloc + 3; idx.area = desloc + 4;
  }
  const registros = [];
  for (const l of linhas) {
    const uf = normalizaUF(l[idx.uf]);
    if (!uf) continue; // sem estado válido, não entra no mapa
    registros.push({
      uf,
      cidade: limpaCampo(l[idx.cidade]),
      curso: limpaCampo(l[idx.curso]),
      instituicao: limpaCampo(l[idx.instituicao]),
      area: limpaCampo(l[idx.area]),
    });
  }
  return registros;
}

// CSV com aspas, vírgulas e quebras de linha dentro de campo
function parseCSV(texto) {
  const linhas = [];
  let linha = [], campo = "", entreAspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreAspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++; }
        else entreAspas = false;
      } else campo += c;
    } else if (c === '"') entreAspas = true;
    else if (c === ",") { linha.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      linha.push(campo); campo = "";
      if (linha.some((x) => x !== "")) linhas.push(linha);
      linha = [];
    } else campo += c;
  }
  linha.push(campo);
  if (linha.some((x) => x !== "")) linhas.push(linha);
  return linhas;
}

async function carregaGviz(url) {
  const resp = await fetch(url, { cache: "no-store" });
  if (!resp.ok) throw new Error("gviz " + resp.status);
  const texto = await resp.text();
  // resposta vem embrulhada: google.visualization.Query.setResponse({...})
  const ini = texto.indexOf("{"), fim = texto.lastIndexOf("}");
  if (ini === -1 || fim === -1) throw new Error("gviz sem JSON");
  const j = JSON.parse(texto.slice(ini, fim + 1));
  if (j.status === "error") throw new Error("gviz status error");
  const cols = (j.table.cols || []).map((c) => c.label || "");
  let rows = (j.table.rows || []).map((r) => (r.c || []).map((c) => (c && (c.v ?? c.f)) ?? ""));
  let cabecalhos = cols;
  // sem labels? a 1ª linha de dados é o cabeçalho
  if (cols.every((c) => !c) && rows.length) {
    cabecalhos = rows[0].map(String);
    rows = rows.slice(1);
  }
  return linhasParaRegistros(cabecalhos, rows);
}

async function carregaCSV(url) {
  const resp = await fetch(url, { cache: "no-store" });
  if (!resp.ok) throw new Error("csv " + resp.status);
  const linhas = parseCSV(await resp.text());
  if (linhas.length < 1) throw new Error("csv vazio");
  return linhasParaRegistros(linhas[0], linhas.slice(1));
}

async function carregaSnapshot() {
  const resp = await fetch("data/snapshot.json", { cache: "no-store" });
  if (!resp.ok) throw new Error("snapshot " + resp.status);
  const j = await resp.json();
  const registros = [];
  for (const r of j.registros || []) {
    const uf = normalizaUF(r.uf);
    if (!uf) continue;
    registros.push({
      uf,
      cidade: limpaCampo(r.cidade), curso: limpaCampo(r.curso),
      instituicao: limpaCampo(r.instituicao), area: limpaCampo(r.area),
    });
  }
  return { registros, atualizadoEm: j.atualizado_em || "" };
}

async function carregaDados() {
  if (CFG.SHEET_GVIZ_URL) {
    try {
      const registros = await carregaGviz(CFG.SHEET_GVIZ_URL);
      if (registros.length) return { registros, fonte: "planilha ao vivo" };
    } catch (e) { console.warn("Leitura ao vivo falhou, tentando CSV publicado…", e); }
  }
  if (CFG.SHEET_CSV_URL) {
    try {
      const registros = await carregaCSV(CFG.SHEET_CSV_URL);
      if (registros.length) return { registros, fonte: "planilha publicada (pode atrasar ~5 min)" };
    } catch (e) { console.warn("CSV publicado falhou, usando o snapshot do repositório…", e); }
  }
  const { registros, atualizadoEm } = await carregaSnapshot();
  return { registros, fonte: "snapshot do repositório" + (atualizadoEm ? " (" + atualizadoEm + ")" : "") };
}

// ---------- estado da aplicação ----------

let TODOS = [];        // todos os registros válidos
let filtroArea = null; // área selecionada ou null = todas
let ufAberta = null;   // UF mostrada no painel

function registrosVisiveis() {
  return filtroArea ? TODOS.filter((r) => r.area === filtroArea) : TODOS;
}

function contagemPorUF(registros) {
  const c = {};
  for (const r of registros) c[r.uf] = (c[r.uf] || 0) + 1;
  return c;
}

function nivelDaContagem(n) {
  if (n >= 10) return 4;
  if (n >= 5) return 3;
  if (n >= 2) return 2;
  if (n >= 1) return 1;
  return 0;
}

// ---------- render: mapa ----------

const SVG_NS = "http://www.w3.org/2000/svg";

function desenhaMapa() {
  const cont = $("#mapa");
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", MAPA_VIEWBOX);
  svg.setAttribute("role", "group");
  svg.setAttribute("aria-label", "Mapa do Brasil dividido por estados");
  for (const [sigla, d] of Object.entries(UF_PATHS)) {
    const p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", d);
    p.setAttribute("class", "uf");
    p.dataset.uf = sigla;
    p.setAttribute("tabindex", "0");
    p.setAttribute("role", "button");
    p.addEventListener("click", () => abrePainel(sigla));
    p.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); abrePainel(sigla); }
    });
    p.addEventListener("pointerenter", (ev) => {
      if (ev.pointerType !== "touch") mostraTooltip(sigla, ev); // no toque, tooltip só atrapalha
    });
    p.addEventListener("pointermove", (ev) => posicionaTooltip(ev.clientX, ev.clientY));
    p.addEventListener("pointerleave", escondeTooltip);
    p.addEventListener("focus", (ev) => {
      const r = ev.target.getBoundingClientRect();
      mostraTooltip(sigla, null, r.left + r.width / 2, r.top);
    });
    p.addEventListener("blur", escondeTooltip);
    svg.appendChild(p);
  }
  cont.appendChild(svg);
}

function pintaMapa() {
  const contagem = contagemPorUF(registrosVisiveis());
  document.querySelectorAll(".uf").forEach((p) => {
    const sigla = p.dataset.uf;
    const n = contagem[sigla] || 0;
    p.dataset.nivel = String(nivelDaContagem(n));
    const info = UFS[sigla];
    p.setAttribute(
      "aria-label",
      info.nome + ": " + n + (n === 1 ? " embaixador" : " embaixadores") + ". Ver detalhes."
    );
    p.classList.toggle("ativa", sigla === ufAberta);
  });
}

function desenhaLegenda() {
  const itens = [
    ["0", "var(--uf-zero)"], ["1", "var(--uf-1)"], ["2–4", "var(--uf-2)"],
    ["5–9", "var(--uf-3)"], ["10+", "var(--uf-4)"],
  ];
  const cont = $("#legenda-itens");
  for (const [rotulo, cor] of itens) {
    const span = document.createElement("span");
    span.className = "legenda-item";
    const caixa = document.createElement("span");
    caixa.className = "legenda-cor";
    caixa.style.background = cor;
    span.append(caixa, document.createTextNode(rotulo));
    cont.appendChild(span);
  }
}

// ---------- tooltip ----------

// O tooltip é puramente visual (aria-hidden fixo): quem usa leitor de tela
// já recebe a mesma informação pelo aria-label de cada estado.
function mostraTooltip(sigla, ev, x, y) {
  const tip = $("#tooltip");
  const n = contagemPorUF(registrosVisiveis())[sigla] || 0;
  tip.textContent = UFS[sigla].nome + " · " + n + (n === 1 ? " embaixador" : " embaixadores");
  tip.classList.add("visivel");
  if (ev) posicionaTooltip(ev.clientX, ev.clientY);
  else if (x != null) posicionaTooltip(x, y);
}

function posicionaTooltip(x, y) {
  const tip = $("#tooltip");
  const margem = 14;
  const larg = tip.offsetWidth, alt = tip.offsetHeight;
  let px = x + margem, py = y - alt - margem;
  if (px + larg > window.innerWidth - 8) px = x - larg - margem;
  if (py < 8) py = y + margem;
  tip.style.left = px + "px";
  tip.style.top = py + "px";
}

function escondeTooltip() {
  $("#tooltip").classList.remove("visivel");
}

// ---------- painel de detalhe ----------

function cartaoPessoa(r) {
  // Cadastro anônimo: sem nome. Linha forte = curso · universidade;
  // linha secundária = cidade; chip = área de interesse.
  const li = document.createElement("li");
  const forte = [r.curso, r.instituicao].filter(Boolean).join(" · ");
  const titulo = document.createElement("p");
  titulo.className = "pessoa-nome";
  titulo.textContent = forte || r.cidade || "Embaixador(a) do programa";
  li.appendChild(titulo);
  if (forte && r.cidade) {
    const det = document.createElement("p");
    det.className = "pessoa-detalhe";
    det.textContent = r.cidade;
    li.appendChild(det);
  }
  if (r.area) {
    const area = document.createElement("span");
    area.className = "pessoa-area";
    area.textContent = r.area;
    li.appendChild(area);
  }
  return li;
}

function abrePainel(sigla, { rolar = true } = {}) {
  escondeTooltip(); // no toque, o tooltip ficaria pendurado por cima do painel
  ufAberta = sigla;
  const info = UFS[sigla];
  const doEstado = registrosVisiveis().filter((r) => r.uf === sigla);
  $("#painel-vazio").classList.add("oculto");
  $("#painel-conteudo").classList.remove("oculto");
  $("#painel-titulo").textContent = info.nome + " (" + sigla + ")";
  $("#painel-capital").textContent = "Capital: " + info.capital + " · Região " + info.regiao +
    " · " + doEstado.length + (doEstado.length === 1 ? " embaixador" : " embaixadores");
  const lista = $("#painel-lista");
  lista.textContent = "";
  if (doEstado.length === 0) {
    const li = document.createElement("li");
    li.className = "painel-ninguem";
    li.textContent = "Ainda não há embaixadores cadastrados aqui" +
      (filtroArea ? " nessa área de interesse" : "") + ". Que tal ser a primeira pessoa? ";
    if (URLS.form) {
      const a = document.createElement("a");
      a.href = URLS.form;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "Cadastre-se no mapa →";
      li.appendChild(a);
    }
    lista.appendChild(li);
  } else {
    for (const r of doEstado) lista.appendChild(cartaoPessoa(r));
  }
  pintaMapa();
  if (rolar && window.matchMedia("(max-width: 820px)").matches) {
    // behavior explícito ignora o CSS de reduced-motion — respeitar aqui também
    const reduz = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    $("#painel").scrollIntoView({ behavior: reduz ? "auto" : "smooth", block: "nearest" });
  }
}

function fechaPainel() {
  ufAberta = null;
  $("#painel-conteudo").classList.add("oculto");
  $("#painel-vazio").classList.remove("oculto");
  pintaMapa();
}

// ---------- filtros por área ----------

function desenhaFiltros() {
  const cont = $("#filtros");
  cont.textContent = "";
  // Map, não objeto: chave vem do usuário ("__proto__" quebraria um objeto comum)
  const porArea = new Map();
  for (const r of TODOS) if (r.area) porArea.set(r.area, (porArea.get(r.area) || 0) + 1);
  const areas = [...porArea.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (areas.length < 2) return; // filtro só faz sentido com 2+ áreas

  const fazChip = (rotulo, valor) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.textContent = rotulo;
    b.setAttribute("aria-pressed", String(filtroArea === valor));
    b.addEventListener("click", () => {
      filtroArea = filtroArea === valor ? null : valor;
      desenhaFiltros();
      pintaMapa();
      desenhaListaCompleta();
      if (ufAberta) abrePainel(ufAberta);
    });
    return b;
  };
  const todas = fazChip("Todas as áreas", null);
  todas.setAttribute("aria-pressed", String(filtroArea === null));
  cont.appendChild(todas);
  for (const [area] of areas) cont.appendChild(fazChip(area, area));
}

// ---------- lista completa ----------

function desenhaListaCompleta() {
  const cont = $("#lista-completa");
  cont.textContent = "";
  const visiveis = registrosVisiveis();
  if (visiveis.length === 0) {
    const p = document.createElement("p");
    p.className = "lista-vazia";
    p.textContent = "Nenhum embaixador cadastrado ainda — o mapa acabou de nascer. Seja quem inaugura! ";
    if (URLS.form) {
      const a = document.createElement("a");
      a.href = URLS.form;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "Cadastre-se no mapa →";
      p.appendChild(a);
    }
    cont.appendChild(p);
    return;
  }
  const regioes = ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"];
  for (const regiao of regioes) {
    const siglas = Object.keys(UFS).filter((s) => UFS[s].regiao === regiao);
    const comGente = siglas
      .map((s) => [s, visiveis.filter((r) => r.uf === s)])
      .filter(([, rs]) => rs.length > 0)
      .sort((a, b) => b[1].length - a[1].length);
    if (comGente.length === 0) continue;
    const bloco = document.createElement("div");
    bloco.className = "regiao-bloco";
    const titulo = document.createElement("h3");
    titulo.className = "regiao-titulo";
    titulo.textContent = regiao;
    bloco.appendChild(titulo);
    for (const [sigla, rs] of comGente) {
      const det = document.createElement("details");
      det.className = "uf-detalhe";
      const sum = document.createElement("summary");
      const nomeSpan = document.createElement("span");
      nomeSpan.textContent = UFS[sigla].nome;
      const contSpan = document.createElement("span");
      contSpan.className = "uf-contagem";
      contSpan.textContent = rs.length + (rs.length === 1 ? " embaixador" : " embaixadores");
      sum.append(nomeSpan, contSpan);
      det.appendChild(sum);
      const ul = document.createElement("ul");
      ul.className = "painel-lista";
      for (const r of rs) ul.appendChild(cartaoPessoa(r));
      det.appendChild(ul);
      bloco.appendChild(det);
    }
    cont.appendChild(bloco);
  }
}

// ---------- stats ----------

function desenhaStats() {
  $("#stat-total").textContent = String(TODOS.length);
  $("#stat-ufs").textContent = String(new Set(TODOS.map((r) => r.uf)).size);
  $("#stat-cidades").textContent = String(new Set(TODOS.filter((r) => r.cidade).map((r) => semAcento(r.cidade.toLowerCase()))).size);
  $("#stat-areas").textContent = String(new Set(TODOS.filter((r) => r.area).map((r) => r.area)).size);
}

// ---------- tema ----------

function temaAtual() {
  return document.documentElement.getAttribute("data-theme") ||
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}

function ligaTema() {
  const botao = $("#botao-tema");
  botao.setAttribute("aria-pressed", String(temaAtual() === "dark"));
  botao.addEventListener("click", () => {
    const novo = temaAtual() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", novo);
    botao.setAttribute("aria-pressed", String(novo === "dark"));
    try { localStorage.setItem("mapa-tema", novo); } catch (e) { /* sem persistência */ }
  });
}

// ---------- links de configuração ----------

function ligaLinks() {
  if (URLS.form) {
    for (const id of ["#cta-topo", "#cta-hero"]) {
      const a = $(id);
      a.href = URLS.form;
      a.classList.remove("oculto");
    }
    $("#aviso-form").classList.add("oculto");
  }
  if (URLS.repo) $("#link-repo").href = URLS.repo;
  if (URLS.remocao) $("#link-remocao").href = URLS.remocao;
}

// ---------- inicialização ----------

async function inicia() {
  ligaTema();
  ligaLinks();
  desenhaMapa();
  desenhaLegenda();
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && ufAberta) fechaPainel();
  });
  $("#painel-fechar").addEventListener("click", fechaPainel);

  try {
    const { registros, fonte } = await carregaDados();
    TODOS = registros.slice(0, MAX_REGISTROS);
    $("#fonte-dados").textContent = "Fonte dos dados: " + fonte + ". Novos cadastros aparecem em alguns minutos.";
  } catch (e) {
    console.error("Nenhuma fonte de dados disponível:", e);
    $("#fonte-dados").textContent = "Não foi possível carregar os dados agora. Recarregue a página em instantes.";
  }
  desenhaStats();
  desenhaFiltros();
  pintaMapa();
  desenhaListaCompleta();
  abreEstadoMaisCheio();
}

// Estados pequenos (DF, SE, AL, RJ, ES) são alvos de toque minúsculos no celular —
// pendência conhecida (README). Enquanto isso, já abrir o estado com mais gente
// garante que o visitante veja conteúdo real sem precisar acertar o alvo.
// Sem rolagem: mexer no scroll durante o carregamento desorienta.
function abreEstadoMaisCheio() {
  const contagem = contagemPorUF(TODOS);
  let melhor = null, maior = 0;
  for (const [sigla, n] of Object.entries(contagem)) {
    if (n > maior) { maior = n; melhor = sigla; }
  }
  if (melhor) abrePainel(melhor, { rolar: false });
}

inicia();
