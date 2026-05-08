"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type Dispatch,
  type SetStateAction,
} from "react";

/** Keys backed by files in `/public/sfx`. */
export type SfxKey =
  | "attack"
  | "defend"
  | "skill"
  | "potion"
  | "coin"
  | "levelup"
  | "adventure"
  | "anvil"
  | "campfire";

const SFX_PATHS: Record<SfxKey, string> = {
  attack: "/sfx/attack.mp3",
  defend: "/sfx/defend.wav",
  skill: "/sfx/abilitypower.wav",
  potion: "/sfx/tonic.mp3",
  coin: "/sfx/coin.mp3",
  levelup: "/sfx/levelup.wav",
  adventure: "/sfx/adventure.wav",
  anvil: "/sfx/anvil.wav",
  campfire: "/sfx/campfire.wav",
};

const STORAGE_MUTE = "browsermmo-sfx-muted";
const STORAGE_VOL = "browsermmo-sfx-volume";
const PREFS_EVENT = "browsermmo-sfx-prefs";

type Prefs = { muted: boolean; volume: number };

let prefsCache: Prefs | null = null;

function readPrefsFromStorage(): Prefs {
  const muted = readStoredMute();
  const volume = readStoredVolume();
  if (prefsCache && prefsCache.muted === muted && prefsCache.volume === volume) return prefsCache;
  prefsCache = { muted, volume };
  return prefsCache;
}

function invalidatePrefsCache() {
  prefsCache = null;
}

function readStoredMute(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_MUTE) === "1";
  } catch {
    return false;
  }
}

function readStoredVolume(): number {
  if (typeof window === "undefined") return 0.75;
  try {
    const raw = window.localStorage.getItem(STORAGE_VOL);
    if (raw == null) return 0.75;
    const n = Number.parseFloat(raw);
    if (!Number.isFinite(n)) return 0.75;
    return Math.min(1, Math.max(0, n));
  } catch {
    return 0.75;
  }
}

function subscribePrefs(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  function onStorage() {
    invalidatePrefsCache();
    onChange();
  }
  function onCustom() {
    invalidatePrefsCache();
    onChange();
  }
  window.addEventListener("storage", onStorage);
  window.addEventListener(PREFS_EVENT, onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(PREFS_EVENT, onCustom);
  };
}

/** Stable reference for SSR — React requires `getServerSnapshot` to return a cached value. */
const SERVER_PREFS_SNAPSHOT: Readonly<Prefs> = Object.freeze({ muted: false, volume: 0.75 });

function getServerPrefsSnapshot(): Prefs {
  return SERVER_PREFS_SNAPSHOT;
}

function getClientPrefsSnapshot(): Prefs {
  return readPrefsFromStorage();
}

type SfxCtx = {
  playSfx: (key: SfxKey) => void;
  muted: boolean;
  setMuted: Dispatch<SetStateAction<boolean>>;
  volume: number;
  setVolume: Dispatch<SetStateAction<number>>;
};

const SfxContext = createContext<SfxCtx>({
  playSfx: () => {},
  muted: false,
  setMuted: () => {},
  volume: 0.75,
  setVolume: () => {},
});

export function SfxProvider({ children }: { children: React.ReactNode }) {
  const prefs = useSyncExternalStore(subscribePrefs, getClientPrefsSnapshot, getServerPrefsSnapshot);
  const { muted, volume } = prefs;

  const setMuted = useCallback((next: SetStateAction<boolean>) => {
    if (typeof window === "undefined") return;
    const value = typeof next === "function" ? next(readStoredMute()) : next;
    try {
      window.localStorage.setItem(STORAGE_MUTE, value ? "1" : "0");
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(PREFS_EVENT));
  }, []);

  const setVolume = useCallback((next: SetStateAction<number>) => {
    if (typeof window === "undefined") return;
    const current = readStoredVolume();
    const value = typeof next === "function" ? next(current) : next;
    const clamped = Math.min(1, Math.max(0, value));
    try {
      window.localStorage.setItem(STORAGE_VOL, String(clamped));
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(PREFS_EVENT));
  }, []);

  const playSfx = useCallback(
    (key: SfxKey) => {
      if (typeof window === "undefined" || muted) return;
      const path = SFX_PATHS[key];
      if (!path) return;
      const audio = new Audio(path);
      audio.volume = Math.min(1, Math.max(0, volume));
      void audio.play().catch(() => {
        /* missing file or autoplay policy */
      });
    },
    [muted, volume],
  );

  const value = useMemo<SfxCtx>(
    () => ({
      playSfx,
      muted,
      setMuted,
      volume,
      setVolume,
    }),
    [playSfx, muted, volume, setMuted, setVolume],
  );

  return <SfxContext.Provider value={value}>{children}</SfxContext.Provider>;
}

export function useSfx() {
  return useContext(SfxContext);
}
