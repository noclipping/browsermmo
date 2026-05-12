"use server";

import { CharacterClass } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { isValidPortraitForClass, portraitsForClass } from "@/lib/game/portraits";
import { CLASS_BASE_STATS, CLASS_STARTING_ATTRIBUTES, EQUIPMENT_SLOTS, STAT_POINTS_ON_CREATE } from "@/lib/game/constants";
import { rollOutskirtsBossInterval } from "@/lib/game/outskirts-boss";
import { setForestBossCountersSql } from "@/lib/game/forest-edge-sql";
import { setOutskirtsBossCountersSql } from "@/lib/game/outskirts-sql";

const createCharacterSchema = z.object({
  name: z.string().min(2).max(18),
  class: z.nativeEnum(CharacterClass),
  portrait: z.string().optional(),
});

export async function createCharacterAction(
  _state: string | null,
  formData: FormData,
) {
  const user = await requireUser();
  const parsed = createCharacterSchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    class: formData.get("class"),
    portrait: formData.get("portrait")?.toString(),
  });
  if (!parsed.success) {
    return "Enter a valid name and class.";
  }

  const existing = await prisma.character.findFirst({ where: { userId: user.id } });
  if (existing) redirect("/town");

  const takenName = await prisma.character.findFirst({
    where: {
      name: {
        equals: parsed.data.name,
        mode: "insensitive",
      },
    },
    select: { id: true },
  });
  if (takenName) {
    return "That character name is already taken.";
  }

  const region = await prisma.region.findUnique({ where: { key: "town_outskirts" } });
  if (!region) {
    return "Town region is not configured yet.";
  }

  const stats = CLASS_BASE_STATS[parsed.data.class];
  const attrs = CLASS_STARTING_ATTRIBUTES[parsed.data.class];
  const portraitKey = parsed.data.portrait ?? portraitsForClass(parsed.data.class)[0]?.id ?? null;
  if (!isValidPortraitForClass(parsed.data.class, portraitKey)) {
    return "Select a valid portrait for your class.";
  }
  try {
    await prisma.$transaction(async (tx) => {
      const c = await tx.character.create({
        data: {
          name: parsed.data.name,
          class: parsed.data.class,
          level: 1,
          xp: 0,
          hp: stats.hp,
          maxHp: stats.hp,
          attack: stats.attack,
          defense: stats.defense,
          speed: stats.speed,
          critChance: stats.critChance,
          ...attrs,
          statPoints: STAT_POINTS_ON_CREATE,
          gold: 0,
          portraitKey,
          user: { connect: { id: user.id } },
          region: { connect: { id: region.id } },
        },
      });
      await tx.user.update({
        where: { id: user.id },
        data: { username: parsed.data.name },
      });
      await setOutskirtsBossCountersSql(tx, c.id, 0, rollOutskirtsBossInterval());
      await setForestBossCountersSql(tx, c.id, 0, rollOutskirtsBossInterval());
      await tx.characterEquipment.createMany({ data: EQUIPMENT_SLOTS.map((slot) => ({ characterId: c.id, slot })) });
    });
  } catch {
    return "Could not create character. Try a different name.";
  }
  redirect("/town");
}

const updatePortraitSchema = z.object({
  portrait: z.string().min(1),
});

const updateBioSchema = z.object({
  bio: z.string().max(180),
});

export async function updateCharacterPortraitAction(
  _state: string | null,
  formData: FormData,
) {
  const user = await requireUser();
  const character = await prisma.character.findFirst({
    where: { userId: user.id },
    select: { id: true, class: true },
  });
  if (!character) return "No character found.";

  const parsed = updatePortraitSchema.safeParse({
    portrait: formData.get("portrait"),
  });
  if (!parsed.success) return "Select a valid portrait.";

  if (!isValidPortraitForClass(character.class, parsed.data.portrait)) {
    return "That portrait is not available for your class.";
  }

  await prisma.character.update({
    where: { id: character.id },
    data: { portraitKey: parsed.data.portrait },
  });
  return null;
}

export async function updateCharacterBioAction(formData: FormData) {
  const user = await requireUser();
  const character = await prisma.character.findFirst({
    where: { userId: user.id },
    select: { id: true, name: true },
  });
  if (!character) return "No character found.";

  const parsed = updateBioSchema.safeParse({
    bio: String(formData.get("bio") ?? "").trim(),
  });
  if (!parsed.success) return "Bio is too long (max 180 characters).";

  await prisma.character.update({
    where: { id: character.id },
    data: { bio: parsed.data.bio },
  });

  revalidatePath("/character");
  revalidatePath("/players");
  revalidatePath("/social/directory");
  revalidatePath(`/player/${encodeURIComponent(character.name)}`);
  return null;
}
