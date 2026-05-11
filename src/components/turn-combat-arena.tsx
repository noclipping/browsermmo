"use client";

/* eslint-disable react-hooks/set-state-in-effect -- effects fold server / useActionState results into UI state */

import {
  combatTurnAction,
  fleeCombatAction,
  resolveAdventureEventChoiceAction,
  returnToTownAction,
  startAdventureRollAction,
} from "@/app/actions/game";
import type { CombatFxItem } from "@/components/combat/combat-fx-types";
import { CombatActorPanel, type CombatActorHitFlash } from "@/components/combat/combat-actor-panel";
import { CombatStage } from "@/components/combat/combat-stage";
import { ItemHoverCard } from "@/components/item-hover-card";
import { useSfx } from "@/components/sfx-provider";
import { getEnemyHurtSfxSpec } from "@/lib/game/enemy-hurt-sfx";

const PLAYER_HURT_SFX_URLS = [
  "/sfx/hurt_sounds/player_hurt.ogg",
  "/sfx/hurt_sounds/player_hurt2.ogg",
  "/sfx/hurt_sounds/player_hurt3.ogg",
] as const;
import { enemyIntentEmoji, enemyIntentTitle, enemyStrikeDamageFxEmoji } from "@/lib/game/combat-intent-emoji";
import { getEnemySpritePath, getPlayerSpritePath, type EnemySpritePose } from "@/lib/game/combat-sprites";
import type { CharacterClass } from "@prisma/client";
import type { EnemyKind, SoloEncounterStartJson } from "@/lib/game/start-encounter";
import { rarityNameClass } from "@/lib/game/item-rarity-styles";
import { emitAchievementToasts } from "@/lib/achievement-toast-events";
import type { AchievementToastItem } from "@/lib/achievement-toast-types";
import { burstAchievementConfetti } from "@/lib/confetti-burst";
import { levelUpToastItem } from "@/lib/level-up-toast";
import { useRouter } from "next/navigation";
import { AdventureHubRichLines } from "@/components/adventure-hub-rich-lines";
import { useActionState, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { MAX_POTIONS_PER_BATTLE, STAT_POINTS_PER_LEVEL } from "@/lib/game/constants";
import type { AdventureEventPayload } from "@/lib/game/adventure-start-execute";

const ADVENTURE_EVENT_ART: Record<AdventureEventPayload["kind"], string> = {
  POTION: "/images/events/crevice_image.png",
  GOLD: "/images/events/locked_cache.png",
  XP: "/images/events/old_monument.png",
};
import {
  ENEMY_DEATH_SQUASH_MS,
  JRPG_LUNGE_IN_MS,
  JRPG_STRIKE_HOLD_MS,
  victoryStrikePresentationEndMs,
} from "@/lib/game/combat-stage-motion";
import {
  inferAutoResolvedStrikeSfx,
  sliceEnemyActsPhase,
  sliceLinesBeforeEnemyActs,
  sumDamageDealtToPlayerFromExchangeLog,
  sumLifestealHealFromLines,
  sumPlayerStrikeDamageFromLines,
} from "@/lib/game/combat-ui-log-parse";

type EnemyIntentKey = "ATTACK" | "HEAVY_ATTACK" | "GUARD" | "RECOVER" | "STRIKE";

const victoryConfettiBurstKeys = new Set<string>();

type DroppedItemPayload = {
  id: string;
  key: string;
  name: string;
  emoji: string;
  rarity: string;
  slot: string | null;
  description: string;
  affixPrefix?: string | null;
  bonusLifeSteal?: number;
  bonusCritChance?: number;
  bonusSkillPower?: number;
  bonusDefensePercent?: number;
  bonusConstitutionPercent?: number;
  bonusStrength?: number;
  bonusConstitution?: number;
  bonusIntelligence?: number;
  bonusDexterity?: number;
  attack: number;
  defense: number;
  hp: number;
  speed: number;
  sellPrice: number;
  requiredLevel: number;
  requiredStrength: number;
  requiredConstitution: number;
  requiredIntelligence: number;
  requiredDexterity: number;
};

type StartPayload = {
  encounterId: string;
  round: number;
  enemyIntent: EnemyIntentKey;
  enemyKey: string;
  enemyKind: EnemyKind;
  enemy: { name: string; emoji: string; level: number; hp: number; maxHp: number };
  player: { name: string; hp: number; maxHp: number };
  log: string[];
  potionCount: number;
  potionCooldownRemaining: number;
  potionMaxCooldown: number;
  skillCooldownRemaining: number;
  skillMaxCooldown: number;
  skillName: string;
  skillEmoji: string;
  playerMana?: number;
  playerMaxMana?: number;
  fleeChance?: number;
};

type EndedPayload = {
  status: "ENDED";
  outcome: "VICTORY" | "DEFEAT" | "FLED";
  round: number;
  log: string[];
  potionCount: number;
  xpGained?: number;
  goldGained?: number;
  droppedItemIds?: string[];
  droppedItems?: DroppedItemPayload[];
  /** True when a level-up occurred (victory or defeat). */
  leveled?: boolean;
  /** Level after XP when `leveled` is true (solo combat payloads). */
  levelAfter?: number;
  goldLost?: number;
  finalHp?: number;
  returnedToTown?: boolean;
  achievementToasts?: AchievementToastItem[];
  guildBoss?: { appliedDamage: number; guildDefeated: boolean };
};

const ADVENTURE_STATUS_LINES = [
  "Adventuring...",
  "Stumbling over rocks...",
  "Trying not to die...",
  "Ignoring ominous noises...",
  "Poking suspicious bushes...",
  "Acting like this was the plan...",
];

const MIN_ADVENTURE_ROLL_MS = 1700;
const AUTO_STEP_MIN_MS = 1000;
const AUTO_STEP_MAX_MS = 2000;

function autoStepDelayMs() {
  return AUTO_STEP_MIN_MS + Math.floor(Math.random() * (AUTO_STEP_MAX_MS - AUTO_STEP_MIN_MS + 1));
}

function parseShieldedAmount(lines: string[]): number | null {
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const m = lines[i]?.match(/(\d+)\s*(?:→|->)\s*(\d+)/);
    if (m) {
      const raw = Number(m[1]);
      const final = Number(m[2]);
      if (Number.isFinite(raw) && Number.isFinite(final) && raw >= final) return raw - final;
    }
  }
  return null;
}

function parseLastAmount(lines: string[], pattern: RegExp): number | null {
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const m = lines[i]?.match(pattern);
    if (m && m[1]) {
      const n = Number(m[1]);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function formatEnemyCombatPanelName(name: string | undefined, level: number, kind: EnemyKind): string {
  const base = name?.trim() || "Enemy";
  const tag = kind === "miniboss" ? "Boss" : kind === "elite" ? "Elite" : null;
  return tag ? `${base} Lv ${level} · ${tag}` : `${base} Lv ${level}`;
}

export function TurnCombatArena({
  characterName,
  regionKey = "",
  regionName,
  regionBannerSrc = null,
  characterClass = "WARRIOR",
  resumeCombat = null,
  debugAdventureFromServer = false,
}: {
  characterName: string;
  /** DB region key (e.g. `town_outskirts`) — used for per-enemy hurt SFX. */
  regionKey?: string;
  regionName: string;
  /** Area banner used as the combat stage background (matches adventure page art). */
  regionBannerSrc?: string | null;
  /** Used by sprite resolver; all classes currently map to the warrior placeholder art. */
  characterClass?: CharacterClass;
  /** When the server still has an ACTIVE encounter, hydrate the fight UI (e.g. after visiting Character). */
  resumeCombat?: SoloEncounterStartJson | null;
  /** Set from RSC `searchParams` — reliable on mobile where client `useSearchParams` can lag or be empty on first paint. */
  debugAdventureFromServer?: boolean;
}) {
  const router = useRouter();
  const { playSfx, playSfxUrl } = useSfx();
  const initialCombat = resumeCombat as StartPayload | null;
  const [clientUrlDebug, setClientUrlDebug] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setClientUrlDebug(new URLSearchParams(window.location.search).get("debugAdventure") === "1");
    setHydrated(true);
  }, []);
  const showDebugOverlay = debugAdventureFromServer || clientUrlDebug;
  const autoAdventureFieldId = useId();
  const logScrollRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"hub" | "fight" | "ended">(initialCombat ? "fight" : "hub");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hubLines, setHubLines] = useState<string[] | null>(null);
  const [pendingEvent, setPendingEvent] = useState<AdventureEventPayload | null>(null);
  /** After resolving an event choice, keep showing the same scene art until the next roll. */
  const [postEventArt, setPostEventArt] = useState<AdventureEventPayload | null>(null);
  const pendingEventRef = useRef<AdventureEventPayload | null>(null);
  pendingEventRef.current = pendingEvent;
  const [encounterId, setEncounterId] = useState<string | null>(initialCombat?.encounterId ?? null);
  const [round, setRound] = useState(initialCombat?.round ?? 1);
  const [playerHp, setPlayerHp] = useState(initialCombat?.player.hp ?? 0);
  const [playerMax, setPlayerMax] = useState(initialCombat?.player.maxHp ?? 1);
  const [enemyHp, setEnemyHp] = useState(initialCombat?.enemy.hp ?? 0);
  const [enemyMax, setEnemyMax] = useState(initialCombat?.enemy.maxHp ?? 1);
  const [enemyName, setEnemyName] = useState(initialCombat?.enemy.name ?? "");
  const [enemyEmoji, setEnemyEmoji] = useState(initialCombat?.enemy.emoji ?? "");
  const [enemyLevel, setEnemyLevel] = useState(initialCombat?.enemy.level ?? 1);
  const [enemyKind, setEnemyKind] = useState<EnemyKind>(initialCombat?.enemyKind ?? "normal");
  const [enemyKey, setEnemyKey] = useState(initialCombat?.enemyKey ?? "sewer_rat");
  const [enemyIntent, setEnemyIntent] = useState<EnemyIntentKey>((initialCombat?.enemyIntent as EnemyIntentKey) ?? "STRIKE");
  const [log, setLog] = useState<string[]>(initialCombat?.log ?? []);
  const [potionCount, setPotionCount] = useState(initialCombat?.potionCount ?? 0);
  const [potionCooldownRemaining, setPotionCooldownRemaining] = useState(initialCombat?.potionCooldownRemaining ?? 0);
  const [potionMaxCooldown, setPotionMaxCooldown] = useState(initialCombat?.potionMaxCooldown ?? 0);
  const [skillCooldownRemaining, setSkillCooldownRemaining] = useState(initialCombat?.skillCooldownRemaining ?? 0);
  const [skillMaxCooldown, setSkillMaxCooldown] = useState(initialCombat?.skillMaxCooldown ?? 0);
  const [skillName, setSkillName] = useState(initialCombat?.skillName ?? "");
  const [skillEmoji, setSkillEmoji] = useState(initialCombat?.skillEmoji ?? "");
  const [playerMana, setPlayerMana] = useState(initialCombat?.playerMana ?? 0);
  const [playerMaxMana, setPlayerMaxMana] = useState(initialCombat?.playerMaxMana ?? 0);
  const [fleeChance, setFleeChance] = useState(initialCombat?.fleeChance ?? 0);
  const [ended, setEnded] = useState<EndedPayload | null>(null);
  const [mobileLogExpanded, setMobileLogExpanded] = useState(false);
  const [combatFx, setCombatFx] = useState<CombatFxItem[]>([]);
  const [playerShakeGen, setPlayerShakeGen] = useState(0);
  const [enemyShakeGen, setEnemyShakeGen] = useState(0);
  const [playerSpritePose, setPlayerSpritePose] = useState<"idle" | "attack">("idle");
  const [enemySpritePose, setEnemySpritePose] = useState<EnemySpritePose>("idle");
  const [playerLungeForward, setPlayerLungeForward] = useState(false);
  const [enemyLungeForward, setEnemyLungeForward] = useState(false);
  const [panelFleeTint, setPanelFleeTint] = useState<"flee" | null>(null);
  const [playerHitFlash, setPlayerHitFlash] = useState<CombatActorHitFlash | null>(null);
  const [enemyHitFlash, setEnemyHitFlash] = useState<CombatActorHitFlash | null>(null);
  const [adventureStatusIndex, setAdventureStatusIndex] = useState(0);
  const fxIdRef = useRef(1);
  const tintTimerRef = useRef<number | null>(null);
  const playerHitFlashTimerRef = useRef<number | null>(null);
  const enemyHitFlashTimerRef = useRef<number | null>(null);
  const [adventureDebugLines, setAdventureDebugLines] = useState<string[]>([]);
  const [autoAdventureEnabled, setAutoAdventureEnabled] = useState(false);
  const [autoAdventureRunning, setAutoAdventureRunning] = useState(false);
  const [rollState, rollFormAction, isRollPending] = useActionState(startAdventureRollAction, null);
  const [turnState, turnFormAction, isTurnPending] = useActionState(combatTurnAction, null);
  const [fleeState, fleeFormAction, isFleePending] = useActionState(fleeCombatAction, null);
  const [eventChoiceState, eventChoiceFormAction, isEventChoicePending] = useActionState(resolveAdventureEventChoiceAction, null);
  const rollFormRef = useRef<HTMLFormElement>(null);
  const riskEventFormRef = useRef<HTMLFormElement>(null);
  const safeEventFormRef = useRef<HTMLFormElement>(null);
  const continueFormRef = useRef<HTMLFormElement>(null);
  const autoTurnFormRef = useRef<HTMLFormElement>(null);
  const autoTurnActionInputRef = useRef<HTMLInputElement>(null);
  const autoTurnEncounterInputRef = useRef<HTMLInputElement>(null);
  const autoTimerRef = useRef<number | null>(null);
  const wasRollPendingRef = useRef(false);
  const adventureRollStartedAtRef = useRef<number | null>(null);
  const processedAdventureRollAtRef = useRef<number | null>(null);
  const processedTurnAtRef = useRef<number | null>(null);
  const processedFleeAtRef = useRef<number | null>(null);
  const playerAttackTimersRef = useRef<number[]>([]);
  const enemyAttackTimersRef = useRef<number[]>([]);
  const strikePresentationTimersRef = useRef<number[]>([]);
  const presentationOpsRef = useRef(0);
  const playerAttackSeqGenRef = useRef(0);
  const enemyAttackSeqGenRef = useRef(0);
  const [presentationBlocking, setPresentationBlocking] = useState(false);
  const pendingVictoryEndedRef = useRef<EndedPayload | null>(null);
  const [enemyDeathSquash, setEnemyDeathSquash] = useState(false);
  const combatStageOverlayRef = useRef<HTMLDivElement | null>(null);

  const pushAdventureDebug = (line: string) => {
    const full = `${new Date().toISOString()} ${line}`;
    if (process.env.NODE_ENV === "development") {
      console.log("[Adventure]", full);
    }
    if (showDebugOverlay) {
      setAdventureDebugLines((prev) => [...prev.slice(-24), full]);
    }
  };

  const refreshPreservingScroll = () => {
    const w = typeof window !== "undefined" ? window : null;
    const y = w ? w.scrollY : 0;
    router.refresh();
    if (!w) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        w.scrollTo(0, y);
      });
    });
  };

  const clearAutoTimer = () => {
    if (autoTimerRef.current) {
      window.clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }
  };

  const chooseAutoCombatAction = (): "ATTACK" | "DEFEND" | "POTION" | "SKILL" => {
    if (enemyIntent === "HEAVY_ATTACK") return "DEFEND";
    if (potionCount > 0 && potionCooldownRemaining <= 0 && playerHp < Math.floor(playerMax * 0.33)) return "POTION";
    if (skillCooldownRemaining <= 0 && Math.random() < 0.35) return "SKILL";
    return "ATTACK";
  };

  const spawnFx = (params: Omit<CombatFxItem, "id">) => {
    const id = fxIdRef.current;
    fxIdRef.current += 1;
    setCombatFx((prev) => [...prev, { id, ...params }]);
    window.setTimeout(() => {
      setCombatFx((prev) => prev.filter((fx) => fx.id !== id));
    }, 850);
  };

  const flashPanelFleeTint = () => {
    if (tintTimerRef.current) {
      window.clearTimeout(tintTimerRef.current);
    }
    setPanelFleeTint("flee");
    tintTimerRef.current = window.setTimeout(() => {
      setPanelFleeTint(null);
      tintTimerRef.current = null;
    }, 260);
  };

  const flashActorHit = (target: "player" | "enemy", tone: CombatActorHitFlash) => {
    const timerRef = target === "player" ? playerHitFlashTimerRef : enemyHitFlashTimerRef;
    const set = target === "player" ? setPlayerHitFlash : setEnemyHitFlash;
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
    set(tone);
    timerRef.current = window.setTimeout(() => {
      set(null);
      timerRef.current = null;
    }, 260);
  };

  const clearPlayerAttackTimersOnly = () => {
    for (const id of playerAttackTimersRef.current) {
      window.clearTimeout(id);
    }
    playerAttackTimersRef.current = [];
  };

  const resetPlayerAttackVisuals = () => {
    clearPlayerAttackTimersOnly();
    playerAttackSeqGenRef.current += 1;
    setPlayerLungeForward(false);
    setPlayerSpritePose("idle");
  };

  const clearEnemyAttackTimersOnly = () => {
    for (const id of enemyAttackTimersRef.current) {
      window.clearTimeout(id);
    }
    enemyAttackTimersRef.current = [];
  };

  const resetEnemyAttackVisuals = () => {
    clearEnemyAttackTimersOnly();
    enemyAttackSeqGenRef.current += 1;
    setEnemyLungeForward(false);
    setEnemySpritePose("idle");
  };

  const clearStrikePresentationTimers = () => {
    for (const id of strikePresentationTimersRef.current) {
      window.clearTimeout(id);
    }
    strikePresentationTimersRef.current = [];
    presentationOpsRef.current = 0;
    setPresentationBlocking(false);
  };

  const pushStrikePresentationTimer = (delayMs: number, fn: () => void) => {
    presentationOpsRef.current += 1;
    if (presentationOpsRef.current === 1) setPresentationBlocking(true);
    const id = window.setTimeout(() => {
      try {
        fn();
      } finally {
        presentationOpsRef.current -= 1;
        if (presentationOpsRef.current <= 0) {
          presentationOpsRef.current = 0;
          setPresentationBlocking(false);
        }
      }
    }, delayMs);
    strikePresentationTimersRef.current.push(id);
  };

  const flashPlayerAttackPose = (strikeSfx: "attack" | "skill" | null) => {
    clearPlayerAttackTimersOnly();
    playerAttackSeqGenRef.current += 1;
    const gen = playerAttackSeqGenRef.current;

    setPlayerLungeForward(true);
    setPlayerSpritePose("idle");

    const t1 = window.setTimeout(() => {
      if (gen !== playerAttackSeqGenRef.current) return;
      setPlayerSpritePose("attack");
      if (strikeSfx) playSfx(strikeSfx);
    }, JRPG_LUNGE_IN_MS);

    const t2 = window.setTimeout(() => {
      if (gen !== playerAttackSeqGenRef.current) return;
      setPlayerSpritePose("idle");
      setPlayerLungeForward(false);
    }, JRPG_LUNGE_IN_MS + JRPG_STRIKE_HOLD_MS);

    playerAttackTimersRef.current = [t1, t2];
  };

  const flashEnemyAttackPose = (hitSfx: "attack" | "defend") => {
    clearEnemyAttackTimersOnly();
    enemyAttackSeqGenRef.current += 1;
    const gen = enemyAttackSeqGenRef.current;

    setEnemyLungeForward(true);
    setEnemySpritePose("idle");

    const t1 = window.setTimeout(() => {
      if (gen !== enemyAttackSeqGenRef.current) return;
      playSfx(hitSfx);
      setEnemySpritePose("attack");
    }, JRPG_LUNGE_IN_MS);

    const t2 = window.setTimeout(() => {
      if (gen !== enemyAttackSeqGenRef.current) return;
      setEnemySpritePose("idle");
      setEnemyLungeForward(false);
    }, JRPG_LUNGE_IN_MS + JRPG_STRIKE_HOLD_MS);

    enemyAttackTimersRef.current = [t1, t2];
  };

  const applyCombatStart = (data: StartPayload) => {
    clearStrikePresentationTimers();
    pendingVictoryEndedRef.current = null;
    victoryConfettiBurstKeys.clear();
    setEnded(null);
    if (playerHitFlashTimerRef.current) {
      window.clearTimeout(playerHitFlashTimerRef.current);
      playerHitFlashTimerRef.current = null;
    }
    if (enemyHitFlashTimerRef.current) {
      window.clearTimeout(enemyHitFlashTimerRef.current);
      enemyHitFlashTimerRef.current = null;
    }
    setPlayerHitFlash(null);
    setEnemyHitFlash(null);
    setEnemyDeathSquash(false);
    resetPlayerAttackVisuals();
    resetEnemyAttackVisuals();
    setEncounterId(data.encounterId);
    setRound(data.round);
    setPlayerHp(data.player.hp);
    setPlayerMax(data.player.maxHp);
    setEnemyHp(data.enemy.hp);
    setEnemyMax(data.enemy.maxHp);
    setEnemyName(data.enemy.name);
    setEnemyEmoji(data.enemy.emoji);
    setEnemyLevel(data.enemy.level);
    setEnemyKind(data.enemyKind ?? "normal");
    setEnemyKey(data.enemyKey ?? "sewer_rat");
    setEnemyIntent(data.enemyIntent as EnemyIntentKey);
    setLog(data.log);
    setPotionCount(data.potionCount);
    setPotionCooldownRemaining(data.potionCooldownRemaining);
    setPotionMaxCooldown(data.potionMaxCooldown);
    setSkillCooldownRemaining(data.skillCooldownRemaining);
    setSkillMaxCooldown(data.skillMaxCooldown);
    setSkillName(data.skillName);
    setSkillEmoji(data.skillEmoji);
    setPlayerMana(data.playerMana ?? playerMana);
    setPlayerMaxMana(data.playerMaxMana ?? playerMaxMana);
    setFleeChance(data.fleeChance ?? fleeChance);
    setPlayerShakeGen(0);
    setEnemyShakeGen(0);
    setPhase("fight");
  };

  useEffect(() => {
    const el = logScrollRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(id);
  }, [log]);

  useEffect(() => {
    return () => clearAutoTimer();
  }, []);

  useEffect(() => {
    return () => {
      for (const id of playerAttackTimersRef.current) window.clearTimeout(id);
      playerAttackTimersRef.current = [];
      for (const id of enemyAttackTimersRef.current) window.clearTimeout(id);
      enemyAttackTimersRef.current = [];
      for (const id of strikePresentationTimersRef.current) window.clearTimeout(id);
      strikePresentationTimersRef.current = [];
      presentationOpsRef.current = 0;
      playerAttackSeqGenRef.current += 1;
      enemyAttackSeqGenRef.current += 1;
      if (playerHitFlashTimerRef.current) window.clearTimeout(playerHitFlashTimerRef.current);
      if (enemyHitFlashTimerRef.current) window.clearTimeout(enemyHitFlashTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (phase === "hub") {
      clearStrikePresentationTimers();
      setEnemyDeathSquash(false);
      setPlayerShakeGen(0);
      setEnemyShakeGen(0);
    } else if (phase !== "fight") {
      clearStrikePresentationTimers();
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== "ended") return;
    resetPlayerAttackVisuals();
    resetEnemyAttackVisuals();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot cleanup when leaving active combat
  }, [phase]);

  useEffect(() => {
    if (phase === "hub") {
      victoryConfettiBurstKeys.clear();
    }
    if (phase !== "ended" || !ended || ended.outcome !== "VICTORY") return;
    const key = `${ended.round}|${ended.log.length}|${ended.log.at(-1) ?? ""}`;
    if (victoryConfettiBurstKeys.has(key)) return;
    victoryConfettiBurstKeys.add(key);
    requestAnimationFrame(() => {
      const el = combatStageOverlayRef.current;
      if (!el) return burstAchievementConfetti();

      const rect = el.getBoundingClientRect();
      const x = (rect.left + rect.width / 2) / window.innerWidth;
      const y = rect.top / window.innerHeight;
      burstAchievementConfetti({
        x: Math.min(1, Math.max(0, x)),
        // Clamp so we don't fire outside the visible viewport on short screens.
        y: Math.min(0.99, Math.max(0, y)),
      });
    });
  }, [phase, ended]);

  useEffect(() => {
    if (!(busy && phase === "hub")) return;
    const id = window.setInterval(() => {
      setAdventureStatusIndex((prev) => (prev + 1) % ADVENTURE_STATUS_LINES.length);
    }, 750);
    return () => window.clearInterval(id);
  }, [busy, phase]);

  useEffect(() => {
    if (isRollPending && !wasRollPendingRef.current) {
      adventureRollStartedAtRef.current = Date.now();
      setBusy(true);
      setError(null);
      setEncounterId(null);
      setEnded(null);
      setHubLines(null);
      setPendingEvent(null);
      setPostEventArt(null);
      // Only leave the victory/defeat panel for the hub loading UI; forcing hub on every roll
      // races RSC `resumeCombat` hydration and can strand the client on hub while the DB has a fight.
      setPhase((p) => (p === "ended" ? "hub" : p));
      pushAdventureDebug("adventure: server action in flight (form submit)");
    }
    wasRollPendingRef.current = isRollPending;
  }, [isRollPending]);

  useEffect(() => {
    if (!rollState) return;
    if (processedAdventureRollAtRef.current === rollState.rolledAt) return;
    processedAdventureRollAtRef.current = rollState.rolledAt;

    void (async () => {
      if (!rollState.ok) {
        pushAdventureDebug(`adventure roll error: ${rollState.error}`);
        setError(rollState.error);
        setBusy(false);
        return;
      }
      const payload = rollState.payload;
      if (payload.outcome === "COMBAT") {
        // Apply immediately — no MIN delay here (hub button hides in fight; delay risked RSC remount/key races on mobile).
        pushAdventureDebug("outcome=COMBAT (action): applyCombatStart (immediate)");
        setPostEventArt(null);
        applyCombatStart(payload as unknown as StartPayload);
        setBusy(false);
        return;
      }

      const startedAt = adventureRollStartedAtRef.current ?? rollState.rolledAt;
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_ADVENTURE_ROLL_MS) {
        await new Promise((r) => setTimeout(r, MIN_ADVENTURE_ROLL_MS - elapsed));
      }

      if (payload.outcome === "EVENT") {
        setPostEventArt(null);
        setPendingEvent(payload.event);
        setHubLines(payload.log);
        pushAdventureDebug(`outcome=EVENT (${payload.event.kind}): awaiting choice`);
      } else if (payload.outcome === "QUICK_GOLD") {
        setPostEventArt(null);
        setHubLines(payload.log);
        if (payload.amount > 0) playSfx("coin");
        pushAdventureDebug("outcome=QUICK_GOLD (action): show hubLines (no immediate refresh)");
      } else if (payload.outcome === "QUICK_POTION") {
        setPostEventArt(null);
        setHubLines(payload.log);
        pushAdventureDebug("outcome=QUICK_POTION (action): show hubLines (no immediate refresh)");
      } else if (payload.outcome === "QUICK_XP") {
        setPostEventArt(null);
        setHubLines(payload.log);
        pushAdventureDebug("outcome=QUICK_XP (action): show hubLines (no immediate refresh)");
      } else {
        pushAdventureDebug(`adventure roll: unknown outcome ${String((payload as { outcome?: string }).outcome)}`);
      }
      setBusy(false);
    })();
  }, [rollState, playSfx]);

  useEffect(() => {
    if (!eventChoiceState) return;
    if (!eventChoiceState.ok) {
      setError(eventChoiceState.error);
      return;
    }
    const payload = eventChoiceState.payload;
    if (payload.outcome === "QUICK_GOLD" || payload.outcome === "QUICK_POTION" || payload.outcome === "QUICK_XP") {
      setHubLines(payload.log);
      if (payload.outcome === "QUICK_GOLD" && payload.amount > 0) playSfx("coin");
      if (payload.outcome === "QUICK_XP" && payload.leveled && payload.newLevel != null) {
        playSfx("levelup");
        emitAchievementToasts([levelUpToastItem(payload.newLevel)]);
      }
      const snap = pendingEventRef.current;
      if (snap) setPostEventArt(snap);
      setPendingEvent(null);
      setError(null);
      refreshPreservingScroll();
    }
  }, [eventChoiceState, playSfx]);

  useEffect(() => {
    if (!turnState) return;
    if (processedTurnAtRef.current === turnState.rolledAt) return;
    processedTurnAtRef.current = turnState.rolledAt;
    if (!turnState.ok) {
      setError(turnState.error);
      return;
    }
    const beforePlayerHp = playerHp;
    const beforeEnemyHp = enemyHp;
    const beforeLogLength = log.length;
    const action = turnState.action;
    const data = turnState.payload;
    /** Intent telegraphed before this exchange (enemy act in this round). */
    const telegraphedEnemyIntentBeforeTurn = enemyIntent;
    const playerIncomingDmgEmoji = enemyStrikeDamageFxEmoji(telegraphedEnemyIntentBeforeTurn);
    const isVictoryFinale = data.status === "ENDED" && data.outcome === "VICTORY";
    const playPlayerHurt = () => {
      const url = PLAYER_HURT_SFX_URLS[Math.floor(Math.random() * PLAYER_HURT_SFX_URLS.length)]!;
      playSfxUrl(url);
    };

    if (data.status === "ACTIVE" || isVictoryFinale) {
      const newLines = data.log.slice(beforeLogLength);
      const strikeLines = action === "AUTO" ? newLines : sliceLinesBeforeEnemyActs(newLines);
      const strikeSumForPose = sumPlayerStrikeDamageFromLines(strikeLines);
      const enemyKeyForSfx = data.status === "ACTIVE" ? (data.enemyKey ?? enemyKey) : enemyKey;
      const playEnemyHurtIfMapped = () => {
        const spec = getEnemyHurtSfxSpec(regionKey, enemyKeyForSfx);
        if (spec) playSfxUrl(spec.url, spec.relativeGain);
      };
      let dmgEnemy = strikeSumForPose;
      const enemyHpAfter = data.status === "ACTIVE" ? data.enemy.hp : 0;
      if (dmgEnemy <= 0 && (action === "ATTACK" || action === "SKILL" || action === "AUTO")) {
        dmgEnemy = Math.max(0, beforeEnemyHp - enemyHpAfter);
      }

      const enemyPhaseLines = action === "AUTO" ? newLines : sliceEnemyActsPhase(newLines);
      let dmgPlayer = sumDamageDealtToPlayerFromExchangeLog(enemyPhaseLines);
      if (dmgPlayer <= 0) {
        dmgPlayer = data.status === "ACTIVE" ? Math.max(0, beforePlayerHp - data.player.hp) : 0;
      }

      const lsHeal = sumLifestealHealFromLines(newLines);

      if (data.status === "ACTIVE") {
        setRound(data.round);
        setPlayerHp(data.player.hp);
        setPlayerMax(data.player.maxHp);
        setEnemyHp(data.enemy.hp);
        setEnemyMax(data.enemy.maxHp);
        setEnemyName(data.enemy.name);
        setEnemyEmoji(data.enemy.emoji);
        setEnemyLevel(data.enemy.level);
        setEnemyKind(data.enemyKind);
        setEnemyKey(data.enemyKey ?? "sewer_rat");
        setEnemyIntent(data.enemyIntent as EnemyIntentKey);
        setLog(data.log);
        setPotionCount(data.potionCount);
        setPotionCooldownRemaining(data.potionCooldownRemaining);
        setPotionMaxCooldown(data.potionMaxCooldown);
        setSkillCooldownRemaining(data.skillCooldownRemaining);
        setSkillMaxCooldown(data.skillMaxCooldown);
        setSkillName(data.skillName);
        setSkillEmoji(data.skillEmoji);
        setPlayerMana(data.playerMana ?? playerMana);
        setPlayerMaxMana(data.playerMaxMana ?? playerMaxMana);
        setFleeChance(data.fleeChance ?? fleeChance);
        setPhase("fight");
      } else {
        pendingVictoryEndedRef.current = data as EndedPayload;
        setRound(data.round);
        setLog(data.log);
        setPotionCount(data.potionCount);
        const potHeal = action === "POTION" ? parseLastAmount(newLines, /recover\s+(\d+)\s+HP/i) ?? 0 : 0;
        setPlayerHp(Math.max(0, beforePlayerHp - dmgPlayer + potHeal + lsHeal));
        setEnemyHp(0);
        setPhase("fight");
      }

      clearStrikePresentationTimers();

      const playerCharged =
        action === "ATTACK" || (action === "SKILL" && strikeSumForPose > 0) || (action === "AUTO" && strikeSumForPose > 0);
      const enemyStrikeVisual =
        dmgPlayer > 0 &&
        (telegraphedEnemyIntentBeforeTurn === "STRIKE" || telegraphedEnemyIntentBeforeTurn === "HEAVY_ATTACK");
      const playerStrikeDoneMs = JRPG_LUNGE_IN_MS + JRPG_STRIKE_HOLD_MS;
      const enemyReplySfx: "attack" | "defend" = action === "DEFEND" ? "defend" : "attack";
      let playerStrikeSfx: "attack" | "skill" | null = null;
      if (playerCharged) {
        if (action === "ATTACK") playerStrikeSfx = "attack";
        else if (action === "SKILL") playerStrikeSfx = "skill";
        else if (action === "AUTO") playerStrikeSfx = inferAutoResolvedStrikeSfx(strikeLines);
      }

      if (action === "POTION") {
        const parsed = parseLastAmount(newLines, /recover\s+(\d+)\s+HP/i);
        const healedActive = data.status === "ACTIVE" ? Math.max(0, data.player.hp - beforePlayerHp) : 0;
        const shown =
          data.status === "ACTIVE" ? (healedActive > 0 ? healedActive : parsed) : parsed;
        if (shown && shown > 0) {
          spawnFx({ emoji: "🧪", text: `+${shown}`, tone: "heal", target: "player", x: 0, y: 0 });
        } else {
          spawnFx({ emoji: "🧪", text: "Full HP", tone: "heal", target: "player", x: 0, y: 0 });
        }
        flashActorHit("player", "heal");
        pushStrikePresentationTimer(0, () => playSfx("potion"));
      } else if (action === "DEFEND") {
        const shielded = parseShieldedAmount(newLines);
        spawnFx({
          emoji: "🛡️",
          text: shielded && shielded > 0 ? `Defends up! (${shielded} blocked)` : "Defends up!",
          tone: "defend",
          target: "player",
          x: 0,
          y: 0,
        });
        flashActorHit("player", "defend");
      }

      if (playerCharged) {
        flashPlayerAttackPose(playerStrikeSfx);
        pushStrikePresentationTimer(playerStrikeDoneMs, () => {});
        pushStrikePresentationTimer(JRPG_LUNGE_IN_MS, () => {
          if (dmgEnemy > 0) {
            spawnFx({ emoji: "⚔️", text: `−${dmgEnemy}`, tone: "damage", target: "enemy", x: 0, y: 0 });
            setEnemyShakeGen((n) => n + 1);
            flashActorHit("enemy", "damage");
            playEnemyHurtIfMapped();
          }
          if (lsHeal > 0) {
            spawnFx({ emoji: "🩸", text: `+${lsHeal}`, tone: "heal", target: "player", x: 0, y: 0 });
            if (dmgEnemy <= 0) flashActorHit("player", "heal");
          }
        });
        if (enemyStrikeVisual) {
          pushStrikePresentationTimer(playerStrikeDoneMs, () => {
            flashEnemyAttackPose(enemyReplySfx);
            pushStrikePresentationTimer(playerStrikeDoneMs, () => {});
            pushStrikePresentationTimer(JRPG_LUNGE_IN_MS, () => {
              spawnFx({ emoji: playerIncomingDmgEmoji, text: `−${dmgPlayer}`, tone: "damage", target: "player", x: 0, y: 0 });
              setPlayerShakeGen((n) => n + 1);
              flashActorHit("player", "damage");
              playPlayerHurt();
            });
          });
        } else if (dmgPlayer > 0) {
          pushStrikePresentationTimer(playerStrikeDoneMs, () => {
            playSfx(enemyReplySfx);
            spawnFx({ emoji: playerIncomingDmgEmoji, text: `−${dmgPlayer}`, tone: "damage", target: "player", x: 0, y: 0 });
            setPlayerShakeGen((n) => n + 1);
            flashActorHit("player", "damage");
            playPlayerHurt();
          });
        }
      } else {
        if (dmgEnemy > 0 && (action === "SKILL" || action === "AUTO")) {
          spawnFx({ emoji: "⚔️", text: `−${dmgEnemy}`, tone: "damage", target: "enemy", x: 0, y: 0 });
          setEnemyShakeGen((n) => n + 1);
          flashActorHit("enemy", "damage");
          playEnemyHurtIfMapped();
        }
        if (dmgPlayer > 0) {
          if (enemyStrikeVisual) {
            flashEnemyAttackPose(enemyReplySfx);
            pushStrikePresentationTimer(playerStrikeDoneMs, () => {});
            pushStrikePresentationTimer(JRPG_LUNGE_IN_MS, () => {
              spawnFx({ emoji: playerIncomingDmgEmoji, text: `−${dmgPlayer}`, tone: "damage", target: "player", x: 0, y: 0 });
              setPlayerShakeGen((n) => n + 1);
              flashActorHit("player", "damage");
              playPlayerHurt();
            });
          } else {
            playSfx(enemyReplySfx);
            spawnFx({ emoji: playerIncomingDmgEmoji, text: `−${dmgPlayer}`, tone: "damage", target: "player", x: 0, y: 0 });
            setPlayerShakeGen((n) => n + 1);
            flashActorHit("player", "damage");
            playPlayerHurt();
          }
        }
        if (lsHeal > 0 && (action === "SKILL" || action === "AUTO")) {
          spawnFx({ emoji: "🩸", text: `+${lsHeal}`, tone: "heal", target: "player", x: 0, y: 0 });
        }
        if (!(dmgPlayer > 0 || dmgEnemy > 0) && lsHeal > 0) {
          flashActorHit("player", "heal");
        }
      }
      if (action === "SKILL" && !playerCharged) {
        pushStrikePresentationTimer(0, () => playSfx("skill"));
      }

      if (isVictoryFinale) {
        const strikeEnd = victoryStrikePresentationEndMs({
          playerCharged,
          enemyStrikeVisual,
          dmgPlayer,
          skillNoChargeSfx: action === "SKILL" && !playerCharged,
        });
        const squashAt = Math.max(120, strikeEnd);
        pushStrikePresentationTimer(squashAt, () => {
          setEnemyDeathSquash(true);
        });
        pushStrikePresentationTimer(squashAt + ENEMY_DEATH_SQUASH_MS, () => {
          const pending = pendingVictoryEndedRef.current;
          pendingVictoryEndedRef.current = null;
          if (!pending) return;
          const toastQueue: AchievementToastItem[] = [];
          if (pending.leveled && typeof pending.levelAfter === "number") {
            playSfx("levelup");
            toastQueue.push(levelUpToastItem(pending.levelAfter));
          }
          if (pending.achievementToasts?.length) toastQueue.push(...pending.achievementToasts);
          if (toastQueue.length) emitAchievementToasts(toastQueue);
          setEnded(pending);
          setLog(pending.log);
          setPotionCount(pending.potionCount);
          setPhase("ended");
          setEncounterId(null);
          clearStrikePresentationTimers();
          if (pending.outcome === "VICTORY" && pending.goldGained && pending.goldGained > 0) {
            playSfx("coin");
          }
          refreshPreservingScroll();
        });
      }
    } else if (data.status === "ENDED") {
      const toastQueue: AchievementToastItem[] = [];
      if (data.leveled && typeof data.levelAfter === "number") {
        playSfx("levelup");
        toastQueue.push(levelUpToastItem(data.levelAfter));
      }
      if (data.achievementToasts?.length) toastQueue.push(...data.achievementToasts);
      if (toastQueue.length) emitAchievementToasts(toastQueue);
      if (data.outcome === "DEFEAT" && typeof data.finalHp === "number") {
        setPlayerHp(data.finalHp);
      }
      setEnded(data);
      setLog(data.log);
      setPotionCount(data.potionCount);
      setPhase("ended");
      setEncounterId(null);
      clearStrikePresentationTimers();
      const newLines = data.log.slice(beforeLogLength);
      const strikeLinesEnded = action === "AUTO" ? newLines : sliceLinesBeforeEnemyActs(newLines);
      let dmgEnemyEnded = sumPlayerStrikeDamageFromLines(strikeLinesEnded);
      if (dmgEnemyEnded <= 0 && (action === "ATTACK" || action === "SKILL" || action === "AUTO")) {
        const p = parseLastAmount(newLines, /for\s+(\d+)(?:\s*\(critical\))?\s*damage/i);
        dmgEnemyEnded = p ?? 0;
      }
      const enemyPhaseEnded = action === "AUTO" ? newLines : sliceEnemyActsPhase(newLines);
      let dmgPlayerEnded = sumDamageDealtToPlayerFromExchangeLog(enemyPhaseEnded);
      if (dmgPlayerEnded <= 0 && data.outcome === "DEFEAT" && typeof data.finalHp === "number") {
        dmgPlayerEnded = Math.max(0, beforePlayerHp - data.finalHp);
      }

      if (action === "POTION") {
        const parsed = parseLastAmount(newLines, /recover\s+(\d+)\s+HP/i);
        if (parsed && parsed > 0) {
          spawnFx({ emoji: "🧪", text: `+${parsed}`, tone: "heal", target: "player", x: 0, y: 0 });
        } else {
          spawnFx({ emoji: "🧪", text: "Full HP", tone: "heal", target: "player", x: 0, y: 0 });
        }
      } else if (action === "DEFEND") {
        const shielded = parseShieldedAmount(newLines);
        spawnFx({
          emoji: "🛡️",
          text: shielded && shielded > 0 ? `Defends up! (${shielded} blocked)` : "Defends up!",
          tone: "defend",
          target: "player",
          x: 0,
          y: 0,
        });
      }
      if (dmgEnemyEnded > 0 && (action === "ATTACK" || action === "SKILL" || action === "AUTO")) {
        spawnFx({ emoji: "⚔️", text: `−${dmgEnemyEnded}`, tone: "damage", target: "enemy", x: 0, y: 0 });
        setEnemyShakeGen((n) => n + 1);
        const hurtSpec = getEnemyHurtSfxSpec(regionKey, enemyKey);
        if (hurtSpec) playSfxUrl(hurtSpec.url, hurtSpec.relativeGain);
      }
      if (dmgPlayerEnded > 0) {
        spawnFx({ emoji: playerIncomingDmgEmoji, text: `−${dmgPlayerEnded}`, tone: "damage", target: "player", x: 0, y: 0 });
        setPlayerShakeGen((n) => n + 1);
        playPlayerHurt();
      }
      const lsHealEnded = sumLifestealHealFromLines(newLines);
      if (lsHealEnded > 0 && (action === "ATTACK" || action === "SKILL" || action === "AUTO")) {
        spawnFx({ emoji: "🩸", text: `+${lsHealEnded}`, tone: "heal", target: "player", x: 0, y: 0 });
      }
      if (dmgPlayerEnded > 0) {
        flashActorHit("player", "damage");
      }
      if (dmgEnemyEnded > 0) {
        flashActorHit("enemy", "damage");
      }
      if (!(dmgPlayerEnded > 0 || dmgEnemyEnded > 0)) {
        if (action === "POTION") {
          flashActorHit("player", "heal");
        } else if (lsHealEnded > 0) {
          flashActorHit("player", "heal");
        } else if (action === "DEFEND") {
          flashActorHit("player", "defend");
        }
      }
    }
    setError(null);
    if (data.status === "ENDED" && !isVictoryFinale) {
      refreshPreservingScroll();
    }
  }, [
    turnState,
    playerHp,
    enemyHp,
    log,
    skillEmoji,
    playerMana,
    playerMaxMana,
    fleeChance,
    playSfx,
    playSfxUrl,
    enemyIntent,
    regionKey,
    enemyKey,
  ]);

  useEffect(() => {
    if (!fleeState) return;
    if (processedFleeAtRef.current === fleeState.rolledAt) return;
    processedFleeAtRef.current = fleeState.rolledAt;
    if (fleeState.achievementToasts?.length) {
      emitAchievementToasts(fleeState.achievementToasts);
    }
    if (!fleeState.ok) {
      const defeatFromFlee = fleeState.error.toLowerCase().includes("defeated");
      if (defeatFromFlee) {
        const defeatLog = [...log, "☠ You fail to escape and are dragged back to town."];
        const fleeDefeatHp = Math.max(1, Math.floor(playerMax * 0.35));
        setEnded({
          status: "ENDED",
          outcome: "DEFEAT",
          round,
          log: defeatLog,
          potionCount,
          finalHp: fleeDefeatHp,
          returnedToTown: true,
        });
        setPlayerHp(fleeDefeatHp);
        setLog(defeatLog);
        setEncounterId(null);
        setPhase("ended");
        setError(null);
        router.refresh();
        return;
      }
      setError(fleeState.error);
      refreshPreservingScroll();
      return;
    }
    const fleeLog = [...log, "🏃 You break contact and escape the fight."];
    setEnded({
      status: "ENDED",
      outcome: "FLED",
      round,
      log: fleeLog,
      potionCount,
    });
    setLog(fleeLog);
    setEncounterId(null);
    setPhase("ended");
    spawnFx({ emoji: "💨", text: "Escaped", tone: "flee", target: "stage", x: 66, y: 38 });
    flashPanelFleeTint();
    setError(null);
    router.refresh();
  }, [fleeState, log, round, potionCount, playerMax, router]);

  const shouldHydrateResume =
    !!resumeCombat &&
    (phase !== "fight" ||
      encounterId !== resumeCombat.encounterId ||
      resumeCombat.round > round ||
      (resumeCombat.round === round &&
        (resumeCombat.log.length > log.length ||
          resumeCombat.player.hp !== playerHp ||
          resumeCombat.enemy.hp !== enemyHp ||
          (resumeCombat.enemyIntent as EnemyIntentKey) !== enemyIntent)));

  // When the server has an ACTIVE encounter, always mirror it if the client is not already in that fight.
  // The old `resumeAppliedRef` gate could stay true after `setEncounterId(null)` at roll start, so we never
  // hydrated again (hub + empty combat panel, no battle UI — common on mobile).
  useLayoutEffect(() => {
    if (!resumeCombat) return;
    if (!shouldHydrateResume) return;
    // Avoid setState via pushAdventureDebug during layout (can reorder updates on some runtimes).
    queueMicrotask(() =>
      pushAdventureDebug(
        `resumeCombat hydrate → fight (encounterId=${resumeCombat.encounterId}, was phase=${phase} id=${encounterId ?? "null"})`,
      ),
    );
    applyCombatStart(resumeCombat as StartPayload);
    setError(null);
    // encounterId / phase intentionally in deps so we re-sync after roll start clears local encounter id.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- applyCombatStart only mutates React state from this module
  }, [resumeCombat, shouldHydrateResume, encounterId, phase]);

  // Paint-phase fallback if layout hydration was skipped (seen on some mobile WebViews).
  useEffect(() => {
    if (!resumeCombat) return;
    if (!shouldHydrateResume) return;
    applyCombatStart(resumeCombat as StartPayload);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeCombat, shouldHydrateResume, encounterId, phase]);

  const leaveToTown = () => {
    void returnToTownAction();
  };

  const combatFormBusy =
    busy || isTurnPending || isFleePending || isEventChoicePending || presentationBlocking;

  useEffect(() => {
    clearAutoTimer();
    if (!autoAdventureEnabled) {
      setAutoAdventureRunning(false);
      return;
    }
    if (phase === "ended" && ended?.outcome === "DEFEAT") {
      setAutoAdventureRunning(false);
      return;
    }
    if (
      busy ||
      isRollPending ||
      isTurnPending ||
      isEventChoicePending ||
      isFleePending ||
      presentationBlocking
    ) {
      setAutoAdventureRunning(true);
      return;
    }

    const run = () => {
      if (!autoAdventureEnabled) return;
      if (phase === "hub") {
        if (pendingEvent) {
          const takeRisk = Math.random() < 0.8;
          (takeRisk ? riskEventFormRef.current : safeEventFormRef.current)?.requestSubmit();
          return;
        }
        rollFormRef.current?.requestSubmit();
        return;
      }
      if (phase === "fight" && encounterId) {
        const action = chooseAutoCombatAction();
        if (autoTurnActionInputRef.current) autoTurnActionInputRef.current.value = action;
        if (autoTurnEncounterInputRef.current) autoTurnEncounterInputRef.current.value = encounterId;
        autoTurnFormRef.current?.requestSubmit();
        return;
      }
      if (phase === "ended" && ended && ended.outcome !== "DEFEAT") {
        continueFormRef.current?.requestSubmit();
      }
    };

    setAutoAdventureRunning(true);
    autoTimerRef.current = window.setTimeout(run, autoStepDelayMs());
  }, [
    autoAdventureEnabled,
    phase,
    ended,
    pendingEvent,
    postEventArt,
    encounterId,
    busy,
    isRollPending,
    isTurnPending,
    isEventChoicePending,
    isFleePending,
    enemyIntent,
    potionCount,
    potionCooldownRemaining,
    playerHp,
    playerMax,
    skillCooldownRemaining,
    presentationBlocking,
  ]);

  const stageCombatFx = combatFx.filter((f) => !f.target || f.target === "stage");
  const playerCombatFx = combatFx.filter((f) => f.target === "player");
  const enemyCombatFx = combatFx.filter((f) => f.target === "enemy");

  const stageCombatFxLive = phase === "fight" ? stageCombatFx : [];
  const playerCombatFxLive = phase === "fight" ? playerCombatFx : [];
  const enemyCombatFxLive = phase === "fight" ? enemyCombatFx : [];
  const logLinesForPanel = phase === "ended" && ended ? ended.log : log;
  const playerPoseForStage = phase === "ended" ? "idle" : playerSpritePose;
  const enemyPoseForStage = phase === "ended" ? "idle" : enemySpritePose;
  const enemySquashHeld =
    enemyDeathSquash || (phase === "ended" && ended?.outcome === "VICTORY");

  return (
    <div className="relative isolate rounded-2xl border border-white/20 bg-zinc-950/45 bg-linear-to-b from-black/62 via-black/78 to-black/95 p-1 shadow-md backdrop-blur-[1px]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.06),transparent_58%)]" />
      {panelFleeTint ? (
        <div className="pointer-events-none absolute inset-0 z-10 animate-combat-tint combat-tint-flee" />
      ) : null}
      <div className="relative z-1 rounded-xl border border-white/15 bg-black/30 p-5 backdrop-blur-[1px] md:p-6">
        {showDebugOverlay ? (
          <div
            className="mb-4 max-h-[min(38vh,18rem)] overflow-auto rounded-lg border-2 border-emerald-500 bg-emerald-950/50 p-3 font-mono text-[11px] leading-snug text-emerald-50 shadow-md"
            aria-live="polite"
          >
            <p className="mb-1 font-sans text-xs font-bold text-emerald-200">Arena trace (in-page)</p>
            <pre className="whitespace-pre-wrap">
              {adventureDebugLines.length
                ? adventureDebugLines.join("\n")
                : "Tap Adventure — trace logs form submit + server action result (no fetch/onClick on mobile)."}
            </pre>
            <p className="mt-2 font-sans text-[10px] text-emerald-200/80">
              phase={phase}
              {" · "}
              hydrated={String(hydrated)}
              {phase !== "hub" ? " · hub Adventure button is hidden in fight/ended" : ""}
            </p>
          </div>
        ) : null}

        <header className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-white/15 pb-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">Adventure</p>
            <h2 className="font-serif text-xl font-semibold text-zinc-100 md:text-2xl">{regionName}</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              {characterName}
              <span
                className={`ml-2 rounded border px-1.5 py-0.5 text-[10px] ${
                  phase === "hub"
                    ? hydrated
                      ? "border-white/25 text-zinc-300"
                      : "border-white/15 text-zinc-500"
                    : hydrated
                      ? "border-emerald-700/70 text-emerald-300"
                      : "border-amber-700/70 text-amber-300"
                }`}
              >
                client:{hydrated ? "hydrated" : "ssr-only"}
              </span>
            </p>
          </div>
        </header>

        <div className="mb-4 rounded-lg border border-white/20 bg-black/45 px-3 py-2.5 backdrop-blur-sm">
          <label htmlFor={autoAdventureFieldId} className="flex cursor-pointer items-start gap-2.5 text-xs text-zinc-300">
            <input
              id={autoAdventureFieldId}
              type="checkbox"
              checked={autoAdventureEnabled}
              onChange={(e) => setAutoAdventureEnabled(e.target.checked)}
              className="peer sr-only"
            />
            <span
              className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-zinc-500/85 bg-zinc-600/75 shadow-inner transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-white/25 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-zinc-950 peer-checked:border-white peer-checked:bg-zinc-100 peer-checked:shadow-none peer-checked:[&_svg]:opacity-100"
              aria-hidden
            >
              <svg
                viewBox="0 0 12 12"
                className="h-2.5 w-2.5 text-zinc-900 opacity-0 transition-opacity duration-150"
                fill="none"
                aria-hidden
              >
                <path d="M2.5 6L5 8.5l4.5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="min-w-0 flex-1 leading-snug">
              <span className="font-medium text-zinc-200">Auto adventure</span>
              {autoAdventureEnabled ? (
                <span className="ml-1.5 text-[10px] uppercase tracking-wider text-zinc-400">
                  {autoAdventureRunning ? "running" : "armed"}
                </span>
              ) : null}
              <span className="mt-1 block text-[11px] font-normal text-zinc-500">
                Auto-picks events and performs combat actions every 1–2 seconds.
              </span>
            </span>
          </label>
        </div>

        {error ? <p className="mb-3 rounded-md border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">{error}</p> : null}

        {phase === "hub" ? (
          <div className="relative z-20 space-y-4">
            <p className="text-sm text-zinc-400">
              Each outing is a surprise: loose coin, a tonic in the brush, or a fight. In combat, enemy intent is telegraphed — strike, brace, or sip.
            </p>
            {pendingEvent ? (
              <div className="mx-auto max-w-xl rounded-xl border border-white/15 bg-black/40 px-4 py-5 text-center shadow-inner backdrop-blur-sm sm:px-6">
                <div className="relative mx-auto mb-4 aspect-4/3 w-full max-w-md overflow-hidden rounded-lg border border-white/10 bg-black shadow-md">
                  {/* eslint-disable-next-line @next/next/no-img-element -- static public pixel art */}
                  <img
                    src={ADVENTURE_EVENT_ART[pendingEvent.kind]}
                    alt={pendingEvent.title}
                    className="h-full w-full object-contain object-center"
                    decoding="async"
                  />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">{pendingEvent.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-zinc-300">{pendingEvent.prompt}</p>
                <div className="mt-5 flex flex-col items-stretch gap-2.5 sm:flex-row sm:justify-center sm:gap-3">
                  <form ref={safeEventFormRef} action={eventChoiceFormAction} className="min-w-0 sm:flex-1 sm:max-w-56">
                    <input type="hidden" name="kind" value={pendingEvent.kind} />
                    <input type="hidden" name="choice" value="SAFE" />
                    <button
                      type="submit"
                      disabled={isEventChoicePending}
                      className="w-full touch-manipulation rounded-lg border border-zinc-600/80 bg-zinc-800/70 px-3 py-2.5 text-xs font-semibold leading-snug text-zinc-100 shadow-sm transition-colors enabled:hover:border-zinc-500 enabled:hover:bg-zinc-700/70 disabled:opacity-40"
                    >
                      {pendingEvent.safeLabel}
                    </button>
                  </form>
                  <form ref={riskEventFormRef} action={eventChoiceFormAction} className="min-w-0 sm:flex-1 sm:max-w-56">
                    <input type="hidden" name="kind" value={pendingEvent.kind} />
                    <input type="hidden" name="choice" value="RISK" />
                    <button
                      type="submit"
                      disabled={isEventChoicePending}
                      className="w-full touch-manipulation rounded-lg border border-amber-800/55 bg-amber-950/45 px-3 py-2.5 text-xs font-semibold leading-snug text-amber-50 shadow-sm transition-colors enabled:hover:border-amber-600/60 enabled:hover:bg-amber-900/40 disabled:opacity-40"
                    >
                      {pendingEvent.riskLabel}
                    </button>
                  </form>
                </div>
              </div>
            ) : postEventArt ? (
              <div className="mx-auto max-w-xl rounded-xl border border-white/15 bg-black/40 px-4 py-5 text-center shadow-inner backdrop-blur-sm sm:px-6">
                <div className="relative mx-auto mb-4 aspect-4/3 w-full max-w-md overflow-hidden rounded-lg border border-white/10 bg-black shadow-md">
                  {/* eslint-disable-next-line @next/next/no-img-element -- static public pixel art */}
                  <img
                    src={ADVENTURE_EVENT_ART[postEventArt.kind]}
                    alt={postEventArt.title}
                    className="h-full w-full object-contain object-center"
                    decoding="async"
                  />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">{postEventArt.title}</p>
                {hubLines?.length ? (
                  <div className="mt-4 text-left">
                    <AdventureHubRichLines lines={hubLines} />
                  </div>
                ) : null}
                <form
                  ref={rollFormRef}
                  action={rollFormAction}
                  className="mt-5 w-full"
                  onSubmit={(e) => {
                    if (busy || isRollPending) {
                      e.preventDefault();
                      return;
                    }
                    pushAdventureDebug("hub: form submit → startAdventureRollAction (post-event)");
                  }}
                >
                  <button
                    type="submit"
                    aria-busy={busy || isRollPending}
                    onClick={() => {
                      if (!(busy || isRollPending)) playSfx("adventure");
                    }}
                    className={`w-full touch-manipulation rounded-xl border-2 border-white/35 bg-linear-to-b from-zinc-900/95 to-black py-4 text-center text-base font-bold uppercase tracking-[0.15em] text-zinc-100 shadow-lg hover:border-white/50 hover:from-zinc-800 hover:to-zinc-950 active:bg-black sm:py-5 sm:text-lg ${busy || isRollPending ? "cursor-wait opacity-55" : "cursor-pointer opacity-100"}`}
                  >
                    {busy || isRollPending ? "Rolling encounter…" : "Adventure"}
                  </button>
                </form>
              </div>
            ) : null}
            {hubLines?.length && !pendingEvent && !postEventArt ? (
              <AdventureHubRichLines lines={hubLines} />
            ) : null}
            {busy ? (
              <div className="rounded-lg border border-white/15 bg-black/40 px-4 py-3 backdrop-blur-sm">
                <p className="text-sm font-semibold text-amber-200">{ADVENTURE_STATUS_LINES[adventureStatusIndex]}</p>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full border border-amber-900/60 bg-amber-950/35">
                  <div className="adventure-progress h-full w-2/5 rounded-full bg-linear-to-r from-amber-500 via-yellow-300 to-amber-500" />
                </div>
              </div>
            ) : null}
            {!pendingEvent && !postEventArt ? (
              <form
                ref={rollFormRef}
                action={rollFormAction}
                className="w-full"
                onSubmit={(e) => {
                  if (busy || isRollPending) {
                    e.preventDefault();
                    return;
                  }
                  pushAdventureDebug("hub: form submit → startAdventureRollAction");
                }}
              >
                <button
                  type="submit"
                  aria-busy={busy || isRollPending}
                  onClick={() => {
                    if (!(busy || isRollPending)) playSfx("adventure");
                  }}
                  className={`w-full touch-manipulation rounded-xl border-2 border-white/35 bg-linear-to-b from-zinc-900/95 to-black py-4 text-center text-base font-bold uppercase tracking-[0.15em] text-zinc-100 shadow-lg hover:border-white/50 hover:from-zinc-800 hover:to-zinc-950 active:bg-black sm:py-5 sm:text-lg ${busy || isRollPending ? "cursor-wait opacity-55" : "cursor-pointer opacity-100"}`}
                >
                  {busy || isRollPending ? "Rolling encounter…" : "Adventure"}
                </button>
              </form>
            ) : null}
          </div>
        ) : null}

        {phase === "ended" && ended ? (
          <div className="space-y-4">
            <div className="relative" ref={combatStageOverlayRef}>
              <CombatStage
              bannerSrc={regionBannerSrc}
              round={ended.round}
              combatFx={stageCombatFxLive}
              left={
                <CombatActorPanel
                  name={characterName}
                  hp={playerHp}
                  maxHp={playerMax}
                  spriteSrc={getPlayerSpritePath(characterClass, playerPoseForStage)}
                  spriteAlt={characterName}
                  barGradient="bg-linear-to-r from-violet-700 to-rose-600"
                  floatingFx={playerCombatFxLive}
                  shakeGen={playerShakeGen}
                  stageSide="left"
                  lungeForward={false}
                  hitFlash={playerHitFlash}
                />
              }
              right={
                <CombatActorPanel
                  name={formatEnemyCombatPanelName(enemyName, enemyLevel, enemyKind)}
                  flipSprite
                  hp={enemyHp}
                  maxHp={enemyMax}
                  spriteSrc={getEnemySpritePath(enemyKey, enemyPoseForStage, regionKey)}
                  spriteAlt={enemyName ? `${enemyName} (${enemyEmoji})` : "Enemy"}
                  intentEmoji={undefined}
                  intentTitle={undefined}
                  barGradient="bg-linear-to-r from-violet-700 to-rose-600"
                  floatingFx={enemyCombatFxLive}
                  shakeGen={enemyShakeGen}
                  stageSide="right"
                  lungeForward={false}
                  deathSquash={enemySquashHeld}
                  hitFlash={enemyHitFlash}
                />
              }
            />

            <div className="pointer-events-none absolute inset-0 z-60 flex items-center justify-center rounded-2xl bg-black/55 p-3 backdrop-blur-sm">
              <section className="pointer-events-auto rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 text-center shadow-inner backdrop-blur-sm">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Outcome</p>
              <div
                className={`mx-auto max-w-md rounded-xl border-2 p-5 ${
                  ended.outcome === "VICTORY"
                    ? "border-amber-500/50 bg-amber-950/30"
                    : ended.outcome === "FLED"
                      ? "border-amber-700/50 bg-amber-950/20"
                      : "border-zinc-600 bg-zinc-900/50"
                }`}
              >
                {ended.outcome === "VICTORY" ? (
                  <>
                    <p className="text-3xl">🏆</p>
                    <p className="mt-2 font-serif text-xl font-semibold text-amber-200">Triumph</p>
                    <p className="mt-1 text-sm text-zinc-400">
                      +{ended.xpGained ?? 0} XP · +{ended.goldGained ?? 0} gold
                      {ended.leveled ? (
                        <span className="block text-emerald-400">
                          You surged to a new level! +{STAT_POINTS_PER_LEVEL} stat points to spend on your sheet.
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-2 text-xs text-emerald-600/85">
                      You keep your fight-ending HP — use the town campfire (or level up for a small bump).
                    </p>
                    {(ended.droppedItems?.length ?? 0) > 0 ? (
                      <div className="mt-3 rounded-lg border border-emerald-900/40 bg-black/30 px-3 py-2 text-left">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/90">Loot gained</p>
                        <ul className="mt-2 space-y-2">
                          {ended.droppedItems!.map((it) => (
                            <li key={it.id} className="text-sm">
                              {it.slot ? (
                                <ItemHoverCard
                                  item={it as unknown as Parameters<typeof ItemHoverCard>[0]["item"]}
                                  affixPrefix={it.affixPrefix ?? null}
                                  bonusLifeSteal={it.bonusLifeSteal ?? 0}
                                  bonusCritChance={it.bonusCritChance ?? 0}
                                  bonusSkillPower={it.bonusSkillPower ?? 0}
                                  bonusDefensePercent={it.bonusDefensePercent ?? 0}
                                  bonusConstitutionPercent={it.bonusConstitutionPercent ?? 0}
                                  bonusStrength={it.bonusStrength ?? 0}
                                  bonusConstitution={it.bonusConstitution ?? 0}
                                  bonusIntelligence={it.bonusIntelligence ?? 0}
                                  bonusDexterity={it.bonusDexterity ?? 0}
                                >
                                  <span className={`font-semibold ${rarityNameClass(it.rarity)}`}>
                                    {it.emoji} {it.name}
                                  </span>
                                </ItemHoverCard>
                              ) : (
                                <span className={`font-semibold ${rarityNameClass(it.rarity)}`}>
                                  {it.emoji} {it.name}
                                </span>
                              )}
                              <span className="ml-2 font-mono text-[11px] text-zinc-500">
                                +{it.attack ? `${it.attack} ATK ` : ""}
                                {it.defense ? `${it.defense} DEF ` : ""}
                                {it.hp ? `${it.hp} HP ` : ""}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <p className="mt-2 text-[11px] text-zinc-500">
                          Added to your pack — hover an item for full stats and sell value.
                        </p>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-zinc-500">No drops this time.</p>
                    )}
                  </>
                ) : ended.outcome === "DEFEAT" ? (
                  <>
                    <p className="text-3xl">💀</p>
                    <p className="mt-2 font-serif text-xl font-semibold text-zinc-300">Defeated</p>
                    <p className="mt-1 text-sm text-zinc-400">
                      +{ended.xpGained ?? 0} XP (consolation). No gold lost.
                      {ended.leveled ? (
                        <span className="mt-1 block text-emerald-400/90">
                          You still leveled — +{STAT_POINTS_PER_LEVEL} stat points on your sheet.
                        </span>
                      ) : null}
                      {ended.returnedToTown ? (
                        <span className="mt-1 block text-emerald-400/90">
                          The healers patch you up — {ended.finalHp ?? "?"} HP, back in town.
                        </span>
                      ) : (
                        <span className="mt-1 block">Restored to {ended.finalHp ?? "?"} HP.</span>
                      )}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-3xl">💨</p>
                    <p className="mt-2 font-serif text-xl font-semibold text-amber-100">Escaped</p>
                    <p className="mt-1 text-sm text-zinc-400">
                      You slip away before the fight can finish. No rewards, no penalties.
                    </p>
                  </>
                )}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={leaveToTown}
                  className="min-h-11 cursor-pointer touch-manipulation rounded-lg border border-zinc-700 bg-zinc-900/60 px-5 py-3 text-sm font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
                >
                  Return to town
                </button>
                {ended.outcome !== "DEFEAT" ? (
                  <form
                    ref={continueFormRef}
                    action={rollFormAction}
                    className="inline"
                    onSubmit={(e) => {
                      if (busy || isRollPending) {
                        e.preventDefault();
                        return;
                      }
                      pushAdventureDebug("ended: form submit → startAdventureRollAction");
                    }}
                  >
                    <button
                      type="submit"
                      aria-busy={busy || isRollPending}
                      onClick={() => {
                        if (!(busy || isRollPending)) playSfx("adventure");
                      }}
                      className={`min-h-11 touch-manipulation rounded-lg border border-amber-800 bg-amber-950/40 px-6 py-3 text-sm font-bold text-amber-100 hover:bg-amber-900/40 ${busy || isRollPending ? "cursor-wait opacity-55" : "cursor-pointer opacity-100"}`}
                    >
                      Continue adventuring
                    </button>
                  </form>
                ) : null}
              </div>
              </section>
            </div>
          </div>

            <div className="rounded-xl border border-zinc-800 bg-black/50">
              <div className="border-b border-zinc-800 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Battle log</p>
                  <button
                    type="button"
                    onClick={() => setMobileLogExpanded((prev) => !prev)}
                    className="rounded border border-zinc-700 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-300 md:hidden"
                  >
                    {mobileLogExpanded ? "Hide log" : "Show log"}
                  </button>
                </div>
              </div>
              <div
                ref={logScrollRef}
                className={`combat-log-scroll overflow-y-auto px-3 py-2 font-serif text-sm leading-relaxed text-zinc-300 ${
                  mobileLogExpanded ? "max-h-40" : "max-h-28"
                } md:max-h-36`}
              >
                {logLinesForPanel.map((line, i) => (
                  <p key={`${i}-${line.slice(0, 24)}`} className="border-b border-zinc-900/50 py-1.5 last:border-0">
                    {line}
                  </p>
                ))}
              </div>
            </div>
          </div>
        ) : phase === "fight" ? (
          <div className="relative space-y-4">
            <CombatStage
              bannerSrc={regionBannerSrc}
              round={round}
              combatFx={stageCombatFxLive}
              left={
                <CombatActorPanel
                  name={characterName}
                  hp={playerHp}
                  maxHp={playerMax}
                  spriteSrc={getPlayerSpritePath(characterClass, playerPoseForStage)}
                  spriteAlt={characterName}
                  barGradient="bg-linear-to-r from-violet-700 to-rose-600"
                  floatingFx={playerCombatFxLive}
                  shakeGen={playerShakeGen}
                  stageSide="left"
                  lungeForward={phase === "fight" && playerLungeForward}
                  hitFlash={playerHitFlash}
                />
              }
              right={
                <CombatActorPanel
                  name={formatEnemyCombatPanelName(enemyName, enemyLevel, enemyKind)}
                  flipSprite
                  hp={enemyHp}
                  maxHp={enemyMax}
                  spriteSrc={getEnemySpritePath(enemyKey, enemyPoseForStage, regionKey)}
                  spriteAlt={enemyName ? `${enemyName} (${enemyEmoji})` : "Enemy"}
                  intentEmoji={phase === "fight" ? enemyIntentEmoji(enemyIntent) : undefined}
                  intentTitle={phase === "fight" ? enemyIntentTitle(enemyIntent) : undefined}
                  barGradient="bg-linear-to-r from-violet-700 to-rose-600"
                  floatingFx={enemyCombatFxLive}
                  shakeGen={enemyShakeGen}
                  stageSide="right"
                  lungeForward={phase === "fight" && enemyLungeForward}
                  deathSquash={enemySquashHeld}
                  hitFlash={enemyHitFlash}
                />
              }
            />

            <section className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 shadow-inner backdrop-blur-sm">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Actions</p>
              <p className="mb-3 text-[11px] leading-snug text-zinc-400">
                Tonics: <span className="font-mono text-amber-200/90">{potionCount}</span> / {MAX_POTIONS_PER_BATTLE}
                {potionCooldownRemaining > 0 ? (
                  <span className="text-emerald-600/90">
                    {" "}
                    · sip CD {potionCooldownRemaining}/{potionMaxCooldown || "?"}
                  </span>
                ) : null}
                <span className="text-zinc-600"> · </span>
                Mana <span className="font-mono text-sky-200/90">{playerMana}</span> / {playerMaxMana}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <form action={turnFormAction} className="contents">
                  <input type="hidden" name="encounterId" value={encounterId ?? ""} />
                  <button
                    type="submit"
                    name="action"
                    value="ATTACK"
                    disabled={combatFormBusy || !encounterId}
                    className="min-h-12 w-full cursor-pointer touch-manipulation rounded-lg border border-red-900/50 bg-red-950/60 px-2 py-3 text-sm font-bold text-red-100 hover:bg-red-900/50 disabled:opacity-50"
                  >
                    Attack
                  </button>
                </form>
                <form action={turnFormAction} className="contents">
                  <input type="hidden" name="encounterId" value={encounterId ?? ""} />
                  <button
                    type="submit"
                    name="action"
                    value="DEFEND"
                    disabled={combatFormBusy || !encounterId}
                    className="min-h-12 w-full cursor-pointer touch-manipulation rounded-lg border border-sky-900/50 bg-sky-950/50 px-2 py-3 text-sm font-bold text-sky-100 hover:bg-sky-900/40 disabled:opacity-50"
                  >
                    Defend
                  </button>
                </form>
                <form action={turnFormAction} className="contents">
                  <input type="hidden" name="encounterId" value={encounterId ?? ""} />
                  <button
                    type="submit"
                    name="action"
                    value="SKILL"
                    disabled={combatFormBusy || !encounterId || skillCooldownRemaining > 0}
                    className="min-h-12 w-full cursor-pointer touch-manipulation rounded-lg border border-violet-900/50 bg-violet-950/45 px-2 py-3 text-sm font-bold text-violet-100 hover:bg-violet-900/35 disabled:opacity-50"
                    title={
                      skillCooldownRemaining > 0
                        ? `Skill recharges in ${skillCooldownRemaining} turn(s).`
                        : `${skillName} · ${skillMaxCooldown}-turn cooldown after use.`
                    }
                  >
                    <span className="mr-1.5">{skillEmoji}</span>
                    {skillName}
                    {skillCooldownRemaining > 0 ? (
                      <span className="mt-0.5 block text-[10px] font-normal uppercase tracking-wider text-violet-300/80">
                        CD {skillCooldownRemaining}/{skillMaxCooldown}
                      </span>
                    ) : null}
                  </button>
                </form>
                <form action={turnFormAction} className="contents">
                  <input type="hidden" name="encounterId" value={encounterId ?? ""} />
                  <button
                    type="submit"
                    name="action"
                    value="POTION"
                    disabled={combatFormBusy || !encounterId || potionCount < 1 || potionCooldownRemaining > 0}
                    title={
                      potionCooldownRemaining > 0
                        ? `Wait ${potionCooldownRemaining} turn(s) before another tonic in this fight.`
                        : potionCount < 1
                          ? "No tonics in pack."
                          : "Drink a tonic (starts cooldown)."
                    }
                    className="min-h-12 w-full cursor-pointer touch-manipulation rounded-lg border border-emerald-900/50 bg-emerald-950/40 px-2 py-3 text-sm font-bold text-emerald-100 hover:bg-emerald-900/35 disabled:opacity-50"
                  >
                    Use potion
                    {potionCooldownRemaining > 0 ? (
                      <span className="mt-0.5 block text-[10px] font-normal uppercase tracking-wider text-emerald-300/80">
                        Tonic CD {potionCooldownRemaining}/{potionMaxCooldown || "?"}
                      </span>
                    ) : null}
                  </button>
                </form>
                <form action={turnFormAction} className="contents">
                  <input type="hidden" name="encounterId" value={encounterId ?? ""} />
                  <button
                    type="submit"
                    name="action"
                    value="AUTO"
                    disabled={combatFormBusy || !encounterId}
                    className="min-h-12 w-full cursor-pointer touch-manipulation rounded-lg border border-amber-800/60 bg-amber-950/30 px-2 py-3 text-sm font-bold text-amber-100 hover:bg-amber-900/25 disabled:opacity-50"
                  >
                    Auto battle
                  </button>
                </form>
                <div className="col-span-2 sm:col-span-1">
                  <form action={fleeFormAction}>
                    <input type="hidden" name="encounterId" value={encounterId ?? ""} />
                    <button
                      type="submit"
                      disabled={combatFormBusy || !encounterId}
                      className="min-h-12 w-full cursor-pointer touch-manipulation rounded-lg border border-zinc-700 px-2 py-2 text-xs text-zinc-400 hover:bg-zinc-900 disabled:opacity-50"
                    >
                      Attempt flee ({Math.round(fleeChance * 100)}%)
                    </button>
                  </form>
                </div>
              </div>
            </section>

            <div className="rounded-xl border border-zinc-800 bg-black/50">
              <div className="border-b border-zinc-800 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Battle log</p>
                  <button
                    type="button"
                    onClick={() => setMobileLogExpanded((prev) => !prev)}
                    className="rounded border border-zinc-700 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-300 md:hidden"
                  >
                    {mobileLogExpanded ? "Hide log" : "Show log"}
                  </button>
                </div>
              </div>
              <div
                ref={logScrollRef}
                className={`combat-log-scroll overflow-y-auto px-3 py-2 font-serif text-sm leading-relaxed text-zinc-300 ${
                  mobileLogExpanded ? "max-h-40" : "max-h-28"
                } md:max-h-36`}
              >
                {logLinesForPanel.map((line, i) => (
                  <p key={`${i}-${line.slice(0, 24)}`} className="border-b border-zinc-900/50 py-1.5 last:border-0">
                    {line}
                  </p>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <form ref={autoTurnFormRef} action={turnFormAction} className="hidden">
          <input ref={autoTurnEncounterInputRef} type="hidden" name="encounterId" value={encounterId ?? ""} />
          <input ref={autoTurnActionInputRef} type="hidden" name="action" value="ATTACK" />
        </form>
      </div>
      <style jsx>{`
        .combat-fx {
          position: absolute;
          display: flex;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          padding: 6px 12px;
          backdrop-filter: blur(3px);
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
          transform: translate(-50%, -50%);
          animation: fx-pop-float 850ms ease-out forwards;
          white-space: nowrap;
          font-weight: 800;
          z-index: 20;
        }
        .combat-fx-damage {
          color: #fecaca;
          background: rgba(127, 29, 29, 0.72);
        }
        .combat-fx-heal {
          color: #dcfce7;
          background: rgba(20, 83, 45, 0.74);
        }
        .combat-fx-defend {
          color: #dbeafe;
          background: rgba(30, 58, 138, 0.7);
        }
        .combat-fx-flee {
          color: #fef3c7;
          background: rgba(120, 53, 15, 0.74);
        }
        .combat-tint-flee {
          background: radial-gradient(circle at 54% 48%, rgba(245, 158, 11, 0.2), rgba(120, 53, 15, 0.1) 48%, transparent 72%);
        }
        .animate-combat-tint {
          animation: combat-tint-pulse 260ms ease-out forwards;
        }
        @keyframes fx-pop-float {
          0% {
            opacity: 0;
            transform: translate(-50%, -40%) scale(0.78);
          }
          15% {
            opacity: 1;
            transform: translate(-50%, -52%) scale(1.06);
          }
          65% {
            opacity: 1;
            transform: translate(-50%, -74%) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -92%) scale(0.96);
          }
        }
        @keyframes combat-tint-pulse {
          0% {
            opacity: 0;
          }
          20% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
        .adventure-progress {
          animation: adventure-sweep 1.05s ease-in-out infinite;
          box-shadow: 0 0 14px rgba(251, 191, 36, 0.45);
        }
        @keyframes adventure-sweep {
          0% {
            transform: translateX(-125%);
          }
          100% {
            transform: translateX(325%);
          }
        }
      `}</style>
    </div>
  );
}
