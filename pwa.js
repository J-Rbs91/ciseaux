// Enregistre le service worker pour rendre KuT installable (PWA).
// Le chemin est calculé depuis l'emplacement de ce script, donc il
// fonctionne aussi bien à la racine que depuis les pages d'aide /docs.
(function () {
  if (!("serviceWorker" in navigator)) return;
  var el =
    document.currentScript ||
    document.querySelector('script[src$="pwa.js"]');
  var base = el ? el.src.replace(/pwa\.js(\?.*)?$/, "") : "./";
  window.addEventListener("load", function () {
    navigator.serviceWorker
      .register(base + "sw.js", { scope: base })
      .catch(function (e) {
        console.warn("Service worker non enregistré :", e);
      });
  });
})();
