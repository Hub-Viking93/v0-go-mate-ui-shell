import Anthropic from "@anthropic-ai/sdk";

// Route through OpenRouter's Anthropic-compatible /v1/messages endpoint when
// OPENROUTER_API_KEY is set (user-supplied key, charged to user's OpenRouter
// balance). Falls back to Replit AI Integrations Anthropic proxy otherwise.
const useOpenRouter = !!process.env.OPENROUTER_API_KEY;

if (useOpenRouter) {
  // OpenRouter's Anthropic-compatible endpoint:
  //   POST https://openrouter.ai/api/v1/messages
  //   Authorization: Bearer <OPENROUTER_API_KEY>
  //   Same request/response shape as Anthropic /v1/messages.
} else {
  if (!process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL) {
    throw new Error(
      "AI_INTEGRATIONS_ANTHROPIC_BASE_URL must be set. Did you forget to provision the Anthropic AI integration? (Or set OPENROUTER_API_KEY to use OpenRouter.)",
    );
  }
  if (!process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY) {
    throw new Error(
      "AI_INTEGRATIONS_ANTHROPIC_API_KEY must be set. Did you forget to provision the Anthropic AI integration? (Or set OPENROUTER_API_KEY to use OpenRouter.)",
    );
  }
}

// Routing priority:
//   1. ANTHROPIC_API_KEY  -> talk directly to api.anthropic.com (cleanest path,
//      no model-name mapping, no proxy quirks). Use this when the user supplies
//      their own Anthropic key.
//   2. OPENROUTER_API_KEY -> route through OpenRouter's Anthropic-compatible
//      endpoint with Bearer auth (model names rewritten in router.ts).
//   3. Replit AI Integrations proxy (default) — uses
//      AI_INTEGRATIONS_ANTHROPIC_API_KEY + base URL injected by Replit.
const useDirectAnthropic =
  typeof process.env.ANTHROPIC_API_KEY === "string" &&
  process.env.ANTHROPIC_API_KEY.length > 0;

// Visible at boot so we can confirm which auth path the API server picked.
// eslint-disable-next-line no-console
console.log(
  `[anthropic-client] route=${
    useDirectAnthropic
      ? "direct(api.anthropic.com)"
      : useOpenRouter
        ? "openrouter"
        : "replit-proxy"
  } anthropicKeyLen=${process.env.ANTHROPIC_API_KEY?.length ?? 0} openrouterKeyLen=${process.env.OPENROUTER_API_KEY?.length ?? 0}`,
);

export const anthropic = useDirectAnthropic
  ? new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
      // baseURL omitted -> SDK default https://api.anthropic.com
    })
  : useOpenRouter
    ? new Anthropic({
        authToken: process.env.OPENROUTER_API_KEY!,
        // The Anthropic SDK appends "/v1/messages" automatically. Setting
        // baseURL to ".../api/v1" produced a double "/v1" path and got
        // OpenRouter's marketing-site HTML back. Trailing-slash matters too —
        // keep it bare.
        baseURL: "https://openrouter.ai/api",
        defaultHeaders: {
          "HTTP-Referer": "https://gomate.replit.app",
          "X-Title": "GoMate",
        },
      })
    : new Anthropic({
        apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY!,
        baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL!,
      });

/** True if the LLM client is currently routed through OpenRouter.
 * Direct Anthropic takes precedence — when ANTHROPIC_API_KEY is set we hit
 * api.anthropic.com directly and must NOT rewrite model names to OpenRouter
 * form (e.g. "anthropic/claude-haiku-4.5") — the upstream API only accepts
 * the canonical "claude-haiku-4-5" naming. */
export const isOpenRouter = !useDirectAnthropic && useOpenRouter;
