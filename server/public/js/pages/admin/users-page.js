import { escapeHtml } from "../../core/ui.js";

export async function showUsersAdmin(panel) {
    if (!panel) panel = document.getElementById("admin-panel");
    panel.innerHTML = `
    <h2 class="h4">Utenti</h2>
    <form id="users-search-form" class="admin-filters-toolbar">
        <label>
            <input type="search" id="users-search-input" placeholder="Nome o email..." />
        </label>
        <button type="submit" class="btn">Cerca</button>
    </form>
    <div id="users-admin-list" class="stack"></div>
  `;
    const listBox = document.getElementById("users-admin-list");
    const searchForm = document.getElementById("users-search-form");
    const searchInput = document.getElementById("users-search-input");

    async function load(q = "") {
        const r = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}`, {
            credentials: "include",
        });
        const users = await r.json();
        render(users);
    }

    searchForm.addEventListener("submit", (e) => {
        e.preventDefault();
        load(searchInput.value);
    });

    function render(users) {
        if (!users.length) {
            listBox.innerHTML = '<p class="muted">Nessun utente.</p>';
            return;
        }
        listBox.innerHTML = users
            .map((u) => {
                const role = (u.role || "user").toString().trim().toLowerCase();
                const isAdmin = role === "admin";
                const delBtn = isAdmin
                    ? ""
                    : '<button class="btn btn-danger btn-del" type="button">Elimina</button>';
                const emailLine = escapeHtml((u.email || "").toString().trim());
                return `
      <article class="card" data-uid="${u.id}" data-role="${role}">
        <div class="card-body flex-row items-center gap-3">
          <div class="mr-auto">
            <strong>#${u.id} ${escapeHtml(u.first_name || "")} ${escapeHtml(
                    u.last_name || ""
                )}</strong>
            <div class="muted email-only">${emailLine}</div>
          </div>
          <button class="btn btn-secondary btn-view" type="button">Dettagli</button>
          ${delBtn}
        </div>
        <div class="stack user-details hidden pt-2"></div>
      </article>
    `;
            })
            .join("");

        // apri/chiudi dettagli
        listBox.querySelectorAll(".btn-view").forEach((btn) => {
            btn.addEventListener("click", async () => {
                const card = btn.closest("[data-uid]");
                const uid = Number(card.dataset.uid);
                const box = card.querySelector(".user-details");
                const isOpen = !box.classList.contains("hidden");
                if (isOpen) {
                    box.classList.add("hidden");
                    return;
                }

                const r = await fetch(`/api/admin/users/${uid}`, {
                    credentials: "include",
                });
                if (!r.ok) {
                    alert("Errore dettaglio utente");
                    return;
                }
                const data = await r.json();

                const favs =
                    (data.favorites || [])
                        .map(
                            (f) =>
                                `<li>${escapeHtml(f.name)} (€${Number(
                                    f.price_per_day
                                ).toFixed(2)})</li>`
                        )
                        .join("") || '<li class="muted">Nessun preferito</li>';

                const ch =
                    (data.children || [])
                        .map((c) => `<li>${escapeHtml(c.name)} – 🎂 ${c.birthday}</li>`)
                        .join("") || '<li class="muted">Nessun figlio</li>';

                const bk =
                    (data.bookings || [])
                        .map((b) => {
                            const euro = (n) => "€" + Number(n).toFixed(2);
                            const perc = Number(b.discount_percent || 0);
                            const cp = b.coupon_code
                                ? ` • coupon: ${escapeHtml(b.coupon_code)}${perc ? " (" + perc + "%)" : ""
                                }`
                                : "";
                            const price =
                                b.final_price != null ? ` • ${euro(b.final_price)}` : "";
                            const addr = b.shipping_address
                                ? ` <br><em>📍 ${escapeHtml(b.shipping_address)}</em>`
                                : "";
                            const statoIT = b.status_label || b.status || "";
                            return `<li>#${b.id} ${escapeHtml(b.item_name)} • ${b.date_from
                                } → ${b.date_to} • ${escapeHtml(
                                    statoIT
                                )}${cp}${price}${addr}</li>`;
                        })
                        .join("") || '<li class="muted">Nessuna prenotazione</li>';

                const n = data.newsletter
                    ? `${escapeHtml(data.newsletter.email)} – ${data.newsletter.is_active ? "attiva ✅" : "disattiva ❌"
                    }`
                    : '<span class="muted">Nessuna iscrizione</span>';

                const cps =
                    (data.coupons || [])
                        .slice(0, 5)
                        .map(
                            (c) =>
                                `${escapeHtml(c.code)} ${c.discount_percent}% ${c.is_active ? "(attivo)" : "(off)"
                                }`
                        )
                        .join(", ") || "—";

                const u = data.user || {};
                const phoneLine = u.phone ? ` • ☎ ${escapeHtml(u.phone)}` : "";

                box.innerHTML = `
          <section class="ud-card">
            <h4 class="ud-title">Profilo</h4>
            <dl class="ud-grid">
              <div class="ud-row">
                <dt>Nome</dt>
                <dd>${escapeHtml(u.first_name || "")} ${escapeHtml(
                    u.last_name || ""
                )}</dd>
              </div>
              <div class="ud-row">
                <dt>Email</dt>
                <dd>${escapeHtml(u.email || "—")}</dd>
              </div>
              <div class="ud-row">
                <dt>Telefono</dt>
                <dd>${escapeHtml(u.phone || "—")}</dd>
              </div>
              <div class="ud-row">
                <dt>Città</dt>
                <dd>${escapeHtml(u.city || "—")}</dd>
              </div>
              <div class="ud-row">
                <dt>CAP</dt>
                <dd>${escapeHtml(u.cap || "—")}</dd>
              </div>
              <div class="ud-row">
                <dt>Indirizzo</dt>
                <dd>${escapeHtml(u.address || "—")}</dd>
              </div>
              ${u.birthday
                        ? `<div class="ud-row">
                       <dt>Nascita</dt>
                       <dd>🎂 ${escapeHtml(u.birthday)}</dd>
                     </div>`
                        : ""
                    }
            </dl>
          </section>
          <div><strong>Preferiti</strong><ul class="mt-1 ml-4">${favs}</ul></div>
          <div><strong>Figli</strong><ul class="mt-1 ml-4">${ch}</ul></div>
          <div><strong>Prenotazioni</strong><ul class="mt-1 ml-4">${bk}</ul></div>
          <div><strong>Newsletter</strong>: ${n}</div>
        `;
                box.classList.remove("hidden");
            });
        });

        // elimina utente (solo per non-admin)
        listBox.querySelectorAll(".btn-del").forEach((btn) => {
            btn.addEventListener("click", async () => {
                const uid = Number(btn.closest("[data-uid]").dataset.uid);
                if (
                    !confirm(
                        "Eliminare definitivamente questo utente e tutti i dati collegati?"
                    )
                )
                    return;
                try {
                    const r = await fetch(`/api/admin/users/${uid}`, {
                        method: "DELETE",
                        credentials: "include",
                    });
                    if (r.status === 403) {
                        const e = await r.json().catch(() => ({}));
                        alert(e.error || "Non è possibile eliminare un amministratore");
                        return;
                    }
                    if (!r.ok && r.status !== 204) throw new Error();
                    await load(searchInput.value);
                } catch (err) {
                    alert("Errore eliminazione");
                }
            });
        });
    }

    await load();
}
