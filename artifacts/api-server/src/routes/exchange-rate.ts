// =============================================================
// GET /api/exchange-rate?from=X&to=Y — currency conversion proxy
// =============================================================
// The frontend `useCurrencyConversion` hook used to call
// `api.frankfurter.app` directly, which has no CORS headers — so
// every request was blocked and conversion was DISABLED. This
// endpoint proxies the same source from the server (no CORS issue)
// and adds a 1h in-memory TTL cache so we don't hammer Frankfurter.
//
// Frankfurter is the European Central Bank's daily rate feed, free
// and no-key. Updates daily ~16:00 CET. Acceptable for relocation
// budget planning where a few hours of rate drift is irrelevant
// against the size of the moving costs.
// =============================================================

import { Router, type IRouter } from "express";
import { authenticate } from "../lib/supabase-auth";
import { getFxRate } from "../lib/fx";

const router: IRouter = Router();

router.get("/exchange-rate", async (req, res) => {
  const ctx = await authenticate(req, res);
  if (!ctx) return;

  const from = typeof req.query.from === "string" ? req.query.from.trim() : null;
  const to = typeof req.query.to === "string" ? req.query.to.trim() : null;
  if (!from || !to) {
    res.status(400).json({ error: "from and to query params are required" });
    return;
  }
  if (!/^[A-Za-z]{3}$/.test(from) || !/^[A-Za-z]{3}$/.test(to)) {
    res.status(400).json({ error: "from/to must be ISO 4217 codes (e.g. USD, EUR)" });
    return;
  }

  const rate = await getFxRate(from, to);
  res.json({
    from: from.toUpperCase(),
    to: to.toUpperCase(),
    rate,
    fetchedAt: new Date().toISOString(),
  });
});

export default router;
