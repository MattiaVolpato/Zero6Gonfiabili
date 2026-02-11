export async function initTesseraPage() {
    const $ = (id) => document.getElementById(id);

    async function fetchJson(url) {
        const res = await fetch(
            `${url}${url.includes("?") ? "&" : "?"}_=${Date.now()}`,
            {
                credentials: "include",
                cache: "no-store",
            }
        );
        if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("application/json")) {
            throw new Error(`${url} → non-JSON (${ct})`);
        }
        return res.json();
    }

    // helper per formattare date brevi
    function fmtDate(d) {
        try {
            return new Date(d).toLocaleDateString();
        } catch {
            return d;
        }
    }

    // calcolo client-side di scadenza se il backend non fornisce is_expired
    function computeExpired(v) {
        if (v?.is_expired != null) return !!v.is_expired;
        if (v?.status && v.status !== "available") return true;
        if (v?.expires_at) {
            const today = new Date();
            const exp = new Date(v.expires_at + "T23:59:59");
            return exp < today;
        }
        return false;
    }

    // 1) Riepilogo tessera (completed/available/progress)
    try {
        const d = await fetchJson("/api/loyalty");

        if ($("loy-completed")) $("loy-completed").textContent = d.completed;
        if ($("loy-available")) $("loy-available").textContent = d.available;

        const step = d.progressInCycle; // 0..1
        const pct = Math.min(100, Math.round((step / 2) * 100)); // 0,50,100
        if ($("loy-progress")) $("loy-progress").style.width = pct + "%";

        if ($("loy-progress-text")) {
            $("loy-progress-text").textContent =
                d.available > 0
                    ? `Hai ${d.available} sconto/i disponibili (10%).`
                    : `${step} / 2 noleggi per il prossimo sconto`;
        }

        if ($("loy-note")) {
            $("loy-note").textContent =
                d.available > 0
                    ? "Usa un codice LCH-… mostrato qui sotto durante il checkout per applicare il 10%."
                    : d.remainingToNext === 1
                        ? "Ti manca 1 noleggio terminato per ottenere uno sconto del 10%."
                        : "Ti mancano 2 noleggi terminati per ottenere uno sconto del 10%.";
        }
    } catch (e) {
        console.error("[TESSERA] /api/loyalty:", e);
        const card = $("loyalty-card");
        if (card)
            card.innerHTML = "<p class='muted'>Impossibile caricare la tessera.</p>";
        return;
    }

    // 2) Sconti ottenuti (elenco buoni LCH: disponibili + scaduti/usati)
    // 2) Sconti ottenuti (elenco buoni LCH: disponibili + usati)
    try {
        const list = $("loy-earned-list");
        const empty = $("loy-earned-empty");
        if (!list && !empty) return;

        const { vouchers } = await fetchJson("/api/loyalty/vouchers");

        if (list) list.innerHTML = "";
        if (!vouchers || vouchers.length === 0) {
            if (empty) empty.style.display = "";
        } else {
            if (empty) empty.style.display = "none";
            if (list) {
                for (const v of vouchers) {
                    // ✅ NUOVO: consideriamo SOLO lo stato "used" per il badge
                    const usato = v.status === "used";
                    const badge = usato
                        ? '<span class="badge bg-secondary">Usato</span>'
                        : '<span class="badge bg-success">Disponibile</span>';

                    // Mostra la data di scadenza solo se è ancora disponibile
                    const expiresStr =
                        !usato && v.expires_at ? ` · Scade: ${fmtDate(v.expires_at)}` : "";

                    // (opzionale) Data di utilizzo se disponibile
                    const usedStr =
                        usato && v.used_at ? ` · Usato il: ${fmtDate(v.used_at)}` : "";

                    const el = document.createElement("div");
                    el.className = "loyalty-card__earned-item";
                    el.innerHTML = `
          <div class="voucher ${usato ? "voucher--used" : ""}">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <div class="voucher__code">${v.code}</div>
                <div class="voucher__meta">
                  Sconto ${v.discount_percent}% · creato il ${fmtDate(
                        v.created_at
                    )}${expiresStr}${usedStr}
                </div>
              </div>
              <div class="voucher__status">
                ${badge}
              </div>
            </div>
          </div>`;
                    list.appendChild(el);
                }
            }
        }
    } catch (e) {
        console.error("[TESSERA] /api/loyalty/vouchers:", e);
        const empty = document.getElementById("loy-earned-empty");
        if (empty) {
            empty.textContent =
                "Non riesco a caricare gli sconti ottenuti al momento.";
            empty.style.display = "";
        }
    }
}