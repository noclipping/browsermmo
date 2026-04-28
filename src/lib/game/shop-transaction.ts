/** Returned by town shop server actions so the client can flash gold +/- feedback. */
export type ShopTransactionResult =
  | { ok: true; delta: number }
  | { ok: false };
