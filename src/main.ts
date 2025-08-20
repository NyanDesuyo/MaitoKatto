import {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  ChatInputCommandInteraction,
  REST,
  Routes,
} from "discord.js";
import { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } from "./constant";

import { Command } from "./types/Command";
import { Helper } from "./utils/helper";

// Import the command
import userCommand from "./commands/users";
import appCommand from "./commands/app";
import todoCommand from "./commands/todo";
import cashflowCommand from "./commands/cashflow";

async function main() {
  const botClient = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  // Store commands
  const commands: Command[] = [todoCommand, appCommand, userCommand,cashflowCommand];

  const commandMap = new Collection<string, Command>();
  for (const cmd of commands) {
    commandMap.set(cmd.data.name, cmd);
  }

  // Register commands (deploy)
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

  // Global Register
  // await rest.put(Routes.applicationCommands(CLIENT_ID), {
  //   body: commands.map((cmd) => cmd.data.toJSON()),
  // });
  // console.log("✅ Global Slash commands registered.");

  // Guild Register
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: commands.map((cmd) => cmd.data.toJSON()),
  });
  Helper.consoleInspect("✅ Server Slash commands registered.");

  botClient.once("ready", () => {
    Helper.consoleInspect(`🤖 Logged in as ${botClient.user?.tag}`);
  });

  // Interaction handler
  botClient.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = commandMap.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction as ChatInputCommandInteraction);
    } catch (error) {
      Helper.consoleInspect(error);
      await interaction.reply({
        content: "There was an error executing this command.",
        ephemeral: true,
      });
    }
  });

  await botClient.login(DISCORD_TOKEN);
}

main().catch((e: any) => {
  Helper.consoleInspect(`❌ Error starting bot: ${e}`);
});
