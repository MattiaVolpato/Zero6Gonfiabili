// --- ROUTE GUARDS: Protezione Rotte Client-Side ---
/**
 * Questo modulo fornisce middleware per proteggere le rotte della SPA:
 * 
 * 1. requireLogin: Funzione helper generica per verificare se l'utente è loggato; se no, reindirizza al login.
 * 2. requireAuth: Middleware per il router (Page.js). Avvolge un handler di rotta e lo esegue SOLO se l'utente è autenticato.
 *    Altrimenti reindirizza al login salvando la pagina di destinazione.
 * 3. requireGuest: Middleware opposto (es. per pagina Login/Register). Permette l'accesso SOLO se l'utente NON è loggato.
 *    Se l'utente è già loggato, lo reindirizza alla home.
 */

import { auth } from "../state/auth-state.js";
// ---- Guard login riutilizzabile (con messaggio personalizzabile) ----
export async function requireLogin(orRedirect = true, opts = {}) {
  const {
    message = "Devi essere loggato per accedere a questa pagina.",
    next = () => window.location.pathname,
  } = opts;

  if (auth.user) return true;
  try {
    await auth.refresh();
  } catch { }
  if (auth.user) return true;

  if (orRedirect) {
    setFlash(message);
    const nextPath = typeof next === "function" ? next() : next;
    window.page.show(`/login?next=${encodeURIComponent(nextPath || "/")}`);
  }
  return false;
}

export function requireAuth(handler) {
  return async (ctx) => {
    if (!auth.user) {
      try {
        await auth.refresh();
      } catch { }
    }
    if (!auth.user) {
      setFlash("Devi effettuare l’accesso per continuare.");
      const next = encodeURIComponent(ctx?.path || window.location.pathname);
      if (window.page?.replace) window.page.replace(`/login?next=${next}`);
      else {
        history.replaceState(null, "", `/login?next=${next}`);
        window.location.replace(`/login?next=${next}`);
      }
      return;
    }
    return handler(ctx);
  };
}

export function requireGuest(next) {
  return async (ctx) => {
    try {
      await auth.refresh().catch(() => { });
    } catch { }
    if (auth.user) {
      if (window.page?.replace) window.page.replace("/");
      else {
        history.replaceState(null, "", "/");
        window.page?.show?.("/");
      }
      return;
    }
    return next(ctx);
  };
}
