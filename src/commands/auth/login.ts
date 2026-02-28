import { defineCommand } from "@crustjs/core";
import { input } from "@crustjs/prompts";
import { authStore } from "../../lib/config.ts";
import { T3_CHAT_URL } from "../../lib/constants.ts";

export const login = defineCommand({
  meta: {
    name: "login",
    description: "Authenticate with t3.chat by providing your cookies",
  },
  async run() {
    console.log("Opening t3.chat in your browser...\n");

    // Open browser (macOS)
    Bun.spawn(["open", T3_CHAT_URL]);

    console.log("To get your cookies:");
    console.log("  1. Log in to t3.chat in the browser");
    console.log("  2. Open DevTools (Cmd+Option+I)");
    console.log("  3. Go to Network tab");
    console.log("  4. Send any chat message");
    console.log("  5. Click the /api/chat request");
    console.log("  6. In the Headers tab, find the 'cookie' request header");
    console.log("  7. Copy the entire cookie string\n");

    const cookies = await input({
      message: "Paste your cookie string:",
      validate: (value) => {
        if (!value.trim()) return "Cookie string cannot be empty";
        if (!value.includes("convex-session-id")) {
          return "Cookie should contain 'convex-session-id'. Make sure you copied the full cookie header.";
        }
        return true;
      },
    });

    await authStore.write({ cookies: cookies.trim() });
    console.log("\nCookies saved. You can now use `t3chat <prompt>` to chat.");
  },
});
