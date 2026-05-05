import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { JWT_SECRET, JWT_EXPIRES_IN } from "../lib/auth";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";

const router: IRouter = Router();

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ─── Password reset token store (in-memory, expires in 1 hour) ───────────────
interface ResetToken {
  userId: number;
  email: string;
  expiresAt: number;
}
const resetTokens = new Map<string, ResetToken>();

// Periodically clean up expired tokens
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of resetTokens.entries()) {
    if (data.expiresAt < now) resetTokens.delete(token);
  }
}, 10 * 60 * 1000); // every 10 min

// ─── Auth routes ──────────────────────────────────────────────────────────────

router.post("/auth/register", async (req, res): Promise<void> => {
  const { email, password } = req.body;
  if (!email || typeof email !== "string" || !password || typeof password !== "string") {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    res.status(400).json({ error: "Please enter a valid email address" });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, normalizedEmail));
  if (existing) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const username = `user_${crypto.randomBytes(4).toString("hex")}`;

  const [totalRow] = await db.select({ count: usersTable.id }).from(usersTable);
  const isFirstUser = !totalRow;

  const [user] = await db.insert(usersTable).values({
    email: normalizedEmail,
    passwordHash,
    username,
    role: isFirstUser ? "admin" : "user",
    lastSeenAt: new Date(),
  }).returning();

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  res.status(201).json({ token, isNewUser: true });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body;
  if (!email || typeof email !== "string" || !password || typeof password !== "string") {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }
  const normalizedEmail = email.trim().toLowerCase();

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, normalizedEmail));
  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  if (!user.passwordHash) {
    res.status(401).json({ error: "This account uses Google Sign-In. Please sign in with Google." });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  res.json({ token });
});

// ─── Forgot password ──────────────────────────────────────────────────────────

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const { email } = req.body;
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Email is required" });
    return;
  }
  const normalizedEmail = email.trim().toLowerCase();

  const [user] = await db
    .select({ id: usersTable.id, email: usersTable.email, passwordHash: usersTable.passwordHash })
    .from(usersTable)
    .where(eq(usersTable.email, normalizedEmail));

  // Always respond the same way whether or not the email exists (prevents enumeration)
  if (!user || !user.passwordHash) {
    // No account, or Google-only account — still respond generically
    res.json({ message: "If that email has an account, a reset link has been sent." });
    return;
  }

  // Invalidate any previous token for this user
  for (const [t, data] of resetTokens.entries()) {
    if (data.userId === user.id) resetTokens.delete(t);
  }

  const token = crypto.randomBytes(32).toString("hex");
  resetTokens.set(token, {
    userId: user.id,
    email: normalizedEmail,
    expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour
  });

  // Build the reset URL (works for any domain)
  const origin = req.headers.origin || `https://${req.headers.host}`;
  const resetUrl = `${origin}/reset-password?token=${token}`;

  // In a production app you'd email this link. For now we return it directly.
  res.json({
    message: "Reset link generated successfully.",
    resetUrl,
  });
});

// ─── Reset password ───────────────────────────────────────────────────────────

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const { token, password } = req.body;
  if (!token || typeof token !== "string" || !password || typeof password !== "string") {
    res.status(400).json({ error: "Token and new password are required" });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const record = resetTokens.get(token);
  if (!record) {
    res.status(400).json({ error: "This reset link is invalid or has already been used." });
    return;
  }
  if (record.expiresAt < Date.now()) {
    resetTokens.delete(token);
    res.status(400).json({ error: "This reset link has expired. Please request a new one." });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await db
    .update(usersTable)
    .set({ passwordHash })
    .where(eq(usersTable.id, record.userId));

  resetTokens.delete(token);
  res.json({ message: "Password updated successfully. You can now sign in." });
});

// ─── Google OAuth ─────────────────────────────────────────────────────────────

router.post("/auth/google", async (req, res): Promise<void> => {
  const { credential } = req.body;
  if (!credential || typeof credential !== "string") {
    res.status(400).json({ error: "Google credential is required" });
    return;
  }
  if (!process.env.GOOGLE_CLIENT_ID) {
    res.status(503).json({ error: "Google Sign-In is not configured on this server" });
    return;
  }

  let ticket;
  try {
    ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
  } catch {
    res.status(401).json({ error: "Invalid Google credential" });
    return;
  }

  const payload = ticket.getPayload();
  if (!payload?.email) {
    res.status(400).json({ error: "Could not retrieve email from Google" });
    return;
  }

  const googleId = payload.sub;
  const email = payload.email.toLowerCase();
  const displayName = payload.name ?? null;
  const avatarUrl = payload.picture ?? null;

  let [user] = await db.select().from(usersTable).where(eq(usersTable.googleId, googleId));

  if (!user) {
    const [byEmail] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (byEmail) {
      [user] = await db.update(usersTable).set({ googleId, avatarUrl: byEmail.avatarUrl ?? avatarUrl }).where(eq(usersTable.id, byEmail.id)).returning();
    } else {
      const username = `user_${crypto.randomBytes(4).toString("hex")}`;
      const [totalRow] = await db.select({ id: usersTable.id }).from(usersTable);
      const isFirstUser = !totalRow;
      [user] = await db.insert(usersTable).values({
        email,
        passwordHash: "",
        username,
        displayName,
        avatarUrl,
        googleId,
        role: isFirstUser ? "admin" : "user",
        lastSeenAt: new Date(),
      }).returning();
    }
  }

  const isNewUser = !user.username || /^user_[0-9a-f]{8}$/.test(user.username);
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  res.json({ token, isNewUser });
});

export default router;
