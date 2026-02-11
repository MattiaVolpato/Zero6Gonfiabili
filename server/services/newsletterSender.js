// server/services/newsletterSender.js
import NewsletterDAO from "../dao/NewsletterDAO.js";
import { getMailer, MAIL_FROM_ADDR } from "../config/mail.js";

// Converte HTML in testo semplice decente (e normalizza spazi)
function toPlainText(htmlOrText) {
  if (!htmlOrText) return "";
  const looksHtml = /<\/?[a-z][\s\S]*>/i.test(htmlOrText);
  if (!looksHtml) return htmlOrText.replace(/\s+/g, " ").trim();

  return htmlOrText
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Invia una campagna newsletter.
 * In DEV: stampa in console (tramite mailer “finto”).
 * @param {{subject:string, html?:string, text?:string, previewEmail?:string|null}} payload
 * @returns {{mode:"dev"|"real", total:number, sent:number, errors:number}}
 */
export async function sendNewsletterCampaign(payload) {
  const subject = (payload.subject || "").trim();
  const html = (payload.html || "").trim();
  let text = (payload.text || "").trim();

  if (!subject || (!html && !text)) {
    throw new Error("Subject e contenuto (HTML o testo) sono obbligatori.");
  }

  if (!text && html) {
    text = toPlainText(html);
  }

  const mailer = await getMailer();
  const mode = process.env.SMTP_HOST ? "real" : "dev";

  // === Invio singolo (previewEmail) ===
  const previewEmail = (payload.previewEmail || "").trim().toLowerCase();
  if (previewEmail) {
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
    if (!EMAIL_RE.test(previewEmail)) {
      throw new Error("Indirizzo email non valido.");
    }

    // invia solo se l’indirizzo è iscritto e attivo
    const isActive = await NewsletterDAO.isActiveByEmail(previewEmail);
    if (!isActive) {
      throw new Error(
        "L'indirizzo specificato non risulta iscritto/attivo alla newsletter."
      );
    }

    await mailer.sendMail({
      from: MAIL_FROM_ADDR,
      to: previewEmail,
      subject,
      text,
      html,
    });

    if (process.env.NODE_ENV !== "production") {
      console.log(`[newsletter] Invio singolo effettuato a ${previewEmail}`);
    }
    return { mode, total: 1, sent: 1, errors: 0 };
  }

  // === Invio massivo (tutti gli iscritti attivi) ===
  const emails = await NewsletterDAO.listActiveEmails();
  const total = emails.length;
  if (total === 0) return { mode, total: 0, sent: 0, errors: 0 };

  let sent = 0;
  let errors = 0;
  const BATCH = Number(process.env.NEWSLETTER_BATCH_SIZE || 50);
  const PAUSE_MS = Number(process.env.NEWSLETTER_PAUSE_MS || 200);

  for (let i = 0; i < emails.length; i += BATCH) {
    const slice = emails.slice(i, i + BATCH);

    await Promise.all(
      slice.map(async (to) => {
        try {
          await mailer.sendMail({
            from: MAIL_FROM_ADDR,
            to,
            subject,
            text,
            html,
          });
          sent++;
        } catch (err) {
          errors++;
          if (process.env.NODE_ENV !== "production") {
            console.error(
              `[newsletter] errore invio a ${to}:`,
              err?.message || err
            );
          }
        }
      })
    );

    if (i + BATCH < emails.length) {
      await new Promise((r) => setTimeout(r, PAUSE_MS));
    }
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[newsletter] invio completato: ${sent}/${total} (errori: ${errors})`
    );
  }
  return { mode, total, sent, errors };
}
