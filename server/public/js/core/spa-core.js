// MOUNT + ROUTER

// --- Import comuni (unici) ---
import { auth } from "../state/auth-state.js";
import { ViewLoader } from "./view-loader.js";
import { root, z6UpdateActiveNav } from "./ui.js";
import { renderFlashIfAny } from "./ui.js";
import { requireAuth, requireGuest } from "./guards.js";
// Dispatcher delle init per pagina
import { pageInitDispatcher } from "../spa.js";

// ----------------------------------------------------
// MOUNT
// ----------------------------------------------------
export async function mount(viewPath, afterMount = pageInitDispatcher) {
  try {
    // refresh auth non-bloccante
    await auth.refresh().catch(() => { });

    // Cleanup vista precedente
    if (window.currentView && typeof window.currentView.destroy === "function") {
      try {
        window.currentView.destroy();
      } catch (e) {
        console.error("Errore destroy vista precedente:", e);
      }
    }
    window.currentView = null; // Reset per la nuova vista

    root.innerHTML = '<div class="muted">Caricamento…</div>';
    const html = await ViewLoader.load(viewPath);
    root.innerHTML = html;

    window.scrollTo(0, 0);

    if (typeof afterMount === "function") {
      await afterMount(viewPath, root);
    }
  } catch (err) {
    console.error(err);
    root.innerHTML = `
      <section class="py-3">
        <h1 class="h3">Errore</h1>
        <pre class="pre-box">${(err && err.message) || err}</pre>
      </section>`;
  } finally {
    renderFlashIfAny();
  }
}

// ----------------------------------------------------
// ROUTER
// ----------------------------------------------------
export function initRouter() {
  // Middleware: aggiorna nav attiva + tenta refresh auth
  window.page("*", async (ctx, next) => {
    try {
      await auth.refresh();
    } catch { }
    z6UpdateActiveNav(ctx.pathname || ctx.path || "/");
    next();
  });

  // Rotte pubbliche
  window.page("/", () => mount("home"));
  window.page("/gonfiabili", () => mount("gonfiabili"));
  window.page("/faq", () => mount("faq"));
  window.page("/newsletter", () => mount("newsletter"));
  window.page("/blog", () => {
    mount("blog");
  });
  window.page("/cookie-policy", () => mount("cookie-policy"));
  window.page("/privacy-policy", () => mount("privacy-policy"));
  window.page("/gonfiabili/:id", (ctx) => mount("gonfiabile-dettaglio"));

  // Rotte guest-only
  window.page(
    "/login",
    requireGuest(() => mount("login"))
  );
  window.page(
    "/register",
    requireGuest(() => mount("register"))
  );

  // Rotte protette
  window.page(
    "/prenotazioni",
    requireAuth(() => mount("prenotazioni"))
  );

  window.page(
    "/gestione-figli",
    requireAuth(() => mount("figli"))
  );
  window.page(
    "/tessera",
    requireAuth(() => mount("tessera"))
  );
  window.page(
    "/admin",
    requireAuth(() => mount("admin"))
  );
  window.page(
    "/profile",
    requireAuth(() => mount("profile"))
  );
  window.page(
    "/preferiti",
    requireAuth(() => mount("preferiti"))
  );

  // Password dimenticata
  window.page(
    "/forgot-password",
    requireGuest(() => mount("forgot-password"))
  );

  window.page(
    "/reset-password/*",
    requireGuest((ctx) => {
      // ctx.params[0] contiene tutto ciò che c'è al posto dell'asterisco
      const tokenFromUrl = ctx.params[0];
      console.log(
        "Rotta Reset Password attivata col JOLLY! Token:",
        tokenFromUrl
      );

      // Montiamo la vista normalmente.
      // Nota: la tua funzione initResetPasswordPage in spa.js leggerà comunque l'URL,
      // quindi non serve passare il token al mount.
      mount("reset-password");
    })
  );
  // 404
  window.page("/404", () => mount("404"));
  window.page("*", (ctx) => {
    if (ctx.path !== "/404") window.page.show("/404");
  });

  // Avvio router (solo se non c'è errore fatale lato server)
  if (!window.__SHOWING_FATAL_ERROR) {
    window.page({ decodeURLComponents: false });
    window.__ROUTER_STARTED = true;
  }
}
