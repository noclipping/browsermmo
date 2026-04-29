import type { GuildBossChestTier } from "@/lib/game/guild-boss-chest";
import {
  CHEST_BAR_MARKERS,
  CHEST_REWARD_PREVIEW_LINES,
  CHEST_TIER_THRESHOLDS,
  GUILD_BOSS_CHEST_ABBR,
  GUILD_BOSS_CHEST_LABEL,
  minDamageForChestEligibility,
  type NextChestTierProgress,
} from "@/lib/game/guild-boss-chest";

const CHEST_BAR_BG_TIER: Record<GuildBossChestTier, string> = {
  bronze: "from-amber-900/90 via-amber-800/70 to-zinc-900",
  silver: "from-zinc-400/80 via-slate-400/70 to-zinc-700",
  gold: "from-yellow-500/85 via-amber-500/75 to-orange-900/80",
  diamond: "from-cyan-400/80 via-sky-500/75 to-blue-900/85",
  mythic: "from-fuchsia-500/85 via-purple-600/80 to-indigo-950/90",
};

const CHEST_TIER_MARKER_CLASS: Record<GuildBossChestTier, string> = {
  bronze: "border-amber-500/70 bg-amber-700/85 text-amber-200",
  silver: "border-slate-400/70 bg-slate-500/85 text-slate-100",
  gold: "border-yellow-400/70 bg-yellow-500/85 text-yellow-100",
  diamond: "border-cyan-400/70 bg-cyan-500/85 text-cyan-100",
  mythic: "border-fuchsia-400/80 bg-fuchsia-500/85 text-fuchsia-100",
};

function chestImagePath(tier: GuildBossChestTier): string {
  switch (tier) {
    case "bronze":
      return "/images/chests/bronzechest.png";
    case "silver":
      return "/images/chests/silverchest.png";
    case "gold":
      return "/images/chests/goldchest.png";
    case "diamond":
      return "/images/chests/diamondchest.png";
    case "mythic":
      return "/images/chests/mythicchest.png";
    default:
      return "/images/chests/bronzechest.png";
  }
}

function ChestPlaceholder({ tier }: { tier: GuildBossChestTier }) {
  const src = chestImagePath(tier);
  return (
    <div
      className={`flex aspect-square w-full max-w-[140px] items-center justify-center rounded-xl border border-white/15 bg-linear-to-br shadow-inner ${CHEST_BAR_BG_TIER[tier]}`}
      aria-label={`${GUILD_BOSS_CHEST_LABEL[tier]} chest placeholder`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- chest art lives in public/images/chests */}
      <img src={src} alt={`${GUILD_BOSS_CHEST_LABEL[tier]} chest`} className="h-full w-full object-cover" />
    </div>
  );
}

export function GuildRaidChestContributionStrip(props: { bossMaxHp: number; progress: NextChestTierProgress }) {
  const { contributionPercent, barFillPercent, currentTier, nextTierLabel, nextTierMinPercent } = props.progress;
  const fill = Math.min(100, barFillPercent);
  const barTint = currentTier ? CHEST_BAR_BG_TIER[currentTier] : "from-zinc-700 to-zinc-900";
  const markerThreshold: Record<GuildBossChestTier, number> = {
    bronze: 1,
    silver: 5,
    gold: 10,
    diamond: 15,
    mythic: 20,
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="text-zinc-200">
          Your contribution: <span className="font-semibold text-rose-200">{contributionPercent.toFixed(1)}%</span>
        </span>
        {currentTier ? (
          <span className="text-xs text-zinc-400">
            Current chest: <span className="font-semibold text-amber-200/90">{GUILD_BOSS_CHEST_LABEL[currentTier]}</span>
          </span>
        ) : (
          <span className="text-xs text-amber-200/75">
            Not eligible yet — need at least {minDamageForChestEligibility(props.bossMaxHp).toLocaleString()} damage to this pool.
          </span>
        )}
      </div>

      <div className="relative">
        <div className="relative mb-1 h-7 w-full">
          {CHEST_BAR_MARKERS.map((m) => (
            <div
              key={m.pct}
              className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
              style={{ left: `${(m.pct / CHEST_TIER_THRESHOLDS.mythicMin) * 100}%` }}
            >
              {(() => {
                const unlocked = contributionPercent >= markerThreshold[m.tier];
                const markerClass = unlocked ? CHEST_TIER_MARKER_CLASS[m.tier] : "border-white/35 bg-zinc-800 text-zinc-500";
                const labelClass = unlocked ? CHEST_TIER_MARKER_CLASS[m.tier].split(" ").at(-1) ?? "text-zinc-300" : "text-zinc-500";
                return (
                  <>
                    <div
                      className={`h-2.5 w-2.5 rounded-full border shadow ${markerClass}`}
                      title={`${GUILD_BOSS_CHEST_LABEL[m.tier]} (${m.pct}%+)`}
                    />
                    <span className={`mt-0.5 text-[9px] font-semibold uppercase tracking-tight ${labelClass}`}>
                      {GUILD_BOSS_CHEST_ABBR[m.tier]}
                    </span>
                  </>
                );
              })()}
            </div>
          ))}
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-black/55 ring-1 ring-white/10">
          <div
            className={`h-full rounded-full bg-linear-to-r ${barTint} transition-[width]`}
            style={{ width: `${fill}%` }}
          />
        </div>
        <p className="mt-1 text-[10px] text-zinc-500">
          Bar tracks toward Mythic (20% of boss HP). Tier caps at Mythic — extra damage does not upgrade further.
        </p>
        {currentTier && currentTier !== "mythic" && nextTierLabel && nextTierMinPercent != null ? (
          <p className="mt-1 text-[11px] text-zinc-400">
            Next: <span className="text-zinc-200">{nextTierLabel}</span> at ≥{nextTierMinPercent}% pool contribution.
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function GuildRaidChestCard(props: {
  tier: GuildBossChestTier | null;
  locked: boolean;
  modeLabel: string;
  seasonDefeated: boolean;
  canClaim: boolean;
  claimed: boolean;
  claimAction: (formData: FormData) => Promise<string | null>;
  seasonId: string;
  nextSpawnAt?: Date | null;
}) {
  const previewTier = props.tier ?? "bronze";
  const previewLine = CHEST_REWARD_PREVIEW_LINES[previewTier];

  return (
    <div className="rounded-xl border border-amber-900/35 bg-black/35 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="mx-auto sm:mx-0 sm:w-36">
          <ChestPlaceholder tier={previewTier} />
          <p className="mt-1 text-center text-[9px] text-zinc-600">
            Chest art: <code className="text-zinc-500">/images/chests/{previewTier}chest.png</code>
          </p>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500/85">Raid chest</p>
          <p className="font-serif text-lg text-zinc-100">
            {props.tier ? `${GUILD_BOSS_CHEST_LABEL[props.tier]} chest` : "Raid chest"}
          </p>
          <p className="text-xs text-zinc-500">{previewLine}</p>
          {props.locked ? (
            <p className="text-sm font-medium text-amber-200/85">{props.modeLabel}</p>
          ) : props.claimed ? (
            <p className="text-sm font-medium text-emerald-400/90">Raid chest claimed.</p>
          ) : props.canClaim && props.seasonDefeated ? (
            <form action={props.claimAction as never}>
              <input type="hidden" name="seasonId" value={props.seasonId} />
              <button
                type="submit"
                className="rounded-lg border border-amber-600/50 bg-amber-950/40 px-4 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-900/35"
              >
                Claim raid chest
              </button>
            </form>
          ) : (
            <p className="text-xs text-zinc-500">You do not qualify for a chest this season.</p>
          )}
          {props.nextSpawnAt && props.nextSpawnAt > new Date() ? (
            <p className="text-[11px] text-zinc-500">
              Next boss after cooldown: <span className="text-zinc-300">{props.nextSpawnAt.toLocaleString()}</span>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function GuildRaidChestPreviewGrid() {
  const tiers = ["bronze", "silver", "gold", "diamond", "mythic"] as const;
  return (
    <div className="relative inline-flex items-center">
      <span className="mr-2 text-[11px] text-zinc-500">Chest odds</span>
      <span className="group relative inline-flex">
        <span className="inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full border border-zinc-600 bg-zinc-900 text-[11px] font-bold text-zinc-200">
          ?
        </span>
        <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-72 -translate-x-1/2 rounded-lg border border-zinc-700 bg-black/90 p-3 text-[11px] text-zinc-300 shadow-2xl group-hover:block">
          {tiers.map((t) => (
            <span key={t} className="mb-1 block last:mb-0">
              <span className="font-semibold text-zinc-100">{GUILD_BOSS_CHEST_LABEL[t]}:</span> {CHEST_REWARD_PREVIEW_LINES[t]}
            </span>
          ))}
        </span>
      </span>
    </div>
  );
}
