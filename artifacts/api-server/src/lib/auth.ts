import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

export const JWT_SECRET = process.env.JWT_SECRET || "quick-vibe-dev-secret-change-in-production";
export const JWT_EXPIRES_IN = "30d";

export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number };
    (req as any).userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

export const requireUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  let payload: { userId: number };
  try {
    payload = jwt.verify(token, JWT_SECRET) as { userId: number };
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId));
  if (!user) {
    res.status(404).json({ error: "User not found. Please complete profile setup." });
    return;
  }
  (req as any).user = user;
  next();
};

export const requireAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  let payload: { userId: number };
  try {
    payload = jwt.verify(token, JWT_SECRET) as { userId: number };
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId));
  if (!user) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  if (user.role !== "admin") {
    res.status(403).json({ error: "Admin access required." });
    return;
  }
  (req as any).user = user;
  next();
};
