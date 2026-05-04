import { Router, type IRouter } from "express";
import { eq, or, and, desc, asc, inArray } from "drizzle-orm";
import { db, usersTable, conversationsTable, messagesTable, messageReactionsTable } from "@workspace/db";
import { requireUser } from "../lib/auth";
import { setTyping, getAllTypingStatuses } from "../lib/typingStore";
import {
  CreateConversationBody,
  GetConversationParams,
  MarkConversationReadParams,
  ListMessagesParams,
  ListMessagesQueryParams,
  SendMessageParams,
  EditMessageParams,
  EditMessageBody,
  ToggleReactionParams,
  ToggleReactionBody,
  SendTypingIndicatorParams,
  SendTypingIndicatorBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

function buildReactionsMap(rows: { messageId: number; emoji: string; userId: number }[]) {
  const map = new Map<number, Map<string, number[]>>();
  for (const r of rows) {
    if (!map.has(r.messageId)) map.set(r.messageId, new Map());
    const byEmoji = map.get(r.messageId)!;
    if (!byEmoji.has(r.emoji)) byEmoji.set(r.emoji, []);
    byEmoji.get(r.emoji)!.push(r.userId);
  }
  return map;
}

function formatReactions(map: Map<number, Map<string, number[]>>, msgId: number) {
  const byEmoji = map.get(msgId) ?? new Map();
  return Array.from(byEmoji.entries()).map(([emoji, userIds]) => ({ emoji, count: userIds.length, userIds }));
}

router.get("/conversations", requireUser, async (req, res): Promise<void> => {
  const currentUser = (req as any).user;
  const convos = await db.select().from(conversationsTable)
    .where(or(eq(conversationsTable.user1Id, currentUser.id), eq(conversationsTable.user2Id, currentUser.id)))
    .orderBy(desc(conversationsTable.updatedAt));

  const result = await Promise.all(convos.map(async (c) => {
    const otherUserId = c.user1Id === currentUser.id ? c.user2Id : c.user1Id;
    const [otherUser] = await db.select().from(usersTable).where(eq(usersTable.id, otherUserId));
    const [lastMessage] = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, c.id)).orderBy(desc(messagesTable.createdAt)).limit(1);
    const unreadMessages = await db.select().from(messagesTable).where(and(eq(messagesTable.conversationId, c.id), eq(messagesTable.isRead, false), eq(messagesTable.senderId, otherUserId)));
    return { id: c.id, otherUser, lastMessage: lastMessage ? { id: lastMessage.id, content: lastMessage.content, senderId: lastMessage.senderId, createdAt: lastMessage.createdAt } : null, unreadCount: unreadMessages.length, createdAt: c.createdAt };
  }));
  res.json(result);
});

router.post("/conversations", requireUser, async (req, res): Promise<void> => {
  const currentUser = (req as any).user;
  const parsed = CreateConversationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const targetUserId = parsed.data.targetUserId;
  const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.id, targetUserId));
  if (!targetUser) { res.status(404).json({ error: "Target user not found" }); return; }
  const minId = Math.min(currentUser.id, targetUserId);
  const maxId = Math.max(currentUser.id, targetUserId);
  const [existing] = await db.select().from(conversationsTable).where(and(eq(conversationsTable.user1Id, minId), eq(conversationsTable.user2Id, maxId)));
  if (existing) {
    const [lastMessage] = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, existing.id)).orderBy(desc(messagesTable.createdAt)).limit(1);
    const unreadMessages = await db.select().from(messagesTable).where(and(eq(messagesTable.conversationId, existing.id), eq(messagesTable.isRead, false), eq(messagesTable.senderId, targetUserId)));
    res.json({ id: existing.id, otherUser: targetUser, lastMessage: lastMessage ? { id: lastMessage.id, content: lastMessage.content, senderId: lastMessage.senderId, createdAt: lastMessage.createdAt } : null, unreadCount: unreadMessages.length, createdAt: existing.createdAt });
    return;
  }
  const [created] = await db.insert(conversationsTable).values({ user1Id: minId, user2Id: maxId }).returning();
  res.json({ id: created.id, otherUser: targetUser, lastMessage: null, unreadCount: 0, createdAt: created.createdAt });
});

router.get("/conversations/unread-counts", requireUser, async (req, res): Promise<void> => {
  const currentUser = (req as any).user;
  const convos = await db.select().from(conversationsTable).where(or(eq(conversationsTable.user1Id, currentUser.id), eq(conversationsTable.user2Id, currentUser.id)));
  const result = await Promise.all(convos.map(async (c) => {
    const otherUserId = c.user1Id === currentUser.id ? c.user2Id : c.user1Id;
    const unread = await db.select().from(messagesTable).where(and(eq(messagesTable.conversationId, c.id), eq(messagesTable.isRead, false), eq(messagesTable.senderId, otherUserId)));
    return { conversationId: c.id, count: unread.length };
  }));
  res.json(result);
});

router.get("/conversations/typing-status", requireUser, async (_req, res): Promise<void> => { res.json(getAllTypingStatuses()); });

router.get("/conversations/:id", requireUser, async (req, res): Promise<void> => {
  const currentUser = (req as any).user;
  const parsed = GetConversationParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [c] = await db.select().from(conversationsTable).where(and(eq(conversationsTable.id, parsed.data.id), or(eq(conversationsTable.user1Id, currentUser.id), eq(conversationsTable.user2Id, currentUser.id))));
  if (!c) { res.status(404).json({ error: "Conversation not found" }); return; }
  const otherUserId = c.user1Id === currentUser.id ? c.user2Id : c.user1Id;
  const [otherUser] = await db.select().from(usersTable).where(eq(usersTable.id, otherUserId));
  const [lastMessage] = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, c.id)).orderBy(desc(messagesTable.createdAt)).limit(1);
  const unread = await db.select().from(messagesTable).where(and(eq(messagesTable.conversationId, c.id), eq(messagesTable.isRead, false), eq(messagesTable.senderId, otherUserId)));
  res.json({ id: c.id, otherUser, lastMessage: lastMessage ? { id: lastMessage.id, content: lastMessage.content, senderId: lastMessage.senderId, createdAt: lastMessage.createdAt } : null, unreadCount: unread.length, createdAt: c.createdAt });
});

router.patch("/conversations/:id/read", requireUser, async (req, res): Promise<void> => {
  const currentUser = (req as any).user;
  const parsed = MarkConversationReadParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [c] = await db.select().from(conversationsTable).where(and(eq(conversationsTable.id, parsed.data.id), or(eq(conversationsTable.user1Id, currentUser.id), eq(conversationsTable.user2Id, currentUser.id))));
  if (!c) { res.status(404).json({ error: "Conversation not found" }); return; }
  const otherUserId = c.user1Id === currentUser.id ? c.user2Id : c.user1Id;
  await db.update(messagesTable).set({ isRead: true }).where(and(eq(messagesTable.conversationId, parsed.data.id), eq(messagesTable.senderId, otherUserId), eq(messagesTable.isRead, false)));
  res.json({ ok: true });
});

router.get("/conversations/:id/messages", requireUser, async (req, res): Promise<void> => {
  const currentUser = (req as any).user;
  const paramsParsed = ListMessagesParams.safeParse(req.params);
  if (!paramsParsed.success) { res.status(400).json({ error: paramsParsed.error.message }); return; }
  const queryParsed = ListMessagesQueryParams.safeParse(req.query);
  if (!queryParsed.success) { res.status(400).json({ error: queryParsed.error.message }); return; }
  const [c] = await db.select().from(conversationsTable).where(and(eq(conversationsTable.id, paramsParsed.data.id), or(eq(conversationsTable.user1Id, currentUser.id), eq(conversationsTable.user2Id, currentUser.id))));
  if (!c) { res.status(404).json({ error: "Conversation not found" }); return; }

  const msgs = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, paramsParsed.data.id)).orderBy(asc(messagesTable.createdAt)).limit(queryParsed.data.limit ?? 200);
  const senderIds = [...new Set(msgs.map(m => m.senderId))];
  const senders = senderIds.length > 0 ? await db.select().from(usersTable).where(or(...senderIds.map(id => eq(usersTable.id, id)))) : [];
  const senderMap = new Map(senders.map(u => [u.id, u]));

  const msgIds = msgs.map(m => m.id);
  const reactionRows = msgIds.length > 0 ? await db.select().from(messageReactionsTable).where(inArray(messageReactionsTable.messageId, msgIds)) : [];
  const reactionsMap = buildReactionsMap(reactionRows);

  const replyToIds = msgs.map(m => (m as any).replyToId).filter((id): id is number => !!id);
  const replyMsgs = replyToIds.length > 0 ? await db.select().from(messagesTable).where(inArray(messagesTable.id, replyToIds)) : [];
  const replyMsgMap = new Map(replyMsgs.map(m => [m.id, m]));
  const replySenderIds = [...new Set(replyMsgs.map(m => m.senderId))];
  const replySenders = replySenderIds.length > 0 ? await db.select().from(usersTable).where(or(...replySenderIds.map(id => eq(usersTable.id, id)))) : [];
  const replySenderMap = new Map(replySenders.map(u => [u.id, u]));

  res.json(msgs.map(m => {
    const replyToId = (m as any).replyToId;
    const replyMsg = replyToId ? replyMsgMap.get(replyToId) : null;
    const replySender = replyMsg ? replySenderMap.get(replyMsg.senderId) : null;
    return {
      ...m,
      sender: senderMap.get(m.senderId)!,
      reactions: formatReactions(reactionsMap, m.id),
      replyTo: replyMsg ? { id: replyMsg.id, content: replyMsg.content, senderName: replySender ? (replySender.displayName || replySender.username) : "Unknown" } : null,
    };
  }));
});

router.post("/conversations/:id/messages", requireUser, async (req, res): Promise<void> => {
  const currentUser = (req as any).user;
  const paramsParsed = SendMessageParams.safeParse(req.params);
  if (!paramsParsed.success) { res.status(400).json({ error: paramsParsed.error.message }); return; }
  const body = req.body ?? {};
  const [c] = await db.select().from(conversationsTable).where(and(eq(conversationsTable.id, paramsParsed.data.id), or(eq(conversationsTable.user1Id, currentUser.id), eq(conversationsTable.user2Id, currentUser.id))));
  if (!c) { res.status(404).json({ error: "Conversation not found" }); return; }
  const [msg] = await db.insert(messagesTable).values({
    conversationId: paramsParsed.data.id,
    senderId: currentUser.id,
    content: typeof body.content === "string" ? body.content : "",
    mediaUrl: body.mediaUrl ?? null,
    mediaType: body.mediaType ?? null,
    isRead: false,
    replyToId: typeof body.replyToId === "number" ? body.replyToId : null,
  } as any).returning();
  await db.update(conversationsTable).set({ updatedAt: new Date() }).where(eq(conversationsTable.id, paramsParsed.data.id));
  setTyping(paramsParsed.data.id, currentUser.id, false);

  let replyTo = null;
  if ((msg as any).replyToId) {
    const [replyMsg] = await db.select().from(messagesTable).where(eq(messagesTable.id, (msg as any).replyToId));
    if (replyMsg) {
      const [replySender] = await db.select().from(usersTable).where(eq(usersTable.id, replyMsg.senderId));
      replyTo = { id: replyMsg.id, content: replyMsg.content, senderName: replySender ? (replySender.displayName || replySender.username) : "Unknown" };
    }
  }

  res.status(201).json({ ...msg, sender: currentUser, reactions: [], replyTo });
});

router.patch("/conversations/:id/messages/:messageId", requireUser, async (req, res): Promise<void> => {
  const currentUser = (req as any).user;
  const paramsParsed = EditMessageParams.safeParse(req.params);
  if (!paramsParsed.success) { res.status(400).json({ error: paramsParsed.error.message }); return; }
  const bodyParsed = EditMessageBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  const [msg] = await db.select().from(messagesTable).where(eq(messagesTable.id, paramsParsed.data.messageId));
  if (!msg) { res.status(404).json({ error: "Message not found" }); return; }
  if (msg.senderId !== currentUser.id) { res.status(403).json({ error: "You can only edit your own messages" }); return; }
  if (msg.conversationId !== paramsParsed.data.id) { res.status(404).json({ error: "Message not in this conversation" }); return; }
  const [updated] = await db.update(messagesTable).set({ content: bodyParsed.data.content, editedAt: new Date() }).where(eq(messagesTable.id, paramsParsed.data.messageId)).returning();
  const [sender] = await db.select().from(usersTable).where(eq(usersTable.id, updated.senderId));
  const reactionRows = await db.select().from(messageReactionsTable).where(eq(messageReactionsTable.messageId, updated.id));
  const reactionsMap = buildReactionsMap(reactionRows);
  res.json({ ...updated, sender, reactions: formatReactions(reactionsMap, updated.id) });
});

router.delete("/conversations/:id/messages/:messageId", requireUser, async (req, res): Promise<void> => {
  const currentUser = (req as any).user;
  const id = parseInt(req.params.id);
  const messageId = parseInt(req.params.messageId);
  if (isNaN(id) || isNaN(messageId)) { res.status(400).json({ error: "Invalid params" }); return; }
  const [c] = await db.select().from(conversationsTable).where(and(eq(conversationsTable.id, id), or(eq(conversationsTable.user1Id, currentUser.id), eq(conversationsTable.user2Id, currentUser.id))));
  if (!c) { res.status(404).json({ error: "Conversation not found" }); return; }
  const [msg] = await db.select().from(messagesTable).where(eq(messagesTable.id, messageId));
  if (!msg) { res.status(404).json({ error: "Message not found" }); return; }
  if (msg.senderId !== currentUser.id) { res.status(403).json({ error: "You can only delete your own messages" }); return; }
  await db.delete(messageReactionsTable).where(eq(messageReactionsTable.messageId, messageId));
  await db.delete(messagesTable).where(eq(messagesTable.id, messageId));
  res.json({ ok: true });
});

router.post("/conversations/:id/messages/:messageId/reactions", requireUser, async (req, res): Promise<void> => {
  const currentUser = (req as any).user;
  const paramsParsed = ToggleReactionParams.safeParse(req.params);
  if (!paramsParsed.success) { res.status(400).json({ error: paramsParsed.error.message }); return; }
  const bodyParsed = ToggleReactionBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }

  const { id: convId, messageId } = paramsParsed.data;
  const { emoji } = bodyParsed.data;

  const [c] = await db.select().from(conversationsTable).where(and(eq(conversationsTable.id, convId), or(eq(conversationsTable.user1Id, currentUser.id), eq(conversationsTable.user2Id, currentUser.id))));
  if (!c) { res.status(404).json({ error: "Conversation not found" }); return; }

  const [existing] = await db.select().from(messageReactionsTable).where(and(eq(messageReactionsTable.messageId, messageId), eq(messageReactionsTable.userId, currentUser.id), eq(messageReactionsTable.emoji, emoji)));
  let added: boolean;
  if (existing) {
    await db.delete(messageReactionsTable).where(eq(messageReactionsTable.id, existing.id));
    added = false;
  } else {
    await db.insert(messageReactionsTable).values({ messageId, userId: currentUser.id, emoji });
    added = true;
  }

  const reactionRows = await db.select().from(messageReactionsTable).where(eq(messageReactionsTable.messageId, messageId));
  const reactionsMap = buildReactionsMap(reactionRows);
  res.json({ added, reactions: formatReactions(reactionsMap, messageId) });
});

router.post("/conversations/:id/typing", requireUser, async (req, res): Promise<void> => {
  const currentUser = (req as any).user;
  const paramsParsed = SendTypingIndicatorParams.safeParse(req.params);
  if (!paramsParsed.success) { res.status(400).json({ error: paramsParsed.error.message }); return; }
  const bodyParsed = SendTypingIndicatorBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  setTyping(paramsParsed.data.id, currentUser.id, bodyParsed.data.isTyping);
  res.json({ ok: true });
});

export default router;
