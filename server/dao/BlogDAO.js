import db from "../config/db.js";

export default class BlogDAO {
    // Public: Get all published posts
    static async listPublished() {
        const rows = await db.all(
            "SELECT * FROM posts WHERE is_published = 1 ORDER BY created_at DESC"
        );
        return rows;
    }

    // Public: Get single published post
    static async getById(id) {
        const row = await db.get("SELECT * FROM posts WHERE id = ?", [id]);
        return row;
    }

    // Admin: List all (published and unpublished)
    static async listAll() {
        return await db.all("SELECT * FROM posts ORDER BY created_at DESC");
    }

    // Admin: Create
    static async create({ title, content, image_url, is_published }) {
        const sql = `
      INSERT INTO posts (title, content, image_url, is_published)
      VALUES (?, ?, ?, ?)
    `;
        const r = await db.run(sql, [
            title,
            content,
            image_url,
            is_published ? 1 : 0,
        ]);
        return r.lastID;
    }

    // Admin: Update
    static async update(id, { title, content, image_url, is_published }) {
        const sql = `
      UPDATE posts 
      SET title = ?, content = ?, image_url = ?, is_published = ?, updated_at = datetime('now')
      WHERE id = ?
    `;
        const r = await db.run(sql, [
            title,
            content,
            image_url,
            is_published ? 1 : 0,
            id,
        ]);
        return r.changes > 0;
    }

    // Admin: Delete
    static async delete(id) {
        const r = await db.run("DELETE FROM posts WHERE id = ?", [id]);
        return r.changes > 0;
    }
}
