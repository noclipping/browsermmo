"use client";

import { useSfx } from "@/components/sfx-provider";
import type { ButtonHTMLAttributes, ReactNode } from "react";

/** Submit button that plays the anvil SFX when not disabled (forge / smithing). */
export function AnvilSfxButton({ children, onClick, disabled, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  const { playSfx } = useSfx();
  return (
    <button
      {...rest}
      type={rest.type ?? "submit"}
      disabled={disabled}
      onClick={(e) => {
        if (!disabled) playSfx("anvil");
        onClick?.(e);
      }}
    >
      {children}
    </button>
  );
}
