import { pgTable, serial, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { messagesTable } from "./messages";
import { usersTable } from "./users";

export const messageReactionsTable = pgTable("message_reactions", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").notNull().references(() => messagesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.messageId, t.userId, t.emoji)]);
