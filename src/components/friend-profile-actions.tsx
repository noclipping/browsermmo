"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  acceptFriendRequestAction,
  cancelOutgoingFriendRequestAction,
  declineFriendRequestAction,
  removeFriendAction,
  sendFriendRequestAction,
} from "@/app/actions/friends";
import type { FriendProfileButtonState } from "@/lib/social/friendship";

const btn =
  "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50";
const btnCompact = "rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50";
const btnPrimary = `${btn} border-white/20 bg-black/55 text-zinc-100 hover:border-white/35 hover:bg-black/70`;
const btnPrimaryCompact = `${btnCompact} border-white/20 bg-black/55 text-zinc-100 hover:border-white/35 hover:bg-black/70`;
const btnMuted = `${btn} border-white/20 bg-white/5 text-zinc-300 hover:bg-white/10`;
const btnMutedCompact = `${btnCompact} border-white/20 bg-white/5 text-zinc-300 hover:bg-white/10`;
const btnDanger = `${btn} border-red-900/50 bg-red-950/30 text-red-200 hover:bg-red-950/50`;
const btnDangerCompact = `${btnCompact} border-red-900/50 bg-red-950/30 text-red-200 hover:bg-red-950/50`;

export function FriendProfileActions({
  state,
  targetUserId,
  compact = false,
}: {
  state: FriendProfileButtonState;
  targetUserId: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (action: (fd: FormData) => Promise<string | null>) => {
    return (formData: FormData) => {
      startTransition(async () => {
        setError(null);
        const err = await action(formData);
        if (err) setError(err);
        else router.refresh();
      });
    };
  };

  if (state.kind === "self") {
    return null;
  }

  const p = compact ? btnPrimaryCompact : btnPrimary;
  const m = compact ? btnMutedCompact : btnMuted;
  const d = compact ? btnDangerCompact : btnDanger;
  const pill = compact
    ? "rounded-lg border border-white/15 bg-black/45 px-2 py-1 text-[11px] text-zinc-400"
    : "rounded-lg border border-white/15 bg-black/45 px-3 py-1.5 text-xs text-zinc-400";
  const friendsPill = compact
    ? "rounded-lg border border-white/25 bg-white/10 px-2 py-1 text-[11px] font-medium text-zinc-200"
    : "rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-medium text-zinc-200";

  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? "mt-0 justify-end" : "mt-3"}`}>
      {state.kind === "add_friend" ? (
        <form action={run(sendFriendRequestAction)}>
          <input type="hidden" name="targetUserId" value={targetUserId} />
          <button type="submit" disabled={pending} className={p}>
            {pending ? "…" : "Add Friend"}
          </button>
        </form>
      ) : null}

      {state.kind === "outgoing_pending" ? (
        <>
          <span className={pill}>Request sent</span>
          <form action={run(cancelOutgoingFriendRequestAction)}>
            <input type="hidden" name="friendshipId" value={state.friendshipId} />
            <button type="submit" disabled={pending} className={m}>
              {compact ? "Cancel" : "Cancel request"}
            </button>
          </form>
        </>
      ) : null}

      {state.kind === "incoming_pending" ? (
        <div className="flex flex-wrap gap-2">
          <form action={run(acceptFriendRequestAction)}>
            <input type="hidden" name="friendshipId" value={state.friendshipId} />
            <button type="submit" disabled={pending} className={p}>
              Accept
            </button>
          </form>
          <form action={run(declineFriendRequestAction)}>
            <input type="hidden" name="friendshipId" value={state.friendshipId} />
            <button type="submit" disabled={pending} className={d}>
              Decline
            </button>
          </form>
        </div>
      ) : null}

      {state.kind === "friends" ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className={friendsPill}>Friends</span>
          <form action={run(removeFriendAction)}>
            <input type="hidden" name="friendshipId" value={state.friendshipId} />
            <button type="submit" disabled={pending} className={m}>
              {compact ? "Remove" : "Remove friend"}
            </button>
          </form>
        </div>
      ) : null}

      {error ? <p className="w-full text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
