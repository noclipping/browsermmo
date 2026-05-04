import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

function createPrismaClient() {
  return new PrismaClient();
}

let warnedMilestoneStaleTypes = false;
/** One-time hint when schema added fields but `prisma generate` did not complete (common on Windows EPERM while dev is running). */
function warnIfGeneratedClientMissingMilestoneFields(): void {
  if (process.env.NODE_ENV === "production" || warnedMilestoneStaleTypes) return;
  try {
    const p = join(process.cwd(), "node_modules/.prisma/client/index.d.ts");
    if (!existsSync(p)) return;
    if (readFileSync(p, "utf8").includes("milestoneCounters")) return;
    warnedMilestoneStaleTypes = true;
    console.warn(
      "[prisma] Generated client is missing DB fields like `milestoneCounters`. Stop the dev server, run `npx prisma generate`, then restart.",
    );
  } catch {
    /* ignore */
  }
}

warnIfGeneratedClientMissingMilestoneFields();

/** In dev, `global.prisma` can survive hot reloads and miss delegates added after `prisma generate`. */
function devClientNeedsRefresh(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const existing = global.prisma;
  if (!existing) return false;
  const d = existing as unknown as Record<string, unknown>;
  return !("friendship" in d) || !("achievement" in d) || !("characterAchievement" in d);
}

if (devClientNeedsRefresh()) {
  void global.prisma?.$disconnect().catch(() => {});
  global.prisma = undefined;
}

export const prisma = global.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}
