"use client";

import { useSfx } from "@/components/sfx-provider";
import type { ButtonHTMLAttributes, ReactNode } from "react";

/** Region travel tab — plays adventure SFX on click when actionable. */
export function AdventureTravelTabButton({
  children,
  onClick,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  const { playSfx } = useSfx();
  return (
    <button
      {...rest}
      type="submit"
      disabled={disabled}
      onClick={(e) => {
        if (!disabled) playSfx("adventure");
        onClick?.(e);
      }}
    >
      {children}
    </button>
  );
}
