"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CharacterClass } from "@prisma/client";
import { portraitForClass, portraitsForClass } from "@/lib/game/portraits";

export function CharacterPortraitPicker({
  characterClass,
  portraitKey,
  updatePortraitAction,
}: {
  characterClass: CharacterClass;
  portraitKey: string | null;
  updatePortraitAction: (state: string | null, formData: FormData) => Promise<string | null>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedPortraitId, setSelectedPortraitId] = useState(
    portraitForClass(characterClass, portraitKey)?.id ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const portraits = useMemo(() => portraitsForClass(characterClass), [characterClass]);
  const currentPortrait = portraitForClass(characterClass, portraitKey) ?? portraits[0] ?? null;
  const submitPortraitChange = (formData: FormData) => {
    startTransition(async () => {
      setError(null);
      const result = await updatePortraitAction(null, formData);
      if (result) {
        setError(result);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  };

  if (!currentPortrait) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-amber-900/40 bg-black/35 p-2 text-left hover:border-amber-700/60"
        title="Change portrait"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- static portrait asset */}
        <img
          src={currentPortrait.src}
          alt={currentPortrait.label}
          width={256}
          height={256}
          className="h-24 w-full rounded object-contain object-top bg-black/25"
          decoding="async"
        />
        <p className="mt-1 text-center text-[11px] text-zinc-400">
          Click to change portrait
        </p>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xl rounded-xl border border-amber-900/40 bg-zinc-950/95 p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-amber-100">Choose portrait</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                Close
              </button>
            </div>

            <form action={submitPortraitChange} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {portraits.map((portrait) => {
                  const active = selectedPortraitId === portrait.id;
                  return (
                    <label
                      key={portrait.id}
                      className={`cursor-pointer rounded border bg-zinc-900/60 p-2 text-center text-xs ${
                        active ? "border-amber-700" : "border-zinc-700"
                      }`}
                    >
                      <input
                        type="radio"
                        name="portrait"
                        value={portrait.id}
                        checked={active}
                        onChange={() => setSelectedPortraitId(portrait.id)}
                        className="sr-only"
                      />
                      {/* eslint-disable-next-line @next/next/no-img-element -- static portrait asset */}
                      <img
                        src={portrait.src}
                        alt={portrait.label}
                        width={256}
                        height={256}
                        className="h-24 w-full rounded object-contain object-top bg-black/25"
                        decoding="async"
                      />
                      <div className="mt-1 text-zinc-300">{portrait.label}</div>
                    </label>
                  );
                })}
              </div>
              {error ? <p className="text-xs text-red-400">{error}</p> : null}
              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-lg border border-amber-800/60 bg-amber-950/30 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-900/35 disabled:opacity-70"
              >
                {pending ? "Saving..." : "Save portrait"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
