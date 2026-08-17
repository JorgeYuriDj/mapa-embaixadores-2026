# Como contribuir

Toda melhoria é bem-vinda: visual, acessibilidade, funcionalidades, correção de bug,
documentação. O fluxo é o padrão do GitHub: **fork → branch → Pull Request**.

## As 5 regras do projeto (não negociáveis)

1. **Privacidade acima de tudo — o cadastro é ANÔNIMO.** O mapa só mostra: estado,
   cidade, curso, universidade e área de interesse, enviados pela própria pessoa.
   **Nome não é coletado nem exibido**, e nada de dado sensível (telefone, e-mail,
   documento, endereço). PR que reintroduza identificação pessoal não passa.
2. **Todo texto vindo de dados entra no DOM via `textContent`** (nunca `innerHTML`,
   nunca template string injetada). É a defesa contra XSS de um site que renderiza dado
   enviado por formulário aberto. PR que viole isso não passa.
3. **Sem marca de terceiros.** Nenhum logo ou identidade visual do Google, do Gemini ou da
   Amplifica — só menção nominativa em texto. O disclaimer do rodapé não sai.
4. **Simples de manter.** HTML + CSS + JS puros, sem build, sem framework, sem dependência
   de runtime. Uma pessoa não técnica precisa conseguir manter isso no ar.
5. **Acessibilidade não regride.** Foco visível, navegação por teclado no mapa, alvos de
   toque ≥ 44px, contraste AA, `prefers-reduced-motion` respeitado, e a lista completa
   (equivalente em texto do mapa) sempre presente.

## Antes de abrir o PR

```bash
node tests/parser.test.mjs   # sem instalar nada; 30 testes, inclui as travas de privacidade
```

Mexeu no visual da capa do link? Regere a imagem: `node scripts/gera-og-image.mjs`
(precisa de Chrome ou Edge instalado — só para gerar; o site continua sem dependências).

## Dicas técnicas

- O mapa é desenhado a partir de `js/mapa-brasil.js` (paths SVG por UF, gerados de um SVG
  CC0 do Wikimedia Commons — fonte e método no README).
- Os dados chegam por `js/app.js` → `carregaDados()`: planilha ao vivo (gviz) → CSV
  publicado → `data/snapshot.json`. Mantenha SEMPRE os três caminhos funcionando.
- A paleta do coroplético foi validada por script (monotonia de luminosidade + contraste);
  se mudar as cores, valide de novo — não escolha no olho.
- Teste no celular (o público abre pelo WhatsApp) e com teclado (Tab pelos estados).

## Reportar problema ou pedir remoção de dados

Abra uma [issue](https://github.com/JorgeYuriDj/mapa-embaixadores-2026/issues/new).
Pedidos de remoção de cadastro são atendidos sem necessidade de justificativa.
