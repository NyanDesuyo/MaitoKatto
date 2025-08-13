import {integer, pgTable, text, timestamp, real, numeric} from "drizzle-orm/pg-core";

export const todoTable = pgTable("todos", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: text("user_id").notNull(),
  text: text("text").notNull(),
});

export const expenseTable = pgTable("expenses", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: text("user_id").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
    deletedAt: timestamp("deletedAt"),

    transactionTimeStamp: timestamp("transaction_timestamp").notNull(),
    name: text("name").notNull(),
    amount: real("amount").notNull().default(0),
    account: text("account").notNull(),
    type: numeric("type").notNull(),
});