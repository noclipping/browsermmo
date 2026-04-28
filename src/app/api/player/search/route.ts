import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const limit = Math.min(25, Math.max(1, Number(searchParams.get("limit") ?? 10) || 10));

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const characters = await prisma.character.findMany({
    where: {
      name: {
        contains: q,
        mode: "insensitive",
      },
    },
    select: {
      name: true,
      class: true,
      level: true,
      portraitKey: true,
      updatedAt: true,
    },
    orderBy: [{ level: "desc" }, { updatedAt: "desc" }],
    take: limit,
  });

  return NextResponse.json({
    results: characters.map((c) => ({
      name: c.name,
      class: c.class,
      level: c.level,
      portraitKey: c.portraitKey,
    })),
  });
}
