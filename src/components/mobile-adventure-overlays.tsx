"use client";

import { useState, type ReactNode } from "react";

function Overlay({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label={`Close ${title}`}
        onClick={onClose}
        className="absolute inset-0 bg-black/70"
      />
      <div className="relative z-10 flex h-full flex-col bg-zinc-950 px-4 pt-4 pb-6">
        <div className="mb-3 flex items-center justify-between gap-3 border-b border-zinc-800 pb-3">
          <p className="text-sm font-semibold text-zinc-200">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm font-semibold text-zinc-200"
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">{children}</div>
      </div>
    </div>
  );
}

export function MobileAdventureOverlays({
  inventoryPanel,
  chatPanel,
}: {
  inventoryPanel: ReactNode;
  chatPanel: ReactNode;
}) {
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex items-end justify-between px-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden">
        <button
          type="button"
          onClick={() => setInventoryOpen(true)}
          aria-label="Open inventory"
          className="pointer-events-auto min-h-12 min-w-12 rounded-full border border-amber-700/80 bg-amber-950/90 px-4 text-lg shadow-lg"
        >
          🎒
        </button>
        <button
          type="button"
          onClick={() => setChatOpen(true)}
          aria-label="Open world chat"
          className="pointer-events-auto min-h-12 min-w-12 rounded-full border border-sky-700/80 bg-sky-950/90 px-4 text-lg shadow-lg"
        >
          💬
        </button>
      </div>

      <Overlay title="Inventory and Character" open={inventoryOpen} onClose={() => setInventoryOpen(false)}>
        {inventoryPanel}
      </Overlay>
      <Overlay title="World Chat" open={chatOpen} onClose={() => setChatOpen(false)}>
        {chatPanel}
      </Overlay>
    </>
  );
}
