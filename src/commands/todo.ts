// commands/todo.ts
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import { eq, and } from "drizzle-orm";

import { Command } from "../types/Command";
import { db } from "../config/drizzle";
import { todoTable } from "../database/schema";

interface Todo {
  id: number;
  text: string;
  userId: string;
  createdAt?: Date;
}

class TodoPagination {
  private interaction: ChatInputCommandInteraction;
  private todos: Todo[];
  private currentPage = 0;
  private itemsPerPage = 5;
  private timeout = 60000; // 1 minute

  constructor(
    interaction: ChatInputCommandInteraction,
    todos: Todo[],
    itemsPerPage = 5
  ) {
    this.interaction = interaction;
    this.todos = todos;
    this.itemsPerPage = itemsPerPage;
  }

  get totalPages(): number {
    return Math.ceil(this.todos.length / this.itemsPerPage);
  }

  private createEmbed(): EmbedBuilder {
    const startIndex = this.currentPage * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const pageTodos = this.todos.slice(startIndex, endIndex);

    const embed = new EmbedBuilder()
      .setTitle("📝 Your Todos")
      .setColor("#0099ff")
      .setFooter({
        text: `Page ${this.currentPage + 1} of ${this.totalPages} • Total: ${
          this.todos.length
        } todos`,
      });

    if (pageTodos.length === 0) {
      embed.setDescription("No todos found on this page.");
      return embed;
    }

    const todoList = pageTodos
      .map((todo) => `**#${todo.id}**: ${todo.text}`)
      .join("\n");

    embed.setDescription(todoList);
    return embed;
  }

  private createButtons(): ActionRowBuilder<ButtonBuilder> {
    const row = new ActionRowBuilder<ButtonBuilder>();

    // Previous button
    row.addComponents(
      new ButtonBuilder()
        .setCustomId("todo_prev")
        .setLabel("⬅️ Previous")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(this.currentPage === 0)
    );

    // Page indicator
    row.addComponents(
      new ButtonBuilder()
        .setCustomId("todo_page_info")
        .setLabel(`${this.currentPage + 1}/${this.totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );

    // Next button
    row.addComponents(
      new ButtonBuilder()
        .setCustomId("todo_next")
        .setLabel("Next ➡️")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(this.currentPage === this.totalPages - 1)
    );

    return row;
  }

  private createDisabledButtons(): ActionRowBuilder<ButtonBuilder> {
    const row = new ActionRowBuilder<ButtonBuilder>();

    row.addComponents(
      new ButtonBuilder()
        .setCustomId("todo_prev")
        .setLabel("⬅️ Previous")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId("todo_page_info")
        .setLabel(`${this.currentPage + 1}/${this.totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId("todo_next")
        .setLabel("Next ➡️")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true)
    );

    return row;
  }

  async start(): Promise<void> {
    if (this.todos.length === 0) {
      await this.interaction.reply("📝 You have no todos.");
      return;
    }

    // If only one page, don't show pagination buttons
    if (this.totalPages === 1) {
      await this.interaction.reply({
        embeds: [this.createEmbed()],
      });
      return;
    }

    const message = await this.interaction.reply({
      embeds: [this.createEmbed()],
      components: [this.createButtons()],
      fetchReply: true,
    });

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: this.timeout,
    });

    collector.on("collect", async (buttonInteraction) => {
      // Only allow the original user to interact
      if (buttonInteraction.user.id !== this.interaction.user.id) {
        await buttonInteraction.reply({
          content: "❌ These buttons are not for you!",
          ephemeral: true,
        });
        return;
      }

      switch (buttonInteraction.customId) {
        case "todo_prev":
          this.currentPage = Math.max(0, this.currentPage - 1);
          break;
        case "todo_next":
          this.currentPage = Math.min(
            this.totalPages - 1,
            this.currentPage + 1
          );
          break;
      }

      await buttonInteraction.update({
        embeds: [this.createEmbed()],
        components: [this.createButtons()],
      });
    });

    collector.on("end", async () => {
      try {
        await message.edit({
          embeds: [this.createEmbed()],
          components: [this.createDisabledButtons()],
        });
      } catch (error) {
        console.log("Could not disable todo pagination buttons:", error);
      }
    });
  }
}

const todoCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("todo")
    .setDescription("Manage your todos")
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add a new todo")
        .addStringOption((opt) =>
          opt.setName("text").setDescription("What to do?").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("Show your todos")
        .addIntegerOption((opt) =>
          opt
            .setName("per-page")
            .setDescription("Number of todos per page (default: 5)")
            .setMinValue(1)
            .setMaxValue(15)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("update")
        .setDescription("Update a todo")
        .addIntegerOption((opt) =>
          opt.setName("id").setDescription("Todo ID").setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("text").setDescription("New todo").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("delete")
        .setDescription("Delete a todo")
        .addIntegerOption((opt) =>
          opt.setName("id").setDescription("Todo ID").setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const userId = interaction.user.id;
    const sub = interaction.options.getSubcommand();

    if (sub === "add") {
      const text = interaction.options.getString("text", true);
      const [inserted] = await db
        .insert(todoTable)
        .values({ userId, text })
        .returning();
      return interaction.reply(`✅ Added todo **#${inserted.id}**: ${text}`);
    }

    if (sub === "list") {
      const userTodos = await db
        .select()
        .from(todoTable)
        .where(eq(todoTable.userId, userId));

      const itemsPerPage = interaction.options.getInteger("per-page") || 5;
      const pagination = new TodoPagination(
        interaction,
        userTodos,
        itemsPerPage
      );
      await pagination.start();
      return;
    }

    if (sub === "update") {
      const id = interaction.options.getInteger("id", true);
      const newText = interaction.options.getString("text", true);
      const updated = await db
        .update(todoTable)
        .set({ text: newText })
        .where(and(eq(todoTable.id, id), eq(todoTable.userId, userId)))
        .returning();

      if (!updated.length) {
        return interaction.reply("❌ Todo not found.");
      }
      return interaction.reply(`✏️ Updated todo **#${id}**.`);
    }

    if (sub === "delete") {
      const id = interaction.options.getInteger("id", true);
      const deleted = await db
        .delete(todoTable)
        .where(and(eq(todoTable.id, id), eq(todoTable.userId, userId)))
        .returning();

      if (!deleted.length) {
        return interaction.reply("❌ Todo not found.");
      }
      return interaction.reply(`🗑️ Deleted todo **#${id}**.`);
    }
  },
};

export default todoCommand;