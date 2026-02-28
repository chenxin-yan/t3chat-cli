import { createStore, configDir, stateDir } from "@crustjs/store";
import { CONFIG_DIR_NAME, DEFAULT_MODEL_ID } from "./constants.ts";

export const modelStore = createStore({
  dirPath: configDir(CONFIG_DIR_NAME),
  fields: {
    model: { type: "string" as const, default: DEFAULT_MODEL_ID },
  },
});

export const authStore = createStore({
  dirPath: stateDir(CONFIG_DIR_NAME),
  fields: {
    cookies: { type: "string" as const, default: "" },
  },
});

/**
 * Extract the convex-session-id value from the stored cookie string.
 * This is needed in the request body as `convexSessionId`.
 */
export async function getConvexSessionId(): Promise<string | undefined> {
  const auth = await authStore.read();
  if (!auth.cookies) return undefined;
  const match = auth.cookies.match(/convex-session-id=([^;]+)/);
  return match?.[1];
}
