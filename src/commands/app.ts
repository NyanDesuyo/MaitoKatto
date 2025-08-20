import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  TextChannel,
} from "discord.js";

import { Command } from "../types/Command.js";
import { Helper } from "../utils/helper.js";

const appCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("app")
    .setDescription("Replies with information about the bot.")
    .addSubcommand((sub) =>
      sub.setName("ping").setDescription("Show app ping.")
    )
    .addSubcommand((sub) =>
      sub.setName("stats").setDescription("Show app stats.")
    )
    .addSubcommandGroup((group) =>
      group
        .setName("chat")
        .setDescription("Chat related commands.")
        .addSubcommand((sub) =>
          sub
            .setName("clean")
            .setDescription("Clean a an amount of messages")
            .addIntegerOption((option) =>
              option
                .setName("amount")
                .setDescription("Amount of messages to clean")
                .setRequired(true)
            )
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const group = interaction.options.getSubcommandGroup();
    const sub = interaction.options.getSubcommand();

    if (group === "chat" && sub === "clean") {
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
        Helper.consoleInspect(`Bulk delete failed: ${error}`);
        await interaction.reply({
          content: "❌ Failed to delete messages. Do I have permission?",
          ephemeral: true,
        });
      }
    }

    if (sub === "stats") {
      const embed = new EmbedBuilder()
        .setTitle("📊 Bot Stats")
        .setColor(0x00aeff)
        .setDescription(`Here's my stat`)
        .addFields(
          {
            name: "Uptime",
            value: `**${Helper.uptime()}**`,
          },
          {
            name: "Users",
            value: `${interaction.client.users.cache.size}`,
          }
        )
        .setFooter({
          text: "Version 1.1.0",
          iconURL: interaction.client.user?.displayAvatarURL() || undefined,
        });

      await interaction.reply({ embeds: [embed] });
    }

    if (sub === "ping") {
      const sent = await interaction.reply({
        content: "Pinging...",
        fetchReply: true,
      });

      const latency = sent.createdTimestamp - interaction.createdTimestamp;

      await interaction.editReply(`🏓 Pong! Latency is **${latency}ms**`);
    }
  },
};

export default appCommand;
