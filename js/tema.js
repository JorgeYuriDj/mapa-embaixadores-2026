// Aplica o tema salvo ANTES do primeiro paint (evita flash de tema errado).
// Fica num arquivo próprio (não inline) para a CSP poder ser "script-src 'self'".
(function () {
  try {
    var t = localStorage.getItem("mapa-tema");
    if (t === "dark" || t === "light") document.documentElement.setAttribute("data-theme", t);
  } catch (e) { /* localStorage bloqueado: segue o tema do sistema */ }
})();
