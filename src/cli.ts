import { defineCommand, runMain } from "@crustjs/core";
import { helpPlugin, renderHelp, versionPlugin } from "@crustjs/plugins";
import { CancelledError, input } from "@crustjs/prompts";
import pkg from "../package.json";
import { auth } from "./commands/auth/index.ts";
import { models } from "./commands/models.ts";
import { getCookies, getModel } from "./lib/config.ts";
import {
  createMessage,
  sendMessage,
  type ChatMessage,
} from "./lib/t3client.ts";

const main = defineCommand({
  meta: {
    name: "chat",
    description: "CLI wrapper for t3.chat",
  },
  args: [
    {
      name: "prompt",
      type: "string",
      variadic: true,
      description: "The message to send to t3.chat",
    },
  ],
  flags: {
    search: {
      type: "boolean",
      alias: "s",
      description: "Enable web search",
      default: false,
    },
    searchLimit: {
      type: "number",
      alias: "S",
      description: "Number of search results",
      default: 1,
    },
    interactive: {
      type: "boolean",
      alias: "i",
      description:
        "Enable interactive follow-up prompts (use --no-interactive to disable)",
      default: true,
    },
  },
  subCommands: {
    auth,
    models,
  },
  async run({ args, flags }) {
    if (args.prompt.length <= 0) {
      console.log(renderHelp(main));
      return;
    }

    const prompt = args.prompt.join(" ");

    const cookies = getCookies();
    if (!cookies) {
      console.error("Not authenticated. Run `chat auth login` first.");
      process.exit(1);
    }

    const modelId = getModel();
    const search = flags.search;
    const searchLimit = flags.searchLimit;

    // Build conversation history
    const messages: ChatMessage[] = [createMessage("user", prompt)];

    try {
      const response = await sendMessage(
        messages,
        modelId,
        search,
        searchLimit,
      );
      messages.push(createMessage("assistant", response));
    } catch (e) {
      const err = e as Error;
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }

    // Interactive follow-up loop
    if (!flags.interactive) return;

    while (true) {
      let followUp: string;
      try {
        followUp = await input({ message: "" });
      } catch (e) {
        if (e instanceof CancelledError) break;
        throw e;
      }

      if (!followUp.trim()) break;

      messages.push(createMessage("user", followUp));

      try {
        const response = await sendMessage(
          messages,
          modelId,
          search,
          searchLimit,
        );
        messages.push(createMessage("assistant", response));
      } catch (e) {
        const err = e as Error;
        console.error(`Error: ${err.message}`);
        // Remove the failed user message so history stays consistent
        messages.pop();
      }
    }
  },
});

runMain(main, {
  plugins: [versionPlugin(pkg.version), helpPlugin()],
});
