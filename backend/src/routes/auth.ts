import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb, users, userProfiles } from "../db";
import { signToken } from "../lib/jwt";
import { sendVerificationEmail, sendPasswordResetEmail } from "../lib/mailer";

export const authRouter = Router();

// ---------------------------------------------------------------------------
// POST /auth/register
// ---------------------------------------------------------------------------
authRouter.post("/register", async (req, res) => {
  const { email, password, displayName, organisation } = req.body ?? {};

  if (typeof email !== "string" || !email.includes("@")) {
    return void res.status(400).json({ detail: "E-mail inválido" });
  }
  if (typeof password !== "string" || password.length < 8) {
    return void res.status(400).json({ detail: "A senha deve ter pelo menos 8 caracteres" });
  }

  const db = getDb();
  const normalizedEmail = email.trim().toLowerCase();

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, normalizedEmail)).limit(1);
  if (existing) {
    return void res.status(409).json({ detail: "E-mail já cadastrado" });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const verificationToken = crypto.randomBytes(32).toString("hex");
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const [user] = await db
    .insert(users)
    .values({ email: normalizedEmail, passwordHash, emailVerificationToken: verificationToken, emailVerificationExpiresAt: verificationExpires })
    .returning({ id: users.id });

  await db.insert(userProfiles)
    .values({ userId: user.id, displayName: displayName?.trim() || null, organisation: organisation?.trim() || null })
    .onConflictDoNothing();

  try {
    await sendVerificationEmail(normalizedEmail, verificationToken);
  } catch (err) {
    console.error("[auth/register] failed to send verification email", err);
  }

  res.status(201).json({ message: "Conta criada. Verifique seu e-mail para ativar o acesso." });
});

// ---------------------------------------------------------------------------
// POST /auth/verify-email
// ---------------------------------------------------------------------------
authRouter.post("/verify-email", async (req, res) => {
  const { token } = req.body ?? {};
  if (typeof token !== "string" || !token) {
    return void res.status(400).json({ detail: "Token inválido" });
  }

  const db = getDb();
  const [user] = await db
    .select({ id: users.id, emailVerificationExpiresAt: users.emailVerificationExpiresAt })
    .from(users)
    .where(eq(users.emailVerificationToken, token))
    .limit(1);

  if (!user) {
    return void res.status(400).json({ detail: "Token inválido ou já utilizado" });
  }
  if (!user.emailVerificationExpiresAt || new Date() > user.emailVerificationExpiresAt) {
    return void res.status(400).json({ detail: "Token expirado. Solicite um novo e-mail de verificação." });
  }

  await db.update(users)
    .set({ emailVerified: true, emailVerificationToken: null, emailVerificationExpiresAt: null, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  res.json({ message: "E-mail verificado com sucesso. Você já pode fazer login." });
});

// ---------------------------------------------------------------------------
// POST /auth/resend-verification
// ---------------------------------------------------------------------------
authRouter.post("/resend-verification", async (req, res) => {
  const { email } = req.body ?? {};
  if (typeof email !== "string" || !email.includes("@")) {
    return void res.status(400).json({ detail: "E-mail inválido" });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const db = getDb();
  const [user] = await db
    .select({ id: users.id, emailVerified: users.emailVerified })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (!user || user.emailVerified) {
    return void res.json({ message: "Se o e-mail existir, um novo link foi enviado." });
  }

  const verificationToken = crypto.randomBytes(32).toString("hex");
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db.update(users)
    .set({ emailVerificationToken: verificationToken, emailVerificationExpiresAt: verificationExpires, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  try {
    await sendVerificationEmail(normalizedEmail, verificationToken);
  } catch (err) {
    console.error("[auth/resend-verification] failed to send email", err);
  }

  res.json({ message: "Se o e-mail existir, um novo link foi enviado." });
});

// ---------------------------------------------------------------------------
// POST /auth/login
// ---------------------------------------------------------------------------
authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string") {
    return void res.status(400).json({ detail: "E-mail e senha são obrigatórios" });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const db = getDb();
  const [user] = await db
    .select({ id: users.id, email: users.email, passwordHash: users.passwordHash, emailVerified: users.emailVerified })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (!user) return void res.status(401).json({ detail: "Credenciais inválidas" });

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) return void res.status(401).json({ detail: "Credenciais inválidas" });

  if (!user.emailVerified) {
    return void res.status(403).json({
      detail: "E-mail ainda não verificado. Verifique sua caixa de entrada.",
      code: "email_not_verified",
    });
  }

  const token = await signToken(user.id, user.email);
  res.json({ token, userId: user.id, email: user.email });
});

// ---------------------------------------------------------------------------
// POST /auth/forgot-password
// ---------------------------------------------------------------------------
authRouter.post("/forgot-password", async (req, res) => {
  const { email } = req.body ?? {};
  if (typeof email !== "string" || !email.includes("@")) {
    return void res.status(400).json({ detail: "E-mail inválido" });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const db = getDb();
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (!user) return void res.json({ message: "Se o e-mail existir, instruções foram enviadas." });

  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetExpires = new Date(Date.now() + 60 * 60 * 1000);

  await db.update(users)
    .set({ passwordResetToken: resetToken, passwordResetExpiresAt: resetExpires, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  try {
    await sendPasswordResetEmail(normalizedEmail, resetToken);
  } catch (err) {
    console.error("[auth/forgot-password] failed to send email", err);
  }

  res.json({ message: "Se o e-mail existir, instruções foram enviadas." });
});

// ---------------------------------------------------------------------------
// POST /auth/reset-password
// ---------------------------------------------------------------------------
authRouter.post("/reset-password", async (req, res) => {
  const { token, password } = req.body ?? {};
  if (typeof token !== "string" || !token) {
    return void res.status(400).json({ detail: "Token inválido" });
  }
  if (typeof password !== "string" || password.length < 8) {
    return void res.status(400).json({ detail: "A senha deve ter pelo menos 8 caracteres" });
  }

  const db = getDb();
  const [user] = await db
    .select({ id: users.id, passwordResetExpiresAt: users.passwordResetExpiresAt })
    .from(users)
    .where(eq(users.passwordResetToken, token))
    .limit(1);

  if (!user) return void res.status(400).json({ detail: "Token inválido ou já utilizado" });
  if (!user.passwordResetExpiresAt || new Date() > user.passwordResetExpiresAt) {
    return void res.status(400).json({ detail: "Token expirado. Solicite uma nova redefinição." });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await db.update(users)
    .set({ passwordHash, passwordResetToken: null, passwordResetExpiresAt: null, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  res.json({ message: "Senha redefinida com sucesso." });
});

// ---------------------------------------------------------------------------
// GET /auth/me
// ---------------------------------------------------------------------------
authRouter.get("/me", async (req, res) => {
  const auth = req.headers.authorization ?? "";
  if (!auth.startsWith("Bearer ")) {
    return void res.status(401).json({ detail: "Token não fornecido" });
  }
  try {
    const { verifyToken } = await import("../lib/jwt");
    const payload = await verifyToken(auth.slice(7).trim());
    res.json({ userId: payload.sub, email: payload.email });
  } catch {
    res.status(401).json({ detail: "Token inválido ou expirado" });
  }
});
