import { escapeHtml } from "../../core/ui.js";

export async function showNewsletterAdmin(panel) {
    if (!panel) panel = document.getElementById("admin-panel");
    panel.innerHTML = `
    <h2 class="h4">Iscritti newsletter</h2>

    <section class="card mb-4">
      <div class="card-body stack">
        <form id="form-news-campaign" class="stack">
          <strong>Invia una campagna</strong>

          <div class="grid-1">
            <label>Oggetto
              <input type="text" name="subject" id="news-subject" required placeholder="Offerta di Halloween 🎃" />
            </label>

            <label>Messaggio (testo puro)
              <textarea name="body" id="news-body" rows="4" required placeholder="Ciao! Ecco il tuo codice sconto…"></textarea>
            </label>

            <fieldset class="reset-fieldset flex-row gap-4 items-center wrap">
              <legend class="muted legend-tight">Destinatari</legend>

              <label class="flex-row items-center gap-2">
                <input type="radio" name="news-target" value="all" checked />
                Tutti gli iscritti attivi
              </label>

              <label class="flex-row items-center gap-2">
                <input type="radio" name="news-target" value="single" />
                Singolo indirizzo:
              </label>

              <input type="email" id="news-single-email" class="maxw-320" placeholder="nome@esempio.it" disabled />
            </fieldset>
          </div>

          <div class="flex-row gap-2 items-center">
            <button class="btn" type="submit" id="btn-news-send">Invia</button>
            <span id="news-send-result" class="muted"></span>
          </div>
        </form>
      </div>
    </section>

    <div class="flex-row items-center gap-2 mb-2">
      <div class="admin-filters-toolbar mr-auto">
        <label>Filtra stato
          <select id="admin-news-filter">
            <option value="all">Tutti</option>
            <option value="active">Attivi</option>
            <option value="inactive">Non attivi</option>
          </select>
        </label>
      </div>
      <button id="news-refresh" class="btn btn-secondary" type="button">Aggiorna elenco</button>
      <span id="news-refresh-status" class="muted"></span>
    </div>
    <div id="news-admin-list" class="stack"></div>
  `;

    const listBox = document.getElementById("news-admin-list");
    const formCampaign = document.getElementById("form-news-campaign");
    const btnSend = document.getElementById("btn-news-send");
    const sendResult = document.getElementById("news-send-result");
    const emailInput = document.getElementById("news-single-email");
    const btnRefresh = document.getElementById("news-refresh");
    const refreshStatus = document.getElementById("news-refresh-status");
    const filterSel = document.getElementById("admin-news-filter");

    filterSel.addEventListener("change", () => loadAndRender());

    // Abilita/disabilita campo email in base alla scelta
    formCampaign.addEventListener("change", (e) => {
        if (e.target.name === "news-target") {
            const single = formCampaign.querySelector(
                'input[name="news-target"][value="single"]'
            ).checked;
            emailInput.disabled = !single;
            if (!single) emailInput.value = "";
        }
    });

    // Carica e renderizza elenco iscritti
    async function loadAndRender() {
        refreshStatus.textContent = "Caricamento…";
        try {
            const filter = filterSel ? (filterSel.value || "all") : "all";
            const res = await fetch(`/api/admin/newsletter?filter=${filter}`, {
                credentials: "include",
            });
            if (!res.ok) throw new Error("Errore caricamento");
            const rows = await res.json();
            renderNews(Array.isArray(rows) ? rows : []);
            refreshStatus.textContent = "";
        } catch {
            listBox.innerHTML = '<p class="muted">Errore nel caricamento.</p>';
            refreshStatus.textContent = "Errore";
        }
    }

    function renderNews(rows) {
        if (!rows.length) {
            listBox.innerHTML = '<p class="muted">Nessun iscritto.</p>';
            return;
        }

        listBox.innerHTML = rows
            .map(
                (r) => `
      <article class="card" data-news-id="${r.id}">
        <div class="card-body flex-row items-center gap-3">
          <div class="mr-auto">
            <strong>${escapeHtml(r.email)}</strong>
            ${r.first_name || r.last_name
                        ? `<div class="muted">Utente: ${escapeHtml(
                            r.first_name || ""
                        )} ${escapeHtml(r.last_name || "")}</div>`
                        : ""
                    }
            <span class="muted">${r.subscribed_at ? r.subscribed_at.slice(0, 10) : ""
                    }</span>
          </div>
          <label class="flex-row items-center gap-2">
            <input type="checkbox" class="news-toggle" ${r.is_active ? "checked" : ""
                    }/> Attiva
          </label>
          <button class="btn btn-danger news-delete" type="button">Elimina</button>
        </div>
      </article>
    `
            )
            .join("");

        // Toggle attivo/disattivo
        listBox.querySelectorAll(".news-toggle").forEach((chk) => {
            chk.addEventListener("change", async () => {
                const card = chk.closest("[data-news-id]");
                const id = Number(card.dataset.newsId);
                const desired = chk.checked;
                chk.disabled = true;
                try {
                    const resp = await fetch(`/api/admin/newsletter/${id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({ is_active: !!desired }),
                    });
                    if (!resp.ok) {
                        let msg = "Errore durante l'aggiornamento.";
                        try {
                            const j = await resp.json();
                            if (j?.error) msg = j.error;
                        } catch { }
                        throw new Error(msg);
                    }
                } catch (e) {
                    alert(e.message || "Errore durante l'aggiornamento. Riprova.");
                    chk.checked = !desired; // rollback UI
                } finally {
                    chk.disabled = false;
                }
            });
        });

        // Elimina iscrizione
        listBox.querySelectorAll(".news-delete").forEach((btn) => {
            btn.addEventListener("click", async () => {
                const card = btn.closest("[data-news-id]");
                const id = Number(card.dataset.newsId);
                if (!confirm("Eliminare questa iscrizione alla newsletter?")) return;

                btn.disabled = true;
                try {
                    const resp = await fetch(`/api/admin/newsletter/${id}`, {
                        method: "DELETE",
                        credentials: "include",
                    });
                    if (!resp.ok) throw new Error("Eliminazione fallita");
                    // ricarico l’elenco per tenere coerente l’UI
                    await loadAndRender();
                } catch (e) {
                    alert(e.message || "Errore durante l'eliminazione. Riprova.");
                } finally {
                    btn.disabled = false;
                }
            });
        });
    }

    // Invio campagna (tutti o singolo)
    formCampaign.addEventListener("submit", async (e) => {
        e.preventDefault();

        const subject = (
            document.getElementById("news-subject").value || ""
        ).trim();
        const body = (document.getElementById("news-body").value || "").trim();
        const targetSingle = formCampaign.querySelector(
            'input[name="news-target"][value="single"]'
        ).checked;
        const previewEmail = (emailInput.value || "").trim().toLowerCase();

        if (!subject || !body) {
            alert("Compila oggetto e messaggio.");
            return;
        }

        if (targetSingle) {
            const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
            if (!EMAIL_RE.test(previewEmail)) {
                alert("Inserisci un indirizzo email valido.");
                return;
            }
        }

        btnSend.disabled = true;
        sendResult.textContent = "Invio in corso…";

        try {
            const payload = { subject, text: body };
            if (targetSingle) payload.previewEmail = previewEmail;

            const r = await fetch("/api/admin/newsletter/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(payload),
            });

            if (!r.ok) {
                const j = await r.json().catch(() => ({}));
                throw new Error(j.error || "Invio fallito");
            }

            const out = await r.json().catch(() => ({}));
            const sent = Number(out.sent ?? out.recipients ?? 0);

            if (targetSingle) {
                sendResult.textContent =
                    out.mode === "dev"
                        ? `Simulazione inviata a ${previewEmail} (vedi terminale).`
                        : `Email inviata a ${previewEmail}.`;
            } else {
                sendResult.textContent =
                    out.mode === "dev"
                        ? `Simulazione inviata a ${sent} destinatari (vedi terminale).`
                        : `Email inviate a ${sent} destinatari.`;
            }

            // pulizia form
            document.getElementById("news-subject").value = "";
            document.getElementById("news-body").value = "";
            if (targetSingle) emailInput.value = "";
            formCampaign.querySelector(
                'input[name="news-target"][value="all"]'
            ).checked = true;
            emailInput.disabled = true;
        } catch (err) {
            sendResult.textContent = "";
            alert(err.message || "Errore durante l'invio");
        } finally {
            btnSend.disabled = false;
        }
    });

    btnRefresh.addEventListener("click", loadAndRender);

    // primo load
    await loadAndRender();
}
