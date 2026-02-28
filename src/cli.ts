import { defineCommand, runMain } from "@crustjs/core";
import { helpPlugin, renderHelp, versionPlugin } from "@crustjs/plugins";
import { CancelledError, input } from "@crustjs/prompts";
import pkg from "../package.json";
import { auth } from "./commands/auth/index.ts";
import { models } from "./commands/models.ts";
import { authStore, modelStore } from "./lib/config.ts";
import {
  createMessage,
  sendMessage,
  type ChatMessage,
} from "./lib/t3client.ts";
import { skillPlugin } from "@crustjs/skills";

const main = defineCommand({
  meta: {
    name: "t3chat",
    description: pkg.description,
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
    model: {
      type: "string",
      alias: "m",
      description: "Override the default model",
    },
    search: {
      type: "boolean",
      alias: "s",
      description: "Enable web search",
      default: false,
    },
    searchLimit: {
      type: "number",
      alias: "S",
      description:
        "Number of searches the agent is allowed to make per response",
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

    const auth = await authStore.read();
    if (!auth.cookies) {
      console.error("Not authenticated. Run `t3chat auth login` first.");
      process.exit(1);
    }

    const modelConfig = await modelStore.read();
    const modelId = flags.model || modelConfig.model;
    const search = flags.search;
    const searchLimit = flags.searchLimit;

    // Build conversation history
    const messages: ChatMessage[] = [createMessage("user", prompt)];

    try {
      const response = await sendMessage(
        messages,
        modelId,
        search,
        searchLimit
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
          searchLimit
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
  plugins: [
    skillPlugin({
      version: pkg.version,
      command: true,
    }),
    versionPlugin(pkg.version),
    helpPlugin(),
  ],
});
