"use client";

import { useSfx } from "@/components/sfx-provider";
import type { ReactNode } from "react";

export function ConsumeTonicForm({
  action,
  disabled,
  className,
  title,
  children,
}: {
  action: () => Promise<void>;
  disabled: boolean;
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  const { playSfx } = useSfx();
  return (
    <form action={action} className="mt-2">
      <button
        type="submit"
        disabled={disabled}
        className={className}
        title={title}
        onClick={() => playSfx("potion")}
      >
        {children}
      </button>
    </form>
  );
}
