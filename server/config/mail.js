// server/config/mail.js

const {
  SMTP_HOST = "",
  SMTP_PORT = "587",
  SMTP_USER = "",
  SMTP_PASS = "",
  MAIL_FROM = "Zero6 Gonfiabili <noreply@zero6-gonfiabili.local>",
} = process.env;

let transporter = null;

export async function getMailer() {
  if (transporter) return transporter;

  // DEV: niente SMTP → no import di nodemailer, solo log in console
  if (!SMTP_HOST) {
    // Modalità sviluppo: non invia davvero le mail
    transporter = {
      async sendMail(opts) {
        const mailPreview = {
          to: opts.to,
          subject: opts.subject,
          text: opts.text,
          //html: ,
        };

        console.log("[MAIL-DEV] Simulazione invio mail:");
        console.log(JSON.stringify(mailPreview, null, 2)); // stampa ordinata

        return { messageId: "dev-" + Date.now() };
      },
    };

    return transporter;
  }

  // REAL: import dinamico di nodemailer solo se serve davvero
  const nodemailer = (await import("nodemailer")).default;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
  return transporter;
}

export const MAIL_FROM_ADDR = MAIL_FROM;
