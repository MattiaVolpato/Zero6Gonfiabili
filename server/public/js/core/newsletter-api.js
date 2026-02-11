
// =========================================================
// GESTORE API NEWSLETTER
// =========================================================
// Questo file centralizza tutte le chiamate verso il backend
// relative alla gestione dell'iscrizione alla newsletter.
// Viene utilizzato sia dalla Home Page (home-page.js) 
// che dalla pagina dedicata (others-page.js).
// =========================================================

/**
 * Effettua l'iscrizione di una email alla newsletter.
 * Endpoint: POST /api/newsletter/subscribe
 */
export async function apiNewsSubscribe(email) {
    const r = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
    });
    if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error || "Errore iscrizione");
    }
}

/**
 * Rimuove l'iscrizione di una email dalla newsletter.
 * Endpoint: POST /api/newsletter/unsubscribe
 */
export async function apiNewsUnsubscribe(email) {
    const r = await fetch("/api/newsletter/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
    });
    if (r.status === 404) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error || "Email non trovata");
    }
    if (!r.ok && r.status !== 204) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error || "Errore disiscrizione");
    }
}

/**
 * Verifica lo stato dell'iscrizione per una email.
 * Endpoint: GET /api/newsletter/status
 * Restituisce { exists: boolean, is_active: boolean }
 */
export async function apiNewsStatus(email) {
    const url = new URL("/api/newsletter/status", location.origin);
    url.searchParams.set("email", email);
    const r = await fetch(url, { credentials: "include" });
    if (!r.ok) throw new Error("Errore verifica stato");
    return r.json();
}
