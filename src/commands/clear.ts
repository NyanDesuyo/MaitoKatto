import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  TextChannel,
} from "discord.js";
import { Command } from "../types/Command";

const clearCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Delete a number of recent messages.")
    .addIntegerOption((option) =>
      option
        .setName("amount")
        .setDescription("Number of messages to delete (1–100)")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const amount = interaction.options.getInteger("amount", true);
    const channel = interaction.channel;

    if (!channel || !channel.isTextBased() || channel.type !== 0) {
      await interaction.reply({
        content: "This command can only be used in a regular text channel.",
        ephemeral: true,
      });
    }

    const textChannel = channel as TextChannel;

    if (amount < 1 || amount > 100) {
      await interaction.reply({
        content: "Please provide a number between 1 and 100.",
        ephemeral: true,
      });
    }

    try {
      const deletedMessages = await textChannel.bulkDelete(amount, false);
      await interaction.reply({
        content: `🧹 Deleted ${deletedMessages.size} messages.`,
        ephemeral: true,
      });
    } catch (error) {
      console.error("Bulk delete failed:", error);
      await interaction.reply({
        content: "❌ Failed to delete messages. Do I have permission?",
        ephemeral: true,
      });
    }
  },
};

export default clearCommand;
