import { Router } from "express";
import BlogDAO from "../dao/BlogDAO.js";

const r = Router();

// GET /api/blog
r.get("/", async (req, res, next) => {
    try {
        const posts = await BlogDAO.listPublished();
        res.json(posts);
    } catch (e) {
        next(e);
    }
});

// GET /api/blog/:id
r.get("/:id", async (req, res, next) => {
    try {
        const post = await BlogDAO.getById(req.params.id);
        if (!post || !post.is_published) {
            return res.status(404).json({ error: "Articolo non trovato" });
        }
        res.json(post);
    } catch (e) {
        next(e);
    }
});

export default r;
