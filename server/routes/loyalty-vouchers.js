import { Router } from "express";
import { ensureAuth } from "./guards.js";
import LoyaltyVoucherDAO from "../dao/LoyaltyVoucherDAO.js";

const r = Router();

r.get("/", ensureAuth, async (req, res, next) => {
  try {
    const vouchers = await LoyaltyVoucherDAO.listAllForUser(req.user.id);
    res.json({ vouchers });
  } catch (e) {
    next(e);
  }
});

export default r;
