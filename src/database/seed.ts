import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";

import { DATABASE_URL } from "../constant/index.js";
import { todoTable } from "./schema.js";

const db = drizzle(DATABASE_URL);

async function main() {
  const todo: typeof todoTable.$inferInsert = {
    userId: "xxnxx",
    text: "Hello todo",
  };

  await db.insert(todoTable).values(todo);
  console.log("New todo created!");

  const users = await db.select().from(todoTable);
  console.log("Getting all users from the database: ", users);

  await db
    .update(todoTable)
    .set({
      text: "Updated todo",
    })
    .where(eq(todoTable.userId, todo.userId));
  console.log("User info updated!");

  await db.delete(todoTable).where(eq(todoTable.userId, todo.userId));
  console.log("User deleted!");
}

main();
