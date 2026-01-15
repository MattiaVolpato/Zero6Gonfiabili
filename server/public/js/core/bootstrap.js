import "./fetch-bootstrap.js"; // side-effect (usa getCsrfToken da csrf.js)

//--------------------------------------------

//GESTIONE ERRORI
export function initServerStatusFlag() {
  (function handleServerStatusFlag() {
    const url = new URL(window.location.href);
    const codeStr = url.searchParams.get("__e");
    if (!codeStr) return;

    const code = parseInt(codeStr, 10);
    const safeCode = code === 404 ? 404 : 500;
    const viewPath = safeCode === 404 ? "/views/404" : "/views/500";

    // blocca l’avvio del router finché mostriamo l’errore
    window.__SHOWING_FATAL_ERROR = true;

    const container = document.getElementById("app-root");
    if (!container) {
      console.error("[error] #app-root non trovato.");
      return;
    }

    fetch(`${viewPath}?status=${encodeURIComponent(safeCode)}`, {
      headers: { "X-Fragment": "1", Accept: "text/html" },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`${viewPath} non disponibile`);
        return r.text();
      })
      .then((html) => {
        container.innerHTML = html;
        container.dataset.view = `error-${safeCode}`;

        // bind "torna a home" (sia per 404 che 500)
        const goHome = container.querySelector(
          "[data-action='go-home-404'], [data-action='go-home-500']"
        );
        if (goHome) {
          goHome.addEventListener("click", (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            clearErrorAndGoHome();
          });
        }
      })
      .catch(() => {
        // Fallback minimale (non maschera l’assenza dell’EJS con una pagina “perfetta”)
        container.innerHTML = `
        <section class="py-3 container">
          <h1 class="h3">Errore ${safeCode}</h1>
          <p class="muted">${safeCode === 404
            ? "Pagina non trovata."
            : "Si è verificato un errore interno."
          }</p>
          <p><a class="btn" href="#" role="button" data-action="go-home-${safeCode}">Torna alla Home</a></p>
        </section>`;
        const a = container.querySelector(
          `[data-action='go-home-${safeCode}']`
        );
        if (a) {
          a.addEventListener("click", (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            clearErrorAndGoHome();
          });
        }
      })
      .finally(() => {
        // pulisci la query
        url.searchParams.delete("__e");
        const clean =
          url.pathname +
          (url.searchParams.toString() ? `?${url.searchParams}` : "") +
          url.hash;
        window.history.replaceState({}, "", clean);
      });

    function clearErrorAndGoHome() {
      const container = document.getElementById("app-root");
      if (container) container.dataset.view = "";
      window.__SHOWING_FATAL_ERROR = false;

      // se la SPA non è partita (per via dell’errore), avviala ora
      if (!window.__ROUTER_STARTED && window.page) {
        window.page();
        window.__ROUTER_STARTED = true;
      }

      // forza la home
      if (window.page && typeof window.page.show === "function") {
        window.page.show("/");
      } else {
        window.history.replaceState({}, "", "/");
        window.location.reload();
      }
    }
  })();
}

//---------------------------------------------------

//NAVIGATION

export function initSpaLinksDelegation() {
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href][data-link]");
    if (!a) return;
    if (a.origin !== location.origin) return;

    e.preventDefault();
    const href = a.getAttribute("href");
    if (window.page && typeof window.page.show === "function") {
      window.page.show(href);
    } else {
      location.assign(href); // fallback
    }
  });
}

//----------------------------------------------------

//CONSENSO COOKIE

const COOKIE_CONSENT_KEY = "cookieConsent.v1";

function shouldShowCookieBanner() {
  try {
    return !localStorage.getItem(COOKIE_CONSENT_KEY);
  } catch {
    return true;
  }
}
function acceptCookies() {
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
  } catch { }
  const b = document.getElementById("cookie-banner");
  if (b) b.hidden = true;
}

export function initCookieBanner() {
  const banner = document.getElementById("cookie-banner");
  if (!banner) return;
  if (shouldShowCookieBanner()) banner.hidden = false;
  document
    .getElementById("cookie-accept")
    ?.addEventListener("click", acceptCookies);
}

//-----------------------------------------------

//MANTIENI SESSIONE ATTIVA

import { auth } from "../state/auth-state.js";

export function startKeepAlive() {
  setInterval(() => {
    if (!auth.user) return;
    fetch("/api/auth/session/keep-alive", { credentials: "include" }).catch(
      () => { }
    );
  }, 10 * 60 * 1000);
}
