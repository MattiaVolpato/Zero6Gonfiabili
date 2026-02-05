import { initHomeReviews, initHomeNewsletter } from "./pages/home-page.js";
import { initGonfiabiliPage } from "./pages/gonfiabili-page.js";
import { initGonfiabileDettaglioPage } from "./pages/gonfiabile-dettaglio-page.js";
import { initBlogPage } from "./pages/blog-page.js";
import {
  initLoginPage,
  initRegisterPage,
  initForgotPasswordPage,
  initResetPasswordPage
} from "./pages/auth-page.js";
import { initPrenotazioniPage } from "./pages/prenotazioni-page.js";
import { initTesseraPage } from "./pages/tessera-page.js";
import { initAdminPage } from "./pages/admin-page.js";
import { initProfilePage } from "./pages/profile-page.js";
import {
  initChildrenPage,
  initCouponsPage,
  initNewsletterPage,
  initFavoritesPage
} from "./pages/others-page.js";

// Dispatcher chiamato dal router DOPO il mount del frammento
export function pageInitDispatcher(viewPath, root) {
  try {
    // Gestione Home
    if (viewPath === "home") {
      initHomeNewsletter();
      initHomeReviews();
    }

    // Catalogo e Dettaglio
    if (root.querySelector("#items-list")) initGonfiabiliPage();
    if (viewPath === "gonfiabile-dettaglio") initGonfiabileDettaglioPage();

    // Blog
    if (viewPath === "blog") initBlogPage();

    // Autenticazione
    if (viewPath === "login") initLoginPage();
    if (viewPath === "register") initRegisterPage();
    if (viewPath === "forgot-password") initForgotPasswordPage();
    if (viewPath === "reset-password") initResetPasswordPage();

    // Utente
    if (viewPath === "profile") initProfilePage();
    if (viewPath === "prenotazioni") initPrenotazioniPage();
    if (viewPath === "figli") initChildrenPage();
    if (viewPath === "buoni") initCouponsPage();
    if (viewPath === "tessera") initTesseraPage();
    if (viewPath === "preferiti") initFavoritesPage(root);

    // Altro
    if (viewPath === "newsletter") initNewsletterPage();
    if (viewPath === "admin") initAdminPage();

    // Inizializzazione UI globale (se esiste in window, es. per script legacy)
    if (window.initUI) window.initUI();

  } catch (err) {
    console.error("[pageInitDispatcher] Errore nell'inizializzazione della pagina:", err);
  }
}