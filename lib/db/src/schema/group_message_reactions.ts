import { pgTable, serial, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { groupMessagesTable } from "./group_messages";
import { usersTable } from "./users";

export const groupMessageReactionsTable = pgTable("group_message_reactions", {
  id: serial("id").primaryKey(),
  groupMessageId: integer("group_message_id").notNull().references(() => groupMessagesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.groupMessageId, t.userId, t.emoji)]);
