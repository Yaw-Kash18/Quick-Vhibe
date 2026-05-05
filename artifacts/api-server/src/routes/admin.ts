import { Router, type IRouter } from "express";
import { eq, desc, count } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAdmin, requireSuperAdmin, isSuperAdmin, isAdminOrAbove } from "../lib/auth";

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
    .select({ id: usersTable.id, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.role, "admin"));
  const superAdminRows = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.role, "super_admin"));
  res.json({
    totalUsers: total,
    totalAdmins: adminRows.length,
    totalSuperAdmins: superAdminRows.length,
  });
});

router.get("/admin/action-logs", requireAdmin, async (req, res): Promise<void> => {
  res.json(actionLog.slice(0, 100));
});

router.patch("/admin/users/:id/role", requireAdmin, async (req, res): Promise<void> => {
  const targetId = parseInt(req.params.id, 10);
  const actor = (req as any).user;

  if (isNaN(targetId)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }
  if (targetId === actor.id) {
    res.status(400).json({ error: "You cannot change your own role" });
    return;
  }

  const { role } = req.body;
  const validRoles = ["user", "admin", "super_admin"];
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: "Invalid role. Must be user, admin, or super_admin." });
    return;
  }

  // Only super_admin can assign the super_admin role
  if (role === "super_admin" && !isSuperAdmin(actor.role)) {
    res.status(403).json({ error: "Only a Super Admin can promote someone to Super Admin." });
    return;
  }

  const [target] = await db
    .select({ id: usersTable.id, username: usersTable.username, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, targetId));
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Regular admins cannot touch super_admins at all
  if (isSuperAdmin(target.role) && !isSuperAdmin(actor.role)) {
    res.status(403).json({ error: "Only a Super Admin can change a Super Admin's role." });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ role })
    .where(eq(usersTable.id, targetId))
    .returning({ id: usersTable.id, role: usersTable.role });

  const action = isAdminOrAbove(role) && !isAdminOrAbove(target.role)
    ? "promote"
    : !isAdminOrAbove(role) && isAdminOrAbove(target.role)
    ? "demote"
    : role === "super_admin"
    ? "promote"
    : "demote";

  const roleLabel = role === "super_admin" ? "Super Admin" : role === "admin" ? "Admin" : "User";
  addLog({
    adminId: actor.id,
    adminUsername: actor.username,
    targetId: target.id,
    targetUsername: target.username,
    action,
    detail: `@${actor.username} changed @${target.username}'s role to ${roleLabel}`,
  });

  res.json(updated);
});

router.delete("/admin/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const targetId = parseInt(req.params.id, 10);
  const actor = (req as any).user;

  if (isNaN(targetId)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }
  if (targetId === actor.id) {
    res.status(400).json({ error: "You cannot delete your own account from the admin panel" });
    return;
  }

  const [target] = await db
    .select({ id: usersTable.id, username: usersTable.username, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, targetId));
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Regular admins cannot delete super_admins
  if (isSuperAdmin(target.role) && !isSuperAdmin(actor.role)) {
    res.status(403).json({ error: "Only a Super Admin can delete a Super Admin account." });
    return;
  }

  await db.delete(usersTable).where(eq(usersTable.id, targetId));

  addLog({
    adminId: actor.id,
    adminUsername: actor.username,
    targetId: target.id,
    targetUsername: target.username,
    action: "delete",
    detail: `@${actor.username} deleted user @${target.username}`,
  });

  res.json({ success: true });
});

export default router;
