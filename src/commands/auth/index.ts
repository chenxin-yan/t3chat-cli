import { defineCommand } from "@crustjs/core";
import { login } from "./login.ts";

export const auth = defineCommand({
  meta: {
    name: "auth",
    description: "Manage authentication with t3.chat",
  },
  subCommands: {
    login,
  },
});
