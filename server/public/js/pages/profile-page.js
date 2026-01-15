import { auth, updateNavAuth } from "../state/auth-state.js";
import { requireLogin } from "../core/guards.js";
import { escapeHtml } from "../core/ui.js";

/*Funzioni API locali*/
async function apiMeProfile() {
    const r = await fetch("/api/users/me", { credentials: "include" });
    if (!r.ok) throw new Error("Errore caricamento profilo");
    return r.json();
}
async function apiUpdateProfile(payload) {
    const r = await fetch("/api/users/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error || "Errore salvataggio profilo");
    }
    return r.json();
}
async function apiChangePassword(current_password, new_password) {
    const r = await fetch("/api/users/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ current_password, new_password }),
    });
    if (r.status === 401) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error || "Password attuale errata");
    }
    if (!r.ok && r.status !== 204) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error || "Errore cambio password");
    }
}

export async function initProfilePage() {
    if (!(await requireLogin())) return;

    const msg = document.getElementById("profile-msg");
    const pmsg = document.getElementById("password-msg");
    const form = document.getElementById("form-profile");
    const formPwd = document.getElementById("form-password");
    const formDel = document.getElementById("form-delete-account");

    const inputs = {
        first_name: form.querySelector('input[name="first_name"]'),
        last_name: form.querySelector('input[name="last_name"]'),
        email: form.querySelector('input[name="email"]'),
        city: form.querySelector('input[name="city"]'),
        cap: form.querySelector('input[name="cap"]'),
        address: form.querySelector('input[name="address"]'),
        phone: form.querySelector('input[name="phone"]'),
    };

    // 1. CARICAMENTO DATI PROFILO
    try {
        const me = await apiMeProfile();
        if (!me) {
            alert("Devi essere loggato");
            window.page.show("/login");
            return;
        }
        inputs.first_name.value = me.first_name || "";
        inputs.last_name.value = me.last_name || "";
        inputs.email.value = me.email || "";
        inputs.city.value = me.city || "";
        inputs.cap.value = me.cap || "";
        inputs.address.value = me.address || "";
        inputs.phone.value = me.phone || "";

        if (me?.role === "admin" && formDel) {
            formDel.style.display = "none";
        }
    } catch (err) {
        console.error(err);
        alert("Errore nel caricamento del profilo");
        return;
    }

    // 2. SALVATAGGIO PROFILO
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const phoneDigits = (inputs.phone.value || "").replace(/\D/g, "");
        const payload = {
            first_name: inputs.first_name.value.trim(),
            last_name: inputs.last_name.value.trim(),
            city: inputs.city.value.trim(),
            cap: inputs.cap.value.trim(),
            address: inputs.address.value.trim(),
            phone: phoneDigits,
        };

        if (!payload.first_name || !payload.last_name)
            return alert("Nome e cognome obbligatori");
        if (payload.cap && !/^\d{5}$/.test(payload.cap))
            return alert("CAP non valido (5 cifre)");
        if (!/^\d{10}$/.test(payload.phone))
            return alert("Telefono obbligatorio (10 cifre)");

        try {
            const updated = await apiUpdateProfile(payload);
            msg.textContent = "Profilo salvato.";
            auth.user = { ...(auth.user || {}), ...updated };
            updateNavAuth();
            setTimeout(() => (msg.textContent = ""), 1500);
        } catch (err) {
            alert(err.message);
        }
    });

    // 3. GESTIONE INDIRIZZI
    async function loadAddresses() {
        const listEl = document.getElementById("addresses-list");
        if (!listEl) return;

        try {
            const res = await fetch("/api/addresses", { credentials: "include" });
            if (!res.ok) throw new Error("Errore fetch");
            const addrs = await res.json();

            listEl.innerHTML =
                addrs.length === 0
                    ? '<em class="muted">Nessun indirizzo extra salvato.</em>'
                    : "";

            addrs.forEach((a) => {
                const div = document.createElement("div");

                // Assegna le classi: card-box (aspetto) + address-item (layout flessibile)
                div.className = "card-box address-item";

                div.innerHTML = `
          <div>
            <strong>${escapeHtml(a.label || "Indirizzo")}</strong><br>
            <span class="muted">${escapeHtml(a.address)}, ${escapeHtml(
                    a.city
                )} (${escapeHtml(a.cap)})</span>
          </div>
          <button class="btn btn-danger btn-sm js-delete-addr" data-id="${a.id
                    }" type="button">&times;</button>
        `;
                listEl.appendChild(div);
            });
        } catch (e) {
            console.error("Errore caricamento indirizzi", e);
        }
    }

    // Event Delegation per eliminare indirizzi (NUOVO CODICE CORRETTO)
    const listEl = document.getElementById("addresses-list");
    listEl?.addEventListener("click", async (e) => {
        const btn = e.target.closest(".js-delete-addr");
        if (!btn) return;

        const id = btn.dataset.id;
        if (!id || !confirm("Eliminare definitivamente questo indirizzo?")) return;

        try {
            btn.disabled = true;
            const res = await fetch(`/api/addresses/${id}`, {
                method: "DELETE",
                credentials: "include",
            });
            if (!res.ok) throw new Error();
            loadAddresses(); // Ricarica la lista
        } catch (err) {
            alert("Impossibile eliminare l'indirizzo.");
            btn.disabled = false;
        }
    });

    // Form aggiunta indirizzo
    document
        .getElementById("form-add-address")
        ?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData);
            try {
                const r = await fetch("/api/addresses", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify(data),
                });
                if (!r.ok) throw new Error();
                e.target.reset();
                loadAddresses();
            } catch (err) {
                alert("Impossibile salvare l'indirizzo.");
            }
        });

    // Caricamento iniziale indirizzi
    loadAddresses();

    // (Ho rimosso qui il blocco 'window.deleteAddress' che era duplicato e inutile)

    // 4. CAMBIO PASSWORD
    formPwd.addEventListener("submit", async (e) => {
        e.preventDefault();
        const current_password = formPwd.querySelector(
            'input[name="current_password"]'
        ).value;
        const new_password = formPwd.querySelector(
            'input[name="new_password"]'
        ).value;
        if (new_password.length < 6)
            return alert("La nuova password deve avere almeno 6 caratteri");
        try {
            await apiChangePassword(current_password, new_password);
            pmsg.textContent = "Password aggiornata.";
            formPwd.reset();
            setTimeout(() => (pmsg.textContent = ""), 1500);
        } catch (err) {
            alert(err.message);
        }
    });

    // 5. ELIMINAZIONE ACCOUNT
    formDel?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const pass = formDel.querySelector('input[name="current_password"]').value;
        if (!pass) return alert("Inserisci la password attuale");
        if (!confirm("Sei sicuro? Questa operazione è irreversibile.")) return;

        try {
            const r = await fetch("/api/users/me", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ current_password: pass }),
            });
            if (r.status === 401)
                return alert((await r.json()).error || "Password attuale errata");
            if (!r.ok && r.status !== 204)
                throw new Error("Errore eliminazione account");

            auth.user = null;
            updateNavAuth();
            alert("Account eliminato.");
            window.page.show("/");
        } catch (err) {
            alert(err.message);
        }
    });
}