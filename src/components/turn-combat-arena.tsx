"use client";

import {
  combatTurnAction,
  fleeCombatAction,
  resolveAdventureEventChoiceAction,
  returnToTownAction,
  startAdventureRollAction,
} from "@/app/actions/game";
import { ItemHoverCard } from "@/components/item-hover-card";
import { useSfx } from "@/components/sfx-provider";
import type { EnemyKind, SoloEncounterStartJson } from "@/lib/game/start-encounter";
import { rarityNameClass } from "@/lib/game/item-rarity-styles";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { MAX_POTIONS_PER_BATTLE, STAT_POINTS_PER_LEVEL } from "@/lib/game/constants";
import type { AdventureEventPayload } from "@/lib/game/adventure-start-execute";

type EnemyIntentKey = "ATTACK" | "HEAVY_ATTACK" | "GUARD" | "RECOVER" | "STRIKE";

type DroppedItemPayload = {
  id: string;
  key: string;
  name: string;
  emoji: string;
  rarity: string;
  slot: string | null;
  description: string;
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

type ActivePayload = {
  status: "ACTIVE";
  round: number;
  enemyIntent: EnemyIntentKey;
  enemyKind: EnemyKind;
  player: { hp: number; maxHp: number };
  enemy: { name: string; emoji: string; level: number; hp: number; maxHp: number };
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
  goldLost?: number;
  finalHp?: number;
  returnedToTown?: boolean;
};

type CombatFxTone = "damage" | "heal" | "defend" | "flee";

type CombatFx = {
  id: number;
  emoji: string;
  text: string;
  tone: CombatFxTone;
  x: number;
  y: number;
};

type CombatTintTone = "damage" | "heal" | "defend" | "flee";

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

function IntentRibbon({ intent }: { intent: EnemyIntentKey }) {
  const config: Record<EnemyIntentKey, { label: string; hint: string; className: string }> = {
    ATTACK: {
      label: "Enrage",
      hint: "Buff turn — their next hit hits harder, not this one.",
      className: "border-orange-700/70 bg-orange-950/45 text-orange-100",
    },
    STRIKE: {
      label: "Strike",
      hint: "Attack turn — standard hit after you act.",
      className: "border-zinc-600 bg-zinc-900/85 text-zinc-200",
    },
    HEAVY_ATTACK: {
      label: "Heavy strike",
      hint: "Attack turn — big hit; Defend shines.",
      className: "border-rose-600/80 bg-rose-950/55 text-rose-100",
    },
    GUARD: {
      label: "Harden",
      hint: "Buff turn — your next damage faces extra armor.",
      className: "border-sky-700/70 bg-sky-950/45 text-sky-100",
    },
    RECOVER: {
      label: "Recover",
      hint: "Heal turn — they patch up (may still nick you).",
      className: "border-emerald-700/70 bg-emerald-950/40 text-emerald-100",
    },
  };
  const c = config[intent] ?? config.STRIKE;
  return (
    <div className={`rounded-lg border-2 px-4 py-3 shadow-md ${c.className}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">Telegraphed intent</p>
      <p className="mt-1 text-lg font-bold leading-tight">{c.label}</p>
      <p className="mt-0.5 text-xs leading-snug opacity-90">{c.hint}</p>
    </div>
  );
}

function HpBar({ current, max, label, gradientClass }: { current: number; max: number; label: string; gradientClass: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        <span>{label}</span>
        <span className="font-mono text-zinc-300">
          {current} / {max}
        </span>
      </div>
      <div className="mt-1.5 h-3.5 overflow-hidden rounded-md border border-black/40 bg-black/50 shadow-inner">
        <div className={`h-full rounded-md transition-[width] duration-500 ease-out ${gradientClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function TurnCombatArena({
  characterName,
  regionName,
  resumeCombat = null,
  debugAdventureFromServer = false,
}: {
  characterName: string;
  regionName: string;
  /** When the server still has an ACTIVE encounter, hydrate the fight UI (e.g. after visiting Character). */
  resumeCombat?: SoloEncounterStartJson | null;
  /** Set from RSC `searchParams` — reliable on mobile where client `useSearchParams` can lag or be empty on first paint. */
  debugAdventureFromServer?: boolean;
}) {
  const router = useRouter();
  const { playSfx } = useSfx();
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
  const [combatFx, setCombatFx] = useState<CombatFx[]>([]);
  const [combatTint, setCombatTint] = useState<CombatTintTone | null>(null);
  const [adventureStatusIndex, setAdventureStatusIndex] = useState(0);
  const fxIdRef = useRef(1);
  const tintTimerRef = useRef<number | null>(null);
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
        setPendingEvent(payload.event);
        setHubLines(payload.log);
        pushAdventureDebug(`outcome=EVENT (${payload.event.kind}): awaiting choice`);
      } else if (payload.outcome === "QUICK_GOLD") {
        setHubLines(payload.log);
        pushAdventureDebug("outcome=QUICK_GOLD (action): show hubLines (no immediate refresh)");
      } else if (payload.outcome === "QUICK_POTION") {
        setHubLines(payload.log);
        pushAdventureDebug("outcome=QUICK_POTION (action): show hubLines (no immediate refresh)");
      } else if (payload.outcome === "QUICK_XP") {
        setHubLines(payload.log);
        pushAdventureDebug("outcome=QUICK_XP (action): show hubLines (no immediate refresh)");
      } else {
        pushAdventureDebug(`adventure roll: unknown outcome ${String((payload as { outcome?: string }).outcome)}`);
      }
      setBusy(false);
    })();
  }, [rollState]);

  useEffect(() => {
    if (!eventChoiceState) return;
    if (!eventChoiceState.ok) {
      setError(eventChoiceState.error);
      return;
    }
    const payload = eventChoiceState.payload;
    if (payload.outcome === "QUICK_GOLD" || payload.outcome === "QUICK_POTION" || payload.outcome === "QUICK_XP") {
      setHubLines(payload.log);
      setPendingEvent(null);
      setError(null);
      refreshPreservingScroll();
    }
  }, [eventChoiceState]);

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

      const newLines = data.log.slice(beforeLogLength);
      if (action === "ATTACK" || action === "SKILL") {
        const dealt = Math.max(0, beforeEnemyHp - data.enemy.hp);
        const parsed = parseLastAmount(newLines, /for\s+(\d+)(?:\s*\(|\s+damage|$)/i);
        const shown = dealt > 0 ? dealt : parsed;
        if (shown && shown > 0) {
          spawnFx({ emoji: action === "SKILL" ? skillEmoji || "✨" : "⚔️", text: `-${shown}`, tone: "damage", x: 68, y: 28 });
          flashTint("damage");
        }
      } else if (action === "POTION") {
        const healed = Math.max(0, data.player.hp - beforePlayerHp);
        const parsed = parseLastAmount(newLines, /recover\s+(\d+)\s+HP/i);
        const shown = healed > 0 ? healed : parsed;
        if (shown && shown > 0) {
          spawnFx({ emoji: "🩹", text: `+${shown}`, tone: "heal", x: 28, y: 62 });
          flashTint("heal");
        } else {
          spawnFx({ emoji: "🧪", text: "Full HP", tone: "heal", x: 28, y: 62 });
          flashTint("heal");
        }
      } else if (action === "DEFEND") {
        const shielded = parseShieldedAmount(newLines);
        spawnFx({
          emoji: "🛡️",
          text: shielded && shielded > 0 ? `${shielded} blocked` : "Guard up",
          tone: "defend",
          x: 32,
          y: 38,
        });
        flashTint("defend");
      }
    } else {
      setEnded(data);
      setLog(data.log);
      setPotionCount(data.potionCount);
      setPhase("ended");
      setEncounterId(null);
      const newLines = data.log.slice(beforeLogLength);
      if (action === "ATTACK" || action === "SKILL") {
        const parsed = parseLastAmount(newLines, /for\s+(\d+)(?:\s*\(|\s+damage|$)/i);
        if (parsed && parsed > 0) {
          spawnFx({ emoji: action === "SKILL" ? skillEmoji || "✨" : "⚔️", text: `-${parsed}`, tone: "damage", x: 68, y: 28 });
          flashTint("damage");
        }
      } else if (action === "POTION") {
        const parsed = parseLastAmount(newLines, /recover\s+(\d+)\s+HP/i);
        spawnFx({ emoji: parsed && parsed > 0 ? "🩹" : "🧪", text: parsed && parsed > 0 ? `+${parsed}` : "Potion", tone: "heal", x: 28, y: 62 });
        flashTint("heal");
      } else if (action === "DEFEND") {
        const shielded = parseShieldedAmount(newLines);
        spawnFx({
          emoji: "🛡️",
          text: shielded && shielded > 0 ? `${shielded} blocked` : "Guard up",
          tone: "defend",
          x: 32,
          y: 38,
        });
        flashTint("defend");
      }
      if (data.outcome === "VICTORY") {
        playSfx("loot");
        if (data.leveled) playSfx("level-up");
      }
    }
    setError(null);
    if (data.status === "ENDED") {
      refreshPreservingScroll();
    }
  }, [turnState, playerHp, enemyHp, log, skillEmoji, playerMana, playerMaxMana, fleeChance, playSfx]);

  useEffect(() => {
    if (!fleeState) return;
    if (processedFleeAtRef.current === fleeState.rolledAt) return;
    processedFleeAtRef.current = fleeState.rolledAt;
    if (!fleeState.ok) {
      const defeatFromFlee = fleeState.error.toLowerCase().includes("defeated");
      if (defeatFromFlee) {
        const defeatLog = [...log, "☠ You fail to escape and are dragged back to town."];
        setEnded({
          status: "ENDED",
          outcome: "DEFEAT",
          round,
          log: defeatLog,
          potionCount,
          finalHp: Math.max(1, Math.floor(playerMax * 0.35)),
          returnedToTown: true,
        });
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
    spawnFx({ emoji: "💨", text: "Escaped", tone: "flee", x: 66, y: 38 });
    flashTint("flee");
    setError(null);
    router.refresh();
  }, [fleeState, log, round, potionCount, playerMax, router]);

  const spawnFx = (params: Omit<CombatFx, "id">) => {
    const id = fxIdRef.current;
    fxIdRef.current += 1;
    setCombatFx((prev) => [...prev, { id, ...params }]);
    window.setTimeout(() => {
      setCombatFx((prev) => prev.filter((fx) => fx.id !== id));
    }, 850);
  };

  const flashTint = (tone: CombatTintTone) => {
    if (tintTimerRef.current) {
      window.clearTimeout(tintTimerRef.current);
    }
    setCombatTint(tone);
    tintTimerRef.current = window.setTimeout(() => {
      setCombatTint(null);
      tintTimerRef.current = null;
    }, 260);
  };

  const applyCombatStart = (data: StartPayload) => {
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
  };

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
  // hydrated again (hub + amber "active fight" banner, no battle panel — common on mobile).
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

  const combatFormBusy = busy || isTurnPending || isFleePending || isEventChoicePending;

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
    if (busy || isRollPending || isTurnPending || isEventChoicePending || isFleePending) {
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
  ]);

  return (
    <div className="relative isolate rounded-2xl border-2 border-amber-900/50 bg-linear-to-b from-zinc-900 via-zinc-950 to-black p-1 shadow-[0_0_40px_rgba(0,0,0,0.6)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(180,83,9,0.12),transparent_55%)]" />
      {combatTint ? <div className={`pointer-events-none absolute inset-0 z-10 animate-combat-tint ${`combat-tint-${combatTint}`}`} /> : null}
      <div className="relative z-1 rounded-xl border border-zinc-800/80 bg-zinc-950/80 p-5 md:p-6">
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

        <header className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-amber-900/30 pb-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-600/90">Adventure</p>
            <h2 className="font-serif text-xl font-semibold text-amber-100 md:text-2xl">{regionName}</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              {characterName}
              <span className={`ml-2 rounded border px-1.5 py-0.5 text-[10px] ${hydrated ? "border-emerald-700/70 text-emerald-300" : "border-amber-700/70 text-amber-300"}`}>
                client:{hydrated ? "hydrated" : "ssr-only"}
              </span>
            </p>
          </div>
          {phase === "fight" ? (
            <div className="rounded-md border border-zinc-700 bg-black/40 px-3 py-1.5 text-center">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Round</p>
              <p className="font-mono text-lg leading-none text-amber-400">{round}</p>
            </div>
          ) : null}
        </header>

        <div className="mb-4 rounded-lg border border-zinc-800/80 bg-zinc-900/35 px-3 py-2.5">
          <label htmlFor={autoAdventureFieldId} className="flex cursor-pointer items-start gap-2.5 text-xs text-zinc-300">
            <input
              id={autoAdventureFieldId}
              type="checkbox"
              checked={autoAdventureEnabled}
              onChange={(e) => setAutoAdventureEnabled(e.target.checked)}
              className="peer sr-only"
            />
            <span
              className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-zinc-500/85 bg-zinc-600/75 shadow-inner transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-amber-500/35 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-zinc-950 peer-checked:border-amber-500/90 peer-checked:bg-amber-600 peer-checked:shadow-none peer-checked:[&_svg]:opacity-100"
              aria-hidden
            >
              <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 text-amber-50 opacity-0 transition-opacity duration-150" fill="none" aria-hidden>
                <path d="M2.5 6L5 8.5l4.5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="min-w-0 flex-1 leading-snug">
              <span className="font-medium text-zinc-200">Auto adventure</span>
              {autoAdventureEnabled ? (
                <span className="ml-1.5 text-[10px] uppercase tracking-wider text-amber-300">
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
              <div className="mx-auto max-w-xl rounded-xl border border-zinc-700/55 bg-zinc-900/50 px-4 py-5 text-center shadow-inner sm:px-6">
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500/90">{pendingEvent.title}</p>
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
            ) : null}
            {hubLines?.length ? (
              <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-4 py-3 font-serif text-sm leading-relaxed text-emerald-100/90">
                {hubLines.map((line, i) => (
                  <p key={i} className={i > 0 ? "mt-2" : ""}>
                    {line}
                  </p>
                ))}
              </div>
            ) : null}
            {busy ? (
              <div className="rounded-lg border border-amber-800/50 bg-black/35 px-4 py-3">
                <p className="text-sm font-semibold text-amber-200">{ADVENTURE_STATUS_LINES[adventureStatusIndex]}</p>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full border border-amber-900/60 bg-amber-950/35">
                  <div className="adventure-progress h-full w-2/5 rounded-full bg-linear-to-r from-amber-500 via-yellow-300 to-amber-500" />
                </div>
              </div>
            ) : null}
            {!pendingEvent ? (
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
                  className={`w-full touch-manipulation rounded-xl border-2 border-amber-600/70 bg-linear-to-b from-amber-900/50 to-amber-950/80 py-4 text-center text-base font-bold uppercase tracking-[0.15em] text-amber-100 shadow-lg hover:from-amber-800/50 hover:to-amber-900/70 active:bg-amber-950/90 sm:py-5 sm:text-lg ${busy || isRollPending ? "cursor-wait opacity-55" : "cursor-pointer opacity-100"}`}
                >
                  {busy || isRollPending ? "Rolling encounter…" : "Adventure"}
                </button>
              </form>
            ) : null}
          </div>
        ) : null}

        {phase === "fight" ? (
          <div className="relative grid gap-5 pb-36 lg:grid-cols-[1fr_280px] lg:pb-0">
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
              {combatFx.map((fx) => (
                <div
                  key={fx.id}
                  className={`combat-fx combat-fx-${fx.tone}`}
                  style={{ left: `${fx.x}%`, top: `${fx.y}%` }}
                >
                  <span className="text-lg">{fx.emoji}</span>
                  <span className="text-sm font-black tracking-wide">{fx.text}</span>
                </div>
              ))}
            </div>
            <div className="space-y-4 lg:space-y-5">
              <div className="rounded-xl border border-zinc-800 bg-black/35 p-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-violet-900/50 bg-violet-950/40 text-4xl shadow-inner">
                    {enemyEmoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-semibold text-zinc-100">{enemyName}</p>
                    <p className="text-xs text-violet-300/80">
                      Hostile · Level {enemyLevel}
                      {enemyKind === "miniboss" ? (
                        <span className="ml-2 rounded border border-rose-600/60 bg-rose-950/50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-200">
                          Boss
                        </span>
                      ) : enemyKind === "elite" ? (
                        <span className="ml-2 rounded border border-amber-600/50 bg-amber-950/40 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200">
                          Elite
                        </span>
                      ) : null}
                    </p>
                    <div className="mt-3">
                      <HpBar current={enemyHp} max={enemyMax} label="Enemy vitality" gradientClass="bg-gradient-to-r from-violet-700 to-rose-600" />
                    </div>
                  </div>
                </div>
              </div>

              <IntentRibbon intent={enemyIntent} />

              <div className="rounded-xl border border-amber-900/40 bg-amber-950/10 p-4">
                <HpBar current={playerHp} max={playerMax} label={`${characterName} (you)`} gradientClass="bg-gradient-to-r from-emerald-600 to-amber-500" />
                <p className="mt-2 text-xs text-zinc-500">
                  Tonics this fight: <span className="font-mono text-amber-200/90">{potionCount}</span> / {MAX_POTIONS_PER_BATTLE}
                  {potionCooldownRemaining > 0 ? (
                    <span className="ml-2 text-emerald-600/90">
                      · sip CD {potionCooldownRemaining}/{potionMaxCooldown || "?"}
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Mana: <span className="font-mono text-sky-200/90">{playerMana}</span> / {playerMaxMana}
                </p>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-black/50">
                <div className="border-b border-zinc-800 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Battle log</p>
                    <button
                      type="button"
                      onClick={() => setMobileLogExpanded((prev) => !prev)}
                      className="rounded border border-zinc-700 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-300 lg:hidden"
                    >
                      {mobileLogExpanded ? "Hide log" : "Show log"}
                    </button>
                  </div>
                </div>
                <div
                  ref={logScrollRef}
                  className={`combat-log-scroll overflow-y-auto px-3 py-2 font-serif text-sm leading-relaxed text-zinc-300 ${
                    mobileLogExpanded ? "max-h-52" : "max-h-24"
                  } lg:max-h-52`}
                >
                  {log.map((line, i) => (
                    <p key={`${i}-${line.slice(0, 24)}`} className="border-b border-zinc-900/50 py-1.5 last:border-0">
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            </div>

            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-800 bg-zinc-950/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.45)] lg:z-auto lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:sticky lg:top-4 lg:self-start">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Commands</p>
              <div className="grid grid-cols-2 gap-2 lg:flex lg:flex-col">
              <form action={turnFormAction} className="contents lg:block">
                <input type="hidden" name="encounterId" value={encounterId ?? ""} />
                <button
                  type="submit"
                  name="action"
                  value="ATTACK"
                  disabled={combatFormBusy || !encounterId}
                className="min-h-12 w-full cursor-pointer touch-manipulation rounded-lg border border-red-900/50 bg-red-950/60 px-2 py-3 text-sm font-bold text-red-100 hover:bg-red-900/50 disabled:opacity-50"
                  onClick={() => playSfx("attack")}
              >
                Attack
              </button>
              </form>
              <form action={turnFormAction} className="contents lg:block">
                <input type="hidden" name="encounterId" value={encounterId ?? ""} />
                <button
                  type="submit"
                  name="action"
                  value="DEFEND"
                  disabled={combatFormBusy || !encounterId}
                className="min-h-12 w-full cursor-pointer touch-manipulation rounded-lg border border-sky-900/50 bg-sky-950/50 px-2 py-3 text-sm font-bold text-sky-100 hover:bg-sky-900/40 disabled:opacity-50"
                  onClick={() => playSfx("ui-click")}
              >
                Defend
              </button>
              </form>
              <form action={turnFormAction} className="contents lg:block">
                <input type="hidden" name="encounterId" value={encounterId ?? ""} />
                <button
                  type="submit"
                  name="action"
                  value="SKILL"
                  disabled={combatFormBusy || !encounterId || skillCooldownRemaining > 0}
                className="min-h-12 w-full cursor-pointer touch-manipulation rounded-lg border border-violet-900/50 bg-violet-950/45 px-2 py-3 text-sm font-bold text-violet-100 hover:bg-violet-900/35 disabled:opacity-50"
                  onClick={() => playSfx("ui-click")}
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
              <form action={turnFormAction} className="contents lg:block">
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
                  onClick={() => playSfx("ui-click")}
              >
                Use potion
                {potionCooldownRemaining > 0 ? (
                  <span className="mt-0.5 block text-[10px] font-normal uppercase tracking-wider text-emerald-300/80">
                    Tonic CD {potionCooldownRemaining}/{potionMaxCooldown || "?"}
                  </span>
                ) : null}
              </button>
              </form>
              <form action={turnFormAction} className="contents lg:block">
                <input type="hidden" name="encounterId" value={encounterId ?? ""} />
                <button
                  type="submit"
                  name="action"
                  value="AUTO"
                  disabled={combatFormBusy || !encounterId}
                className="min-h-12 w-full cursor-pointer touch-manipulation rounded-lg border border-amber-800/60 bg-amber-950/30 px-2 py-3 text-sm font-bold text-amber-100 hover:bg-amber-900/25 disabled:opacity-50"
                  onClick={() => playSfx("ui-click")}
              >
                Auto battle
              </button>
              </form>
              <form action={fleeFormAction} className="contents lg:block">
                <input type="hidden" name="encounterId" value={encounterId ?? ""} />
                <button
                  type="submit"
                  disabled={combatFormBusy || !encounterId}
                className="min-h-12 w-full cursor-pointer touch-manipulation rounded-lg border border-zinc-700 px-2 py-2 text-xs text-zinc-400 hover:bg-zinc-900 disabled:opacity-50 lg:mt-2"
              >
                Attempt flee ({Math.round(fleeChance * 100)}%)
              </button>
              </form>
              </div>
            </div>
          </div>
        ) : null}

        <form ref={autoTurnFormRef} action={turnFormAction} className="hidden">
          <input ref={autoTurnEncounterInputRef} type="hidden" name="encounterId" value={encounterId ?? ""} />
          <input ref={autoTurnActionInputRef} type="hidden" name="action" value="ATTACK" />
        </form>

        {phase === "ended" && ended ? (
          <div className="space-y-4 text-center">
            <div
              className={`mx-auto max-w-md rounded-xl border-2 p-6 ${
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
                  <p className="mt-2 text-xs text-emerald-600/85">You keep your fight-ending HP — use the town campfire (or level up for a small bump).</p>
                  {(ended.droppedItems?.length ?? 0) > 0 ? (
                    <div className="mt-3 rounded-lg border border-emerald-900/40 bg-black/30 px-3 py-2 text-left">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/90">Loot gained</p>
                      <ul className="mt-2 space-y-2">
                        {ended.droppedItems!.map((it) => (
                          <li key={it.id} className="text-sm">
                            {it.slot ? (
                              <ItemHoverCard item={it as unknown as Parameters<typeof ItemHoverCard>[0]["item"]}>
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
                      <p className="mt-2 text-[11px] text-zinc-500">Added to your pack — hover an item for full stats and sell value.</p>
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
            <div className="combat-log-scroll max-h-40 overflow-y-auto rounded-lg border border-zinc-800 bg-black/40 px-3 py-2 text-left text-xs text-zinc-400">
              {ended.log.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
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
                    className={`min-h-11 touch-manipulation rounded-lg border border-amber-800 bg-amber-950/40 px-6 py-3 text-sm font-bold text-amber-100 hover:bg-amber-900/40 ${busy || isRollPending ? "cursor-wait opacity-55" : "cursor-pointer opacity-100"}`}
                  >
                    Continue adventuring
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        ) : null}
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
          animation: fx-pop-float 850ms ease-out forwards, fx-shake 260ms ease-out;
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
        .combat-tint-damage {
          background: radial-gradient(circle at 50% 42%, rgba(220, 38, 38, 0.22), rgba(127, 29, 29, 0.1) 52%, transparent 72%);
        }
        .combat-tint-heal {
          background: radial-gradient(circle at 36% 60%, rgba(22, 163, 74, 0.2), rgba(20, 83, 45, 0.1) 48%, transparent 72%);
        }
        .combat-tint-defend {
          background: radial-gradient(circle at 40% 40%, rgba(59, 130, 246, 0.2), rgba(30, 64, 175, 0.1) 50%, transparent 72%);
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
        @keyframes fx-shake {
          0%,
          100% {
            margin-left: 0;
          }
          25% {
            margin-left: -4px;
          }
          50% {
            margin-left: 4px;
          }
          75% {
            margin-left: -2px;
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
