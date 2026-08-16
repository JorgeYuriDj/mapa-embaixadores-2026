/* ============================================================
   Snapshot diário: baixa o CSV publicado da planilha e salva
   uma cópia normalizada em data/snapshot.json.
   Por que existe: mantém os dados DENTRO do repositório (open
   data, fork funcional e reserva caso a planilha saia do ar).
   Roda no GitHub Actions (ver .github/workflows/snapshot.yml)
   ou localmente: node scripts/snapshot.mjs
   ============================================================ */

import { readFileSync, writeFileSync } from "node:fs";

// A URL vem do js/config.js (fonte única de configuração)
const config = readFileSync(new URL("../js/config.js", import.meta.url), "utf8");
const m = config.match(/SHEET_CSV_URL:\s*"([^"]*)"/);
const CSV_URL = m ? m[1] : "";

if (!CSV_URL) {
  console.log("SHEET_CSV_URL ainda não configurada em js/config.js — nada a fazer.");
  process.exit(0);
}

const UFS = new Set(["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"]);
const NOMES = {
  "acre":"AC","alagoas":"AL","amapa":"AP","amazonas":"AM","bahia":"BA","ceara":"CE",
  "distrito federal":"DF","espirito santo":"ES","goias":"GO","maranhao":"MA","mato grosso":"MT",
  "mato grosso do sul":"MS","minas gerais":"MG","para":"PA","paraiba":"PB","parana":"PR",
  "pernambuco":"PE","piaui":"PI","rio de janeiro":"RJ","rio grande do norte":"RN",
  "rio grande do sul":"RS","rondonia":"RO","roraima":"RR","santa catarina":"SC",
  "sao paulo":"SP","sergipe":"SE","tocantins":"TO",
};

const semAcento = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const limpa = (v) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, 120);

function normalizaUF(v) {
  const chave = semAcento(String(v || "").trim().toLowerCase());
  if (UFS.has(chave.toUpperCase())) return chave.toUpperCase();
  if (NOMES[chave]) return NOMES[chave];
  const sigla = chave.slice(0, 2).toUpperCase();
  if (chave.length > 2 && UFS.has(sigla) && /[^a-z]/.test(chave[2] || "")) return sigla;
  return null;
}

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

const resp = await fetch(CSV_URL, { redirect: "follow" });
if (!resp.ok) {
  console.error("Falha ao baixar o CSV publicado: HTTP " + resp.status);
  process.exit(1);
}
const linhas = parseCSV(await resp.text());
if (linhas.length < 1) {
  console.error("CSV vazio — snapshot não atualizado.");
  process.exit(1);
}

const cab = linhas[0].map((h) => semAcento(String(h).toLowerCase()));
const acha = (re, fallback) => {
  const i = cab.findIndex((h) => re.test(h));
  return i === -1 ? fallback : i;
};
// ordem padrão do Form: [carimbo, nome, estado, cidade, curso, instituição, área]
const idx = {
  nome: acha(/\bnome\b/, 1),
  uf: acha(/estado|\buf\b/, 2),
  cidade: acha(/cidade|municipio/, 3),
  curso: acha(/curso/, 4),
  instituicao: acha(/faculdade|universidade|instituicao|\bies\b/, 5),
  area: acha(/area|interesse/, 6),
};

const registros = [];
for (const l of linhas.slice(1)) {
  const uf = normalizaUF(l[idx.uf]);
  const nome = limpa(l[idx.nome]);
  if (!uf || !nome) continue;
  registros.push({
    nome, uf,
    cidade: limpa(l[idx.cidade]), curso: limpa(l[idx.curso]),
    instituicao: limpa(l[idx.instituicao]), area: limpa(l[idx.area]),
  });
}

if (registros.length === 0) {
  console.error("Nenhum registro válido no CSV — snapshot mantido como está (proteção contra sobrescrever com vazio).");
  process.exit(1);
}

const saida = {
  atualizado_em: new Date().toISOString().slice(0, 10),
  origem: "snapshot automático do CSV publicado da planilha",
  registros,
};
writeFileSync(new URL("../data/snapshot.json", import.meta.url), JSON.stringify(saida, null, 2) + "\n");
console.log("Snapshot atualizado: " + registros.length + " registros.");
