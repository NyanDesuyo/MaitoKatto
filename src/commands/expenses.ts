// commands/expenses.ts
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import { eq, and, isNull, gte, lte, desc } from "drizzle-orm";

import { Command } from "../types/Command";
import { db } from "../config/drizzle";
import { expenseTable } from "../database/schema";

interface Expense {
  id: number;
  userId: string;
  createdAt: Date;
  updatedAt?: Date;
  deletedAt?: Date;
  transactionTimeStamp: Date;
  name: string;
  amount: number;
  account: string;
  type: number;
}

class ExpensePagination {
  private interaction: ChatInputCommandInteraction;
  private expenses: Expense[];
  private currentPage = 0;
  private itemsPerPage = 5;
  private timeout = 60000; // 1 minute
  private title: string;

  constructor(
    interaction: ChatInputCommandInteraction,
    expenses: Expense[],
    itemsPerPage = 5,
    title = "💰 Your Expenses"
  ) {
    this.interaction = interaction;
    this.expenses = expenses;
    this.itemsPerPage = itemsPerPage;
    this.title = title;
  }

  get totalPages(): number {
    return Math.ceil(this.expenses.length / this.itemsPerPage);
  }

  private formatAmount(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  }

  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  private getTypeIcon(type: number): string {
    // Assuming type 1 = income, type 0 = expense
    return type === 1 ? "📈" : "📉";
  }

  private createEmbed(): EmbedBuilder {
    const startIndex = this.currentPage * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const pageExpenses = this.expenses.slice(startIndex, endIndex);

    const embed = new EmbedBuilder()
      .setTitle(this.title)
      .setColor("#0099ff")
      .setFooter({
        text: `Page ${this.currentPage + 1} of ${this.totalPages} • Total: ${
          this.expenses.length
        } expenses`,
      });

    if (pageExpenses.length === 0) {
      embed.setDescription("No expenses found on this page.");
      return embed;
    }

    const expenseList = pageExpenses
      .map((expense) => {
        const typeIcon = this.getTypeIcon(expense.type);
        const amount = this.formatAmount(expense.amount);
        const date = this.formatDate(expense.transactionTimeStamp);
        return `${typeIcon} **#${expense.id}**: ${expense.name}\n` +
               `💳 ${expense.account} • ${amount}\n` +
               `🕐 ${date}\n`;
      })
      .join("\n");

    embed.setDescription(expenseList);
    return embed;
  }

  private createButtons(): ActionRowBuilder<ButtonBuilder> {
    const row = new ActionRowBuilder<ButtonBuilder>();

    // Previous button
    row.addComponents(
      new ButtonBuilder()
        .setCustomId("expense_prev")
        .setLabel("⬅️ Previous")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(this.currentPage === 0)
    );

    // Page indicator
    row.addComponents(
      new ButtonBuilder()
        .setCustomId("expense_page_info")
        .setLabel(`${this.currentPage + 1}/${this.totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );

    // Next button
    row.addComponents(
      new ButtonBuilder()
        .setCustomId("expense_next")
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
        .setCustomId("expense_prev")
        .setLabel("⬅️ Previous")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId("expense_page_info")
        .setLabel(`${this.currentPage + 1}/${this.totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId("expense_next")
        .setLabel("Next ➡️")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true)
    );

    return row;
  }

  async start(): Promise<void> {
    if (this.expenses.length === 0) {
      await this.interaction.reply("💰 You have no expenses.");
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
        case "expense_prev":
          this.currentPage = Math.max(0, this.currentPage - 1);
          break;
        case "expense_next":
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
        // Message might have been deleted
        console.log("Could not disable expense pagination buttons:", error);
      }
    });
  }
}

const expenseCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("expense")
    .setDescription("Manage your expenses")
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add a new expense")
        .addStringOption((opt) =>
          opt
            .setName("name")
            .setDescription("Expense name/description")
            .setRequired(true)
        )
        .addNumberOption((opt) =>
          opt
            .setName("amount")
            .setDescription("Expense amount")
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("account")
            .setDescription("Account used for transaction")
            .setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt
            .setName("type")
            .setDescription("Transaction type (0 = expense, 1 = income)")
            .setRequired(true)
            .addChoices(
              { name: "Expense", value: 0 },
              { name: "Income", value: 1 }
            )
        )
        .addStringOption((opt) =>
          opt
            .setName("date")
            .setDescription("Transaction date (YYYY-MM-DD HH:MM, default: now)")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("Show your expenses")
        .addIntegerOption((opt) =>
          opt
            .setName("per-page")
            .setDescription("Number of expenses per page (default: 5)")
            .setMinValue(1)
            .setMaxValue(15)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("today")
        .setDescription("Show today's expenses")
        .addIntegerOption((opt) =>
          opt
            .setName("per-page")
            .setDescription("Number of expenses per page (default: 5)")
            .setMinValue(1)
            .setMaxValue(15)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("edit")
        .setDescription("Edit an expense")
        .addIntegerOption((opt) =>
          opt.setName("id").setDescription("Expense ID").setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("name")
            .setDescription("New expense name/description")
            .setRequired(false)
        )
        .addNumberOption((opt) =>
          opt
            .setName("amount")
            .setDescription("New expense amount")
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName("account")
            .setDescription("New account")
            .setRequired(false)
        )
        .addIntegerOption((opt) =>
          opt
            .setName("type")
            .setDescription("New transaction type")
            .setRequired(false)
            .addChoices(
              { name: "Expense", value: 0 },
              { name: "Income", value: 1 }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("delete")
        .setDescription("Delete an expense (soft delete)")
        .addIntegerOption((opt) =>
          opt.setName("id").setDescription("Expense ID").setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const userId = interaction.user.id;
    const sub = interaction.options.getSubcommand();

    if (sub === "add") {
      const name = interaction.options.getString("name", true);
      const amount = interaction.options.getNumber("amount", true);
      const account = interaction.options.getString("account", true);
      const type = interaction.options.getInteger("type", true);
      const dateStr = interaction.options.getString("date");
      
      let transactionTimeStamp = new Date();
      
      // Parse custom date if provided
      if (dateStr) {
        const parsedDate = new Date(dateStr);
        if (isNaN(parsedDate.getTime())) {
          return interaction.reply("❌ Invalid date format. Use YYYY-MM-DD HH:MM format.");
        }
        transactionTimeStamp = parsedDate;
      }

      try {
        const [inserted] = await db
          .insert(expenseTable)
          .values({ 
            userId, 
            name, 
            amount, 
            account, 
            type, 
            transactionTimeStamp 
          })
          .returning();
        
        const typeIcon = type === 1 ? "📈" : "📉";
        const formattedAmount = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(amount);
        
        return interaction.reply(
          `✅ Added ${type === 1 ? 'income' : 'expense'} **#${inserted.id}**: ${name}\n` +
          `${typeIcon} ${formattedAmount} from ${account}`
        );
      } catch (error) {
        console.error("Error adding expense:", error);
        return interaction.reply("❌ Failed to add expense. Please try again.");
      }
    }

    if (sub === "list") {
      try {
        const userExpenses = await db
          .select()
          .from(expenseTable)
          .where(
            and(
              eq(expenseTable.userId, userId),
              isNull(expenseTable.deletedAt)
            )
          )
          .orderBy(desc(expenseTable.transactionTimeStamp));

        const itemsPerPage = interaction.options.getInteger("per-page") || 5;
        const pagination = new ExpensePagination(
          interaction,
          userExpenses,
          itemsPerPage
        );
        await pagination.start();
        return;
      } catch (error) {
        console.error("Error fetching expenses:", error);
        return interaction.reply("❌ Failed to fetch expenses. Please try again.");
      }
    }

    if (sub === "today") {
      try {
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

        const todayExpenses = await db
          .select()
          .from(expenseTable)
          .where(
            and(
              eq(expenseTable.userId, userId),
              isNull(expenseTable.deletedAt),
              gte(expenseTable.transactionTimeStamp, startOfDay),
              lte(expenseTable.transactionTimeStamp, endOfDay)
            )
          )
          .orderBy(desc(expenseTable.transactionTimeStamp));

        const itemsPerPage = interaction.options.getInteger("per-page") || 5;
        const pagination = new ExpensePagination(
          interaction,
          todayExpenses,
          itemsPerPage,
          "📅 Today's Expenses"
        );
        await pagination.start();
        return;
      } catch (error) {
        console.error("Error fetching today's expenses:", error);
        return interaction.reply("❌ Failed to fetch today's expenses. Please try again.");
      }
    }

    if (sub === "edit") {
      const id = interaction.options.getInteger("id", true);
      const name = interaction.options.getString("name");
      const amount = interaction.options.getNumber("amount");
      const account = interaction.options.getString("account");
      const type = interaction.options.getInteger("type");

      // Check if at least one field is provided
      if (!name && amount === null && !account && type === null) {
        return interaction.reply("❌ Please provide at least one field to update.");
      }

      try {
        // Build the update object dynamically
        const updateData: any = { updatedAt: new Date() };
        if (name) updateData.name = name;
        if (amount !== null) updateData.amount = amount;
        if (account) updateData.account = account;
        if (type !== null) updateData.type = type;

        const updated = await db
          .update(expenseTable)
          .set(updateData)
          .where(
            and(
              eq(expenseTable.id, id),
              eq(expenseTable.userId, userId),
              isNull(expenseTable.deletedAt)
            )
          )
          .returning();

        if (!updated.length) {
          return interaction.reply("❌ Expense not found or already deleted.");
        }
        
        return interaction.reply(`✏️ Updated expense **#${id}**.`);
      } catch (error) {
        console.error("Error updating expense:", error);
        return interaction.reply("❌ Failed to update expense. Please try again.");
      }
    }

    if (sub === "delete") {
      const id = interaction.options.getInteger("id", true);
      
      try {
        const updated = await db
          .update(expenseTable)
          .set({ 
            deletedAt: new Date(),
            updatedAt: new Date()
          })
          .where(
            and(
              eq(expenseTable.id, id),
              eq(expenseTable.userId, userId),
              isNull(expenseTable.deletedAt)
            )
          )
          .returning();

        if (!updated.length) {
          return interaction.reply("❌ Expense not found or already deleted.");
        }
        
        return interaction.reply(`🗑️ Deleted expense **#${id}**.`);
      } catch (error) {
        console.error("Error deleting expense:", error);
        return interaction.reply("❌ Failed to delete expense. Please try again.");
      }
    }
  },
};

export default expenseCommand;
