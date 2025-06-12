// cleanup-global-commands.ts
import { REST, Routes } from "discord.js";
import { DISCORD_TOKEN, CLIENT_ID } from "./src/constant";

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    const commands = (await rest.get(
      Routes.applicationCommands(CLIENT_ID)
    )) as any[];

    for (const command of commands) {
      await rest.delete(Routes.applicationCommand(CLIENT_ID, command.id));
      console.log(`❌ Deleted global command: ${command.name}`);
    }

    console.log("✅ All global commands deleted.");
  } catch (error) {
    console.error("❌ Error deleting global commands:", error);
  }
})();
