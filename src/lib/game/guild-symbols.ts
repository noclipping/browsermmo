export const GUILD_SYMBOLS = [
  "🛡️",
  "⚔️",
  "🏰",
  "👑",
  "🦁",
  "🐺",
  "🐉",
  "🦅",
  "🔥",
  "🌙",
  "⭐",
  "⛨",
] as const;

export type GuildSymbol = (typeof GUILD_SYMBOLS)[number];

export function isGuildSymbol(value: string): value is GuildSymbol {
  return (GUILD_SYMBOLS as readonly string[]).includes(value);
}
