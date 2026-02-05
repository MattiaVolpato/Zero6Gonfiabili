(function () {
  let io = null;

  function showAll() {
    document
      .querySelectorAll(".reveal:not(.is-visible)")
      .forEach((el) => el.classList.add("is-visible"));
  }

  function initObserver() {
    if (io) return io;

    // Rispetta "riduci animazioni", ma se vuoi forzare le animazioni commenta questo blocco
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      showAll();
      return null;
    }

    if (!("IntersectionObserver" in window)) {
      showAll();
      return null;
    }

    io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const el = entry.target;
          if (entry.isIntersecting) {
            el.classList.add("is-visible");
            const once = el.getAttribute("data-reveal-once");
            if (once !== "false") io.unobserve(el);
          } else {
            if (el.getAttribute("data-reveal-repeat") === "true") {
              el.classList.remove("is-visible");
            }
          }
        });
      },
      {
        root: null,
        rootMargin: "0px 0px -10% 0px",
        threshold: 0.15,
      }
    );

    return io;
  }

  function bindTargets() {
    const targets = document.querySelectorAll(
      ".reveal:not([data-reveal-bound])"
    );
    if (!targets.length) return;

    const observer = initObserver();
    if (!observer) return; // reduce motion o niente IO -> già mostrati

    targets.forEach((el) => {
      el.setAttribute("data-reveal-bound", "1");
      observer.observe(el);
    });
  }

  function rebindSoon() {
    setTimeout(bindTargets, 0);
  }

  function init() {
    bindTargets();

    // Se la SPA inietta HTML dinamicamente, rilegati
    try {
      const mo = new MutationObserver(rebindSoon);
      mo.observe(document.body, { childList: true, subtree: true });
    } catch (e) {
      // non bloccare se MutationObserver non è disponibile
    }

    window.addEventListener("hashchange", rebindSoon);
    window.addEventListener("popstate", rebindSoon);

    // Hook personalizzato per la tua SPA (vedi punto 2 sotto)
    document.addEventListener("spa:content-updated", rebindSoon);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.addEventListener("load", bindTargets);
})();
