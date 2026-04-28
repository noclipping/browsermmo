"use client";

import type { ShopTransactionResult } from "@/lib/game/shop-transaction";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type Bubble = { id: number; delta: number; x: number; y: number };

export type ShopGoldAnchor = { x: number; y: number };

const ShopGoldFxContext = createContext<(delta: number, anchor: ShopGoldAnchor) => void>(() => {});

function anchorFromSubmit(form: HTMLFormElement, submitEvent: SubmitEvent): ShopGoldAnchor {
  const submitter = submitEvent.submitter as HTMLButtonElement | null | undefined;
  if (submitter && typeof submitter.getBoundingClientRect === "function") {
    const r = submitter.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  const r = form.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + Math.min(r.height / 2, 48) };
}

export function ShopGoldFxRoot({ children }: { children: ReactNode }) {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const idRef = useRef(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const spawn = useCallback((delta: number, anchor: ShopGoldAnchor) => {
    const id = ++idRef.current;
    setBubbles((b) => [...b, { id, delta, ...anchor }]);
    window.setTimeout(() => setBubbles((b) => b.filter((x) => x.id !== id)), 900);
  }, []);

  const bubbleLayer =
    mounted &&
    typeof document !== "undefined" &&
    createPortal(
      <div className="pointer-events-none fixed inset-0 z-120" aria-hidden>
        {bubbles.map((b) => (
          <div
            key={b.id}
            className="shop-gold-fx-anchor"
            style={{ left: b.x, top: b.y }}
          >
            <div
              className={`shop-gold-fx-inner flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-black shadow-lg backdrop-blur-sm ${
                b.delta >= 0 ? "shop-gold-fx-gain" : "shop-gold-fx-spend"
              }`}
            >
              <span className="text-base leading-none">🪙</span>
              <span className="font-mono text-sm tracking-tight">
                {b.delta >= 0 ? "+" : ""}
                {b.delta}g
              </span>
            </div>
          </div>
        ))}
      </div>,
      document.body,
    );

  return (
    <ShopGoldFxContext.Provider value={spawn}>
      <div className="relative">
        {bubbleLayer}
        {children}
      </div>
      {/* global: bubbles are portaled to document.body */}
      <style jsx global>{`
        .shop-gold-fx-anchor {
          position: fixed;
          transform: translate(-50%, -50%);
          pointer-events: none;
        }
        .shop-gold-fx-inner {
          animation: shop-gold-pop 900ms ease-out forwards;
          white-space: nowrap;
        }
        .shop-gold-fx-spend {
          color: #fecaca;
          border-color: rgba(248, 113, 113, 0.45);
          background: rgba(127, 29, 29, 0.78);
        }
        .shop-gold-fx-gain {
          color: #bbf7d0;
          border-color: rgba(74, 222, 128, 0.45);
          background: rgba(20, 83, 45, 0.78);
        }
        @keyframes shop-gold-pop {
          0% {
            opacity: 0;
            transform: translateY(12px) scale(0.85);
          }
          12% {
            opacity: 1;
            transform: translateY(0) scale(1.05);
          }
          70% {
            opacity: 1;
            transform: translateY(-10px) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-22px) scale(0.96);
          }
        }
      `}</style>
    </ShopGoldFxContext.Provider>
  );
}

export function useShopGoldFx() {
  return useContext(ShopGoldFxContext);
}

export function ShopTransactionForm({
  transactionAction,
  children,
  className,
}: {
  transactionAction: (formData: FormData) => Promise<ShopTransactionResult>;
  children: ReactNode;
  className?: string;
}) {
  const spawn = useShopGoldFx();
  const router = useRouter();
  const pointerRef = useRef<ShopGoldAnchor | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const anchor = pointerRef.current ?? anchorFromSubmit(form, e.nativeEvent as SubmitEvent);
    pointerRef.current = null;
    const r = await transactionAction(fd);
    if (r.ok) spawn(r.delta, anchor);
    router.refresh();
  }

  return (
    <form
      className={className}
      onSubmit={handleSubmit}
      onPointerDownCapture={(ev) => {
        const el = ev.target as HTMLElement | null;
        if (el?.closest('button[type="submit"]')) {
          pointerRef.current = { x: ev.clientX, y: ev.clientY };
        }
      }}
    >
      {children}
    </form>
  );
}
