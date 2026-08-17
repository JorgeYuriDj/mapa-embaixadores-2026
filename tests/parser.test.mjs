/* ============================================================
   Testes do parser de dados (sem dependência, sem build).
   Rodar:  node tests/parser.test.mjs
   Por que existe: o site lê dado de um formulário ABERTO. O parser
   é a fronteira entre esse dado e a página — regressão aqui é bug
   público. Inclui as travas de privacidade (cadastro ANÔNIMO).
   Como funciona: importa as funções puras de js/app.js recortando o
   trecho anterior ao estado da aplicação (o resto precisa de DOM).
   ============================================================ */

import { readFileSync } from "node:fs";

const raizURL = new URL("../", import.meta.url);
const appURL = new URL("js/app.js", raizURL);
const mapaURL = new URL("js/mapa-brasil.js", raizURL);

const CORTE = "// ---------- estado da aplicação ----------";
const fonte = readFileSync(appURL, "utf8");
const corte = fonte.indexOf(CORTE);
if (corte === -1) throw new Error("Marcador de corte não encontrado em js/app.js — ajuste o teste.");

// O trecho puro ainda toca window/document/location na inicialização dos links;
// stubs mínimos bastam — nenhum teste aqui exercita DOM.
const STUBS = `
const window = { MAPA_CONFIG: {} };
const document = { querySelector: () => null };
const location = { href: "https://exemplo.invalid/" };
`;

const puro = fonte
  .slice(0, corte)
  .replace('from "./mapa-brasil.js"', `from ${JSON.stringify(mapaURL.href)};${STUBS}//`)
  + "\nexport { limpaCampo, normalizaUF, mapeiaColunas, linhasParaRegistros, parseCSV };\n";

const mod = await import("data:text/javascript," + encodeURIComponent(puro));
const { limpaCampo, normalizaUF, mapeiaColunas, linhasParaRegistros, parseCSV } = mod;

// ---------- micro-harness ----------

let passou = 0;
const falhas = [];
function teste(nome, fn) {
  try { fn(); passou++; }
  catch (e) { falhas.push(nome + " → " + e.message); }
}
function igual(obtido, esperado, msg) {
  const a = JSON.stringify(obtido), b = JSON.stringify(esperado);
  if (a !== b) throw new Error((msg ? msg + ": " : "") + "esperado " + b + ", obtido " + a);
}
function verdade(cond, msg) { if (!cond) throw new Error(msg || "condição falsa"); }

// Cabeçalho real do Google Forms para o cadastro anônimo de 5 perguntas
const CAB_FORM = ["Carimbo de data/hora", "Estado", "Cidade", "Curso", "Faculdade/Universidade", "Área de interesse"];
const LINHA_FORM = ["16/08/2026 21:03:11", "DF", "Brasília", "Física", "UnB", "Inteligência Artificial"];

// ---------- limpaCampo ----------

teste("limpaCampo colapsa espaços e apara as pontas", () => {
  igual(limpaCampo("  Física   Computacional \n"), "Física Computacional");
});
teste("limpaCampo corta em 120 caracteres (teto anti-flood)", () => {
  igual(limpaCampo("a".repeat(500)).length, 120);
});
teste("limpaCampo trata nulo e indefinido como vazio", () => {
  igual([limpaCampo(null), limpaCampo(undefined)], ["", ""]);
});

// ---------- normalizaUF ----------

teste("normalizaUF aceita sigla em qualquer caixa", () => {
  igual([normalizaUF("df"), normalizaUF("DF"), normalizaUF(" sp ")], ["DF", "DF", "SP"]);
});
teste("normalizaUF aceita o nome do estado com e sem acento", () => {
  igual([normalizaUF("São Paulo"), normalizaUF("sao paulo"), normalizaUF("Distrito Federal")], ["SP", "SP", "DF"]);
});
teste('normalizaUF aceita "DF - Distrito Federal"', () => {
  igual(normalizaUF("DF - Distrito Federal"), "DF");
});
teste('normalizaUF aceita "Paraná (PR)"', () => {
  igual(normalizaUF("Paraná (PR)"), "PR");
});
teste("normalizaUF rejeita lixo, vazio e nulo", () => {
  igual([normalizaUF("Portugal"), normalizaUF(""), normalizaUF(null), normalizaUF("XX")], [null, null, null, null]);
});
teste("normalizaUF cobre as 27 unidades federativas", () => {
  const todas = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
  const faltando = todas.filter((s) => normalizaUF(s) !== s);
  igual(faltando, [], "siglas não reconhecidas");
});

// ---------- mapeiaColunas ----------

teste("mapeiaColunas casa o cabeçalho real do Form", () => {
  igual(mapeiaColunas(CAB_FORM), { uf: 1, cidade: 2, curso: 3, instituicao: 4, area: 5 });
});
teste("mapeiaColunas NÃO cria índice de nome (cadastro anônimo)", () => {
  verdade(!("nome" in mapeiaColunas(CAB_FORM)), "o mapeamento não pode ter campo nome");
});
teste('mapeiaColunas não confunde "Nome da universidade" com instituição errada', () => {
  const idx = mapeiaColunas(["Estado", "Cidade", "Curso", "Nome da sua universidade", "Área"]);
  igual([idx.instituicao, idx.area], [3, 4]);
});
teste("mapeiaColunas aceita rótulos alternativos (UF, município, IES)", () => {
  igual(mapeiaColunas(["UF", "Município", "Curso", "IES", "Interesse"]),
    { uf: 0, cidade: 1, curso: 2, instituicao: 3, area: 4 });
});

// ---------- linhasParaRegistros ----------

teste("linhasParaRegistros converte a linha do Form", () => {
  igual(linhasParaRegistros(CAB_FORM, [LINHA_FORM]),
    [{ uf: "DF", cidade: "Brasília", curso: "Física", instituicao: "UnB", area: "Inteligência Artificial" }]);
});
teste("PRIVACIDADE: nenhum registro carrega campo de nome", () => {
  const regs = linhasParaRegistros(CAB_FORM, [LINHA_FORM]);
  igual(Object.keys(regs[0]).sort(), ["area", "cidade", "curso", "instituicao", "uf"]);
});
teste("PRIVACIDADE: coluna 'Nome' legada na planilha é IGNORADA", () => {
  const cab = ["Carimbo de data/hora", "Nome", "Estado", "Cidade", "Curso", "Universidade", "Área de interesse"];
  const linha = ["16/08/2026", "Fulano de Tal", "SP", "Campinas", "Engenharia", "Unicamp", "Robótica"];
  const regs = linhasParaRegistros(cab, [linha]);
  igual(regs.length, 1);
  verdade(!JSON.stringify(regs).includes("Fulano"), "o nome vazou para o registro");
  igual(regs[0], { uf: "SP", cidade: "Campinas", curso: "Engenharia", instituicao: "Unicamp", area: "Robótica" });
});
teste("linha sem estado válido é descartada", () => {
  igual(linhasParaRegistros(CAB_FORM, [["x", "Portugal", "Lisboa", "Direito", "UL", "Outra"]]), []);
});
teste("registro entra mesmo com cidade/curso/área em branco", () => {
  igual(linhasParaRegistros(CAB_FORM, [["x", "BA", "", "", "", ""]]),
    [{ uf: "BA", cidade: "", curso: "", instituicao: "", area: "" }]);
});
teste("cabeçalho irreconhecível cai na ordem posicional do Form", () => {
  const cab = ["a", "b", "c", "d", "e", "f"];
  igual(linhasParaRegistros(cab, [LINHA_FORM]),
    [{ uf: "DF", cidade: "Brasília", curso: "Física", instituicao: "UnB", area: "Inteligência Artificial" }]);
});
teste("cabeçalho irreconhecível SEM coluna de carimbo também funciona", () => {
  igual(linhasParaRegistros(["a", "b", "c", "d", "e"], [["DF", "Brasília", "Física", "UnB", "IA"]]),
    [{ uf: "DF", cidade: "Brasília", curso: "Física", instituicao: "UnB", area: "IA" }]);
});
teste("campos longos são cortados em 120 caracteres", () => {
  const regs = linhasParaRegistros(CAB_FORM, [["x", "DF", "b".repeat(400), "c", "d", "e"]]);
  igual(regs[0].cidade.length, 120);
});

// ---------- parseCSV ----------

teste("parseCSV lê linhas simples", () => {
  igual(parseCSV("a,b,c\n1,2,3"), [["a", "b", "c"], ["1", "2", "3"]]);
});
teste("parseCSV respeita vírgula dentro de aspas", () => {
  igual(parseCSV('a,"b,c",d'), [["a", "b,c", "d"]]);
});
teste("parseCSV respeita quebra de linha dentro de aspas", () => {
  igual(parseCSV('a,"linha1\nlinha2",c'), [["a", "linha1\nlinha2", "c"]]);
});
teste("parseCSV desdobra aspas escapadas", () => {
  igual(parseCSV('a,"diz ""oi""",c'), [["a", 'diz "oi"', "c"]]);
});
teste("parseCSV trata CRLF do Google Sheets", () => {
  igual(parseCSV("a,b\r\n1,2\r\n"), [["a", "b"], ["1", "2"]]);
});
teste("parseCSV descarta linhas totalmente vazias", () => {
  igual(parseCSV("a,b\n\n1,2\n\n"), [["a", "b"], ["1", "2"]]);
});
teste("parseCSV + linhasParaRegistros no fluxo real do CSV publicado", () => {
  const csv = 'Carimbo de data/hora,Estado,Cidade,Curso,Faculdade/Universidade,Área de interesse\n' +
    '16/08/2026 21:03:11,DF,Brasília,Física,UnB,Inteligência Artificial\n' +
    '16/08/2026 21:05:02,"São Paulo","São Paulo","Ciência da Computação","USP","Dados & Machine Learning"\n';
  const linhas = parseCSV(csv);
  const regs = linhasParaRegistros(linhas[0], linhas.slice(1));
  igual(regs.length, 2);
  igual(regs[1], { uf: "SP", cidade: "São Paulo", curso: "Ciência da Computação", instituicao: "USP", area: "Dados & Machine Learning" });
});

// ---------- travas de privacidade no resto do pipeline ----------

teste("PRIVACIDADE: scripts/snapshot.mjs não lê nem grava coluna de nome", () => {
  const src = readFileSync(new URL("scripts/snapshot.mjs", raizURL), "utf8");
  const linhasSuspeitas = src.split("\n").filter((l) =>
    /\bidx\.nome\b|\bnome:/.test(l) || /claim\(\/\\bnome/.test(l));
  igual(linhasSuspeitas, [], "o gerador de snapshot voltou a tratar nome");
});

teste("PRIVACIDADE: os textos de preview do link não prometem identificar ninguém", () => {
  // A capa do WhatsApp é a vitrine: foi o unico lugar onde "quem somos" sobreviveu
  // à passagem para o cadastro anônimo, porque nenhum teste olhava para o HTML.
  const html = readFileSync(new URL("index.html", raizURL), "utf8");
  const metas = html.split("\n").filter((l) => /<meta\s+(name="description"|property="og:description")/.test(l));
  verdade(metas.length >= 2, "as duas metas de descrição precisam existir");
  const promessas = metas.filter((l) => /quem somos|nossos nomes|\bnome\b/i.test(l));
  igual(promessas, [], "meta de descrição promete identificação pessoal");
});

teste("PRIVACIDADE: data/snapshot.json commitado não tem campo de nome", () => {
  const j = JSON.parse(readFileSync(new URL("data/snapshot.json", raizURL), "utf8"));
  const comNome = (j.registros || []).filter((r) => "nome" in r);
  igual(comNome, [], "há registro com nome no snapshot público");
});

// ---------- relatório ----------

console.log("\n" + passou + " passaram, " + falhas.length + " falharam.");
if (falhas.length) {
  for (const f of falhas) console.error("  ✗ " + f);
  process.exit(1);
}
console.log("✓ parser OK (inclui as travas de cadastro anônimo).\n");
