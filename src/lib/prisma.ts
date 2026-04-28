import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

function createPrismaClient() {
  return new PrismaClient();
}

/** In dev, `global.prisma` can survive hot reloads and miss delegates added after `prisma generate`. */
function devClientNeedsRefresh(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const existing = global.prisma;
  if (!existing) return false;
  return !("friendship" in (existing as object));
}

if (devClientNeedsRefresh()) {
  void global.prisma?.$disconnect().catch(() => {});
  global.prisma = undefined;
}

export const prisma = global.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}
