# 📍 Mapa dos Embaixadores 2026

**O Brasil dos Embaixadores Estudantis do Google 2026, num mapa colaborativo e open source.**

Estudantes de todo o país participam do programa — este mapa mostra **quem somos, de onde
somos e o que estudamos**: estado, cidade, curso, universidade e área de interesse de cada
embaixador(a) que quiser se cadastrar.

> ⚠️ **Iniciativa independente e voluntária de estudantes.** Este NÃO é um site oficial do
> Google nem da Amplifica. Nomes de programas e produtos são citados apenas para identificação.

## Como funciona

```
Google Form  ──▶  Planilha Google  ──▶  Página estática (GitHub Pages)
 (cadastro)        (armazenamento         lê a planilha ao vivo
                    e moderação)          e desenha o mapa
                        │
                        └──▶  GitHub Action diária salva uma cópia
                              dos dados em data/snapshot.json
                              (open data + reserva)
```

- **Cadastro:** um Google Form de 6 perguntas (menos de 1 minuto, sem dado sensível).
- **Exibição:** a página lê a planilha (endpoint `gviz` com fallback para o CSV publicado);
  se ambos falharem, usa o `data/snapshot.json` commitado no repositório.
- **Open data:** uma Action diária copia os dados para dentro do repo — um fork deste
  repositório reproduz o site completo, com dados.
- **Zero backend próprio, zero custo, zero build:** HTML + CSS + JS puros — basta um
  servidor estático (`npx serve .`) e está rodando.

## Rodando localmente

```bash
git clone https://github.com/JorgeYuriDj/mapa-embaixadores-2026.git
cd mapa-embaixadores-2026
# qualquer servidor estático serve; por exemplo:
npx serve .
# ou: python -m http.server 8000
```

(Servir por HTTP é necessário porque a página usa módulos ES e `fetch` — abrir o
`index.html` com dois cliques NÃO funciona nos navegadores atuais.)

## Privacidade e remoção de dados

- O mapa exibe **apenas dados não sensíveis**, enviados **voluntariamente** pela própria
  pessoa, que é avisada no formulário de que eles ficam **públicos** nesta página.
- **Não** coletamos telefone, e-mail, documentos nem qualquer dado sensível.
- **Correção ou remoção:** [abra uma issue](https://github.com/JorgeYuriDj/mapa-embaixadores-2026/issues/new)
  pedindo a alteração (não precisa dizer o motivo). Quem mantém o mapa remove o registro da
  planilha e o snapshot é substituído no ciclo seguinte.

## Contribuindo

Este mapa é dos embaixadores: melhorias são bem-vindas — visual, acessibilidade,
funcionalidades novas, correções. Leia o [CONTRIBUTING.md](CONTRIBUTING.md) (tem 5 regras
curtas, principalmente sobre privacidade) e abra seu PR.

Ideias já mapeadas (pegue uma!):

- [ ] Imagem de preview (`og:image`) para o link ficar bonito no WhatsApp
- [ ] Busca por nome/universidade
- [ ] Compartilhar o recorte de um estado (link direto `#uf=SP`)
- [ ] Modo "apresentação" para eventos do programa
- [ ] Área de toque ampliada para estados pequenos no celular (DF, SE, AL, RJ, ES) —
  hoje a lista completa é o caminho equivalente com alvos grandes

## Créditos e licenças

- **Código:** licença [MIT](LICENSE).
- **Mapa base:** derivado de
  ["Brazil States With ID and State Name inside svg"](https://commons.wikimedia.org/wiki/File:Brazil_States_With_ID_and_State_Name_inside_svg.svg)
  (Wikimedia Commons, autor Murchelon, **CC0/domínio público**) — simplificado
  (Douglas-Peucker) e reescalado para uso web.
- **Paleta do mapa:** rampa sequencial de um matiz, com degraus validados por script para
  legibilidade (inclusive para daltonismo) nos temas claro e escuro.
- Feito com 💚 por embaixadores, para embaixadores.
