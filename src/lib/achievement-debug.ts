/** Dev / explicit env only — used to show debug UI and guard reset action. */
export function isAchievementDebugResetEnabled(): boolean {
  if (process.env.NODE_ENV === "development") return true;
  return process.env.ALLOW_ACHIEVEMENT_DEBUG_RESET === "true";
}
