// --- HEADER FIXED: Calcolo Altezza Header ---
/**
 * Script per gestire l'altezza dinamica dell'header fisso.
 * 
 * Funzionalità:
 * 1. Misura l'altezza reale dell'elemento `.z6-header`.
 * 2. Imposta la variabile CSS `--z6-header-h` con tale valore.
 *    Questo permette al contenuto della pagina di avere il giusto padding-top e non finire sotto l'header.
 * 3. Aggiorna il valore su resize, caricamento e cambiamenti di orientamento.
 * 4. Espone `window.z6UpdateHeaderHeight()` per forzare il ricalcolo manuale (es. quando si apre un menu).
 */
(function () {
  const raf = window.requestAnimationFrame || ((cb) => setTimeout(cb, 16));

  function setVar() {
    const el = document.querySelector(".z6-header");
    if (!el) return;
    const h = Math.round(
      el.getBoundingClientRect().height || el.offsetHeight || 72
    );
    document.documentElement.style.setProperty("--z6-header-h", h + "px");
  }

  // helper globale per aggiornare l'altezza quando cambia il layout (dropdown, ecc.)
  window.z6UpdateHeaderHeight = function () {
    raf(setVar);
  };

  document.addEventListener(
    "DOMContentLoaded",
    () => {
      window.z6UpdateHeaderHeight();
      window.addEventListener("resize", window.z6UpdateHeaderHeight);
      window.addEventListener("orientationchange", window.z6UpdateHeaderHeight);
      window.addEventListener("load", window.z6UpdateHeaderHeight);
    },
    { once: true }
  );
})();
