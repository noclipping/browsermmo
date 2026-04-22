"use client";

import { createContext, useContext, useMemo } from "react";

type SfxKey = "attack" | "loot" | "equip" | "level-up" | "ui-click";

const SFX_PATHS: Record<SfxKey, string> = {
  attack: "/sfx/attack-placeholder.ogg",
  loot: "/sfx/loot-placeholder.ogg",
  equip: "/sfx/equip-placeholder.ogg",
  "level-up": "/sfx/level-up-placeholder.ogg",
  "ui-click": "/sfx/ui-click-placeholder.ogg",
};

type SfxCtx = { playSfx: (key: SfxKey) => void };
const SfxContext = createContext<SfxCtx>({ playSfx: () => {} });

export function SfxProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo<SfxCtx>(
    () => ({
      playSfx: (key) => {
        if (typeof window === "undefined") return;
        const audio = new Audio(SFX_PATHS[key]);
        audio.volume = 0.35;
        void audio.play().catch(() => {
          // Placeholder paths may not exist yet.
        });
      },
    }),
    [],
  );

  return <SfxContext.Provider value={value}>{children}</SfxContext.Provider>;
}

export function useSfx() {
  return useContext(SfxContext);
}
