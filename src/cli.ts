import { defineCommand, runMain } from "@crustjs/core";
import { helpPlugin, renderHelp, versionPlugin } from "@crustjs/plugins";
import pkg from "../package.json";
import { auth } from "./commands/auth/index.ts";
import { models } from "./commands/models.ts";
import { getCookies, getModel } from "./lib/config.ts";
import { formatModelName } from "./lib/constants.ts";
import { sendMessage } from "./lib/t3client.ts";

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

    try {
      const search = flags.search;
      const searchLimit = flags.searchLimit;
      await sendMessage(prompt, modelId, search, searchLimit);
    } catch (e) {
      const err = e as Error;
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  },
});

runMain(main, {
  plugins: [versionPlugin(pkg.version), helpPlugin()],
});
