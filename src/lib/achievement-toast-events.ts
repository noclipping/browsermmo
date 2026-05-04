import type { AchievementToastItem } from "@/lib/achievement-toast-types";

export const ACHIEVEMENT_UNLOCK_EVENT = "browsermmo:achievement-unlock";

export type AchievementUnlockDetail = { items: AchievementToastItem[] };

const COOKIE = "mm_achievement_toast";

/** Client-only: show achievement toast(s) + confetti (AchievementToastProvider listens). */
export function emitAchievementToasts(items: AchievementToastItem[]) {
  if (typeof window === "undefined" || !items.length) return;
  window.dispatchEvent(
    new CustomEvent<AchievementUnlockDetail>(ACHIEVEMENT_UNLOCK_EVENT, { detail: { items } }),
  );
}

export function readAchievementToastCookie(): AchievementToastItem[] | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]*)`));
  if (!m?.[1]) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(m[1])) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(
      (x): x is AchievementToastItem =>
        x != null &&
        typeof x === "object" &&
        typeof (x as AchievementToastItem).key === "string" &&
        typeof (x as AchievementToastItem).name === "string",
    );
  } catch {
    return null;
  }
}

export function clearAchievementToastCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE}=; path=/; max-age=0`;
}

/** Read server-set cookie + dispatch unlock event (form flows without route change). */
export function drainAchievementToastCookie(): void {
  const items = readAchievementToastCookie();
  if (!items?.length) return;
  clearAchievementToastCookie();
  emitAchievementToasts(items);
}
