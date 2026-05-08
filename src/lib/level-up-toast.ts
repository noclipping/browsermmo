import type { AchievementToastItem } from "@/lib/achievement-toast-types";

/** Same toast UI as achievements; not a DB achievement. */
export function levelUpToastItem(newLevel: number): AchievementToastItem {
  return {
    key: "__level_up__",
    name: "Level up!",
    description: `You've reached level ${newLevel}!`,
    icon: "⭐",
    variant: "levelup",
  };
}
