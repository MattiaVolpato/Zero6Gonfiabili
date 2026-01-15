/*!
 * header-fixed.js — aggiorna --z6-header-h con l’altezza reale della header
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
