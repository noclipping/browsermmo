import { logoutAction } from "@/app/actions/auth";
import { debugResetCharacterAction } from "@/app/actions/game";
import { CLASS_DISPLAY_NAME } from "@/lib/game/constants";
import type { CharacterClass } from "@prisma/client";

export function GameTopBar({
  username,
  characterName,
  characterClass,
}: {
  username: string;
  characterName: string;
  characterClass: CharacterClass;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-900/40 bg-zinc-950/70 px-5 py-4 shadow-lg">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-700">
          Browser RPG · Phase 3
        </p>
        <h1 className="font-serif text-2xl text-amber-50">{characterName}</h1>
        <p className="text-sm text-zinc-500">
          {username} · {CLASS_DISPLAY_NAME[characterClass]}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <form
          action={debugResetCharacterAction}
          title="Level 1, base stats, town, 25 gold, 4 tonics, no gear or loot"
        >
          <button
            type="submit"
            className="rounded-lg border border-amber-800/70 bg-amber-950/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-amber-200/90 hover:bg-amber-900/35"
          >
            Debug reset
          </button>
        </form>
        <form action={logoutAction}>
          <button
            type="submit"
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            Logout
          </button>
        </form>
      </div>
    </header>
  );
}
