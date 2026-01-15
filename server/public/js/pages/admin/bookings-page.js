import { escapeHtml } from "../../core/ui.js";

export async function showBookingsAdmin(panel) {
    if (!panel) panel = document.getElementById("admin-panel");
    panel.innerHTML = `
    <h2 class="h4">Prenotazioni</h2>

    <form id="form-bk-filters" class="stack card-box">
      <strong>Filtri</strong>
      <div class="grid-auto-160">
        <label>Stato
          <select name="status">
            <option value="all">Tutti</option>
            <option value="pending">In attesa</option>
            <option value="confirmed">Confermate</option>
            <option value="rejected">Rifiutate</option>
            <option value="cancelled">Annullate</option>
            <option value="finished">Terminate</option>
          </select>
        </label>
        <label>Dal <input type="date" name="date_from"></label>
        <label>Al <input type="date" name="date_to"></label>
        <label>Nr. Ordine <input type="number" name="id" min="1"></label>
        <label>Item ID <input type="number" name="itemId" min="1"></label>
        <label>User ID <input type="number" name="userId" min="1"></label>
        <label>Testo (item/email) <input type="text" name="q" placeholder="castello, mario@..."></label>
      </div>
      <div>
        <button class="btn" type="submit">Applica filtri</button>
      </div>
    </form>

    <div id="bk-list" class="stack mt-3"></div>
  `;

    const form = document.getElementById("form-bk-filters");
    const listBox = document.getElementById("bk-list");

    // Etichette in IT
    const STATUS_LABEL = {
        pending: "In attesa",
        confirmed: "Confermata",
        rejected: "Rifiutata",
        cancelled: "Annullata",
        finished: "Terminata",
    };
    // Azioni API per lo stato di destinazione
    const ACTION_FOR = {
        confirmed: "confirm",
        rejected: "reject",
        cancelled: "cancel",
        finished: "finish",
        // pending: nessuna azione di ritorno
    };

    async function load() {
        const fd = new FormData(form);
        const params = new URLSearchParams();
        for (const [k, v] of fd.entries()) {
            const s = String(v || "").trim();
            if (s) params.set(k, s);
        }
        const url = `/api/bookings/admin/list?${params.toString()}`;
        const r = await fetch(url, { credentials: "include" });
        if (!r.ok) {
            listBox.innerHTML = `<p class="muted">Errore nel caricamento.</p>`;
            return;
        }
        const rows = await r.json();
        render(rows);
    }

    function render(rows) {
        if (!rows.length) {
            listBox.innerHTML = `<p class="muted">Nessun risultato.</p>`;
            return;
        }

        listBox.innerHTML = rows
            .map((b) => {
                const euro = (n) => "€" + Number(n).toFixed(2);
                const price =
                    b.final_price != null
                        ? `<div class="muted">${euro(b.final_price)}</div>`
                        : "";

                const addr = b.shipping_address
                    ? `<div>📍 ${escapeHtml(b.shipping_address)}</div>`
                    : "";
                const started = !!b.is_started;
                const statusIt = STATUS_LABEL[b.status] || b.status;

                // === LOGICA BOTTONE PAGAMENTO CORRETTA ===
                let payAction = "";
                if (
                    b.payment_status === "unpaid" &&
                    b.status !== "cancelled" &&
                    b.status !== "rejected"
                ) {
                    payAction = `<button class="btn btn-success btn-mark-paid">💰 Segna Pagato</button>`;
                } else if (b.payment_status === "paid") {
                    payAction = `<div class="label-paid-success">✅ Pagato</div>`;
                }

                // Opzioni consentite in base alle regole
                /** @type {{v:string,label:string,selected?:boolean,disabled?:boolean}[]} */
                let options = [];
                if (b.status === "pending") {
                    options = [
                        {
                            v: "pending",
                            label: STATUS_LABEL.pending,
                            selected: true,
                            disabled: true,
                        },
                        { v: "confirmed", label: STATUS_LABEL.confirmed },
                        { v: "rejected", label: STATUS_LABEL.rejected },
                    ];
                } else if (b.status === "confirmed") {
                    if (started) {
                        options = [
                            {
                                v: "confirmed",
                                label: STATUS_LABEL.confirmed,
                                selected: true,
                            },
                            { v: "finished", label: STATUS_LABEL.finished },
                        ];
                    } else {
                        options = [
                            {
                                v: "confirmed",
                                label: STATUS_LABEL.confirmed,
                                selected: true,
                            },
                            { v: "cancelled", label: STATUS_LABEL.cancelled },
                        ];
                    }
                } else if (b.status === "rejected") {
                    options = [
                        {
                            v: "rejected",
                            label: STATUS_LABEL.rejected,
                            selected: true,
                            disabled: true,
                        },
                    ];
                } else if (b.status === "cancelled") {
                    options = [
                        {
                            v: "cancelled",
                            label: STATUS_LABEL.cancelled,
                            selected: true,
                            disabled: true,
                        },
                    ];
                } else if (b.status === "finished") {
                    options = [
                        {
                            v: "finished",
                            label: STATUS_LABEL.finished,
                            selected: true,
                            disabled: true,
                        },
                    ];
                }

                const optionsHtml = options
                    .map(
                        (o) =>
                            `<option value="${o.v}" ${o.selected ? "selected" : ""} ${o.disabled ? "disabled" : ""
                            }>${o.label}</option>`
                    )
                    .join("");

                return `
          <article class="card" data-bid="${b.id}">
            <div class="card-body flex-row items-center gap-3 wrap">
              <div class="mr-auto minw-260">
                <div><strong>#${b.id}</strong> • ${escapeHtml(
                    b.item_name
                )}</div>
                ${addr}
                <div class="muted">${b.date_from} → ${b.date_to} • ${escapeHtml(
                    statusIt
                )}</div>
                <div class="muted">${escapeHtml(b.user_email || "")}</div>
                ${price}
                
                <div>
                   <strong>Metodo:</strong> ${b.payment_method} 
                   ${payAction}
                </div>

              </div>
              <label>Stato
                <select class="bk-status" title="Cambia stato prenotazione">
                  ${optionsHtml}
                </select>
              </label>
            </div>
          </article>
        `;
            })
            .join("");

        // Listener per il bottone "Segna Pagato"
        listBox.querySelectorAll(".btn-mark-paid").forEach((btn) => {
            btn.addEventListener("click", async () => {
                const card = btn.closest("[data-bid]");
                const id = Number(card.dataset.bid);

                if (!confirm("Confermi di aver ricevuto il pagamento in contanti?"))
                    return;

                try {
                    btn.disabled = true;
                    const r = await fetch(`/api/bookings/admin/${id}/pay`, {
                        method: "PATCH",
                        credentials: "include",
                    });
                    if (r.ok) {
                        load(); // Ricarica la lista per vedere l'aggiornamento
                    } else {
                        alert("Errore aggiornamento");
                        btn.disabled = false;
                    }
                } catch (e) {
                    alert("Errore di rete");
                    btn.disabled = false;
                }
            });
        });

        // Cambio stato con regole lato client e chiamata API coerente
        listBox.querySelectorAll(".bk-status").forEach((sel) => {
            sel.addEventListener("change", async () => {
                const card = sel.closest("[data-bid]");
                const id = Number(card.dataset.bid);
                const to = sel.value;

                // recupera record per conoscere started/stato corrente
                const dataItem = rows.find((r) => r.id === id);
                const started = !!dataItem?.is_started;
                const current = dataItem?.status;

                // Blocchi UX (rispecchiano le regole server)
                if (
                    current === "pending" &&
                    !["confirmed", "rejected"].includes(to)
                ) {
                    alert(
                        "Da 'In attesa' puoi scegliere solo 'Confermata' o 'Rifiutata'."
                    );
                    sel.value = current;
                    return;
                }
                if (to === "cancelled" && started) {
                    alert(
                        "Non è possibile annullare dopo l’inizio del noleggio. Usa 'Terminata'."
                    );
                    sel.value = current;
                    return;
                }
                if (current === "confirmed" && !started && to === "finished") {
                    alert("Puoi terminare solo dopo l’inizio del noleggio.");
                    sel.value = current;
                    return;
                }
                if (to === "pending") {
                    // non si torna a "In attesa"
                    sel.value = current;
                    return;
                }

                const action = ACTION_FOR[to];
                if (!action) {
                    alert("Stato non gestito.");
                    sel.value = current;
                    return;
                }

                sel.disabled = true;
                try {
                    const r = await fetch(`/api/bookings/admin/${id}/${action}`, {
                        method: "PUT",
                        credentials: "include",
                        headers: { "Content-Type": "application/json" },
                    });
                    if (!r.ok) {
                        let msg = "Errore aggiornamento stato";
                        try {
                            const body = await r.json();
                            if (body?.error === "illegal_transition")
                                msg = "Transizione di stato non consentita.";
                            else if (body?.error === "not_found")
                                msg = "Prenotazione non trovata.";
                            else if (body?.error) msg = body.error;
                        } catch { }
                        throw new Error(msg);
                    }
                    // ricarica con i filtri correnti
                    form.dispatchEvent(
                        new Event("submit", { bubbles: false, cancelable: false })
                    );
                } catch (err) {
                    alert(err.message || "Errore aggiornamento stato");
                    sel.value = current;
                } finally {
                    sel.disabled = false;
                }
            });
        });
    }

    form.addEventListener("submit", (e) => {
        e.preventDefault();
        load();
    });

    await load();
}
