import { Router, type IRouter } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { AGENTS_PACKAGE_VERSION } from "@workspace/agents";
import { authenticate } from "../lib/supabase-auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const HEALTH_MODEL = "claude-haiku-4-5";

router.get("/agents/health", async (req, res) => {
  try {
    const ctx = await authenticate(req, res);
    if (!ctx) return;

    const startedAt = Date.now();
    const message = await anthropic.messages.create({
      model: HEALTH_MODEL,
      max_tokens: 32,
      messages: [{ role: "user", content: "Reply with exactly the word: ok" }],
    });
    const latencyMs = Date.now() - startedAt;

    const block = message.content[0];
    const text = block && block.type === "text" ? block.text.trim() : "";

    res.json({
      ok: text.toLowerCase().includes("ok"),
      models: [message.model],
      latencyMs,
      usage: message.usage,
      agentsPackageVersion: AGENTS_PACKAGE_VERSION,
      reply: text,
    });
  } catch (err) {
    logger.error({ err }, "agents-health error");
    res.status(500).json({
      ok: false,
      models: [HEALTH_MODEL],
      error: err instanceof Error ? err.message : "unknown",
    });
  }
});

export default router;
