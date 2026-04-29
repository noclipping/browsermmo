"use client";

import { useMemo, useState } from "react";
import { ShopTransactionForm } from "@/components/shop-gold-fx";
import type { ShopTransactionResult } from "@/lib/game/shop-transaction";

export function ShopQuantityBuy({
  transactionAction,
  unitPrice,
  playerGold,
  label,
  currentCountLabel,
  maxQuantity,
}: {
  transactionAction: (formData: FormData) => Promise<ShopTransactionResult>;
  unitPrice: number;
  playerGold: number;
  label: string;
  currentCountLabel?: string;
  maxQuantity?: number;
}) {
  const maxAffordable = Math.floor(playerGold / Math.max(1, unitPrice));
  const maxAllowed = Math.max(0, Math.min(maxAffordable, maxQuantity ?? maxAffordable));
  const [quantity, setQuantity] = useState(1);
  const clamped = Math.min(Math.max(1, quantity), Math.max(1, maxAllowed || 1));
  const totalPrice = clamped * unitPrice;
  const disabled = maxAllowed < 1;

  const hint = useMemo(() => {
    if (disabled) return "Cannot afford or at cap";
    if (maxQuantity != null) return `Max ${maxAllowed}`;
    return `Affordable: ${maxAllowed}`;
  }, [disabled, maxAllowed, maxQuantity]);

  return (
    <ShopTransactionForm transactionAction={transactionAction} className="mt-3 space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          disabled={disabled}
          className="h-8 w-8 rounded border border-white/20 bg-white/5 text-sm font-bold text-zinc-100 disabled:opacity-40"
        >
          -
        </button>
        <input
          name="quantityUi"
          type="number"
          min={1}
          max={Math.max(1, maxAllowed)}
          value={clamped}
          onChange={(e) => setQuantity(Number(e.target.value) || 1)}
          disabled={disabled}
          className="h-8 w-20 rounded border border-white/20 bg-black/40 px-2 text-center text-sm text-zinc-100 disabled:opacity-40"
        />
        <button
          type="button"
          onClick={() => setQuantity((q) => Math.min(Math.max(1, maxAllowed), q + 1))}
          disabled={disabled}
          className="h-8 w-8 rounded border border-white/20 bg-white/5 text-sm font-bold text-zinc-100 disabled:opacity-40"
        >
          +
        </button>
        <span className="text-[11px] text-zinc-400">{hint}</span>
      </div>

      <input type="hidden" name="quantity" value={clamped} />
      <button
        type="submit"
        disabled={disabled}
        className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-semibold text-zinc-100 enabled:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Buy {label} x{clamped} — {totalPrice}g{currentCountLabel ? ` (${currentCountLabel})` : ""}
      </button>
    </ShopTransactionForm>
  );
}
