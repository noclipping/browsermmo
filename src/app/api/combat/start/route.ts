import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCharacter, requireUser } from "@/lib/auth/guards";
import { createSoloEncounter, toStartResponse } from "@/lib/game/start-encounter";
import { prisma } from "@/lib/prisma";

const schema = z.object({ enemyId: z.string().min(1) });

export async function POST(request: Request) {
  const user = await requireUser();
  const character = await requireCharacter(user.id);
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const [characterRegion, enemy] = await Promise.all([
    prisma.region.findUnique({ where: { id: character.regionId } }),
    prisma.enemy.findUnique({ where: { id: parsed.data.enemyId }, include: { region: true } }),
  ]);
  if (!enemy || !characterRegion || enemy.region.key !== characterRegion.key) {
    return NextResponse.json({ error: "That foe is not in this region." }, { status: 400 });
  }

  const fighting = await prisma.soloCombatEncounter.findFirst({
    where: { characterId: character.id, status: "ACTIVE" },
    select: { id: true },
  });
  if (fighting) {
    return NextResponse.json({ error: "You already have an active encounter." }, { status: 409 });
  }

  const { encounter, enemy: enemyRow, potionCount } = await createSoloEncounter(prisma, {
    character,
    enemy,
    flavorPrefixLines: [],
  });
  const log = encounter.log as string[];

  return NextResponse.json(toStartResponse(encounter, enemyRow, character, potionCount, log));
}
