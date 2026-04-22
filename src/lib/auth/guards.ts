import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireCharacter(userId: string) {
  const character = await prisma.character.findFirst({ where: { userId } });
  if (!character) redirect("/character/new");
  return character;
}
