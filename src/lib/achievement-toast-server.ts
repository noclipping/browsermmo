import { cookies } from "next/headers";
import type { AchievementToastItem } from "@/lib/achievement-toast-types";
import { prisma } from "@/lib/prisma";

const COOKIE = "mm_achievement_toast";

function dedupeItems(items: AchievementToastItem[]): AchievementToastItem[] {
  const byKey = new Map<string, AchievementToastItem>();
  for (const x of items) {
    if (x.key) byKey.set(x.key, x);
  }
  return [...byKey.values()];
}

export async function achievementToastItemsForKeys(keys: string[]): Promise<AchievementToastItem[]> {
  if (!keys.length) return [];
  const uniq = [...new Set(keys.filter((k) => typeof k === "string" && k.length > 0))];
  const rows = await prisma.achievement.findMany({
    where: { key: { in: uniq } },
    select: { key: true, name: true, description: true, icon: true },
  });
  const order = new Map(uniq.map((k, i) => [k, i]));
  rows.sort((a, b) => (order.get(a.key) ?? 99) - (order.get(b.key) ?? 99));
  return rows;
}

/** Merge into a short-lived cookie so form-only flows still surface toasts after navigation. */
export async function mergeAchievementToastCookie(items: AchievementToastItem[]): Promise<void> {
  const next = dedupeItems(items);
  if (!next.length) return;
  const jar = await cookies();
  let existing: AchievementToastItem[] = [];
  try {
    const raw = jar.get(COOKIE)?.value;
    if (raw) existing = JSON.parse(raw) as AchievementToastItem[];
  } catch {
    /* ignore */
  }
  const merged = dedupeItems([...existing, ...next]);
  jar.set(COOKIE, JSON.stringify(merged), {
    path: "/",
    maxAge: 120,
    sameSite: "lax",
    httpOnly: false,
  });
}

export async function queueAchievementToasts(keys: string[]): Promise<void> {
  const items = await achievementToastItemsForKeys(keys);
  if (!items.length) return;
  await mergeAchievementToastCookie(items);
}
