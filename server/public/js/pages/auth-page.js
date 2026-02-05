import { CSRF } from "../core/csrf.js";
import { auth, updateNavAuth } from "../state/auth-state.js";
import { escapeHtml } from "../core/ui.js";

// =====================
//        LOGIN
// =====================
export function initLoginPage() {
    const form = document.getElementById("form-login");

    // Helper: replace nella history + naviga SENZA aggiungere entry
    const goReplace = (url) => {
        try {
            if (window.page?.replace) {
                window.page.replace(url);
            } else {
                history.replaceState(null, "", url);
                window.location.replace(url);
            }
        } catch (_) {
            window.location.replace(url);
        }
    };

    // next "safe": evita redirect loop verso /login
    const getNextSafe = () => {
        const params = new URLSearchParams(window.location.search);
        const raw = params.get("next") || "/";
        try {
            const u = new URL(raw, location.origin);
            // Se punta a /login (anche con query), ignora → home
            if (u.pathname === "/login") return "/";
            // consenti solo path locali (no absolute esterni)
            if (u.origin !== location.origin) return "/";
            return u.pathname + (u.search || "") + (u.hash || "");
        } catch {
            return "/";
        }
    };

    // 🔹 Refresh immediato dello stato (best effort, non blocca la UI)
    // Se sei già loggato mentre atterri su /login, sostituisco l'URL.
    (async () => {
        try {
            await auth.refresh();
        } catch { }
        if (window.auth?.user && location.pathname === "/login") {
            goReplace(getNextSafe());
            return; // evita lampeggio della pagina di login
        }
    })();

    // 1) Se arrivo alla login da utente già autenticato, non devo vederla
    if (window.auth?.user) {
        goReplace(getNextSafe());
        return;
    }

    // 2) Gestisci BFCache: se torni indietro e ora SEI loggato, vai via dalla login
    window.addEventListener("pageshow", async (e) => {
        const cameFromBFCache =
            e.persisted ||
            performance.getEntriesByType?.("navigation")[0]?.type === "back_forward";

        if (!cameFromBFCache) return;

        try {
            await auth.refresh();
        } catch { }
        if (window.auth?.user && location.pathname === "/login") {
            goReplace(getNextSafe());
        } else {
            // riallinea comunque la UI (navbar, ecc.)
            updateNavAuth?.();
        }
    });

    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const fd = new FormData(form);
        const email = fd.get("email");
        const password = fd.get("password");
        // se il checkbox è fuori dal form, prova anche nel documento
        const rememberMe =
            form.querySelector('input[name="rememberMe"]')?.checked ||
            document.querySelector('input[name="rememberMe"]')?.checked ||
            false;

        async function doLogin() {
            return fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ email, password, rememberMe }),
            });
        }

        try {
            let res = await doLogin();

            // Retry se token CSRF scaduto
            if (res.status === 403) {
                await CSRF.refresh().catch(() => { });
                res = await doLogin();
            }

            if (!res.ok) {
                const msg =
                    res.status === 401
                        ? "Email o password errate"
                        : "Impossibile completare il login. Riprova.";
                throw new Error(msg);
            }

            const data = await res.json();
            window.auth.user = data.user;
            updateNavAuth?.();

            const next = getNextSafe();
            setFlash?.("Accesso effettuato con successo.", "success");

            // 4) Rimuovi /login dallo storico e vai alla pagina successiva (senza aggiungere entry)
            goReplace(next);
        } catch (err) {
            alert(err.message || "Errore di login");
            console.error(err);
        }
    });
}

// === REGISTER ===
export function initRegisterPage() {
    const form = document.getElementById("form-register");

    // helper per sostituire nello history e navigare
    const goReplace = (url) => {
        try {
            history.replaceState(null, "", url);
            if (window.page?.show) window.page.show(url);
            else window.location.replace(url);
        } catch (_) {
            window.location.replace(url);
        }
    };

    // 1) se sono già autenticato, non devo vedere la registrazione
    if (window.auth?.user) {
        goReplace("/");
        return;
    }

    // 2) gestione back/forward cache: se torno e sono loggato, vai via
    window.addEventListener("pageshow", (e) => {
        const fromBFCache =
            e.persisted ||
            performance.getEntriesByType("navigation")[0]?.type === "back_forward";
        if (!fromBFCache) return;

        auth
            .refresh()
            .then(() => {
                if (location.pathname === "/login" && auth.user) {
                    if (window.page?.replace) window.page.replace("/");
                    else {
                        history.replaceState(null, "", "/");
                        window.page?.show?.("/");
                    }
                } else {
                    updateNavAuth();
                }
            })
            .catch(() => { });
    });

    if (!form) return;

    // === VALIDAZIONE CUSTOM (niente tooltip del browser) ===
    form.setAttribute("novalidate", "novalidate");

    // refs in ordine di form
    const F = {
        first_name: form.querySelector('[name="first_name"]'),
        last_name: form.querySelector('[name="last_name"]'),
        email: form.querySelector('[name="email"]'),
        password: form.querySelector('[name="password"]'),
        password2: form.querySelector('[name="password2"]'),
        birthday: form.querySelector('[name="birthday"]'),
        city: form.querySelector('[name="city"]'),
        cap: form.querySelector('[name="cap"]'),
        address: form.querySelector('[name="address"]'),
        phone: form.querySelector('[name="phone"]'),
    };

    function renderRegisterMsg(text, type = "error") {
        const box = document.getElementById("register-msg");
        if (!box) return;
        box.textContent = text || "";
        box.classList.remove("error", "success");
        box.classList.add(type);
    }

    function clearErrors() {
        form.querySelectorAll(".field-error").forEach((n) => n.remove());
        form.querySelectorAll(".is-invalid").forEach((el) => {
            el.classList.remove("is-invalid");
            el.removeAttribute("aria-invalid");
            el.removeAttribute("aria-describedby");
        });
        Object.values(F).forEach((el) => el?.setCustomValidity?.("")); // sicurezza
        renderRegisterMsg(""); // pulisci banner
    }

    function showError(input, message) {
        if (!input) return;
        input.classList.add("is-invalid");
        input.setAttribute("aria-invalid", "true");
        const msg = document.createElement("div");
        msg.className = "field-error";
        msg.textContent = message;
        input.parentElement.appendChild(msg);
        const id = input.name + "-error";
        msg.id = id;
        input.setAttribute("aria-describedby", id);
    }

    function calcAge(iso) {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return NaN;
        const now = new Date();
        let age = now.getFullYear() - d.getFullYear();
        const m = now.getMonth() - d.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
        return age;
    }

    // pulizia errori mentre l’utente digita
    form.addEventListener("input", (e) => {
        const el = e.target;
        if (el?.matches?.("input")) {
            el.classList.remove("is-invalid");
            el.removeAttribute("aria-invalid");
            el.removeAttribute("aria-describedby");
            el.parentElement.querySelector(".field-error")?.remove();
        }
    });

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const submitBtn = form.querySelector('[type="submit"]');
        submitBtn?.setAttribute("disabled", "true");
        clearErrors();

        // valori normalizzati
        const v = {
            first_name: F.first_name?.value?.trim() || "",
            last_name: F.last_name?.value?.trim() || "",
            email: F.email?.value?.trim() || "",
            password: F.password?.value || "",
            password2: F.password2?.value || "",
            birthday: F.birthday?.value || "",
            city: F.city?.value?.trim() || "",
            cap: F.cap?.value?.trim() || "",
            address: F.address?.value?.trim() || "",
            phone: F.phone?.value?.trim() || "",
        };

        const errors = [];
        const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        // Ordine richiesto: Nome, Cognome, Email, Password, Conferma, Data di nascita, Città, CAP, Indirizzo, Telefono
        if (!v.first_name)
            errors.push(() => showError(F.first_name, "Inserisci il nome."));
        if (!v.last_name)
            errors.push(() => showError(F.last_name, "Inserisci il cognome."));
        if (!v.email)
            errors.push(() => showError(F.email, "Inserisci la tua email."));
        else if (!emailRe.test(v.email))
            errors.push(() => showError(F.email, "Email non valida."));

        if (!v.password)
            errors.push(() => showError(F.password, "Inserisci una password."));
        else if (v.password.length < 6)
            errors.push(() =>
                showError(F.password, "La password deve avere almeno 6 caratteri.")
            );

        if (!v.password2)
            errors.push(() => showError(F.password2, "Conferma la password."));
        else if (v.password2 !== v.password)
            errors.push(() => showError(F.password2, "Le password non coincidono."));

        if (!v.birthday)
            errors.push(() => showError(F.birthday, "Inserisci la data di nascita."));
        else {
            const age = calcAge(v.birthday);
            if (isNaN(age))
                errors.push(() => showError(F.birthday, "Data non valida."));
            else if (age < 15)
                errors.push(() => showError(F.birthday, "Devi avere almeno 15 anni."));
        }

        if (!v.city) errors.push(() => showError(F.city, "Inserisci la città."));
        if (!v.cap) errors.push(() => showError(F.cap, "Inserisci il CAP."));
        else if (!/^\d{5}$/.test(v.cap))
            errors.push(() => showError(F.cap, "Il CAP deve avere 5 cifre."));

        if (!v.address)
            errors.push(() => showError(F.address, "Inserisci l’indirizzo."));
        if (!v.phone)
            errors.push(() => showError(F.phone, "Inserisci il telefono."));
        else if (!/^\d{10}$/.test(v.phone))
            errors.push(() => showError(F.phone, "Il numero deve avere 10 cifre."));

        if (errors.length) {
            errors.forEach((fn) => fn()); // mostra tutti
            form.querySelector(".is-invalid")?.focus(); // focus primo errore
            submitBtn?.removeAttribute("disabled");
            return; // non inviare
        }

        // Payload pronto (tutti i campi obbligatori OK)
        const fd = new FormData(form);
        const payload = Object.fromEntries(fd.entries());
        payload.rememberMe =
            form.querySelector('input[name="rememberMe"]')?.checked ||
            document.querySelector('input[name="rememberMe"]')?.checked ||
            false;

        async function doRegister() {
            return fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(payload),
            });
        }

        try {
            let res = await doRegister();

            // retry se CSRF scaduto
            if (res.status === 403) {
                await CSRF.refresh().catch(() => { });
                res = await doRegister();
            }

            if (!res.ok) {
                const text = await res.text().catch(() => "");
                const msg =
                    res.status === 409
                        ? "Email già registrata."
                        : text || "Impossibile completare la registrazione. Riprova.";
                renderRegisterMsg(`⚠️ ${msg}`, "error");
                throw new Error(msg);
            }

            const data = await res.json();
            // aggiorna stato auth in modo sicuro (evita 'this' binding)
            window.auth = window.auth || {};
            window.auth.user = data.user;
            updateNavAuth?.();

            setFlash?.("Registrazione completata con successo.", "success");
            renderRegisterMsg(
                "✅ Account creato! Reindirizzamento in corso…",
                "success"
            );

            const params = new URLSearchParams(window.location.search);
            const next = params.get("next") || "/";

            // 3) sostituisci la /register nello storico e naviga
            goReplace(next);
        } catch (err) {
            console.error(err);
        } finally {
            submitBtn?.removeAttribute("disabled");
        }
    });
}

// === FORGOT PASSWORD ===
export function initForgotPasswordPage() {
    const form = document.getElementById("form-forgot");
    const msg = document.getElementById("fp-msg");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = form.querySelector('[name="email"]').value;
        const btn = form.querySelector("button");

        try {
            btn.disabled = true;
            btn.textContent = "Invio in corso...";

            const res = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ email }),
            });

            const data = await res.json();

            // Questo scatta SOLO se c'è un errore tecnico del server (es. 500)
            if (!res.ok) {
                throw new Error(data.error || "Errore tecnico del server");
            }

            // Se l'email non esiste, il server restituisce 200 OK, quindi arriviamo qui:
            msg.className = "mt-3 text-center text-success";
            msg.textContent =
                data.message || "Se l'email esiste, riceverai istruzioni.";
            form.reset();
        } catch (err) {
            msg.className = "mt-3 text-center text-danger";
            msg.textContent = "Si è verificato un errore."; // Messaggio generico anche in caso di crash
        } finally {
            btn.disabled = false;
            btn.textContent = "Invia Link";
        }
    });
}

// === RESET PASSWORD ===
export function initResetPasswordPage() {
    const form = document.querySelector("form");
    if (!form) return;

    const feedbackBox =
        document.querySelector(".form-feedback") ||
        document.querySelector("#error-box");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        // --- 1. ESTRAZIONE E PULIZIA TOKEN (AGGIORNATO) ---
        // Prende tutto ciò che c'è dopo /reset-password/
        const match = window.location.pathname.match(/\/reset-password\/(.+)/);
        let rawToken = match ? match[1] : "";

        // NUOVO: Se il token contiene una barra (es. token/nIl), prendiamo solo la parte PRIMA della barra.
        let token = rawToken.split("/")[0];

        // Pulizia finale (spazi, caratteri strani)
        token = token.trim();

        console.log("Token PULITO inviato al server:", token); // <-- Verifica che non ci sia più /nIl

        const password = form.querySelector('input[name="password"]').value;

        // Gestione sicura del campo confirmPassword (se non c'è nel form, usa la stessa password)
        const confirmInput = form.querySelector('input[name="confirmPassword"]');
        const confirmPassword = confirmInput ? confirmInput.value : password;

        try {
            const res = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, newPassword: password, confirmPassword }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(
                    data.error || data.message || "Errore durante il reset della password"
                );
            }

            alert("Password aggiornata con successo! Ora puoi accedere.");
            window.page("/login");
        } catch (err) {
            console.error("Errore reset:", err);
            if (feedbackBox) {
                feedbackBox.textContent = err.message;
                feedbackBox.classList.remove("hidden");
            } else {
                alert("Errore: " + err.message);
            }
        }
    });
}