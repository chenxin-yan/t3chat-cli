import { randomUUID } from "node:crypto";
import {
  CHAT_API_URL,
  TRPC_API_URL,
  T3_CHAT_URL,
  type Model,
  getProviderFromModelId,
  getCostTier,
  formatModelName,
} from "./constants.ts";
import { getCookies, getConvexSessionId, getModel } from "./config.ts";

// ---------------------------------------------------------------------------
// Shared curl helpers
// ---------------------------------------------------------------------------

/** Browser-like headers required to bypass Vercel bot protection */
function browserHeaders(cookies: string): string[] {
  return [
    "-H",
    "Accept: */*",
    "-H",
    "Accept-Language: en-US,en;q=0.9",
    "-H",
    `Cookie: ${cookies}`,
    "-H",
    `Origin: ${T3_CHAT_URL}`,
    "-H",
    `Referer: ${T3_CHAT_URL}/`,
    "-H",
    "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
    "-H",
    'sec-ch-ua: "Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"',
    "-H",
    "sec-ch-ua-mobile: ?0",
    "-H",
    'sec-ch-ua-platform: "macOS"',
    "-H",
    "Sec-Fetch-Dest: empty",
    "-H",
    "Sec-Fetch-Mode: cors",
    "-H",
    "Sec-Fetch-Site: same-origin",
  ];
}

/** Run curl and return the response body + HTTP status code */
async function curlRequest(
  args: string[],
): Promise<{ body: string; httpStatus: number }> {
  const proc = Bun.spawn(
    [
      "curl",
      "--silent",
      "--show-error",
      "-w",
      "\n__HTTP_STATUS__%{http_code}",
      ...args,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );

  const stdoutText = await new Response(proc.stdout).text();
  await proc.exited;

  const statusMatch = stdoutText.match(/__HTTP_STATUS__(\d+)$/);
  const httpStatus = statusMatch ? Number(statusMatch[1]) : 0;
  const body = statusMatch
    ? stdoutText.slice(0, statusMatch.index)
    : stdoutText;

  return { body, httpStatus };
}

/**
 * Run curl for SSE responses and parse `data:` lines incrementally.
 *
 * Returns the full raw body plus HTTP status so callers can keep their
 * existing error handling logic.
 */
async function curlRequestSSE(
  args: string[],
  onEventData: (data: string) => void,
): Promise<{ body: string; httpStatus: number }> {
  const proc = Bun.spawn(
    [
      "curl",
      "--silent",
      "--show-error",
      "-N",
      "-w",
      "\n__HTTP_STATUS__%{http_code}",
      ...args,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );

  const stderrTextPromise = new Response(proc.stderr).text();

  const reader = proc.stdout.getReader();
  const decoder = new TextDecoder();

  let rawOutput = "";
  let lineBuffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    rawOutput += chunk;
    lineBuffer += chunk;

    while (true) {
      const newlineIndex = lineBuffer.indexOf("\n");
      if (newlineIndex === -1) break;

      let line = lineBuffer.slice(0, newlineIndex);
      lineBuffer = lineBuffer.slice(newlineIndex + 1);

      if (line.endsWith("\r")) line = line.slice(0, -1);

      if (!line.startsWith("data:")) continue;

      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      onEventData(data);
    }
  }

  const tail = decoder.decode();
  rawOutput += tail;
  lineBuffer += tail;

  if (lineBuffer) {
    const line = lineBuffer.endsWith("\r")
      ? lineBuffer.slice(0, -1)
      : lineBuffer;

    if (line.startsWith("data:")) {
      const data = line.slice(5).trim();
      if (data && data !== "[DONE]") {
        onEventData(data);
      }
    }
  }

  const exitCode = await proc.exited;
  const stderrText = (await stderrTextPromise).trim();

  const statusMatch = rawOutput.match(/__HTTP_STATUS__(\d+)\s*$/);
  const httpStatus = statusMatch ? Number(statusMatch[1]) : 0;
  const body = statusMatch ? rawOutput.slice(0, statusMatch.index) : rawOutput;

  if (exitCode !== 0 && httpStatus === 0) {
    throw new Error(`curl failed: ${stderrText || "unknown error"}`);
  }

  return { body, httpStatus };
}

function requireCookies(): string {
  const cookies = getCookies();
  if (!cookies) {
    throw new Error("Not authenticated. Run `chat auth login` first.");
  }
  return cookies;
}

// ---------------------------------------------------------------------------
// Fetch models via tRPC
// ---------------------------------------------------------------------------

interface TrpcModelBenchmark {
  slug: string;
  intelligenceIndex: number | null;
  codingIndex: number | null;
  mathIndex: number | null;
  pricing: {
    price_1m_blended_3_to_1: number;
    price_1m_input_tokens: number;
    price_1m_output_tokens: number;
  };
}

/**
 * Fetch available models from t3.chat's tRPC endpoint.
 *
 * Calls GET /api/trpc/getAllModelBenchmarks which returns a map of
 * model IDs → benchmark + pricing data. We transform this into our
 * Model[] format.
 */
export async function fetchModels(): Promise<Model[]> {
  const cookies = requireCookies();

  const input = encodeURIComponent(
    JSON.stringify({ json: null, meta: { values: ["undefined"] } }),
  );
  const url = `${TRPC_API_URL}/getAllModelBenchmarks?input=${input}`;

  const { body, httpStatus } = await curlRequest([
    url,
    ...browserHeaders(cookies),
  ]);

  if (httpStatus !== 200) {
    throw new Error(`tRPC API returned HTTP ${httpStatus}`);
  }

  // Parse the tRPC response.
  // Non-batched format:  { result: { data: { json: { ...models }, meta: { ... } } } }
  // Batched format:      [{ result: { data: { json: { ...models } } } }]
  const response = JSON.parse(body);

  let modelMap: Record<string, TrpcModelBenchmark> | undefined;

  if (Array.isArray(response)) {
    // Batched response — find the first entry with model data
    for (const item of response) {
      const candidate = item?.result?.data?.json;
      if (
        candidate &&
        typeof candidate === "object" &&
        !Array.isArray(candidate)
      ) {
        modelMap = candidate;
        break;
      }
    }
  } else {
    modelMap = response?.result?.data?.json;
  }

  if (!modelMap || typeof modelMap !== "object") {
    throw new Error("Unexpected response format from model benchmarks API");
  }

  return Object.entries(modelMap)
    .map(([id, data]) => ({
      id,
      name: formatModelName(id),
      provider: getProviderFromModelId(id),
      cost: getCostTier(data.pricing.price_1m_blended_3_to_1),
    }))
    .sort((a, b) => {
      if (a.provider !== b.provider)
        return a.provider.localeCompare(b.provider);
      return a.id.localeCompare(b.id);
    });
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

/**
 * A single message in the conversation history.
 */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  parts: Array<{ type: "text"; text: string }>;
  attachments: never[];
}

/**
 * Create a ChatMessage from a role and text content.
 */
export function createMessage(
  role: "user" | "assistant",
  text: string,
): ChatMessage {
  return {
    id: randomUUID(),
    role,
    parts: [{ type: "text", text }],
    attachments: [],
  };
}

/**
 * Build the request body matching t3.chat's expected format.
 *
 * The payload was reverse-engineered from the browser's /api/chat request.
 * All top-level fields appear to be validated server-side.
 */
function buildRequestBody(
  messages: ChatMessage[],
  model: string,
  sessionId: string,
  search: boolean,
  searchLimit: number,
) {
  return {
    messages,
    threadMetadata: {
      id: randomUUID(),
      title: "",
    },
    responseMessageId: randomUUID(),
    model,
    convexSessionId: sessionId,
    modelParams: {
      reasoningEffort: "low",
      includeSearch: search,
      searchLimit: searchLimit,
    },
    preferences: {
      name: "",
      occupation: "",
      selectedTraits: [],
      additionalInfo: "",
    },
    userConfiguration: {
      currentlySelectedModel: model,
      currentModelParameters: {
        includeSearch: search,
        reasoningEffort: "low",
      },
      hasMigrated: true,
      mainFont: "proxima",
      streamerMode: false,
      favoriteModels: [],
      billingEmailsEnabled: true,
      statsForNerds: false,
      disableExternalLinkWarning: false,
      disableHorizontalLines: false,
    },
    userInfo: {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: "en-US",
    },
    isEphemeral: true,
  };
}

/**
 * Send a chat message to t3.chat via POST /api/chat using curl.
 *
 * We use curl instead of fetch because Vercel's bot protection checks
 * TLS fingerprints (JA3/JA4). Bun's fetch has a non-browser fingerprint
 * that gets blocked with a 403. curl's TLS fingerprint is typically allowed.
 *
 * The response is SSE (Server-Sent Events) which we parse and stream
 * text deltas to stdout.
 */
export async function sendMessage(
  messages: ChatMessage[],
  model: string,
  search: boolean,
  searchLimit: number,
): Promise<string> {
  const cookies = requireCookies();

  const sessionId = getConvexSessionId();
  if (!sessionId) {
    throw new Error(
      "Could not find convex-session-id in your cookies. Run `chat auth login` again.",
    );
  }

  const body = buildRequestBody(messages, model, sessionId, search, searchLimit);

  let hasOutput = false;
  let accumulated = "";

  const { body: responseBody, httpStatus } = await curlRequestSSE(
    [
      "-X",
      "POST",
      CHAT_API_URL,
      "-H",
      "Content-Type: application/json",
      ...browserHeaders(cookies),
      "-d",
      JSON.stringify(body),
    ],
    (data) => {
      try {
        const event = JSON.parse(data) as {
          type: string;
          delta?: string;
        };

        if (event.type === "text-delta" && event.delta) {
          process.stdout.write(event.delta);
          accumulated += event.delta;
          hasOutput = true;
        }
      } catch {
        // Skip non-JSON lines
      }
    },
  );

  if (httpStatus !== 200) {
    if (httpStatus === 403 || responseBody.includes("Vercel Security")) {
      throw new Error(
        [
          "Blocked by Vercel's bot protection (403).",
          "Your cookies may have expired. Try:",
          "  1. Open t3.chat in Chrome and send a message",
          "  2. Run `chat auth login` again with fresh cookies",
          "",
          "Make sure to copy the FULL cookie header from a recent request.",
        ].join("\n"),
      );
    }
    throw new Error(`Chat API returned HTTP ${httpStatus}: ${responseBody}`);
  }

  if (hasOutput) {
    process.stdout.write("\n");
  }

  return accumulated;
}
