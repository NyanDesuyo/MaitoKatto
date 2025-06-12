import { integer, pgTable, varchar, text } from "drizzle-orm/pg-core";

export const todoTable = pgTable("todos", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: text("user_id").notNull(),
  text: text("text").notNull(),
});
