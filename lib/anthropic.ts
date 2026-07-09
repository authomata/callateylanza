import Anthropic from "@anthropic-ai/sdk";

// Model is env-driven (spec §9 says sonnet-4-6, but that id is outdated; we default to Opus 4.8).
// Swappable without a deploy via ANTHROPIC_MODEL.
export const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

export function getAnthropic(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
}

// Streaming message stream for a single generation.
export function createGenerationStream(system: string, user: string) {
  return getAnthropic().messages.stream({
    model: MODEL,
    max_tokens: 20000,
    system,
    messages: [{ role: "user", content: user }],
  });
}
