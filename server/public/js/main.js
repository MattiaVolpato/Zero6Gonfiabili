// 1) Patch fetch + CSRF (side-effect, una sola volta)
import "./core/fetch-bootstrap.js";

// 2) Script UI globali RISOLVERE 
import "./user-menu.js";
import "./reveal.js";
import "./force-newtab.js";
import "./set-current-year.js";
import "./header-fixed.js";

// 3) Errori server (?__e=404/500) PRIMA di avviare il router
import { initServerStatusFlag } from "./core/bootstrap.js";
initServerStatusFlag();

// 4) Espongo auth a window per compatibilità con alcuni punti del tuo spa.js
import { auth } from "./state/auth-state.js";
window.auth = auth;

// 5) Avvio router (ora è in core/spa-core.js)
import { initRouter } from "./core/spa-core.js";
document.addEventListener("DOMContentLoaded", initRouter);
