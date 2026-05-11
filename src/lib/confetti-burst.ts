import confetti from "canvas-confetti";

/** Same burst as achievement unlock toasts (`AchievementToastProvider`). Fires once per call. */
export function burstAchievementConfetti(origin?: { x: number; y: number }) {
  const count = 140;
  const defaults = { origin: { x: 0.5, y: 0.92 }, zIndex: 10080 };

  void confetti({
    ...defaults,
    origin: origin ?? defaults.origin,
    particleCount: Math.floor(count * 0.35),
    spread: 62,
    startVelocity: 35,
    scalar: 0.9,
    colors: ["#fbbf24", "#fcd34d", "#fde68a", "#ffffff", "#a78bfa", "#34d399"],
  });
  void confetti({
    ...defaults,
    origin: origin ?? defaults.origin,
    particleCount: Math.floor(count * 0.25),
    spread: 90,
    startVelocity: 28,
    scalar: 0.85,
    colors: ["#f59e0b", "#fbbf24", "#fef3c7"],
  });
}
