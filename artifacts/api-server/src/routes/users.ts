import { Router, type IRouter } from "express";
import { eq, ilike, ne, and } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth, requireUser } from "../lib/auth";
import { updateOnlineStatus, getOnlineUserIds } from "../lib/typingStore";
import {
  UpdateMeBody,
  SearchUsersQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/users/me", requireAuth, async (req, res): Promise<void> => {
  const clerkId = (req as any).clerkId as string;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(user);
});

router.patch("/users/me", requireAuth, async (req, res): Promise<void> => {
  const clerkId = (req as any).clerkId as string;
  const parsed = UpdateMeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));

  if (!existing) {
    // Create user on first patch (upsert)
    const username = parsed.data.username ?? `user_${clerkId.slice(0, 8)}`;
    const [created] = await db.insert(usersTable).values({
      clerkId,
      username,
      displayName: parsed.data.displayName ?? null,
      avatarUrl: parsed.data.avatarUrl ?? null,
      lastSeenAt: new Date(),
    }).returning();
    res.json(created);
    return;
  }

  const [updated] = await db.update(usersTable)
    .set({
      ...(parsed.data.username !== undefined && { username: parsed.data.username }),
      ...(parsed.data.displayName !== undefined && { displayName: parsed.data.displayName }),
      ...(parsed.data.avatarUrl !== undefined && { avatarUrl: parsed.data.avatarUrl }),
    })
    .where(eq(usersTable.clerkId, clerkId))
    .returning();
  res.json(updated);
});

router.get("/users/search", requireUser, async (req, res): Promise<void> => {
  const parsed = SearchUsersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const currentUser = (req as any).user;
  const q = parsed.data.q;
  const users = await db.select().from(usersTable)
    .where(and(
      ilike(usersTable.username, `%${q}%`),
      ne(usersTable.id, currentUser.id),
    ))
    .limit(20);
  res.json(users);
});

router.post("/users/online-status", requireUser, async (req, res): Promise<void> => {
  const user = (req as any).user;
  updateOnlineStatus(user.id);
  await db.update(usersTable)
    .set({ lastSeenAt: new Date() })
    .where(eq(usersTable.id, user.id));
  res.json({ ok: true });
});

router.get("/users/online-users", requireUser, async (req, res): Promise<void> => {
  const onlineUserIds = getOnlineUserIds();
  res.json({ onlineUserIds });
});

export default router;
