import type { GuildMember } from "@prisma/client";
import { guildRoleRankForSuccession } from "@/lib/game/guild-rank";

export type GuildMemberForSuccession = Pick<GuildMember, "userId" | "role" | "joinedAt">;

/**
 * Pick the next guild owner when the current owner leaves. Prefer OFFICER, then MEMBER, then INITIATE.
 * Tie-break: earliest `joinedAt`, then `userId` lexicographic (stable).
 */
export function pickGuildSuccessorPlain(members: GuildMemberForSuccession[], leavingUserId: string): GuildMemberForSuccession | null {
  const candidates = members.filter((m) => m.userId !== leavingUserId && m.role !== "OWNER");
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => {
    const dr = guildRoleRankForSuccession(b.role) - guildRoleRankForSuccession(a.role);
    if (dr !== 0) return dr;
    const t = a.joinedAt.getTime() - b.joinedAt.getTime();
    if (t !== 0) return t;
    return a.userId.localeCompare(b.userId);
  })[0]!;
}
