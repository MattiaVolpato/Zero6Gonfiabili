import { getDB } from "../config/db.js";

function parseArgs() {
  const [, , cmd, ...rest] = process.argv;
  const args = {};
  for (let i = 0; i < rest.length; i += 2) {
    const k = rest[i];
    const v = rest[i + 1];
    if (!k?.startsWith("--")) continue;
    args[k.slice(2)] = v;
  }
  return { cmd, args };
}

function normalizeEmail(e) {
  return (e ?? "").toString().trim().toLowerCase();
}

async function main() {
  const { cmd, args } = parseArgs();
  const db = await getDB();

  try {
    if (cmd === "list") {
      const rows = await db.all(
        `SELECT id, email, is_active, subscribed_at, unsubscribed_at
         FROM newsletter_subscriptions
         ORDER BY id ASC`
      );
      console.table(rows);
      return;
    }

    if (cmd === "delete" && args.email) {
      const email = normalizeEmail(args.email);
      const res = await db.run(
        `DELETE FROM newsletter_subscriptions
         WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) COLLATE NOCASE`,
        email
      );
      console.log(`Delete by email "${email}": affected rows = ${res.changes}`);
      return;
    }

    if (cmd === "delete" && args.id) {
      const id = Number(args.id);
      if (!Number.isInteger(id)) {
        console.error("Errore: --id deve essere un intero");
        process.exit(1);
      }
      const res = await db.run(
        `DELETE FROM newsletter_subscriptions WHERE id = ?`,
        id
      );
      console.log(`Delete by id ${id}: affected rows = ${res.changes}`);
      return;
    }

    if (cmd === "purge") {
      const res = await db.run(`DELETE FROM newsletter_subscriptions`);
      console.log(`Purge ALL: affected rows = ${res.changes}`);
      return;
    }

    if (cmd === "purge-inactive") {
      const res = await db.run(
        `DELETE FROM newsletter_subscriptions WHERE is_active = 0`
      );
      console.log(`Purge inactive: affected rows = ${res.changes}`);
      return;
    }

    console.log(`
Uso:
  node server/scripts/manage-newsletter.js list
  node server/scripts/manage-newsletter.js delete --email some@mail.com
  node server/scripts/manage-newsletter.js delete --id 12
  node server/scripts/manage-newsletter.js purge
  node server/scripts/manage-newsletter.js purge-inactive
`);
  } finally {
    await db.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
