"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession } from "@/lib/auth/session";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  confirmPassword: z.string().min(8),
});

async function makeAutoUsername(email: string) {
  const localPart = email.split("@")[0] ?? "player";
  const cleaned = localPart
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 20);
  const base = (cleaned.length >= 3 ? cleaned : `player_${cleaned}`).slice(0, 20);
  let candidate = base;
  let suffix = 1;
  // Keep usernames unique while registration remains email-only.
  while (await prisma.user.findUnique({ where: { username: candidate }, select: { id: true } })) {
    suffix += 1;
    candidate = `${base}_${suffix}`.slice(0, 30);
  }
  return candidate;
}

export async function registerAction(_state: string | null, formData: FormData) {
  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return "Invalid registration fields.";
  if (parsed.data.password !== parsed.data.confirmPassword) {
    return "Passwords do not match.";
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });
  if (existing) return "Email is already in use.";

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const username = await makeAutoUsername(parsed.data.email);
  const user = await prisma.user.create({
    data: { username, email: parsed.data.email, passwordHash, lastSeenAt: new Date() },
  });
  await createSession(user.id);
  redirect("/character/new");
}

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8) });

export async function loginAction(_state: string | null, formData: FormData) {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return "Invalid credentials.";

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) return "Invalid credentials.";

  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) return "Invalid credentials.";

  await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
  await createSession(user.id);
  const hasCharacter = await prisma.character.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  redirect(hasCharacter ? "/town" : "/character/new");
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}
