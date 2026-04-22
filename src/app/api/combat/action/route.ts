import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCharacter, requireUser } from "@/lib/auth/guards";
import { executeCombatAction } from "@/lib/game/combat-action-execute";

const schema = z.object({
  encounterId: z.string().min(1),
  action: z.enum(["ATTACK", "DEFEND", "POTION", "SKILL", "AUTO"]),
});

export async function POST(request: Request) {
  const user = await requireUser();
  const character = await requireCharacter(user.id);
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const result = await executeCombatAction(character, parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.httpStatus });
  return NextResponse.json(result.body);
}
