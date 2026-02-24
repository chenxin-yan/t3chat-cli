import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { CONFIG_DIR_NAME, DEFAULT_MODEL_ID } from "./constants.ts";

export interface Config {
  /** All cookies from t3.chat as a single string (cookie header format) */
  cookies?: string;
  /** Selected model ID */
  model?: string;
}

function getConfigDir(): string {
  const dir = join(homedir(), ".config", CONFIG_DIR_NAME);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getConfigPath(): string {
  return join(getConfigDir(), "config.json");
}

export function loadConfig(): Config {
  const path = getConfigPath();
  if (!existsSync(path)) {
    return {};
  }
  try {
    const raw = readFileSync(path, "utf-8");
    return JSON.parse(raw) as Config;
  } catch {
    return {};
  }
}

export function saveConfig(config: Config): void {
  const path = getConfigPath();
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
}

export function getCookies(): string | undefined {
  return loadConfig().cookies;
}

export function getModel(): string {
  return loadConfig().model ?? DEFAULT_MODEL_ID;
}

/**
 * Extract the convex-session-id value from the stored cookie string.
 * This is needed in the request body as `convexSessionId`.
 */
export function getConvexSessionId(): string | undefined {
  const cookies = getCookies();
  if (!cookies) return undefined;
  const match = cookies.match(/convex-session-id=([^;]+)/);
  return match?.[1];
}
