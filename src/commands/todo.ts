// commands/todo.ts
import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../types/Command";
import { db } from "../config/drizzle";
import { todoTable } from "../database/schema";
import { eq, and } from "drizzle-orm";

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
      sub.setName("list").setDescription("Show your todos")
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

      if (!userTodos.length) {
        return interaction.reply("📝 You have no todos.");
      }

      const formatted = userTodos
        .map((todo) => `**#${todo.id}**: ${todo.text}`)
        .join("\n");

      return interaction.reply(`📝 Your Todos:\n${formatted}`);
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
