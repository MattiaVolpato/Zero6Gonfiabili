// server/services/birthdayReminder.js
import db from "../config/db.js";
import { getMailer, MAIL_FROM_ADDR } from "../config/mail.js";

/* ---------- Date helpers (Europe/Rome) ---------- */
function todayRome() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()); // YYYY-MM-DD
}

function nextBirthdayFor(ymd) {
  const [, m, d] = ymd.split("-").map(Number);
  const today = todayRome(); // YYYY-MM-DD
  const y = Number(today.slice(0, 4));
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");

  const thisYear = `${y}-${mm}-${dd}`;
  return thisYear >= today ? thisYear : `${y + 1}-${mm}-${dd}`;
}

/** Sottrae N mesi di calendario, clampando al last-day del mese risultante. */
function minusMonths(ymd, months) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, 1));
  dt.setUTCMonth(dt.getUTCMonth() - months);

  // ultimo giorno del mese ottenuto (gestisce 31->30/28-29 ecc.)
  const lastDay = new Date(
    Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)
  ).getUTCDate();
  const day = Math.min(d, lastDay);
  dt.setUTCDate(day);

  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/* ---------- Mail helper ---------- */
function buildBaseUrl() {
  // APP_HOST può essere "localhost:3000" oppure già con protocollo
  const host = (process.env.APP_HOST || "localhost:3000").trim();
  const hasProtocol = /^https?:\/\//i.test(host);
  if (hasProtocol) return host;
  const isProd = process.env.NODE_ENV === "production";
  return (isProd ? "https://" : "http://") + host;
}

async function sendReminderMail({ to, userName, childName, birthdayYmd }) {
  const mailer = await getMailer();
  const subject = `Manca 1 mese al compleanno di ${childName}! 🎈`;
  const base = buildBaseUrl();

  const text = `Ciao ${
    userName || ""
  }, tra un mese è il compleanno di ${childName} (${birthdayYmd}).
Prenota subito un gonfiabile: ${base}/gonfiabili —
Zero6 Gonfiabili`;

  // HTML senza alcun style inline
  const html = `
  <div>
    <p>Ciao ${userName || ""},</p>
    <p>Tra un mese è il compleanno di <strong>${childName}</strong> (${birthdayYmd}).</p>
    <p>
      Prenota subito un gonfiabile dal nostro
      <a href="${base}/gonfiabili">catalogo online</a> 🎉
    </p>
    <p>— Zero6 Gonfiabili</p>
  </div>`;

  await mailer.sendMail({ from: MAIL_FROM_ADDR, to, subject, text, html });
}

/* ---------- Job singolo ---------- */
export async function runBirthdayReminderOnce() {
  const today = todayRome();

  if (process.env.NODE_ENV !== "production") {
    console.log(`[birthday-reminder] oggi (Europe/Rome): ${today}`);
  }

  const rows = await db.all(`
    SELECT c.id AS child_id, c.name AS child_name, c.birthday,
           u.id AS user_id, u.email AS user_email, u.first_name
      FROM children c
      JOIN users u ON u.id = c.user_id
  `);

  for (const r of rows) {
    try {
      if (!r.birthday || !r.user_email) continue;

      const nextBday = nextBirthdayFor(r.birthday);
      // Calcola la data di invio promemoria: 1 mese prima del compleanno
      // (usa mesi di calendario, non 30 giorni)
      const remindOn = minusMonths(nextBday, 1);

      // log di debug (dev) per capire perché viene/ non viene inviato
      if (process.env.NODE_ENV !== "production") {
        console.log(
          `[birthday-reminder][debug] child=${r.child_name} nextBday=${nextBday} remindOn=${remindOn} today=${today}`
        );
      }

      if (remindOn !== today) continue;

      // evita doppi invii per stesso bambino/anno
      const dup = await db.get(
        `SELECT id FROM email_reminders
         WHERE reminder_type='birthday-1m' AND child_id=? AND target_date=?`,
        r.child_id,
        nextBday
      );
      if (dup) continue;

      await sendReminderMail({
        to: r.user_email,
        userName: r.first_name || "",
        childName: r.child_name,
        birthdayYmd: nextBday,
      });

      await db.run(
        `INSERT INTO email_reminders (reminder_type,user_id,child_id,target_date,sent_at)
         VALUES ('birthday-1m', ?, ?, ?, datetime('now'))`,
        r.user_id,
        r.child_id,
        nextBday
      );

      console.log(
        `[birthday-reminder] inviato a ${r.user_email} (${r.child_name}) • compleanno ${nextBday}`
      );
    } catch (err) {
      console.error(
        `[birthday-reminder] errore invio a ${r?.user_email || "?"} (${
          r?.child_name || "?"
        }):`,
        err.message || err
      );
    }
  }
}

/* ---------- Scheduler giornaliero alle 09:00 Europe/Rome ---------- */
export function startBirthdayReminderScheduler() {
  const tz = "Europe/Rome";

  // ora Roma
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .formatToParts(new Date())
    .reduce((a, p) => ((a[p.type] = p.value), a), {});

  // costruiamo un "ora Roma" e calcoliamo il delta al prossimo 09:00
  const nowRome = new Date(
    `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`
  );
  const realNow = new Date(); // orario reale macchina
  const romeOffset = realNow.getTime() - nowRome.getTime(); // correzione

  const targetRome = new Date(nowRome);
  targetRome.setUTCHours(9, 0, 0, 0); // 09:00 Roma
  if (nowRome >= targetRome) targetRome.setUTCDate(targetRome.getUTCDate() + 1);

  const msUntilFirst = targetRome - nowRome + romeOffset;

  setTimeout(async () => {
    await runBirthdayReminderOnce();
    setInterval(runBirthdayReminderOnce, 24 * 60 * 60 * 1000);
  }, Math.max(1000, msUntilFirst));

  // --- opzionale: poll più frequente in DEV se definito
  const devPoll = Number(process.env.DEV_POLL_INTERVAL_MS || 0);
  if (process.env.NODE_ENV !== "production" && devPoll >= 10000) {
    const t = setInterval(() => {
      runBirthdayReminderOnce().catch(() => {});
    }, devPoll);
    t.unref?.();
    console.log(`[birthday-reminder] DEV poll attivo ogni ${devPoll}ms`);
  }
}
