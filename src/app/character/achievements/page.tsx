import { redirect } from "next/navigation";

/** Achievements live in the modal on `/character` (🏆 Achievements). */
export default function CharacterAchievementsPage() {
  redirect("/character");
}
