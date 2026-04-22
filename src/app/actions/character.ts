"use server";

import { CharacterClass } from "@prisma/client";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { CLASS_BASE_STATS, CLASS_STARTING_ATTRIBUTES, EQUIPMENT_SLOTS, STAT_POINTS_ON_CREATE } from "@/lib/game/constants";
import { rollOutskirtsBossInterval } from "@/lib/game/outskirts-boss";
import { setOutskirtsBossCountersSql } from "@/lib/game/outskirts-sql";

const createCharacterSchema = z.object({ name: z.string().min(2).max(18), class: z.nativeEnum(CharacterClass) });

export async function createCharacterAction(formData: FormData) {
  const user = await requireUser();
  const parsed = createCharacterSchema.safeParse({ name: formData.get("name"), class: formData.get("class") });
  if (!parsed.success) {
    redirect("/character/new");
  }

  const existing = await prisma.character.findFirst({ where: { userId: user.id } });
  if (existing) redirect("/");

  const region = await prisma.region.findUnique({ where: { key: "town_outskirts" } });
  if (!region) {
    redirect("/character/new");
  }

  const stats = CLASS_BASE_STATS[parsed.data.class];
  const attrs = CLASS_STARTING_ATTRIBUTES[parsed.data.class];
  const character = await prisma.$transaction(async (tx) => {
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
        user: { connect: { id: user.id } },
        region: { connect: { id: region.id } },
      },
    });
    await setOutskirtsBossCountersSql(tx, c.id, 0, rollOutskirtsBossInterval());
    await tx.characterEquipment.createMany({ data: EQUIPMENT_SLOTS.map((slot) => ({ characterId: c.id, slot })) });
    return c;
  });
  redirect("/");
}
