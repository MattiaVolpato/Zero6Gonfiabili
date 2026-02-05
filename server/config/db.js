// server/config/db.js
import fs from "node:fs";
import path from "node:path";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

// ---------- Percorso e cartella DB ----------
const DB_DIR = path.resolve("./server/db");
const DB_FILE = path.join(DB_DIR, "app.sqlite");

// Crea cartella se non esiste (utile su Windows)
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// ---------- Singleton anche con hot-reload ----------
const globalKey = "__APP_SQLITE_DB_PROMISE__";

/**
 * Apre (una sola volta) il DB con PRAGMA corretti.
 * - WAL per ridurre i lock
 * - synchronous NORMAL per performance bilanciate
 * - busy_timeout 5000ms per evitare SQLITE_BUSY nei picchi
 * - foreign_keys ON per integrità referenziale
 */
async function createAndConfigureDb() {
  const db = await open({
    filename: DB_FILE,
    driver: sqlite3.Database,
  });

  // PRAGMA iniziali
  await db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
    PRAGMA temp_store = MEMORY;
  `);

  // Timeout lato API + lato PRAGMA
  db.configure?.("busyTimeout", 5000);
  await db.exec("PRAGMA busy_timeout = 5000;");

  await runSoftMigrations(db);

  return db;
}

/*Migrazioni "soft" idempotenti
crea automaticamente la tabella email_reminders se non esiste.
È una "rete di sicurezza" per assicurarsi che il database abbia 
la struttura minima necessaria appena il server parte. */
async function runSoftMigrations(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS email_reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reminder_type TEXT NOT NULL,   -- 'birthday-1m'
      user_id INTEGER NOT NULL,
      child_id INTEGER NOT NULL,
      target_date TEXT NOT NULL,     -- YYYY-MM-DD del compleanno in quell'anno
      sent_at TEXT NOT NULL,
      UNIQUE(reminder_type, child_id, target_date)
    );
  `);
}

/*Controlla se esiste già una promessa di connessione nell'oggetto globale. 
Se esiste, la riusa; se non esiste, chiama createAndConfigureDb() e la salva.
In questo modo la connessione "sopravvive" al riavvio del modulo.*/
const dbPromise =
  globalThis[globalKey] || (globalThis[globalKey] = createAndConfigureDb());

// ---------- Esportazioni ----------
/**
 * default export: istanza risolta di Database (con top-level await)
 * Uso: `import db from "...";`  -> db è già pronto
 */
const db = await dbPromise;
export default db;

/** named export (compat) */
export { db };

/** compat legacy per codice che chiama getDB() */
export function getDB() {
  return db;
}
