import { Router, type IRouter } from "express";
import { eq, desc, count } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

// ─── In-memory action log ────────────────────────────────────────────────────
interface ActionLogEntry {
  id: number;
  timestamp: string;
  adminId: number;
  adminUsername: string;
  targetId: number;
  targetUsername: string;
  action: "promote" | "demote" | "delete";
  detail: string;
}

const actionLog: ActionLogEntry[] = [];
let logSeq = 0;

function addLog(entry: Omit<ActionLogEntry, "id" | "timestamp">) {
  actionLog.unshift({ id: ++logSeq, timestamp: new Date().toISOString(), ...entry });
  if (actionLog.length > 200) actionLog.pop();
}

// ─── Routes ──────────────────────────────────────────────────────────────────

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

router.get("/admin/action-logs", requireAdmin, async (req, res): Promise<void> => {
  res.json(actionLog.slice(0, 100));
});

router.patch("/admin/users/:id/role", requireAdmin, async (req, res): Promise<void> => {
  const targetId = parseInt(req.params.id, 10);
  const admin = (req as any).user;

  if (isNaN(targetId)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }
  if (targetId === admin.id) {
    res.status(400).json({ error: "You cannot change your own role" });
    return;
  }
  const { role } = req.body;
  if (role !== "admin" && role !== "user") {
    res.status(400).json({ error: "Role must be 'admin' or 'user'" });
    return;
  }

  const [target] = await db
    .select({ id: usersTable.id, username: usersTable.username })
    .from(usersTable)
    .where(eq(usersTable.id, targetId));
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ role })
    .where(eq(usersTable.id, targetId))
    .returning({ id: usersTable.id, role: usersTable.role });

  const action = role === "admin" ? "promote" : "demote";
  addLog({
    adminId: admin.id,
    adminUsername: admin.username,
    targetId: target.id,
    targetUsername: target.username,
    action,
    detail: role === "admin"
      ? `@${admin.username} promoted @${target.username} to admin`
      : `@${admin.username} demoted @${target.username} to user`,
  });

  res.json(updated);
});

router.delete("/admin/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const targetId = parseInt(req.params.id, 10);
  const admin = (req as any).user;

  if (isNaN(targetId)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }
  if (targetId === admin.id) {
    res.status(400).json({ error: "You cannot delete your own account from the admin panel" });
    return;
  }

  const [target] = await db
    .select({ id: usersTable.id, username: usersTable.username })
    .from(usersTable)
    .where(eq(usersTable.id, targetId));
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  await db.delete(usersTable).where(eq(usersTable.id, targetId));

  addLog({
    adminId: admin.id,
    adminUsername: admin.username,
    targetId: target.id,
    targetUsername: target.username,
    action: "delete",
    detail: `@${admin.username} deleted user @${target.username}`,
  });

  res.json({ success: true });
});

export default router;
