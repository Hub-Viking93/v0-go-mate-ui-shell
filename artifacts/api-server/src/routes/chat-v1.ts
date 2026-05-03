import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { authenticate } from "../lib/supabase-auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const SYSTEM_PROMPT = `You are GoMate, a friendly and knowledgeable AI relocation assistant. You help people plan international moves by answering questions about:
- Visa requirements and immigration paths
- Cost of living in different cities and countries
- Banking, taxes, healthcare, and bureaucracy
- Settling in: housing, schools, transport, culture
- Required documents and timelines

Be concise, practical, and warm. Always cite official sources when possible. If a user is just starting out, ask what country they're moving from and to, and what their purpose is (work, study, retirement, etc.) so you can give specific advice.`;

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

router.post("/chat-v1", async (req, res) => {
  try {
    const ctx = await authenticate(req, res);
    if (!ctx) return;

    const body = req.body as { messages?: Array<{ role: string; content: string }> };
    const messages = Array.isArray(body.messages) ? body.messages : [];

    const chatMessages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role as "user" | "assistant", content: String(m.content || "") })),
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 2048,
      messages: chatMessages,
    });

    const message = completion.choices[0]?.message?.content ?? "";
    logger.info({ userId: ctx.user.id, msgCount: messages.length, version: "v1" }, "chat-v1 ok");
    res.json({ message });
  } catch (err) {
    logger.error({ err }, "chat-v1 error");
    res.status(500).json({
      message: `Sorry, I hit an error: ${err instanceof Error ? err.message : "unknown"}`,
    });
  }
});

export default router;
