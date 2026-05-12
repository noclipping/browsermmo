import type { CombatFxItem, CombatFxTone } from "@/components/combat/combat-fx-types";
import { ENEMY_DEATH_SQUASH_MS, JRPG_LUNGE_IN_MS } from "@/lib/game/combat-stage-motion";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/** Fallback when `--meet-shift-x` is unset (must match `sm:` value on `CombatStage`). */
const MEET_SHIFT_FALLBACK = "min(56vw,19rem)";

/** Matches Tailwind `sm:` — mobile vs desktop actor trees are separate; splatter must only run on the visible one. */
const SM_UP_MQ = "(min-width: 640px)";

function subscribeSmUp(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia(SM_UP_MQ);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getSmUpSnapshot() {
  if (typeof window === "undefined") return false;
  return window.matchMedia(SM_UP_MQ).matches;
}

/** Brief tint on the sprite when struck, defending, or healed (not full-arena). */
export type CombatActorHitFlash = "damage" | "defend" | "heal";

/** Same hue throughout; only alpha falls off toward the edge (no bright / white core). */
const HIT_FLASH_RADIAL: Record<CombatActorHitFlash, string> = {
  damage:
    "radial-gradient(circle at 50% 42%, rgba(220, 38, 38, 0.52) 0%, rgba(220, 38, 38, 0.38) 22%, rgba(220, 38, 38, 0.18) 42%, rgba(220, 38, 38, 0.06) 58%, transparent 74%)",
  defend:
    "radial-gradient(circle at 50% 42%, rgba(14, 165, 233, 0.48) 0%, rgba(14, 165, 233, 0.35) 22%, rgba(14, 165, 233, 0.16) 42%, rgba(14, 165, 233, 0.05) 58%, transparent 74%)",
  heal:
    "radial-gradient(circle at 50% 42%, rgba(16, 185, 129, 0.48) 0%, rgba(16, 185, 129, 0.35) 22%, rgba(16, 185, 129, 0.16) 42%, rgba(16, 185, 129, 0.05) 58%, transparent 74%)",
};

const FLOAT_TONE_CLASS: Record<CombatFxTone, string> = {
  damage: "border-red-700/80 bg-red-950/90 text-red-100 [&_span:last-child]:text-red-200",
  heal: "border-emerald-700/75 bg-emerald-950/88 text-emerald-50 [&_span:last-child]:text-emerald-100",
  defend: "border-sky-700/75 bg-sky-950/85 text-sky-100 [&_span:last-child]:text-sky-50",
  flee: "border-amber-700/75 bg-amber-950/80 text-amber-50 [&_span:last-child]:text-amber-100",
};

type CombatActorPanelProps = {
  name: string;
  hp: number;
  maxHp: number;
  spriteSrc: string;
  spriteAlt: string;
  /** Outer wrapper for stage alignment (default centers the actor column). */
  columnClassName?: string;
  barGradient: string;
  /** Enemy intent — above sprite with floating text (same stack on mobile and desktop). */
  intentEmoji?: string;
  intentTitle?: string;
  /** Floating combat text above the sprite */
  floatingFx?: CombatFxItem[];
  /** Increment to play a short damage shake on the sprite */
  shakeGen?: number;
  /** Mirror the sprite horizontally (e.g. face toward the player on the right side). */
  flipSprite?: boolean;
  /** Stage column — sets horizontal lunge direction toward the opponent. */
  stageSide: "left" | "right";
  /** Slide sprite toward the opposite combatant (classic turn-based step-in). */
  lungeForward?: boolean;
  /** Victory / death: squash sprite into a flat smear at the feet, then hide. */
  deathSquash?: boolean;
  /** One-shot overlay on the sprite (damage = red, defend = blue, heal = green). */
  hitFlash?: CombatActorHitFlash | null;
};

/** Visual column width: HP bar + text align to this; sprite scales inside the same width. */
const ACTOR_COLUMN_WIDTH = "w-[min(78vw,12.5rem)] sm:w-[min(70vw,15rem)]";

type SplatterSpeck = {
  id: string;
  tx: number;
  ty: number;
  rot: number;
  w: number;
  h: number;
  delayMs: number;
  durationMs: number;
  bg: string;
  br: string;
};

function randomSplatterSpecks(stageSide: "left" | "right"): SplatterSpeck[] {
  const toward = stageSide === "left" ? 1 : -1;
  const count = 11 + Math.floor(Math.random() * 7);
  const palette = [
    "rgba(220, 38, 38, 0.95)",
    "rgba(185, 28, 28, 0.92)",
    "rgba(153, 27, 27, 0.9)",
    "rgba(127, 29, 29, 0.88)",
    "rgba(254, 202, 202, 0.35)",
    "rgba(69, 10, 10, 0.9)",
  ];
  const radii = ["35% 65% 40% 60% / 45% 55% 50% 50%", "55% 45% 60% 40% / 55% 45% 50% 50%", "50% 50% 35% 65% / 50% 50% 45% 55%", "40% 60% 55% 45% / 40% 60% 50% 50%"];
  const out: SplatterSpeck[] = [];
  for (let i = 0; i < count; i += 1) {
    const dist = 24 + Math.random() * 52;
    const spread = (Math.random() - 0.5) * 1.15;
    const upLift = -22 - Math.random() * 42;
    const tx = toward * dist * (0.72 + Math.random() * 0.28) + (Math.random() - 0.5) * 20 + spread * 14;
    const ty = upLift + (Math.random() - 0.5) * 28 + spread * 12;
    out.push({
      id: `s-${i}-${Math.random().toString(36).slice(2, 9)}`,
      tx,
      ty,
      rot: (Math.random() - 0.5) * 220,
      w: 5 + Math.random() * 8,
      h: 4 + Math.random() * 9,
      delayMs: Math.floor(Math.random() * 40),
      durationMs: 320 + Math.floor(Math.random() * 200),
      bg: palette[Math.floor(Math.random() * palette.length)] ?? palette[0],
      br: radii[Math.floor(Math.random() * radii.length)] ?? "50%",
    });
  }
  return out;
}

/** Short blood-like specks when `shakeGen` bumps (damage hits only in parent). */
function HitDamageSplatter({
  shakeGen,
  stageSide,
  layoutKey,
  reduceMotion,
}: {
  shakeGen: number;
  stageSide: "left" | "right";
  layoutKey: "mobile" | "desktop";
  reduceMotion: boolean;
}) {
  const [specks, setSpecks] = useState<SplatterSpeck[]>([]);
  const prevShakeRef = useRef(shakeGen);
  const smUp = useSyncExternalStore(subscribeSmUp, getSmUpSnapshot, () => false);
  const layoutVisible = layoutKey === "desktop" ? smUp : !smUp;

  useEffect(() => {
    const prev = prevShakeRef.current;
    if (shakeGen < prev) {
      prevShakeRef.current = shakeGen;
      setSpecks([]);
      return;
    }
    if (shakeGen === prev) return;
    prevShakeRef.current = shakeGen;
    if (reduceMotion) return;
    if (!layoutVisible) return;
    setSpecks(randomSplatterSpecks(stageSide));
    const t = window.setTimeout(() => setSpecks([]), 680);
    return () => window.clearTimeout(t);
  }, [shakeGen, stageSide, reduceMotion, layoutVisible]);

  if (!specks.length) return null;
  return (
    <div
      className="pointer-events-none absolute inset-0 isolate overflow-visible"
      style={{ zIndex: 40 }}
      aria-hidden
    >
      {specks.map((s) => (
        <div
          key={s.id}
          className="combat-hit-splatter-speck absolute"
          style={
            {
              left: "50%",
              top: "52%",
              width: `${s.w}px`,
              height: `${s.h}px`,
              background: s.bg,
              borderRadius: s.br,
              boxShadow: "0 0 4px rgba(0,0,0,0.55), 0 0 10px rgba(220,38,38,0.25)",
              "--spl-tx": `${s.tx}px`,
              "--spl-ty": `${s.ty}px`,
              "--spl-rot": `${s.rot}deg`,
              animationDuration: `${s.durationMs}ms`,
              animationDelay: `${s.delayMs}ms`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

function ActorHpBar({ current, max, gradientClass }: { current: number; max: number; gradientClass: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0;
  return (
    <div className="h-2 w-full min-w-18 overflow-hidden rounded-full border border-white/25 bg-zinc-950/85 shadow-inner backdrop-blur-[1px]">
      <div className={`h-full min-h-[6px] rounded-full transition-[width] duration-500 ease-out ${gradientClass}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function ActorFloatingFx({ items }: { items: CombatFxItem[] }) {
  if (!items.length) return null;
  return (
    <>
      {items.map((fx) => (
        <div
          key={fx.id}
          className={`actor-floating-fx flex max-w-44 items-center gap-1 rounded-full border px-2.5 py-1 shadow-lg backdrop-blur-sm ${FLOAT_TONE_CLASS[fx.tone]}`}
        >
          <span className="shrink-0 text-base leading-none">{fx.emoji}</span>
          <span className="text-xs font-black tracking-wide drop-shadow-sm">{fx.text}</span>
        </div>
      ))}
    </>
  );
}

function ActorNameHpBlock({
  name,
  hp,
  maxHp,
  barGradient,
}: {
  name: string;
  hp: number;
  maxHp: number;
  barGradient: string;
}) {
  return (
    <>
      <div className="flex items-end justify-between gap-1 text-[9px] font-semibold leading-tight text-white/90 sm:text-[10px]">
        <span className="min-w-0 truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">{name}</span>
        <span className="shrink-0 font-mono tabular-nums text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
          {hp} / {maxHp}
        </span>
      </div>
      <div className="mt-0.5">
        <ActorHpBar current={hp} max={maxHp} gradientClass={barGradient} />
      </div>
    </>
  );
}

function IntentSpriteOverlay({ intentEmoji, intentTitle }: { intentEmoji: string; intentTitle?: string }) {
  return (
    <div className="pointer-events-none flex justify-center" title={intentTitle}>
      <span
        className="combat-intent-bob inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/50 text-base shadow-md backdrop-blur-sm sm:h-8 sm:w-8 sm:text-lg"
        aria-hidden
      >
        {intentEmoji}
      </span>
      <span className="sr-only">{intentTitle ?? "Enemy intent"}</span>
    </div>
  );
}

export function CombatActorPanel({
  name,
  hp,
  maxHp,
  spriteSrc,
  spriteAlt,
  columnClassName = "",
  barGradient,
  intentEmoji,
  intentTitle,
  floatingFx = [],
  shakeGen = 0,
  flipSprite = false,
  stageSide,
  lungeForward = false,
  deathSquash = false,
  hitFlash = null,
}: CombatActorPanelProps) {
  const [shaking, setShaking] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  /** Only animate when gen increases — avoids shake on mount if parent passed a stale >0, or on remount. */
  const prevShakeGenRef = useRef(shakeGen);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onChange = () => setReduceMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const prev = prevShakeGenRef.current;
    if (shakeGen < prev) {
      prevShakeGenRef.current = shakeGen;
      return;
    }
    if (shakeGen === prev) return;
    prevShakeGenRef.current = shakeGen;
    setShaking(true);
    const t = window.setTimeout(() => setShaking(false), 420);
    return () => window.clearTimeout(t);
  }, [shakeGen]);

  const renderSpriteLunge = (layoutKey: "mobile" | "desktop") => (
    <div
      className={`relative flex w-full flex-col items-center will-change-transform ${
        reduceMotion ? "" : `transition-transform ease-[cubic-bezier(0.34,1.02,0.64,1)]`
      }`}
      style={{
        transitionDuration: reduceMotion ? "0ms" : `${JRPG_LUNGE_IN_MS}ms`,
        transform:
          reduceMotion || !lungeForward
            ? "translateX(0)"
            : stageSide === "left"
              ? `translateX(var(--meet-shift-x, ${MEET_SHIFT_FALLBACK}))`
              : `translateX(calc(-1 * var(--meet-shift-x, ${MEET_SHIFT_FALLBACK})))`,
      }}
    >
      <div className={`relative flex w-full flex-col items-center will-change-transform ${shaking ? "combat-actor-sprite-shake" : ""}`}>
        {/* Death squash only on the sprite — floating damage / intent stay readable above */}
        <div
          className="relative z-0 mx-auto w-full max-w-full"
          style={{
            transformOrigin: "50% 100%",
            ...(reduceMotion
              ? deathSquash
                ? { opacity: 0, transform: "scale(0.02)" }
                : {}
              : {
                  transition: `transform ${ENEMY_DEATH_SQUASH_MS}ms cubic-bezier(0.45, 0, 0.55, 1), opacity ${ENEMY_DEATH_SQUASH_MS}ms ease-out`,
                  transform: deathSquash ? "scaleX(1.12) scaleY(0.06) translateY(10px)" : "scale(1)",
                  opacity: deathSquash ? 0 : 1,
                }),
          }}
        >
          {hitFlash ? (
            <div
              className="pointer-events-none absolute inset-0 z-20 animate-combat-sprite-hit-flash"
              style={{ background: HIT_FLASH_RADIAL[hitFlash] }}
              aria-hidden
            />
          ) : null}
          {/* eslint-disable-next-line @next/next/no-img-element -- local sprite assets; dynamic paths */}
          <img
            key={`${spriteSrc}-${layoutKey}`}
            src={spriteSrc}
            alt={spriteAlt}
            width={220}
            height={220}
            className="relative z-0 mx-auto h-auto max-h-[min(30vw,8.5rem)] w-full max-w-full object-contain object-bottom select-none drop-shadow-[0_8px_16px_rgba(0,0,0,0.55)] sm:max-h-[min(46vw,18rem)]"
            style={
              flipSprite ? { transform: "scaleX(-1)", transformOrigin: "50% 100%" } : undefined
            }
            draggable={false}
          />
          <HitDamageSplatter
            shakeGen={shakeGen}
            stageSide={stageSide}
            layoutKey={layoutKey}
            reduceMotion={reduceMotion}
          />
        </div>
        {(() => {
          const intentOnSprite = Boolean(intentEmoji);
          if (!floatingFx.length && !intentOnSprite) return null;
          return (
            <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-0.5 flex -translate-x-1/2 flex-col items-center gap-1">
              <ActorFloatingFx items={floatingFx} />
              {intentOnSprite && intentEmoji ? (
                <IntentSpriteOverlay intentEmoji={intentEmoji} intentTitle={intentTitle} />
              ) : null}
            </div>
          );
        })()}
      </div>
    </div>
  );

  const hudBottom = (
    <div className="mt-0.5 w-full shrink-0 space-y-0.5 pb-1">
      <ActorNameHpBlock name={name} hp={hp} maxHp={maxHp} barGradient={barGradient} />
    </div>
  );

  return (
    <div
      className={[
        "flex min-h-0 min-w-0 flex-1 flex-col px-0.5 max-sm:h-auto max-sm:min-h-0 max-sm:justify-end sm:justify-end",
        columnClassName,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className={`mx-auto flex min-h-0 w-full min-w-0 flex-col sm:min-h-0 ${ACTOR_COLUMN_WIDTH} max-sm:h-auto max-sm:min-h-0 max-sm:shrink-0`}
      >
        {/* Mobile: pin sprite + HP to bottom of stage row so headroom stays above intent */}
        <div className="flex w-full shrink-0 flex-col items-center pt-1 sm:hidden">
          <div className="relative z-0 flex w-full flex-col items-center">
            {renderSpriteLunge("mobile")}
          </div>
          {hudBottom}
        </div>

        {/* sm+: same order as mobile — intent/float above sprite, name + HP under feet */}
        <div className="hidden min-h-0 w-full flex-col justify-end sm:flex sm:pt-5">
          <div className="relative z-0 flex w-full flex-col items-center">
            {renderSpriteLunge("desktop")}
          </div>
          {hudBottom}
        </div>
      </div>
      <style jsx global>{`
        @keyframes actor-floating-pop {
          0% {
            opacity: 0;
            transform: translateY(10px) scale(0.85);
          }
          12% {
            opacity: 1;
            transform: translateY(0) scale(1.05);
          }
          70% {
            opacity: 1;
            transform: translateY(-6px) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-18px) scale(0.96);
          }
        }
        @keyframes actor-floating-pop-mobile {
          0% {
            opacity: 0;
            transform: translateY(4px) scale(0.92);
          }
          12% {
            opacity: 1;
            transform: translateY(0) scale(1.02);
          }
          70% {
            opacity: 1;
            transform: translateY(-2px) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-5px) scale(0.96);
          }
        }
        @keyframes combat-intent-bob {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-6px);
          }
        }
        @keyframes combat-intent-bob-mobile {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-2px);
          }
        }
        :global(.combat-intent-bob) {
          animation: combat-intent-bob-mobile 1.15s ease-in-out infinite;
          will-change: transform;
        }
        @media (min-width: 640px) {
          :global(.combat-intent-bob) {
            animation-name: combat-intent-bob;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          :global(.combat-intent-bob) {
            animation: none;
          }
        }
        @keyframes combat-actor-hit-shake {
          0%,
          100% {
            transform: translateX(0);
          }
          15% {
            transform: translateX(-5px) rotate(-1deg);
          }
          30% {
            transform: translateX(5px) rotate(1deg);
          }
          45% {
            transform: translateX(-4px);
          }
          60% {
            transform: translateX(3px);
          }
        }
        :global(.actor-floating-fx) {
          animation: actor-floating-pop-mobile 820ms ease-out forwards;
        }
        @media (min-width: 640px) {
          :global(.actor-floating-fx) {
            animation-name: actor-floating-pop;
          }
        }
        :global(.combat-actor-sprite-shake) {
          animation: combat-actor-hit-shake 420ms ease-out;
        }
        @keyframes combat-sprite-hit-flash {
          0% {
            opacity: 0;
          }
          28% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
        :global(.animate-combat-sprite-hit-flash) {
          animation: combat-sprite-hit-flash 260ms ease-out forwards;
        }
        @media (prefers-reduced-motion: reduce) {
          :global(.animate-combat-sprite-hit-flash) {
            animation: combat-sprite-hit-flash 180ms ease-out forwards;
          }
        }
      `}</style>
    </div>
  );
}
