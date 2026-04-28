import { prisma } from "@/lib/prisma";

/** How often we write `User.lastSeenAt` for an active session (reduces DB churn). */
const LAST_SEEN_TOUCH_MIN_INTERVAL_MS = 2 * 60 * 1000;

/** If `lastSeenAt` is newer than this, we show “Online” (async / best-effort, not sockets). */
export const LAST_SEEN_ONLINE_WINDOW_MS = 5 * 60 * 1000;

export function isUserRecentlyActive(lastSeenAt: Date | null | undefined): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - lastSeenAt.getTime() < LAST_SEEN_ONLINE_WINDOW_MS;
}

export async function touchUserLastSeenIfStale(userId: string): Promise<void> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastSeenAt: true },
  });
  if (!row) return;
  const last = row.lastSeenAt?.getTime() ?? 0;
  if (Date.now() - last < LAST_SEEN_TOUCH_MIN_INTERVAL_MS) return;
  await prisma.user.update({
    where: { id: userId },
    data: { lastSeenAt: new Date() },
  });
}
