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
  // isNewUser=true signals the frontend to redirect to the username-setup screen
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

  // isNewUser=true when the account still has a backend-generated temp username
  const isNewUser = !user.username || /^user_[0-9a-f]{8}$/.test(user.username);
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  res.json({ token, isNewUser });
});

export default router;
