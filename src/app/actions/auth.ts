"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession } from "@/lib/auth/session";

const registerSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function registerAction(_state: string | null, formData: FormData) {
  const parsed = registerSchema.safeParse({
    username: formData.get("username"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return "Invalid registration fields.";

  const existing = await prisma.user.findFirst({ where: { OR: [{ email: parsed.data.email }, { username: parsed.data.username }] } });
  if (existing) return "Email or username is already in use.";

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const user = await prisma.user.create({ data: { username: parsed.data.username, email: parsed.data.email, passwordHash, lastSeenAt: new Date() } });
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
  redirect("/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
