// server/routes/admin-reviews.js
import { Router } from "express";
import { ensureLoggedIn, ensureAdmin } from "../middlewares/auth.js";
import ReviewsDAO from "../dao/ReviewsDAO.js";

const r = Router();
r.use(ensureLoggedIn, ensureAdmin);

/**
 * GET /api/admin/reviews?status=pending|approved|all
 */
r.get("/", async (req, res, next) => {
  try {
    const status = (req.query.status || "pending").toLowerCase();
    const rows = await ReviewsDAO.listAdmin(status);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

/**
 * PUT /api/admin/reviews/:id/approve
 */
r.put("/:id/approve", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id))
      return res.status(400).json({ error: "ID non valido" });
    await ReviewsDAO.approve(id);
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
});

/**
 * DELETE /api/admin/reviews/:id
 */
r.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id))
      return res.status(400).json({ error: "ID non valido" });
    await ReviewsDAO.remove(id);
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
});

export default r;
