import type { FriendshipStatus, PrismaClient } from "@prisma/client";

export type FriendProfileButtonState =
  | { kind: "self" }
  | { kind: "add_friend" }
  | { kind: "friends"; friendshipId: string }
  | { kind: "outgoing_pending"; friendshipId: string }
  | { kind: "incoming_pending"; friendshipId: string };

type FriendEdge = {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: FriendshipStatus;
};

function computeFriendButtonState(
  myUserId: string,
  profileUserId: string,
  forward: FriendEdge | null,
  reverse: FriendEdge | null,
): FriendProfileButtonState {
  if (myUserId === profileUserId) return { kind: "self" };

  if (forward?.status === "ACCEPTED" || reverse?.status === "ACCEPTED") {
    const row = forward?.status === "ACCEPTED" ? forward : reverse!;
    return { kind: "friends", friendshipId: row.id };
  }
  if (forward?.status === "PENDING") {
    return { kind: "outgoing_pending", friendshipId: forward.id };
  }
  if (reverse?.status === "PENDING") {
    return { kind: "incoming_pending", friendshipId: reverse.id };
  }
  return { kind: "add_friend" };
}

export async function getFriendProfileButtonState(
  db: PrismaClient,
  myUserId: string,
  profileUserId: string,
): Promise<FriendProfileButtonState> {
  if (myUserId === profileUserId) return { kind: "self" };

  const [forward, reverse] = await Promise.all([
    db.friendship.findUnique({
      where: {
        requesterId_addresseeId: { requesterId: myUserId, addresseeId: profileUserId },
      },
    }),
    db.friendship.findUnique({
      where: {
        requesterId_addresseeId: { requesterId: profileUserId, addresseeId: myUserId },
      },
    }),
  ]);

  return computeFriendButtonState(myUserId, profileUserId, forward, reverse);
}

/** One query for up to N directory rows (e.g. players list). */
export async function getFriendProfileButtonStatesForUsers(
  db: PrismaClient,
  myUserId: string,
  otherUserIds: string[],
): Promise<Map<string, FriendProfileButtonState>> {
  const targets = [...new Set(otherUserIds)];
  const map = new Map<string, FriendProfileButtonState>();
  const toQuery = targets.filter((id) => id !== myUserId);

  for (const id of targets) {
    if (id === myUserId) map.set(id, { kind: "self" });
  }

  if (toQuery.length === 0) return map;

  const rows = await db.friendship.findMany({
    where: {
      OR: [
        { requesterId: myUserId, addresseeId: { in: toQuery } },
        { addresseeId: myUserId, requesterId: { in: toQuery } },
      ],
    },
    select: { id: true, requesterId: true, addresseeId: true, status: true },
  });

  for (const id of toQuery) {
    const forward = rows.find((r) => r.requesterId === myUserId && r.addresseeId === id) ?? null;
    const reverse = rows.find((r) => r.requesterId === id && r.addresseeId === myUserId) ?? null;
    map.set(id, computeFriendButtonState(myUserId, id, forward, reverse));
  }

  return map;
}
