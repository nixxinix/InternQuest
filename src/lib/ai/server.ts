import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * The AI helper's one call to Claude (server only: the key never reaches
 * the browser, CLAUDE.md hard rule). Off unless AI_API_KEY is set.
 *
 * Model: AI_MODEL, default Claude Opus 5.5, at low effort (short writing
 * tasks). On a safety refusal, the API retries on a fallback model in the
 * same call ("fallbacks": "default"); if everything refuses, the user sees
 * a plain message instead of a draft.
 */
export const DEFAULT_AI_MODEL = "claude-opus-5-5";

/** Models that accept the server-side refusal fallback. */
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"]);

export function isAiEnabled(): boolean {
  return Boolean(process.env.AI_API_KEY);
}

export type AiResult = { ok: true; text: string } | { ok: false; reason: "refused" | "busy" | "unavailable" };

export async function generateDraft(system: string, user: string): Promise<AiResult> {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) return { ok: false, reason: "unavailable" };
  const model = process.env.AI_MODEL || DEFAULT_AI_MODEL;
  const client = new Anthropic({ apiKey, timeout: 60_000, maxRetries: 1 });

  try {
    const response = await client.beta.messages.create({
      model,
      max_tokens: 8000,
      output_config: { effort: "low" },
      ...(FALLBACK_MODELS.has(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      system,
      messages: [{ role: "user", content: user }],
    });
    if (response.stop_reason === "refusal") return { ok: false, reason: "refused" };
    const text = response.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("\n")
      .trim();
    return text ? { ok: true, text } : { ok: false, reason: "unavailable" };
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return { ok: false, reason: "busy" };
    if (error instanceof Anthropic.APIError) {
      console.error(`[ai] API error ${error.status}:`, error.message);
      return { ok: false, reason: "unavailable" };
    }
    console.error("[ai] request failed:", error instanceof Error ? error.message : error);
    return { ok: false, reason: "unavailable" };
  }
}
