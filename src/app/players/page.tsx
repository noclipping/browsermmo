import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
};

/** @deprecated Use `/social/directory` — kept for bookmarks and external links. */
export default async function PlayersLegacyRedirect({ searchParams }: PageProps) {
  const sp = searchParams ? await Promise.resolve(searchParams) : {};
  const q = new URLSearchParams();
  const rawQ = sp.q;
  const qs = (Array.isArray(rawQ) ? rawQ[0] : rawQ ?? "").trim();
  if (qs.length >= 2) q.set("q", qs);
  const rawP = sp.page;
  const p = Array.isArray(rawP) ? rawP[0] : rawP;
  if (p) q.set("page", String(p));
  const s = q.toString();
  redirect(s ? `/social/directory?${s}` : "/social/directory");
}
