
import fs from "fs";
import path from "path";
import { getDB } from "../config/db.js";

async function generateDump() {
    const db = await getDB();
    const dumpFile = path.resolve("dump.sql");
    const stream = fs.createWriteStream(dumpFile, { flags: "w" });

    console.log("Generazione dump in corso...");

    stream.write("-- SQLite Dump generato automaticamente\n");
    stream.write(`-- Data: ${new Date().toISOString()}\n\n`);

    stream.write("PRAGMA foreign_keys=OFF;\n");
    stream.write("BEGIN TRANSACTION;\n\n");

    try {
        // 1. Ottieni la lista delle tabelle
        const tables = await db.all(
            "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        );

        for (const table of tables) {
            console.log(`Esportazione tabella: ${table.name}`);

            // Scrivi lo schema (CREATE TABLE)
            // Aggiungiamo IF NOT EXISTS per sicurezza
            const createSql = table.sql.replace("CREATE TABLE", "CREATE TABLE IF NOT EXISTS");
            stream.write(`-- Tabella: ${table.name}\n`);
            stream.write(`DROP TABLE IF EXISTS ${table.name};\n`);
            stream.write(`${createSql};\n`);

            // 2. Ottieni i dati
            const rows = await db.all(`SELECT * FROM ${table.name}`);

            if (rows.length > 0) {
                stream.write(`\n-- Dati per: ${table.name}\n`);

                for (const row of rows) {
                    const keys = Object.keys(row).join(", ");
                    const values = Object.values(row).map(val => {
                        if (val === null) return "NULL";
                        if (typeof val === "number") return val;
                        // Escape delle stringhe: sostituisce ' con ''
                        return `'${String(val).replace(/'/g, "''")}'`;
                    }).join(", ");

                    stream.write(`INSERT INTO ${table.name} (${keys}) VALUES (${values});\n`);
                }
            }
            stream.write("\n");
        }

        stream.write("COMMIT;\n");
        console.log(`\n✅ Dump salvato con successo in: ${dumpFile}`);
    } catch (err) {
        console.error("Errore durante il dump:", err);
        stream.write("ROLLBACK;\n");
    } finally {
        stream.end();
    }
}

generateDump();
