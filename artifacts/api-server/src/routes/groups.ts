import { Router, type IRouter } from "express";
import { eq, desc, asc, inArray, and, or } from "drizzle-orm";
import { db, usersTable, groupsTable, groupMembersTable, groupMessagesTable, groupMessageReactionsTable } from "@workspace/db";
import { requireUser } from "../lib/auth";
import {
  CreateGroupBody, GetGroupParams, UpdateGroupParams, UpdateGroupBody,
  ListGroupMessagesParams, ListGroupMessagesQueryParams,
  SendGroupMessageParams, SendGroupMessageBody,
  RemoveGroupMemberParams, UpdateGroupMemberParams, UpdateGroupMemberBody,
  EditGroupMessageParams, EditGroupMessageBody,
  ToggleGroupMessageReactionParams, ToggleGroupMessageReactionBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

function buildReactionsMap(rows: { groupMessageId: number; emoji: string; userId: number }[]) {
  const map = new Map<number, Map<string, number[]>>();
  for (const r of rows) {
    if (!map.has(r.groupMessageId)) map.set(r.groupMessageId, new Map());
    const byEmoji = map.get(r.groupMessageId)!;
    if (!byEmoji.has(r.emoji)) byEmoji.set(r.emoji, []);
    byEmoji.get(r.emoji)!.push(r.userId);
  }
  return map;
}

function formatReactions(map: Map<number, Map<string, number[]>>, msgId: number) {
  const byEmoji = map.get(msgId) ?? new Map();
  return Array.from(byEmoji.entries()).map(([emoji, userIds]) => ({ emoji, count: userIds.length, userIds }));
}

async function buildGroupSummary(groupId: number) {
  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId));
  if (!group) return null;
  const memberRows = await db.select().from(groupMembersTable).where(eq(groupMembersTable.groupId, groupId));
  const memberIds = memberRows.map((m) => m.userId);
  const users = memberIds.length > 0 ? await db.select().from(usersTable).where(inArray(usersTable.id, memberIds)) : [];
  const isAdminMap = new Map(memberRows.map((m) => [m.userId, m.isAdmin]));
  const members = users.map((u) => ({ ...u, isAdmin: isAdminMap.get(u.id) ?? false }));
  const [lastMsg] = await db.select().from(groupMessagesTable).where(eq(groupMessagesTable.groupId, groupId)).orderBy(desc(groupMessagesTable.createdAt)).limit(1);
  let lastMessage = null;
  if (lastMsg) {
    const [sender] = await db.select().from(usersTable).where(eq(usersTable.id, lastMsg.senderId));
    lastMessage = { id: lastMsg.id, content: lastMsg.content, senderId: lastMsg.senderId, senderName: sender ? (sender.displayName || sender.username) : "Unknown", createdAt: lastMsg.createdAt };
  }
  return { id: group.id, name: group.name, description: group.description ?? null, adminOnlyMessaging: group.adminOnlyMessaging, createdById: group.createdById, memberCount: members.length, members, lastMessage, createdAt: group.createdAt, updatedAt: group.updatedAt };
}

router.get("/groups", requireUser, async (req, res): Promise<void> => {
  const currentUser = (req as any).user;
  const memberRows = await db.select().from(groupMembersTable).where(eq(groupMembersTable.userId, currentUser.id));
  const groupIds = memberRows.map((m) => m.groupId);
  if (groupIds.length === 0) { res.json([]); return; }
  const groups = await db.select().from(groupsTable).where(inArray(groupsTable.id, groupIds)).orderBy(desc(groupsTable.updatedAt));
  const result = await Promise.all(groups.map((g) => buildGroupSummary(g.id)));
  res.json(result.filter(Boolean));
});

router.post("/groups", requireUser, async (req, res): Promise<void> => {
  const currentUser = (req as any).user;
  const parsed = CreateGroupBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { name, memberUserIds } = parsed.data;
  const allMemberIds = [...new Set([currentUser.id, ...memberUserIds])];
  const existingUsers = await db.select().from(usersTable).where(inArray(usersTable.id, allMemberIds));
  if (existingUsers.length !== allMemberIds.length) { res.status(400).json({ error: "One or more users not found" }); return; }
  const [group] = await db.insert(groupsTable).values({ name, createdById: currentUser.id }).returning();
  await db.insert(groupMembersTable).values(allMemberIds.map((userId) => ({ groupId: group.id, userId, isAdmin: userId === currentUser.id })));
  res.status(201).json(await buildGroupSummary(group.id));
});

router.get("/groups/:id", requireUser, async (req, res): Promise<void> => {
  const currentUser = (req as any).user;
  const parsed = GetGroupParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const memberRows = await db.select().from(groupMembersTable).where(eq(groupMembersTable.groupId, parsed.data.id));
  if (!memberRows.some((m) => m.userId === currentUser.id)) { res.status(404).json({ error: "Group not found or you are not a member" }); return; }
  const summary = await buildGroupSummary(parsed.data.id);
  if (!summary) { res.status(404).json({ error: "Group not found" }); return; }
  res.json(summary);
});

router.patch("/groups/:id", requireUser, async (req, res): Promise<void> => {
  const currentUser = (req as any).user;
  const paramsParsed = UpdateGroupParams.safeParse(req.params);
  if (!paramsParsed.success) { res.status(400).json({ error: paramsParsed.error.message }); return; }
  const bodyParsed = UpdateGroupBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  const memberRows = await db.select().from(groupMembersTable).where(eq(groupMembersTable.groupId, paramsParsed.data.id));
  const currentMember = memberRows.find((m) => m.userId === currentUser.id);
  if (!currentMember) { res.status(403).json({ error: "You are not a member of this group" }); return; }
  if (bodyParsed.data.adminOnlyMessaging !== undefined && !currentMember.isAdmin) { res.status(403).json({ error: "Only admins can change messaging mode" }); return; }
  const updateData: Record<string, unknown> = {};
  if (bodyParsed.data.name !== undefined) updateData.name = bodyParsed.data.name;
  if (bodyParsed.data.description !== undefined) updateData.description = bodyParsed.data.description;
  if (bodyParsed.data.adminOnlyMessaging !== undefined) updateData.adminOnlyMessaging = bodyParsed.data.adminOnlyMessaging;
  await db.update(groupsTable).set(updateData).where(eq(groupsTable.id, paramsParsed.data.id));
  res.json(await buildGroupSummary(paramsParsed.data.id));
});

router.post("/groups/:id/members", requireUser, async (req, res): Promise<void> => {
  const currentUser = (req as any).user;
  const groupId = parseInt(req.params.id);
  if (isNaN(groupId)) { res.status(400).json({ error: "Invalid group id" }); return; }
  const body = req.body ?? {};
  const userId = body.userId;
  if (typeof userId !== "number") { res.status(400).json({ error: "userId must be a number" }); return; }
  const memberRows = await db.select().from(groupMembersTable).where(eq(groupMembersTable.groupId, groupId));
  const currentMember = memberRows.find((m) => m.userId === currentUser.id);
  if (!currentMember) { res.status(403).json({ error: "You are not a member of this group" }); return; }
  if (memberRows.some((m) => m.userId === userId)) { res.status(400).json({ error: "User is already a member" }); return; }
  const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!targetUser) { res.status(404).json({ error: "User not found" }); return; }
  await db.insert(groupMembersTable).values({ groupId, userId, isAdmin: false });
  res.json({ ok: true });
});

router.delete("/groups/:id/members/:userId", requireUser, async (req, res): Promise<void> => {
  const currentUser = (req as any).user;
  const parsed = RemoveGroupMemberParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { id: groupId, userId: targetUserId } = parsed.data;
  const memberRows = await db.select().from(groupMembersTable).where(eq(groupMembersTable.groupId, groupId));
  const currentMember = memberRows.find((m) => m.userId === currentUser.id);
  if (!currentMember) { res.status(403).json({ error: "You are not a member of this group" }); return; }
  if (targetUserId !== currentUser.id && !currentMember.isAdmin) { res.status(403).json({ error: "Only admins can remove members" }); return; }
  if (!memberRows.find((m) => m.userId === targetUserId)) { res.status(404).json({ error: "User is not a member" }); return; }
  await db.delete(groupMembersTable).where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, targetUserId)));
  res.json({ ok: true });
});

router.patch("/groups/:id/members/:userId", requireUser, async (req, res): Promise<void> => {
  const currentUser = (req as any).user;
  const paramsParsed = UpdateGroupMemberParams.safeParse(req.params);
  if (!paramsParsed.success) { res.status(400).json({ error: paramsParsed.error.message }); return; }
  const bodyParsed = UpdateGroupMemberBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  const { id: groupId, userId: targetUserId } = paramsParsed.data;
  const memberRows = await db.select().from(groupMembersTable).where(eq(groupMembersTable.groupId, groupId));
  const currentMember = memberRows.find((m) => m.userId === currentUser.id);
  if (!currentMember?.isAdmin) { res.status(403).json({ error: "Only admins can change member roles" }); return; }
  if (!memberRows.find((m) => m.userId === targetUserId)) { res.status(404).json({ error: "User is not a member" }); return; }
  await db.update(groupMembersTable).set({ isAdmin: bodyParsed.data.isAdmin }).where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, targetUserId)));
  res.json({ ok: true });
});

router.get("/groups/:id/messages", requireUser, async (req, res): Promise<void> => {
  const currentUser = (req as any).user;
  const paramsParsed = ListGroupMessagesParams.safeParse(req.params);
  if (!paramsParsed.success) { res.status(400).json({ error: paramsParsed.error.message }); return; }
  const queryParsed = ListGroupMessagesQueryParams.safeParse(req.query);
  if (!queryParsed.success) { res.status(400).json({ error: queryParsed.error.message }); return; }
  const memberRows = await db.select().from(groupMembersTable).where(eq(groupMembersTable.groupId, paramsParsed.data.id));
  if (!memberRows.some((m) => m.userId === currentUser.id)) { res.status(404).json({ error: "Group not found or not a member" }); return; }

  const msgs = await db.select().from(groupMessagesTable).where(eq(groupMessagesTable.groupId, paramsParsed.data.id)).orderBy(asc(groupMessagesTable.createdAt)).limit(queryParsed.data.limit ?? 200);
  const senderIds = [...new Set(msgs.map((m) => m.senderId))];
  const senders = senderIds.length > 0 ? await db.select().from(usersTable).where(inArray(usersTable.id, senderIds)) : [];
  const senderMap = new Map(senders.map((u) => [u.id, u]));

  const msgIds = msgs.map((m) => m.id);
  const reactionRows = msgIds.length > 0 ? await db.select().from(groupMessageReactionsTable).where(inArray(groupMessageReactionsTable.groupMessageId, msgIds)) : [];
  const reactionsMap = buildReactionsMap(reactionRows);

  const replyToIds = msgs.map(m => (m as any).replyToId).filter((id): id is number => !!id);
  const replyMsgs = replyToIds.length > 0 ? await db.select().from(groupMessagesTable).where(inArray(groupMessagesTable.id, replyToIds)) : [];
  const replyMsgMap = new Map(replyMsgs.map(m => [m.id, m]));
  const replySenderIds = [...new Set(replyMsgs.map(m => m.senderId))];
  const replySenders = replySenderIds.length > 0 ? await db.select().from(usersTable).where(inArray(usersTable.id, replySenderIds)) : [];
  const replySenderMap = new Map(replySenders.map(u => [u.id, u]));

  res.json(msgs.map((m) => {
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

router.post("/groups/:id/messages", requireUser, async (req, res): Promise<void> => {
  const currentUser = (req as any).user;
  const paramsParsed = SendGroupMessageParams.safeParse(req.params);
  if (!paramsParsed.success) { res.status(400).json({ error: paramsParsed.error.message }); return; }
  const body = req.body ?? {};
  const memberRows = await db.select().from(groupMembersTable).where(eq(groupMembersTable.groupId, paramsParsed.data.id));
  const currentMember = memberRows.find((m) => m.userId === currentUser.id);
  if (!currentMember) { res.status(403).json({ error: "Not a member" }); return; }
  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, paramsParsed.data.id));
  if (group?.adminOnlyMessaging && !currentMember.isAdmin) { res.status(403).json({ error: "Only admins can send messages" }); return; }
  const [msg] = await db.insert(groupMessagesTable).values({
    groupId: paramsParsed.data.id,
    senderId: currentUser.id,
    content: typeof body.content === "string" ? body.content : "",
    mediaUrl: body.mediaUrl ?? null,
    mediaType: body.mediaType ?? null,
    replyToId: typeof body.replyToId === "number" ? body.replyToId : null,
  } as any).returning();
  await db.update(groupsTable).set({ updatedAt: new Date() }).where(eq(groupsTable.id, paramsParsed.data.id));

  let replyTo = null;
  if ((msg as any).replyToId) {
    const [replyMsg] = await db.select().from(groupMessagesTable).where(eq(groupMessagesTable.id, (msg as any).replyToId));
    if (replyMsg) {
      const [replySender] = await db.select().from(usersTable).where(eq(usersTable.id, replyMsg.senderId));
      replyTo = { id: replyMsg.id, content: replyMsg.content, senderName: replySender ? (replySender.displayName || replySender.username) : "Unknown" };
    }
  }

  res.status(201).json({ ...msg, sender: currentUser, reactions: [], replyTo });
});

router.patch("/groups/:id/messages/:messageId", requireUser, async (req, res): Promise<void> => {
  const currentUser = (req as any).user;
  const paramsParsed = EditGroupMessageParams.safeParse(req.params);
  if (!paramsParsed.success) { res.status(400).json({ error: paramsParsed.error.message }); return; }
  const bodyParsed = EditGroupMessageBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  const [msg] = await db.select().from(groupMessagesTable).where(eq(groupMessagesTable.id, paramsParsed.data.messageId));
  if (!msg) { res.status(404).json({ error: "Message not found" }); return; }
  if (msg.senderId !== currentUser.id) { res.status(403).json({ error: "You can only edit your own messages" }); return; }
  const [updated] = await db.update(groupMessagesTable).set({ content: bodyParsed.data.content, editedAt: new Date() }).where(eq(groupMessagesTable.id, paramsParsed.data.messageId)).returning();
  const [sender] = await db.select().from(usersTable).where(eq(usersTable.id, updated.senderId));
  const reactionRows = await db.select().from(groupMessageReactionsTable).where(eq(groupMessageReactionsTable.groupMessageId, updated.id));
  const reactionsMap = buildReactionsMap(reactionRows);
  res.json({ ...updated, sender, reactions: formatReactions(reactionsMap, updated.id) });
});

router.delete("/groups/:id/messages/:messageId", requireUser, async (req, res): Promise<void> => {
  const currentUser = (req as any).user;
  const groupId = parseInt(req.params.id);
  const messageId = parseInt(req.params.messageId);
  if (isNaN(groupId) || isNaN(messageId)) { res.status(400).json({ error: "Invalid params" }); return; }
  const memberRows = await db.select().from(groupMembersTable).where(eq(groupMembersTable.groupId, groupId));
  if (!memberRows.some((m) => m.userId === currentUser.id)) { res.status(403).json({ error: "Not a member" }); return; }
  const [msg] = await db.select().from(groupMessagesTable).where(eq(groupMessagesTable.id, messageId));
  if (!msg) { res.status(404).json({ error: "Message not found" }); return; }
  if (msg.senderId !== currentUser.id) { res.status(403).json({ error: "You can only delete your own messages" }); return; }
  await db.delete(groupMessageReactionsTable).where(eq(groupMessageReactionsTable.groupMessageId, messageId));
  await db.delete(groupMessagesTable).where(eq(groupMessagesTable.id, messageId));
  res.json({ ok: true });
});

router.post("/groups/:id/messages/:messageId/reactions", requireUser, async (req, res): Promise<void> => {
  const currentUser = (req as any).user;
  const paramsParsed = ToggleGroupMessageReactionParams.safeParse(req.params);
  if (!paramsParsed.success) { res.status(400).json({ error: paramsParsed.error.message }); return; }
  const bodyParsed = ToggleGroupMessageReactionBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }

  const { id: groupId, messageId } = paramsParsed.data;
  const { emoji } = bodyParsed.data;

  const memberRows = await db.select().from(groupMembersTable).where(eq(groupMembersTable.groupId, groupId));
  if (!memberRows.some((m) => m.userId === currentUser.id)) { res.status(403).json({ error: "Not a member" }); return; }

  const [existing] = await db.select().from(groupMessageReactionsTable).where(and(eq(groupMessageReactionsTable.groupMessageId, messageId), eq(groupMessageReactionsTable.userId, currentUser.id), eq(groupMessageReactionsTable.emoji, emoji)));
  let added: boolean;
  if (existing) {
    await db.delete(groupMessageReactionsTable).where(eq(groupMessageReactionsTable.id, existing.id));
    added = false;
  } else {
    await db.insert(groupMessageReactionsTable).values({ groupMessageId: messageId, userId: currentUser.id, emoji });
    added = true;
  }

  const reactionRows = await db.select().from(groupMessageReactionsTable).where(eq(groupMessageReactionsTable.groupMessageId, messageId));
  const reactionsMap = buildReactionsMap(reactionRows);
  res.json({ added, reactions: formatReactions(reactionsMap, messageId) });
});

export default router;
