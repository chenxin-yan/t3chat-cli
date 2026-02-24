export const T3_CHAT_URL = "https://t3.chat";
export const CHAT_API_URL = "https://t3.chat/api/chat";
export const TRPC_API_URL = "https://t3.chat/api/trpc";
// Config paths
export const CONFIG_DIR_NAME = "t3chat-cli";

export interface Model {
  id: string;
  name: string;
  provider: string;
  cost: "$" | "$$" | "$$$";
}

/** Derive provider name from model ID prefix */
export function getProviderFromModelId(id: string): string {
  if (id.startsWith("claude-")) return "Anthropic";
  if (id.startsWith("gpt-") || id.startsWith("o3-")) return "OpenAI";
  if (id.startsWith("gemini-")) return "Google";
  if (id.startsWith("deepseek-")) return "DeepSeek";
  if (id.startsWith("kimi-")) return "Moonshot";
  if (id.startsWith("llama-")) return "Meta";
  if (id.startsWith("minimax-")) return "MiniMax";
  if (id.startsWith("grok-")) return "xAI";
  if (id.startsWith("glm-")) return "Zhipu";
  if (id.startsWith("qwen")) return "Alibaba";
  return "Unknown";
}

/** Map blended price per 1M tokens to a cost tier */
export function getCostTier(blendedPrice: number): "$" | "$$" | "$$$" {
  if (blendedPrice < 1) return "$";
  if (blendedPrice <= 5) return "$$";
  return "$$$";
}

/** Format a model ID into a human-readable name */
export function formatModelName(id: string): string {
  return id
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export const DEFAULT_MODEL_ID = "kimi-k2.5";
