// commands/cashflow.ts
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

import { Command } from "../types/Command.js";
import { db } from "../config/drizzle.js";
import { cashflowTable } from "../database/schema.js";

interface Cashflow {
  id: number;
  userId: string;
  createdAt: Date;
  updatedAt?: Date | null;
  deletedAt?: Date | null;
  transactionTimeStamp: Date;
  name: string;
  amount: number;
  account: string;
  type: string;
}

class CashflowPagination {
  private interaction: ChatInputCommandInteraction;
  private cashflows: Cashflow[];
  private currentPage = 0;
  private itemsPerPage = 5;
  private timeout = 60000; // 1 minute
  private title: string;

  constructor(
    interaction: ChatInputCommandInteraction,
    cashflows: Cashflow[],
    itemsPerPage = 5,
    title = "💰 Your Cashflows"
  ) {
    this.interaction = interaction;
    this.cashflows = cashflows;
    this.itemsPerPage = itemsPerPage;
    this.title = title;
  }

  get totalPages(): number {
    return Math.ceil(this.cashflows.length / this.itemsPerPage);
  }

  private formatAmount(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
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

  private getTypeIcon(type: string): string {
    return type === "1" ? "📈" : "📉";
  }

  private createEmbed(): EmbedBuilder {
    const startIndex = this.currentPage * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const pageCashflows = this.cashflows.slice(startIndex, endIndex);

    const embed = new EmbedBuilder()
      .setTitle(this.title)
      .setColor("#0099ff")
      .setFooter({
        text: `Page ${this.currentPage + 1} of ${this.totalPages} • Total: ${ 
          this.cashflows.length
        } cashflows`,
      });

    if (pageCashflows.length === 0) {
      embed.setDescription("No cashflows found on this page.");
      return embed;
    }

    const cashflowList = pageCashflows
      .map((cashflow) => {
        const typeIcon = this.getTypeIcon(cashflow.type);
        const amount = this.formatAmount(cashflow.amount);
        const date = this.formatDate(cashflow.transactionTimeStamp);
        return `${typeIcon} **#${cashflow.id}**: ${cashflow.name}\n` + 
               `💳 ${cashflow.account} • ${amount}\n` + 
               `🕐 ${date}\n`;
      })
      .join("\n");

    embed.setDescription(cashflowList);
    return embed;
  }

  private createButtons(): ActionRowBuilder<ButtonBuilder> {
    const row = new ActionRowBuilder<ButtonBuilder>();

    row.addComponents(
      new ButtonBuilder()
        .setCustomId("cashflow_prev")
        .setLabel("⬅️ Previous")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(this.currentPage === 0)
    );

    row.addComponents(
      new ButtonBuilder()
        .setCustomId("cashflow_page_info")
        .setLabel(`${this.currentPage + 1}/${this.totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );

    row.addComponents(
      new ButtonBuilder()
        .setCustomId("cashflow_next")
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
        .setCustomId("cashflow_prev")
        .setLabel("⬅️ Previous")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId("cashflow_page_info")
        .setLabel(`${this.currentPage + 1}/${this.totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId("cashflow_next")
        .setLabel("Next ➡️")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true)
    );

    return row;
  }

  async start(): Promise<void> {
    if (this.cashflows.length === 0) {
      await this.interaction.reply("💰 You have no cashflows.");
      return;
    }

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
      if (buttonInteraction.user.id !== this.interaction.user.id) {
        await buttonInteraction.reply({
          content: "❌ These buttons are not for you!",
          ephemeral: true,
        });
        return;
      }

      switch (buttonInteraction.customId) {
        case "cashflow_prev":
          this.currentPage = Math.max(0, this.currentPage - 1);
          break;
        case "cashflow_next":
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
        console.log("Could not disable cashflow pagination buttons:", error);
      }
    });
  }
}

const cashflowCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("cashflow")
    .setDescription("Manage your cashflows")
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add a new cashflow")
        .addStringOption((opt) =>
          opt
            .setName("name")
            .setDescription("Cashflow name/description")
            .setRequired(true)
        )
        .addNumberOption((opt) =>
          opt
            .setName("amount")
            .setDescription("Cashflow amount")
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
        .setDescription("Show your cashflows")
        .addIntegerOption((opt) =>
          opt
            .setName("per-page")
            .setDescription("Number of cashflows per page (default: 5)")
            .setMinValue(1)
            .setMaxValue(15)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("today")
        .setDescription("Show today's cashflows")
        .addIntegerOption((opt) =>
          opt
            .setName("per-page")
            .setDescription("Number of cashflows per page (default: 5)")
            .setMinValue(1)
            .setMaxValue(15)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("edit")
        .setDescription("Edit a cashflow")
        .addIntegerOption((opt) =>
          opt.setName("id").setDescription("Cashflow ID").setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("name")
            .setDescription("New cashflow name/description")
            .setRequired(false)
        )
        .addNumberOption((opt) =>
          opt
            .setName("amount")
            .setDescription("New cashflow amount")
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
        .setDescription("Delete a cashflow (soft delete)")
        .addIntegerOption((opt) =>
          opt.setName("id").setDescription("Cashflow ID").setRequired(true)
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
      
      if (dateStr) {
        const parsedDate = new Date(dateStr);
        if (isNaN(parsedDate.getTime())) {
          return interaction.reply("❌ Invalid date format. Use YYYY-MM-DD HH:MM format.");
        }
        transactionTimeStamp = parsedDate;
      }

      try {
        const [inserted] = await db
          .insert(cashflowTable)
          .values({
            userId, 
            name, 
            amount, 
            account, 
            type: type.toString(), 
            transactionTimeStamp 
          })
          .returning();
        
        const typeIcon = type.toString() === "1" ? "📈" : "📉";
        const formattedAmount = new Intl.NumberFormat('id-ID', {
          style: 'currency',
          currency: 'IDR',
        }).format(amount);
        
        return interaction.reply(
          `✅ Added ${type.toString() === "1" ? 'income' : 'expense'} **#${inserted.id}**: ${name}\n` + 
          `${typeIcon} ${formattedAmount} from ${account}`
        );
      } catch (error) {
        console.error("Error adding cashflow:", error);
        return interaction.reply("❌ Failed to add cashflow. Please try again.");
      }
    }

    if (sub === "list") {
      try {
        const userCashflows: Cashflow[] = await db
          .select()
          .from(cashflowTable)
          .where(
            and(
              eq(cashflowTable.userId, userId),
              isNull(cashflowTable.deletedAt)
            )
          )
          .orderBy(desc(cashflowTable.transactionTimeStamp));

        const itemsPerPage = interaction.options.getInteger("per-page") || 5;
        const pagination = new CashflowPagination(
          interaction,
          userCashflows,
          itemsPerPage
        );
        await pagination.start();
        return;
      } catch (error) {
        console.error("Error fetching cashflows:", error);
        return interaction.reply("❌ Failed to fetch cashflows. Please try again.");
      }
    }

    if (sub === "today") {
      try {
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

        const todayCashflows: Cashflow[] = await db
          .select()
          .from(cashflowTable)
          .where(
            and(
              eq(cashflowTable.userId, userId),
              isNull(cashflowTable.deletedAt),
              gte(cashflowTable.transactionTimeStamp, startOfDay),
              lte(cashflowTable.transactionTimeStamp, endOfDay)
            )
          )
          .orderBy(desc(cashflowTable.transactionTimeStamp));

        const itemsPerPage = interaction.options.getInteger("per-page") || 5;
        const pagination = new CashflowPagination(
          interaction,
          todayCashflows,
          itemsPerPage,
          "📅 Today's Cashflows"
        );
        await pagination.start();
        return;
      } catch (error) {
        console.error("Error fetching today's cashflows:", error);
        return interaction.reply("❌ Failed to fetch today's cashflows. Please try again.");
      }
    }

    if (sub === "edit") {
      const id = interaction.options.getInteger("id", true);
      const name = interaction.options.getString("name");
      const amount = interaction.options.getNumber("amount");
      const account = interaction.options.getString("account");
      const type = interaction.options.getInteger("type");

      if (!name && amount === null && !account && type === null) {
        return interaction.reply("❌ Please provide at least one field to update.");
      }

      try {
        const updateData: any = { updatedAt: new Date() };
        if (name) updateData.name = name;
        if (amount !== null) updateData.amount = amount;
        if (account) updateData.account = account;
        if (type !== null) updateData.type = type.toString();

        const updated = await db
          .update(cashflowTable)
          .set(updateData)
          .where(
            and(
              eq(cashflowTable.id, id),
              eq(cashflowTable.userId, userId),
              isNull(cashflowTable.deletedAt)
            )
          )
          .returning();

        if (!updated.length) {
          return interaction.reply("❌ Cashflow not found or already deleted.");
        }
        
        return interaction.reply(`✏️ Updated cashflow **#${id}**.`);
      } catch (error) {
        console.error("Error updating cashflow:", error);
        return interaction.reply("❌ Failed to update cashflow. Please try again.");
      }
    }

    if (sub === "delete") {
      const id = interaction.options.getInteger("id", true);
      
      try {
        const updated = await db
          .update(cashflowTable)
          .set({
            deletedAt: new Date(),
            updatedAt: new Date()
          })
          .where(
            and(
              eq(cashflowTable.id, id),
              eq(cashflowTable.userId, userId),
              isNull(cashflowTable.deletedAt)
            )
          )
          .returning();

        if (!updated.length) {
          return interaction.reply("❌ Cashflow not found or already deleted.");
        }
        
        return interaction.reply(`🗑️ Deleted cashflow **#${id}**.`);
      } catch (error) {
        console.error("Error deleting cashflow:", error);
        return interaction.reply("❌ Failed to delete cashflow. Please try again.");
      }
    }
  },
};

export default cashflowCommand;