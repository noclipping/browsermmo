export type WeaponType = "MAGIC" | "RANGED" | "DAGGER" | "MELEE";

type WeaponLike = {
  slot: string;
  name: string;
  key?: string | null;
};

export function weaponType(item: WeaponLike): WeaponType {
  if (item.slot !== "WEAPON") return "MELEE";
  const key = (item.key ?? "").toLowerCase();
  const name = item.name.toLowerCase();
  if (
    key.includes("staff") ||
    key.includes("rod") ||
    key.includes("wand") ||
    key.includes("channel") ||
    key.includes("focus") ||
    name.includes("staff") ||
    name.includes("archstaff") ||
    name.includes("rod") ||
    name.includes("wand") ||
    name.includes("channel") ||
    name.includes("focus")
  ) {
    return "MAGIC";
  }
  if (
    key.includes("bow") ||
    key.includes("slingshot") ||
    key.includes("recurve") ||
    name.includes("bow") ||
    name.includes("slingshot")
  ) {
    return "RANGED";
  }
  if (
    key.includes("dagger") ||
    key.includes("knife") ||
    key.includes("dirk") ||
    name.includes("dagger")
  ) {
    return "DAGGER";
  }
  return "MELEE";
}

export function isMagicWeapon(item: WeaponLike): boolean {
  return weaponType(item) === "MAGIC";
}
