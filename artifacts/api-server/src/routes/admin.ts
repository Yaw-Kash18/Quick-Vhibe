import { Router, type IRouter } from "express";
import { eq, ne, desc, count } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

router.get("/admin/users", requireAdmin, async (req, res): Promise<void> => {
  const users = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      username: usersTable.username,
      displayName: usersTable.displayName,
      avatarUrl: usersTable.avatarUrl,
      role: usersTable.role,
      googleId: usersTable.googleId,
      lastSeenAt: usersTable.lastSeenAt,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .orderBy(desc(usersTable.createdAt));
  res.json(users);
});

router.get("/admin/stats", requireAdmin, async (req, res): Promise<void> => {
  const [{ total }] = await db.select({ total: count() }).from(usersTable);
  const adminRows = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.role, "admin"));
  res.json({ totalUsers: total, totalAdmins: adminRows.length });
});

router.patch("/admin/users/:id/role", requireAdmin, async (req, res): Promise<void> => {
  const targetId = parseInt(req.params.id, 10);
  const currentUser = (req as any).user;
  if (isNaN(targetId)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }
  if (targetId === currentUser.id) {
    res.status(400).json({ error: "You cannot change your own role" });
    return;
  }
  const { role } = req.body;
  if (role !== "admin" && role !== "user") {
    res.status(400).json({ error: "Role must be 'admin' or 'user'" });
    return;
  }
  const [target] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, targetId));
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const [updated] = await db
    .update(usersTable)
    .set({ role })
    .where(eq(usersTable.id, targetId))
    .returning({ id: usersTable.id, role: usersTable.role });
  res.json(updated);
});

router.delete("/admin/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const targetId = parseInt(req.params.id, 10);
  const currentUser = (req as any).user;
  if (isNaN(targetId)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }
  if (targetId === currentUser.id) {
    res.status(400).json({ error: "You cannot delete your own account from the admin panel" });
    return;
  }
  const [target] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, targetId));
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  await db.delete(usersTable).where(eq(usersTable.id, targetId));
  res.json({ success: true });
});

export default router;
