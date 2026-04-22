import { NextResponse } from "next/server";

type ClientLogBody = {
  kind?: string;
  href?: string;
  userAgent?: string;
  message?: string;
  stack?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as ClientLogBody;
  console.log("[client-log]", {
    kind: body.kind ?? "unknown",
    href: body.href ?? "",
    userAgent: body.userAgent ?? "",
    message: body.message ?? "",
    stack: body.stack ?? "",
  });
  return NextResponse.json({ ok: true });
}
