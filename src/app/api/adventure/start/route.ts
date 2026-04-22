import { NextResponse } from "next/server";
import { requireCharacter, requireUser } from "@/lib/auth/guards";
import { executeAdventureStart } from "@/lib/game/adventure-start-execute";

export async function POST(req: Request) {
  const trace =
    process.env.NODE_ENV === "development" || new URL(req.url).searchParams.get("debugAdventure") === "1";
  const log = (...args: unknown[]) => {
    if (trace) console.log("[api/adventure/start]", ...args);
  };

  const user = await requireUser();
  const character = await requireCharacter(user.id);
  log("POST", { characterId: character.id, userId: user.id });

  const result = await executeAdventureStart(character);
  if (!result.ok) {
    log("error", result.httpStatus, result.error);
    return NextResponse.json({ error: result.error }, { status: result.httpStatus });
  }
  log("ok", result.body.outcome);
  return NextResponse.json(result.body);
}
