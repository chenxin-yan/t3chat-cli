import { defineCommand } from "@crustjs/core";
import { filter, spinner } from "@crustjs/prompts";
import { modelStore } from "../lib/config.ts";
import { DEFAULT_MODEL_ID } from "../lib/constants.ts";
import { fetchModels } from "../lib/t3client.ts";

export const models = defineCommand({
  meta: {
    name: "models",
    description: "Select the default model for chat",
  },
  async run() {
    const config = await modelStore.read();
    const currentModel = config.model ?? DEFAULT_MODEL_ID;

    const modelList = await spinner({
      message: "Fetching available models...",
      task: () => fetchModels(),
    });

    console.log(`Current model: ${currentModel}\n`);

    const selected = await filter<string>({
      message: "Choose a model:",
      placeholder: "Type to filter...",
      choices: modelList.map((m) => ({
        label: `${m.name} (${m.provider}) ${m.cost}`,
        value: m.id,
      })),
    });

    await modelStore.write({ model: selected });
    const model = modelList.find((m) => m.id === selected);
    console.log(`\nDefault model set to: ${model?.name ?? selected}`);
  },
});
