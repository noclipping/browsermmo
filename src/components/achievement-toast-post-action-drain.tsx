"use client";

import { drainAchievementToastCookie } from "@/lib/achievement-toast-events";
import { useEffect } from "react";

/**
 * Server actions that unlock feats call `queueAchievementToasts` → Set-Cookie.
 * Same-route RSC refresh does not remount layout; drain when a server prop tied to the character row changes (e.g. updatedAt).
 */
export function AchievementToastPostActionDrain({ revision }: { revision: string }) {
  useEffect(() => {
    drainAchievementToastCookie();
  }, [revision]);
  return null;
}
