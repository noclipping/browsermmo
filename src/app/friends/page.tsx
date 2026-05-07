import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** @deprecated Use `/social/friends` — kept for bookmarks and external links. */
export default function FriendsLegacyRedirect() {
  redirect("/social/friends");
}
