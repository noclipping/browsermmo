"use client";

import { forgedAffixScaledBonuses, forgedStatsForEntry } from "@/lib/game/item-affixes";
import type { ItemTooltipFields } from "@/lib/game/item-tooltip-text";
import { normalizeForgeLevel } from "@/lib/game/item-display";
import { formatItemStatBlock } from "@/lib/game/item-tooltip-text";
import { formatItemStatRequirements } from "@/lib/game/item-requirements";
import { rarityBadgeClass, rarityNameClass } from "@/lib/game/item-rarity-styles";
import { weaponType } from "@/lib/game/weapon-classification";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type CompareTarget = {
  item: ItemTooltipFields;
  forgeLevel?: number;
  affixPrefix?: string | null;
  bonusLifeSteal?: number;
  bonusCritChance?: number;
  bonusSkillPower?: number;
  bonusStrength?: number;
  bonusConstitution?: number;
  bonusIntelligence?: number;
  bonusDexterity?: number;
};

type Props = {
  item: ItemTooltipFields;
  forgeLevel?: number;
  affixPrefix?: string | null;
  bonusLifeSteal?: number;
  bonusCritChance?: number;
  bonusSkillPower?: number;
  bonusStrength?: number;
  bonusConstitution?: number;
  bonusIntelligence?: number;
  bonusDexterity?: number;
  children: React.ReactNode;
  className?: string;
  compareAgainst?: CompareTarget | null;
};

type CombinedStats = {
  attack: number;
  defense: number;
  hp: number;
  speed: number;
  lifeSteal: number;
  critChance: number;
  skillPower: number;
  strength: number;
  constitution: number;
  intelligence: number;
  dexterity: number;
};

function buildCombinedStats(params: {
  item: ItemTooltipFields;
  forgeLevel: number;
  bonusLifeSteal: number;
  bonusCritChance: number;
  bonusSkillPower: number;
  bonusStrength: number;
  bonusConstitution: number;
  bonusIntelligence: number;
  bonusDexterity: number;
}): CombinedStats {
  const forged = forgedStatsForEntry({
    slot: params.item.slot,
    rarity: params.item.rarity,
    forgeLevel: params.forgeLevel,
  });
  const affix = forgedAffixScaledBonuses(
    {
      bonusLifeSteal: params.bonusLifeSteal,
      bonusCritChance: params.bonusCritChance,
      bonusSkillPower: params.bonusSkillPower,
      bonusStrength: params.bonusStrength,
      bonusConstitution: params.bonusConstitution,
      bonusIntelligence: params.bonusIntelligence,
      bonusDexterity: params.bonusDexterity,
    },
    { forgeLevel: params.forgeLevel, rarity: params.item.rarity },
  );
  const offense = params.item.attack + forged.attack;
  const wt = weaponType(params.item);
  const magicWeapon = wt === "MAGIC";
  const rangedWeapon = wt === "RANGED";
  const daggerWeapon = wt === "DAGGER";
  const dexFromDagger = daggerWeapon ? Math.ceil(offense * 0.6) : 0;
  const strFromDagger = daggerWeapon ? offense - dexFromDagger : 0;
  return {
    attack: magicWeapon || rangedWeapon || daggerWeapon ? 0 : offense,
    defense: params.item.defense + forged.defense,
    hp: params.item.hp + forged.hp,
    speed: params.item.speed,
    lifeSteal: affix.bonusLifeSteal,
    critChance: affix.bonusCritChance,
    skillPower: affix.bonusSkillPower,
    strength: affix.bonusStrength + strFromDagger,
    constitution: affix.bonusConstitution,
    intelligence: affix.bonusIntelligence + (magicWeapon ? offense : 0),
    dexterity: affix.bonusDexterity + (rangedWeapon ? offense : 0) + dexFromDagger,
  };
}

function deltaClass(delta: number) {
  if (delta > 0) return "text-emerald-300";
  if (delta < 0) return "text-red-300";
  return "text-zinc-400";
}

type CompareRow = {
  label: string;
  hovered: number;
  equipped: number;
};

export function ItemHoverCard({
  item,
  forgeLevel = 0,
  affixPrefix = null,
  bonusLifeSteal = 0,
  bonusCritChance = 0,
  bonusSkillPower = 0,
  bonusStrength = 0,
  bonusConstitution = 0,
  bonusIntelligence = 0,
  bonusDexterity = 0,
  children,
  className,
  compareAgainst = null,
}: Props) {
  const fl = normalizeForgeLevel(forgeLevel);
  const scaledAffix = useMemo(
    () =>
      forgedAffixScaledBonuses(
        {
          bonusLifeSteal,
          bonusCritChance,
          bonusSkillPower,
          bonusStrength,
          bonusConstitution,
          bonusIntelligence,
          bonusDexterity,
        },
        { forgeLevel: fl, rarity: item.rarity },
      ),
    [
      fl,
      item.rarity,
      bonusLifeSteal,
      bonusCritChance,
      bonusSkillPower,
      bonusStrength,
      bonusConstitution,
      bonusIntelligence,
      bonusDexterity,
    ],
  );
  const req = formatItemStatRequirements(item as Parameters<typeof formatItemStatRequirements>[0]);
  const stats = formatItemStatBlock(item, fl);
  const rootRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [hovered, setHovered] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const affixLines = [
    scaledAffix.bonusLifeSteal > 0 ? `Lifesteal +${(scaledAffix.bonusLifeSteal * 100).toFixed(1)}%` : null,
    scaledAffix.bonusCritChance > 0 ? `Crit +${(scaledAffix.bonusCritChance * 100).toFixed(1)}%` : null,
    scaledAffix.bonusSkillPower > 0 ? `Skill power +${(scaledAffix.bonusSkillPower * 100).toFixed(1)}%` : null,
    scaledAffix.bonusStrength > 0 ? `STR +${scaledAffix.bonusStrength}` : null,
    scaledAffix.bonusConstitution > 0 ? `CON +${scaledAffix.bonusConstitution}` : null,
    scaledAffix.bonusIntelligence > 0 ? `INT +${scaledAffix.bonusIntelligence}` : null,
    scaledAffix.bonusDexterity > 0 ? `DEX +${scaledAffix.bonusDexterity}` : null,
  ].filter(Boolean) as string[];
  const currentStats = useMemo(
    () =>
      buildCombinedStats({
        item,
        forgeLevel: fl,
        bonusLifeSteal,
        bonusCritChance,
        bonusSkillPower,
        bonusStrength,
        bonusConstitution,
        bonusIntelligence,
        bonusDexterity,
      }),
    [
      item,
      fl,
      bonusLifeSteal,
      bonusCritChance,
      bonusSkillPower,
      bonusStrength,
      bonusConstitution,
      bonusIntelligence,
      bonusDexterity,
    ],
  );
  const compareStats = useMemo(() => {
    if (!compareAgainst || compareAgainst.item.slot !== item.slot) return null;
    return buildCombinedStats({
      item: compareAgainst.item,
      forgeLevel: normalizeForgeLevel(compareAgainst.forgeLevel ?? 0),
      bonusLifeSteal: compareAgainst.bonusLifeSteal ?? 0,
      bonusCritChance: compareAgainst.bonusCritChance ?? 0,
      bonusSkillPower: compareAgainst.bonusSkillPower ?? 0,
      bonusStrength: compareAgainst.bonusStrength ?? 0,
      bonusConstitution: compareAgainst.bonusConstitution ?? 0,
      bonusIntelligence: compareAgainst.bonusIntelligence ?? 0,
      bonusDexterity: compareAgainst.bonusDexterity ?? 0,
    });
  }, [compareAgainst, item.slot]);
  const compareRows: CompareRow[] = useMemo(() => {
    if (!compareStats) return [];
    return [
      { label: "ATK", hovered: currentStats.attack, equipped: compareStats.attack },
      { label: "DEF", hovered: currentStats.defense, equipped: compareStats.defense },
      { label: "HP", hovered: currentStats.hp, equipped: compareStats.hp },
      { label: "SPD", hovered: currentStats.speed, equipped: compareStats.speed },
      { label: "LS%", hovered: Number((currentStats.lifeSteal * 100).toFixed(1)), equipped: Number((compareStats.lifeSteal * 100).toFixed(1)) },
      { label: "Crit%", hovered: Number((currentStats.critChance * 100).toFixed(1)), equipped: Number((compareStats.critChance * 100).toFixed(1)) },
      { label: "Skill%", hovered: Number((currentStats.skillPower * 100).toFixed(1)), equipped: Number((compareStats.skillPower * 100).toFixed(1)) },
      { label: "STR", hovered: currentStats.strength, equipped: compareStats.strength },
      { label: "CON", hovered: currentStats.constitution, equipped: compareStats.constitution },
      { label: "INT", hovered: currentStats.intelligence, equipped: compareStats.intelligence },
      { label: "DEX", hovered: currentStats.dexterity, equipped: compareStats.dexterity },
    ].filter((row) => row.hovered > 0 && row.equipped > 0);
  }, [compareStats, currentStats]);

  useEffect(() => {
    if (!hovered) return;
    const update = () => {
      const trigger = rootRef.current;
      const tip = tooltipRef.current;
      if (!trigger || !tip) return;
      const triggerRect = trigger.getBoundingClientRect();
      const tipRect = tip.getBoundingClientRect();
      const gap = 10;
      const margin = 8;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = triggerRect.left + triggerRect.width / 2 - tipRect.width / 2;
      left = Math.max(margin, Math.min(left, vw - tipRect.width - margin));
      let top = triggerRect.top - tipRect.height - gap;
      if (top < margin) top = Math.min(vh - tipRect.height - margin, triggerRect.bottom + gap);
      setTooltipStyle({ top, left });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [hovered, stats, req, affixLines.length, compareStats]);

  return (
    <span
      ref={rootRef}
      className={`relative inline-flex max-w-full cursor-help ${className ?? ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      {children}
      {hovered && typeof document !== "undefined"
        ? createPortal(
            <span
              ref={tooltipRef}
              className="pointer-events-none fixed z-120 w-88 max-w-[min(22rem,calc(100vw-1rem))] rounded-lg border border-zinc-700 bg-zinc-950/98 p-3 text-left text-xs text-zinc-200 opacity-100 shadow-xl backdrop-blur-sm"
              style={{ top: tooltipStyle.top, left: tooltipStyle.left }}
              role="tooltip"
            >
              <span className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${rarityBadgeClass(item.rarity)}`}>
                {item.rarity}
              </span>
              <p className={`mt-2 font-semibold ${rarityNameClass(item.rarity)}`}>
                {item.emoji} {affixPrefix ? `${affixPrefix} ` : ""}
                {item.name}
                {fl > 0 ? <span className="text-zinc-400"> +{fl}</span> : null}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500">
                Slot {item.slot.replace(/_/g, " ")} · Lv {item.requiredLevel}+
              </p>
              {item.description?.trim() ? <p className="mt-2 leading-snug text-zinc-400">{item.description.trim()}</p> : null}
              <p className="mt-2 font-mono text-[11px] text-emerald-200/90">{stats}</p>
              {affixLines.length ? <p className="mt-1 text-[11px] text-violet-200/90">{affixLines.join(" · ")}</p> : null}
              {req ? <p className="mt-1 text-[11px] text-amber-200/80">Requires: {req}</p> : null}

              {compareStats ? (
                <div className="mt-2 border-t border-zinc-800 pt-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Gear compare</p>
                  <p className="mt-1 text-[11px] text-zinc-400">
                    <span className="text-zinc-200">Equipped:</span> {compareAgainst?.item.name}
                    {normalizeForgeLevel(compareAgainst?.forgeLevel ?? 0) > 0
                      ? ` +${normalizeForgeLevel(compareAgainst?.forgeLevel ?? 0)}`
                      : ""}{" "}
                    · <span className="text-zinc-200">Hover:</span> {item.name}
                    {fl > 0 ? ` +${fl}` : ""}
                  </p>
                  {compareRows.length ? (
                    <div className="mt-1 grid grid-cols-[auto_1fr_1fr] gap-x-2 gap-y-0.5 font-mono text-[11px]">
                      <span className="text-zinc-500">Stat</span>
                      <span className="text-zinc-500">Equipped</span>
                      <span className="text-zinc-500">Hover</span>
                      {compareRows.map((row) => (
                        <span key={row.label} className="contents">
                          <span className="text-zinc-500">{row.label}</span>
                          <span className={deltaClass(row.equipped - row.hovered)}>{row.equipped}</span>
                          <span className={deltaClass(row.hovered - row.equipped)}>{row.hovered}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-[11px] text-zinc-500">No shared non-zero weapon stats to compare.</p>
                  )}
                </div>
              ) : null}

              <p className="mt-2 border-t border-zinc-800 pt-2 font-mono text-amber-300/90">Vendor buyback: {item.sellPrice} gold</p>
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
