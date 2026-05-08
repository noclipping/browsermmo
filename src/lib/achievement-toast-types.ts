export type AchievementToastItem = {
  key: string;
  name: string;
  description: string;
  icon: string;
  /** Synthetic toasts (e.g. level-up) reuse achievement chrome with different header copy. */
  variant?: "achievement" | "levelup";
};
