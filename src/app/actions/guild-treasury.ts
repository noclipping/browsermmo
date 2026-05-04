"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCharacter, requireUser } from "@/lib/auth/guards";
import { canWithdrawFromTreasury } from "@/lib/game/guild-rank";
import { reevaluateMilestoneAchievements } from "@/lib/game/milestone-achievements";
import { queueAchievementToasts } from "@/lib/achievement-toast-server";
import { moveInventoryStackToTreasury, moveTreasuryStackToInventory } from "@/lib/game/guild-treasury-inventory";
import { prisma } from "@/lib/prisma";

const cuidSchema = z.string().cuid();
const qtySchema = z.coerce.number().int().min(1).max(9999);

function revalidateTreasury() {
  revalidatePath("/guild");
  revalidatePath("/guild/treasury");
}

export async function depositGuildTreasuryAction(formData: FormData): Promise<string | null> {
  const user = await requireUser();
  const character = await requireCharacter(user.id);
  const me = await prisma.guildMember.findUnique({ where: { userId: user.id } });
  if (!me) return "Join a guild first.";

  const invId = cuidSchema.safeParse(String(formData.get("inventoryItemId") ?? ""));
  if (!invId.success) return "Invalid item.";

  const qtyParsed = qtySchema.safeParse(formData.get("quantity"));
  const qty = qtyParsed.success ? qtyParsed.data : undefined;

  try {
    const keys = await prisma.$transaction(async (tx) => {
      const moved = await moveInventoryStackToTreasury(tx, {
        guildId: me.guildId,
        inventoryItemId: invId.data,
        characterId: character.id,
        quantity: qty,
      });
      await tx.character.update({
        where: { id: character.id },
        data: { guildTreasuryItemsDeposited: { increment: moved } },
      });
      return reevaluateMilestoneAchievements(tx, character.id);
    });
    await queueAchievementToasts(keys);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "inventory_not_found") return "Item not in your inventory.";
    if (msg === "nothing_to_move") return "Nothing to deposit.";
    throw e;
  }

  revalidateTreasury();
  revalidatePath("/character");
  return null;
}

export async function withdrawGuildTreasuryAction(formData: FormData): Promise<string | null> {
  const user = await requireUser();
  const character = await requireCharacter(user.id);
  const me = await prisma.guildMember.findUnique({ where: { userId: user.id } });
  if (!me) return "Join a guild first.";
  if (!canWithdrawFromTreasury(me.role)) {
    return "Initiates cannot withdraw from the treasury — ask for promotion to Member.";
  }

  const rowId = cuidSchema.safeParse(String(formData.get("treasuryItemId") ?? ""));
  if (!rowId.success) return "Invalid treasury stack.";

  const qtyParsed = qtySchema.safeParse(formData.get("quantity"));
  const qty = qtyParsed.success ? qtyParsed.data : undefined;

  try {
    await prisma.$transaction(async (tx) => {
      await moveTreasuryStackToInventory(tx, {
        guildId: me.guildId,
        treasuryItemId: rowId.data,
        characterId: character.id,
        quantity: qty,
      });
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "treasury_not_found") return "That stack is no longer in the treasury.";
    if (msg === "nothing_to_move") return "Nothing to withdraw.";
    throw e;
  }

  revalidateTreasury();
  return null;
}
