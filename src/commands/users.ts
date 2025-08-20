import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../types/Command.js"; // adjust the path if needed

const userCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("user")
    .setDescription("Provides information about the user."),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply(
      `This command was used by ${interaction.user.username}.`
    );
  },
};

export default userCommand;
