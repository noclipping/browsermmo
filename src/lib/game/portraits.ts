import type { CharacterClass } from "@prisma/client";

export type PortraitOption = {
  id: string;
  label: string;
  src: string;
};

export const PORTRAITS_BY_CLASS: Record<CharacterClass, PortraitOption[]> = {
  WARRIOR: [
    {
      id: "warrior_male",
      label: "Warrior (Male)",
      src: "/images/portraits/warriorportraitmale.png",
    },
    {
      id: "warrior_female",
      label: "Warrior (Female)",
      src: "/images/portraits/warriorportraitfemale.png",
    },
  ],
  MAGE: [
    {
      id: "mage_male",
      label: "Mage (Male)",
      src: "/images/portraits/mageportraitmale.png",
    },
    {
      id: "mage_female",
      label: "Mage (Female)",
      src: "/images/portraits/mageportraitfemale.png",
    },
  ],
  ROGUE: [
    {
      id: "archer_male",
      label: "Archer (Male)",
      src: "/images/portraits/archerportraitmale.png",
    },
    {
      id: "archer_female",
      label: "Archer (Female)",
      src: "/images/portraits/archerportraitfemale.png",
    },
  ],
};

export function portraitsForClass(characterClass: CharacterClass): PortraitOption[] {
  return PORTRAITS_BY_CLASS[characterClass] ?? [];
}

export function isValidPortraitForClass(characterClass: CharacterClass, portraitKey: string | null | undefined): boolean {
  if (!portraitKey) return false;
  return portraitsForClass(characterClass).some((portrait) => portrait.id === portraitKey);
}

export function portraitForClass(characterClass: CharacterClass, portraitKey: string | null | undefined): PortraitOption | null {
  const portraits = portraitsForClass(characterClass);
  const chosen = portraits.find((portrait) => portrait.id === portraitKey);
  if (chosen) return chosen;
  return portraits[0] ?? null;
}
