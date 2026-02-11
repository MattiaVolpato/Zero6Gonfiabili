// --- USER MENU: Gestione Menu Utente ---
/**
 * Gestisce il dropdown del menu utente nella navbar:
 * 
 * 1. Toggling: Apre/chiude il menu al click sull'icona utente.
 * 2. Accessibilità: Gestisce l'attributo `aria-expanded` per gli screen reader.
 * 3. Chiusura Automatica: Chiude il menu se:
 *    - Si clicca fuori dal menu.
 *    - Si clicca su un link interno al menu.
 *    - Si naviga in un'altra pagina (SPA navigation).
 * 4. Layout: Notifica `header-fixed.js` per ricalcolare l'altezza dell'header se necessario.
 */

document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("user-menu-toggle");
  const menu = document.getElementById("user-menu");
  if (!toggle || !menu) return;

  // helper visibilità + ARIA
  function setOpen(isOpen) {
    menu.hidden = !isOpen;
    toggle.setAttribute("aria-expanded", String(isOpen));

    // quando cambia il menu utente, aggiorna l'altezza header
    if (window.z6UpdateHeaderHeight) {
      window.z6UpdateHeaderHeight();
    }
  }

  function closeMenu() {
    setOpen(false);
  }

  // stato iniziale
  setOpen(false);

  // Apri/chiudi dal toggle
  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    setOpen(menu.hidden); // se era hidden => apri, altrimenti chiudi
  });

  // Chiudi cliccando fuori
  document.addEventListener("click", (e) => {
    if (
      !menu.hidden &&
      !menu.contains(e.target) &&
      !toggle.contains(e.target)
    ) {
      closeMenu();
    }
  });

  // ✅ Chiudi quando clicchi un link dentro il menu (SPA link)
  menu.addEventListener("click", (e) => {
    const a = e.target.closest("a[href]");
    const isLogoutBtn = e.target.closest("#nav-logout");
    if (a || isLogoutBtn) {
      closeMenu();
    }
  });

  // ✅ Chiudi anche quando clicchi qualunque link SPA nel documento
  // (utile se il click parte da dentro il menu o da overlay affini)
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href][data-link]");
    if (a) closeMenu();
  });

  // Chiudi al cambio route "vero"
  window.addEventListener("hashchange", closeMenu);
  window.addEventListener("popstate", closeMenu);
});
