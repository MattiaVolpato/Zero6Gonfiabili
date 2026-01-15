import { auth } from "../state/auth-state.js";
import { requireLogin } from "../core/guards.js";
import { escapeHtml } from "../core/ui.js";

async function apiItemsAll() {
    const r = await fetch("/api/items", { credentials: "include" });
    if (!r.ok) throw new Error("Errore caricamento items");
    return r.json();
}
async function apiBookingsMine() {
    const r = await fetch("/api/bookings/mine", { credentials: "include" });
    if (!r.ok) throw new Error("Errore caricamento prenotazioni");
    return r.json();
}

async function apiBookingsCreate(payload) {
    const r = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error || "Errore creazione prenotazione");
    }
    return r.json();
}


function renderBookings(rows) {
    const box = document.getElementById("my-bookings");
    if (!box) return;
    if (!rows?.length) {
        box.innerHTML = '<p class="muted">Nessuna prenotazione.</p>';
        return;
    }
    const euro = (n) => "€" + Number(n).toFixed(2);

    box.innerHTML = rows
        .map((b) => {
            const cp = b.coupon_code
                ? ` • coupon: ${escapeHtml(b.coupon_code)}${b.discount_percent ? " (" + b.discount_percent + "%)" : ""
                }`
                : "";
            const price =
                b.final_price != null ? ` • totale: ${euro(b.final_price)}` : "";

            const addr = b.shipping_address
                ? `<br><small class="muted">📍 ${escapeHtml(
                    b.shipping_address
                )}</small>`
                : "";

            // --- LOGICA PAGAMENTO (Senza CSS inline) ---
            const isPaid = b.payment_status === "paid";

            // Determina la classe del badge (verde o rosso) definita nel CSS
            const badgeClass = isPaid
                ? "z6-badge z6-badge--success"
                : "z6-badge z6-badge--danger";

            const badgeText = isPaid ? "Pagato" : "Da pagare";

            // Traduzione metodo
            let methodLabel = "—";
            if (b.payment_method === "credit_card") methodLabel = "Carta di Credito";
            else if (b.payment_method === "paypal") methodLabel = "PayPal";
            else if (b.payment_method === "cash") methodLabel = "Contanti";

            // Costruzione HTML pagamento
            const paymentHtml = `
        <div class="booking-payment-info">
          <span class="${badgeClass}">${badgeText}</span>
          <span class="muted">(${methodLabel})</span>
        </div>`;
            // -------------------------------------------

            // Etichetta stato “umana” fornita dall’API (fallback su b.status)
            const statoVisibile = (b.status_label || b.status || "").toString();

            // Può annullare solo se il noleggio non è terminato e non è già rifiutato o annullato
            const canCancel =
                b.status !== "finished" &&
                b.status !== "cancelled" &&
                b.status !== "rejected" &&
                !b.is_finished;

            // Pill di stato
            const pillClass =
                statoVisibile === "confermato"
                    ? "badge badge-success"
                    : statoVisibile === "in attesa"
                        ? "badge badge-warning"
                        : statoVisibile === "terminato"
                            ? "badge badge-muted"
                            : statoVisibile === "rifiutato"
                                ? "badge badge-danger"
                                : statoVisibile === "annullato"
                                    ? "badge badge-muted"
                                    : "badge";
            const statoHtml = `<span class="${pillClass}">${statoVisibile}</span>`;

            const cancelBtn = canCancel
                ? `<button class="btn btn-danger btn-cancel" data-id="${b.id}">Annulla</button>`
                : "";

            return `
      <article class="card">
       <div class="card-body flex-row items-center gap-2">
           <div class="mr-auto">
            #${b.id} ${escapeHtml(b.item_name)} • ${b.date_from} → ${b.date_to
                } • ${statoHtml}${cp}${price}${addr}
            ${paymentHtml} </div>
          ${cancelBtn}
        </div>
      </article>`;
        })
        .join("");

    // bind pulsanti "Annulla"
    box.querySelectorAll(".btn-cancel").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const id = Number(btn.getAttribute("data-id"));
            if (!confirm("Vuoi annullare questa prenotazione?")) return;
            try {
                btn.disabled = true;
                const r = await fetch(`/api/bookings/${id}`, {
                    method: "DELETE",
                    credentials: "include",
                });
                if (r.status === 404) {
                    alert("Prenotazione non trovata");
                    return;
                }
                if (!r.ok && r.status !== 204) {
                    const msg = await r.text().catch(() => "");
                    alert("Errore annullamento" + (msg ? ": " + msg : ""));
                    return;
                }
                const mine = await apiBookingsMine();
                renderBookings(mine);
            } catch (e) {
                alert("Errore di rete");
            } finally {
                btn.disabled = false;
            }
        });
    });
}


export async function initPrenotazioniPage() {
    if (!(await requireLogin())) return;

    const select = document.getElementById("booking-item");
    const listBox = document.getElementById("my-bookings");
    const form = document.getElementById("form-booking");

    // --- coupon state ---
    const couponInput = document.getElementById("booking-coupon");
    const couponBtn = document.getElementById("btn-booking-coupon-confirm");
    const couponResult = document.getElementById("booking-coupon-result");
    let confirmedCoupon = null;

    const quoteBox = document.getElementById("booking-quote");

    // --- blocco date nel passato + coerenza from/to ---
    const inputFrom = form?.querySelector('input[name="date_from"]');
    const inputTo = form?.querySelector('input[name="date_to"]');

    const ISO = /^\d{4}-\d{2}-\d{2}$/;
    const getTodayStr = () => new Date().toISOString().slice(0, 10);

    if (inputFrom && inputTo) {
        const todayStr = getTodayStr();

        // Imposta min iniziale
        inputFrom.min = todayStr;
        inputTo.min = todayStr;

        // Se cambia la from, forza la to a non essere precedente
        inputFrom.addEventListener("change", () => {
            if (!inputFrom.value) return;
            inputTo.min = inputFrom.value;
            if (inputTo.value && inputTo.value < inputFrom.value) {
                inputTo.value = inputFrom.value;
            }
            refreshQuote();
        });

        inputTo.addEventListener("change", () => {
            refreshQuote();
        });
    }

    function setCouponUIApplied(coupon) {
        // blocca solo il bottone e mostra "Confermato ✓"
        couponBtn?.setAttribute("disabled", "disabled");
        couponBtn.textContent = "Confermato ✓";
        confirmedCoupon = coupon?.code || coupon || null;
    }

    function resetCouponUI() {
        // Riabilita il bottone e azzera lo stato
        if (couponBtn) {
            couponBtn.removeAttribute("disabled");
            couponBtn.textContent = "Conferma codice";
        }

        // Pulisce i messaggi e lo stato coupon
        confirmedCoupon = null;
        if (couponResult) couponResult.textContent = "";
    }

    function renderBookingCouponResult(data) {
        if (!couponResult) return;
        if (!data) {
            couponResult.textContent = "";
            confirmedCoupon = null;
            return;
        }
        if (!data.valid) {
            const reasons = {
                not_found: "Codice non trovato",
                inactive: "Codice inattivo",
                expired: "Codice scaduto",
                not_started: "Non ancora attivo",
            };
            couponResult.textContent = reasons[data.reason] || "Codice non valido";
            confirmedCoupon = null;
            return;
        }
        // OK: mostro il coupon (sia classico che LCH-…)
        const pct = data.coupon.discount_percent;
        couponResult.textContent = `Coupon valido: ${data.coupon.code} (${pct}%)`;
        setCouponUIApplied(data.coupon);
    }

    async function loadBookingAddresses() {
        const addressSelect = document.getElementById("booking-address");
        // Se non c'è la tendina (magari siamo in un'altra pagina), esci
        if (!addressSelect) return;

        try {
            // Chiama la tua API
            const res = await fetch("/api/addresses");

            if (res.ok) {
                const addresses = await res.json();

                // Pulisci e metti l'opzione di default
                addressSelect.innerHTML =
                    '<option value="">-- Seleziona Indirizzo --</option>';

                if (addresses.length === 0) {
                    addressSelect.innerHTML +=
                        '<option value="" disabled>Nessun indirizzo salvato (vai al profilo)</option>';
                } else {
                    // Genera le opzioni per ogni indirizzo
                    addresses.forEach((addr) => {
                        const label = addr.label ? `[${addr.label}] ` : "";
                        const text = `${label}${addr.address}, ${addr.city} (${addr.cap})`;

                        const opt = document.createElement("option");
                        opt.value = addr.id; // L'ID che serve al backend
                        opt.textContent = text;
                        addressSelect.appendChild(opt);
                    });
                }
            } else {
                console.error("Errore server:", await res.text());
                addressSelect.innerHTML =
                    '<option value="">Errore nel caricamento</option>';
            }
        } catch (e) {
            console.error("Errore fetch indirizzi:", e);
            addressSelect.innerHTML =
                '<option value="">Errore di connessione</option>';
        }
    }

    // --- preventivo con validazioni data ---
    async function refreshQuote() {
        if (!form || !select || !quoteBox) return;

        const itemId = Number(select.value || 0);
        const df = form.querySelector('input[name="date_from"]')?.value || "";
        const dt = form.querySelector('input[name="date_to"]')?.value || "";

        const todayStr = getTodayStr();

        // Reset se mancano i dati minimi
        if (!itemId || !ISO.test(df) || !ISO.test(dt)) {
            quoteBox.textContent = "";
            return;
        }

        // Regole: no passato, dt >= df
        if (df < todayStr || dt < todayStr) {
            quoteBox.textContent = "Le date non possono essere nel passato.";
            return;
        }
        if (dt < df) {
            quoteBox.textContent =
                "La data di fine non può essere precedente alla data di inizio.";
            return;
        }

        try {
            const qs = new URLSearchParams({
                itemId: String(itemId),
                date_from: df,
                date_to: dt,
                couponCode: confirmedCoupon || "",
            }).toString();

            const r = await fetch(`/api/pricing/quote?${qs}`, {
                credentials: "include",
            });
            if (!r.ok) {
                quoteBox.textContent = "";
                return;
            }

            const q = await r.json();
            if (q.discount_percent > 0) {
                quoteBox.textContent =
                    `Preventivo: ${q.days} giorni × €${q.unit_price.toFixed(
                        2
                    )} = €${q.subtotal.toFixed(2)} • ` +
                    `sconto ${q.discount_percent}% (−€${q.discount_amount.toFixed(
                        2
                    )}) → TOTALE €${q.total.toFixed(2)}`;
            } else {
                quoteBox.textContent =
                    `Preventivo: ${q.days} giorni × €${q.unit_price.toFixed(2)} = ` +
                    `TOTALE €${q.subtotal.toFixed(2)}`;
            }
        } catch {
            quoteBox.textContent = "";
        }
    }

    // click "Conferma codice"
    couponBtn?.addEventListener("click", async () => {
        if (confirmedCoupon) {
            couponResult.textContent = "Puoi usare un solo buono per prenotazione.";
            return;
        }

        const code = (couponInput.value || "").trim();
        if (!code) {
            couponResult.textContent = "Inserisci un codice prima di confermare.";
            return;
        }

        try {
            const r = await fetch(`/api/coupons/${encodeURIComponent(code)}`, {
                credentials: "include",
            });

            if (!r.ok) {
                // codice non trovato
                couponResult.textContent = "Codice non trovato.";
                return;
            }

            const data = await r.json();

            if (!data.valid) {
                // codice invalido o scaduto
                couponResult.textContent = "Codice non valido o scaduto.";
                return;
            }

            // codice valido → mostro risultato e disabilito bottone
            const pct = data.coupon.discount_percent;
            couponResult.textContent = `Coupon valido: ${data.coupon.code} (${pct}%)`;
            setCouponUIApplied(data.coupon);
            await refreshQuote();
        } catch (err) {
            console.error(err);
            couponResult.textContent = "Errore nella verifica del codice.";
        }
    });

    couponInput?.addEventListener("input", () => {
        const val = couponInput.value.trim();

        // Se era confermato e l'utente cambia/cancella il valore → reset + aggiorna preventivo
        if (confirmedCoupon && val !== confirmedCoupon) {
            confirmedCoupon = null;
            couponBtn.disabled = false;
            couponBtn.textContent = "Conferma codice";
            if (couponResult) couponResult.textContent = "";
            refreshQuote(); // ritorna al totale senza sconto
            return;
        }

        // Se il campo è stato svuotato → reset + aggiorna preventivo
        if (!val) {
            confirmedCoupon = null;
            if (couponBtn.disabled) {
                couponBtn.disabled = false;
                couponBtn.textContent = "Conferma codice";
            }
            if (couponResult) couponResult.textContent = "";
            refreshQuote(); // totale senza sconto
            return;
        }

        // Se non c'è coupon confermato ma il bottone è disabilitato → riattivalo
        if (!confirmedCoupon && couponBtn.disabled) {
            couponBtn.disabled = false;
            couponBtn.textContent = "Conferma codice";
        }
    });

    await loadBookingAddresses();

    // carica items + pre-selezione da ?itemId=...
    try {
        const items = await apiItemsAll();

        if (select) {
            // costruisci le option
            select.innerHTML = items
                .map((it) => `<option value="${it.id}">${it.name}</option>`)
                .join("");

            // leggi itemId dall'URL (es. /prenotazioni?itemId=123)
            let preId = null;
            try {
                const url = new URL(location.href);
                preId = url.searchParams.get("itemId");
            } catch {
                /* no-op */
            }

            if (preId) {
                // normalizza a stringa per confronto safe
                const strId = String(preId);
                const has = Array.from(select.options).some(
                    (o) => String(o.value) === strId
                );
                if (has) {
                    select.value = strId;

                    // notifica eventuali listener 'change' già esistenti
                    select.dispatchEvent(new Event("change", { bubbles: true }));

                    // se hai una funzione di aggiornamento preventivo/price, chiamala
                    if (typeof refreshQuote === "function") {
                        try {
                            await refreshQuote();
                        } catch { }
                    }
                }
            }
        }
    } catch (e) {
        console.error(e);
    }

    // carica prenotazioni
    try {
        renderBookings(await apiBookingsMine());
    } catch (e) {
        console.error(e);
        listBox.innerHTML =
            '<p class="muted">Errore nel caricamento prenotazioni.</p>';
    }

    // aggiorna quote su cambi data/item
    select?.addEventListener("change", refreshQuote);

    // prima valutazione (non mostra nulla se mancano date)
    await refreshQuote();

    // submit prenotazione (include coupon confermato)
    form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(form);

        // Verifica che paymentMethod sia preso correttamente
        const payMethod = fd.get("paymentMethod");
        const payload = {
            itemId: Number(fd.get("itemId")),
            date_from: fd.get("date_from"),
            date_to: fd.get("date_to"),
            couponCode: confirmedCoupon || null,
            addressId: fd.get("addressId"),
            paymentMethod: payMethod,
        };

        //Validazione
        if (!payload.addressId) {
            alert("Seleziona un indirizzo di spedizione.");
            return;
        }

        if (!payload.paymentMethod) {
            alert("Seleziona un metodo di pagamento."); // Blocca prima di chiamare il server
            return;
        }

        // piccola validazione client prima della chiamata
        if (!ISO.test(payload.date_from) || !ISO.test(payload.date_to)) {
            alert("Formato date non valido.");
            return;
        }
        const todayStr = getTodayStr();
        if (payload.date_from < todayStr || payload.date_to < todayStr) {
            alert("Le date non possono essere nel passato.");
            return;
        }
        if (payload.date_to < payload.date_from) {
            alert("La data di fine non può essere precedente alla data di inizio.");
            return;
        }

        try {
            // crea la prenotazione e ottieni la risposta dal backend
            const created = await apiBookingsCreate(payload);

            // reset campi form
            form.querySelector('input[name="date_from"]').value = "";
            form.querySelector('input[name="date_to"]').value = "";
            couponInput.value = "";
            resetCouponUI(); // riabilita input/bottone e pulisce stato
            await refreshQuote();

            // aggiorna lista prenotazioni
            renderBookings(await apiBookingsMine());

            // (opzionale) aggiorna badge "Tessera" nel menu se presente
            if (document.getElementById("loy-badge")) {
                try {
                    const r = await fetch("/api/loyalty", { credentials: "include" });
                    if (r.ok) {
                        const d = await r.json();
                        const b = document.getElementById("loy-badge");
                        if (d.available > 0) {
                            b.textContent = d.available;
                            b.style.display = "inline-block";
                        } else {
                            b.style.display = "none";
                        }
                    }
                } catch (_) { }
            }

            // messaggistica: priorità alla Tessera, poi ad eventuale sconto coupon
            if (created?.appliedLoyalty) {
                alert("Prenotazione creata! 🎉 Tessera: sconto 10% applicato.");
            } else if (
                typeof created?.discount_percent === "number" &&
                created.discount_percent > 0
            ) {
                alert(
                    `Prenotazione creata! Sconto applicato: ${created.discount_percent}%`
                );
            } else {
                alert("Prenotazione creata!");
            }
        } catch (err) {
            alert(err?.message || "Errore durante la creazione della prenotazione");
        }
    });
}