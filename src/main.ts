import { Client, Events, GatewayIntentBits } from "discord.js";

import { DISCORD_TOKEN } from "./constant";

async function main() {
  const botClient = new Client({
    intents: ["Guilds"],
  });

  botClient.once("ready", () => {
    console.log(`Logged in as ${botClient.user?.tag}`);
  });

  botClient.login(DISCORD_TOKEN);
}

main().catch((e: any) => {
  console.log(e);
});
