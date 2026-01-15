import { getDB } from "../config/db.js";

const db = await getDB();

console.log("Creating posts table...");
await db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    image_url TEXT,
    author TEXT DEFAULT 'Admin',
    is_published INTEGER NOT NULL DEFAULT 1 CHECK(is_published IN (0,1)),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  
  -- Seed data if empty
  INSERT INTO posts (title, content, image_url, author)
  SELECT 'Benvenuti nel nostro Blog!', 'Questo è il primo articolo del blog di Zero6 Gonfiabili. Qui troverete novità, offerte e consigli per le vostre feste.', '/img/hero.jpg', 'Admin'
  WHERE NOT EXISTS (SELECT 1 FROM posts);
`);

console.log("✅ Table 'posts' created/verified.");
await db.close();
