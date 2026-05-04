import type { GuildRole } from "@prisma/client";

/** Rank for succession / sorting (higher = more trusted). OWNER is not stored as a promotion target. */
const SUCCESSION_RANK: Record<Exclude<GuildRole, "OWNER">, number> = {
  OFFICER: 3,
  MEMBER: 2,
  INITIATE: 1,
};

export function guildRoleRankForSuccession(role: GuildRole): number {
  if (role === "OWNER") return 0;
  return SUCCESSION_RANK[role];
}

export function canWithdrawFromTreasury(role: GuildRole): boolean {
  return role !== "INITIATE";
}

export function canEditGuildBranding(role: GuildRole): boolean {
  return role === "OWNER" || role === "OFFICER";
}

export function canPromoteInitiateToMember(actor: GuildRole): boolean {
  return actor === "OWNER" || actor === "OFFICER";
}

export function canPromoteMemberToOfficer(actor: GuildRole): boolean {
  return actor === "OWNER";
}

export function canDemoteOfficerToMember(actor: GuildRole): boolean {
  return actor === "OWNER";
}
