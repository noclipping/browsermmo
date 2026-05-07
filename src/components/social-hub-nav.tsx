"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const pill =
  "inline-flex min-h-9 shrink-0 touch-manipulation items-center justify-center rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors";
const inactive = "border-white/25 bg-black/35 text-zinc-400 hover:border-white/45 hover:bg-black/50 hover:text-zinc-100";
const activeCls =
  "border-white bg-zinc-800 text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14)] ring-1 ring-white/25";

export function SocialHubNav() {
  const pathname = usePathname();
  const dir = pathname === "/social/directory";
  const friends = pathname === "/social/friends";
  const requests = pathname === "/social/requests";

  return (
    <nav
      className="flex flex-wrap gap-2 rounded-xl border border-white/12 bg-black/30 px-3 py-2.5 backdrop-blur-[1px]"
      aria-label="Social sections"
    >
      <Link href="/social/directory" className={`${pill} ${dir ? activeCls : inactive}`} aria-current={dir ? "page" : undefined}>
        Player directory
      </Link>
      <Link href="/social/friends" className={`${pill} ${friends ? activeCls : inactive}`} aria-current={friends ? "page" : undefined}>
        Friends
      </Link>
      <Link href="/social/requests" className={`${pill} ${requests ? activeCls : inactive}`} aria-current={requests ? "page" : undefined}>
        Requests
      </Link>
    </nav>
  );
}
