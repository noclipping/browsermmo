"use client";

import { useSfx } from "@/components/sfx-provider";
import Link from "next/link";
import type { ComponentProps } from "react";

/** Link that plays the forge/anvil SFX (e.g. opening guild shared storage). */
export function AnvilSfxLink(props: ComponentProps<typeof Link>) {
  const { playSfx } = useSfx();
  const { onClick, ...rest } = props;
  return (
    <Link
      {...rest}
      onClick={(e) => {
        playSfx("anvil");
        onClick?.(e);
      }}
    />
  );
}
