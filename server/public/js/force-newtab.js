// --- FORCE NEW TAB: Gestione Link Esterni ---
/**
 * Questo script migliora la UX e la sicurezza per i link esterni:
 * 
 * 1. Rileva automaticamente tutti i link che puntano a domini esterni.
 * 2. Aggiunge `target="_blank"` per aprirli in una nuova scheda.
 * 3. Aggiunge `rel="noopener noreferrer"` per sicurezza (previene tab-nabbing e non invia referrer).
 * 4. Monitora il DOM tramite MutationObserver per applicare la logica anche ai link aggiunti dinamicamente.
 */

// force-newtab.js (sostituisci la parte di decisione)
(() => {
  const isExternal = (a) => {
    try {
      const u = new URL(a.getAttribute("href"), location.href);
      return u.origin !== location.origin;
    } catch {
      return false;
    }
  };

  const shouldOpenNewTab = (a) => {
    if (!a || a.hasAttribute("download")) return false;
    if (a.hasAttribute("data-link")) return false; // SPA: interno
    const href = a.getAttribute("href");
    if (!href) return false;
    if (href.startsWith("#")) return false; // ancore
    const proto = href.split(":")[0].toLowerCase();
    if (["javascript", "mailto", "tel"].includes(proto)) return false;
    return isExternal(a); // SOLO esterni
  };

  const addTokens = (rel, ...tokens) => {
    const set = new Set((rel || "").split(/\s+/).filter(Boolean));
    tokens.forEach((t) => set.add(t));
    return Array.from(set).join(" ");
  };

  const patchLinks = (root = document) => {
    root.querySelectorAll("a[href]").forEach((a) => {
      if (!shouldOpenNewTab(a)) {
        // se qualcuno ha messo target prima, non toccare i link interni
        return;
      }
      a.setAttribute("target", "_blank");
      a.setAttribute(
        "rel",
        addTokens(a.getAttribute("rel"), "noopener", "noreferrer")
      );
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => patchLinks());
  } else {
    patchLinks();
  }

  new MutationObserver((muts) => {
    for (const m of muts) {
      m.addedNodes.forEach((node) => {
        if (node.nodeType === 1) patchLinks(node);
      });
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
