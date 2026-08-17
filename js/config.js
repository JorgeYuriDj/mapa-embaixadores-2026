/* ============================================================
   CONFIGURAÇÃO DO MAPA — o único arquivo que você precisa editar
   para "ligar" o mapa aos dados ao vivo.

   Como preencher (quem mantém o mapa):
   1. FORM_URL — link curto do Google Form de cadastro.
   2. SHEET_GVIZ_URL — na planilha de respostas:
      https://docs.google.com/spreadsheets/d/SEU_ID_AQUI/gviz/tq?tqx=out:json
      (a planilha precisa estar compartilhada como
      "qualquer pessoa com o link pode ver")
   3. SHEET_CSV_URL — na planilha: Arquivo > Compartilhar >
      Publicar na web > formato CSV > copiar o link.
   Deixe "" (vazio) enquanto não tiver — a página usa o snapshot
   salvo no repositório (data/snapshot.json) como reserva.
   ============================================================ */
window.MAPA_CONFIG = {
  FORM_URL: "https://docs.google.com/forms/d/e/1FAIpQLSe3LfnIwTbm-O5WVNLKlthxmH9N-67KOoIEBF8AaVEndsnOCg/viewform",
  SHEET_GVIZ_URL: "https://docs.google.com/spreadsheets/d/12LdsU8zpvR9qSNYqhvvDv_9amvbn_0GI-Ft9ytz7t5Y/gviz/tq?tqx=out:json&gid=1441195567",
  SHEET_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTCrPJwAXbQpwXbWG3MigfDN_Qodi1Yz2gf3XwPG569QVW8RwJ_1a87wHCx-R_DjLfJaHSkXqhz3OIM/pub?gid=1441195567&single=true&output=csv",
  REPO_URL: "https://github.com/JorgeYuriDj/mapa-embaixadores-2026",
  REMOCAO_URL: "https://github.com/JorgeYuriDj/mapa-embaixadores-2026/issues/new?title=Pedido+de+corre%C3%A7%C3%A3o+ou+remo%C3%A7%C3%A3o",
};
