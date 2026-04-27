"use client";

import { useMemo, useState, useActionState } from "react";
import { CharacterClass } from "@prisma/client";
import { createCharacterAction } from "@/app/actions/character";
import { portraitsForClass } from "@/lib/game/portraits";
import {
  BASE_FLEE_CHANCE,
  CLASS_BASE_STATS,
  CLASS_STARTING_ATTRIBUTES,
  DEX_FLEE_CHANCE_PER_POINT,
  MAX_FLEE_CHANCE,
  MIN_FLEE_CHANCE,
} from "@/lib/game/constants";

const CLASS_OPTIONS: Array<{ value: CharacterClass; label: string }> = [
  { value: "WARRIOR", label: "Warrior" },
  { value: "MAGE", label: "Mage" },
  { value: "ROGUE", label: "Archer" },
];

export function CharacterCreateForm() {
  const [selectedClass, setSelectedClass] = useState<CharacterClass>("WARRIOR");
  const [selectedPortraitId, setSelectedPortraitId] = useState("warrior_male");
  const [error, action, pending] = useActionState(createCharacterAction, null);
  const statPreview = useMemo(() => {
    const base = CLASS_BASE_STATS[selectedClass];
    const attrs = CLASS_STARTING_ATTRIBUTES[selectedClass];
    const fleeChance = Math.min(
      MAX_FLEE_CHANCE,
      Math.max(MIN_FLEE_CHANCE, BASE_FLEE_CHANCE + attrs.dexterity * DEX_FLEE_CHANCE_PER_POINT),
    );
    return { base, attrs, fleeChance };
  }, [selectedClass]);
  const availablePortraits = portraitsForClass(selectedClass);
  const setClassAndDefaultPortrait = (nextClass: CharacterClass) => {
    setSelectedClass(nextClass);
    const firstPortrait = portraitsForClass(nextClass)[0];
    if (firstPortrait) setSelectedPortraitId(firstPortrait.id);
  };

  return (
    <form action={action} className="mt-6 space-y-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <div>
        <label className="text-sm">Character name</label>
        <input
          name="name"
          required
          minLength={2}
          maxLength={18}
          className="mt-1 w-full rounded bg-zinc-950 px-3 py-2"
          placeholder="Enter unique name"
        />
      </div>

      <div>
        <p className="text-sm">Class</p>
        <input type="hidden" name="class" value={selectedClass} />
        <div className="mt-2 grid grid-cols-3 gap-2">
          {CLASS_OPTIONS.map((option) => {
            const active = selectedClass === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setClassAndDefaultPortrait(option.value)}
                className={`rounded border px-3 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? "border-amber-700 bg-amber-950/40 text-amber-100"
                    : "border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-zinc-500"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-sm">Portrait</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {availablePortraits.length > 0 ? (
            availablePortraits.map((portrait) => {
              const active = selectedPortraitId === portrait.id;
              return (
                <label
                  key={portrait.id}
                  className={`cursor-pointer rounded border bg-zinc-950/70 p-2 text-center text-xs ${
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
                  {/* eslint-disable-next-line @next/next/no-img-element -- static portrait assets from public */}
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
            })
          ) : (
            <p className="col-span-2 rounded border border-zinc-700 bg-zinc-950/70 px-3 py-2 text-xs text-zinc-400">
              Portraits for this class are coming soon.
            </p>
          )}
        </div>
      </div>

      <div className="rounded border border-zinc-800 bg-black/30 p-3 text-xs text-zinc-300">
        <div className="flex items-center gap-2">
          <p className="font-semibold uppercase tracking-wider text-amber-400">Base stats</p>
          <div className="group relative">
            <button
              type="button"
              className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-amber-700/70 text-[10px] font-bold text-amber-200/90"
              aria-label="Show advanced stats info"
            >
              ?
            </button>
            <div className="pointer-events-none absolute left-6 top-1/2 z-20 w-64 -translate-y-1/2 rounded-lg border border-amber-900/50 bg-zinc-950/95 p-2 text-[11px] leading-relaxed text-zinc-200 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              <p>
                Crit chance: {(statPreview.base.critChance * 100).toFixed(1)}%
              </p>
              <p>Speed: {statPreview.base.speed}</p>
              <p>
                Flee chance: {(statPreview.fleeChance * 100).toFixed(1)}%
                (before enemy penalties).
              </p>
            </div>
          </div>
        </div>
        <p className="mt-1">HP {statPreview.base.hp} · ATK {statPreview.base.attack} · DEF {statPreview.base.defense}</p>
        <p className="mt-1">
          STR {statPreview.attrs.strength} · CON {statPreview.attrs.constitution} · INT {statPreview.attrs.intelligence}
          {" "}· DEX {statPreview.attrs.dexterity}
        </p>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg border border-amber-800/60 bg-amber-950/30 py-2 font-medium text-amber-100 hover:bg-amber-900/35 disabled:opacity-70"
      >
        {pending ? "Creating..." : "Enter game"}
      </button>
    </form>
  );
}
