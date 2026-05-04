"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function CharacterBioEditor({
  initialBio,
  updateBioAction,
  variant = "default",
}: {
  initialBio: string;
  updateBioAction: (formData: FormData) => Promise<string | null>;
  /** Softer read/edit chrome when embedded in the character sheet header. */
  variant?: "default" | "header";
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draftBio, setDraftBio] = useState(initialBio);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [pending, startTransition] = useTransition();

  const onSave = (formData: FormData) => {
    startTransition(async () => {
      setFeedback(null);
      const result = await updateBioAction(formData);
      if (result) {
        setIsError(true);
        setFeedback(result);
        return;
      }
      setIsError(false);
      const timeLabel = new Date().toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      });
      setFeedback(`Bio saved. Updated just now · ${timeLabel}`);
      setEditing(false);
      router.refresh();
    });
  };

  const readBoxClass =
    variant === "header"
      ? "min-h-9 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm leading-relaxed text-zinc-300"
      : "min-h-10 rounded border border-zinc-900 bg-black/20 px-3 py-2 text-sm text-zinc-300";
  const secondaryBtnClass =
    variant === "header"
      ? "rounded border border-white/15 bg-black/40 px-2.5 py-1 text-[11px] font-semibold text-zinc-200 hover:bg-black/55 disabled:opacity-50"
      : "rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 disabled:opacity-50";
  const primaryBtnClass =
    variant === "header"
      ? "rounded-lg border border-amber-800/50 bg-amber-950/25 px-3 py-1.5 text-[11px] font-semibold text-amber-100 hover:bg-amber-900/30 disabled:opacity-50"
      : "rounded-lg border border-white/20 bg-black/55 px-3 py-1.5 text-xs font-semibold text-zinc-100 hover:border-white/35 hover:bg-black/70 disabled:opacity-50";
  const textareaClass =
    variant === "header"
      ? "w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600"
      : "w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200";

  return (
    <div className="space-y-2">
      {editing ? (
        <form action={onSave} className="space-y-2">
          <textarea
            name="bio"
            value={draftBio}
            onChange={(event) => setDraftBio(event.target.value)}
            maxLength={180}
            rows={3}
            placeholder="Write a short bio or tagline..."
            className={textareaClass}
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-zinc-500">{draftBio.length}/180</p>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraftBio(initialBio);
                  setEditing(false);
                  setFeedback(null);
                }}
                disabled={pending}
                className={secondaryBtnClass}
              >
                Cancel
              </button>
              <button type="submit" disabled={pending} className={primaryBtnClass}>
                {pending ? "Saving..." : "Save bio"}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="space-y-2">
          <p className={readBoxClass}>{initialBio || "No bio set yet — add a line that shows on your public profile."}</p>
          <button
            type="button"
            onClick={() => {
              setDraftBio(initialBio);
              setEditing(true);
              setFeedback(null);
            }}
            className={variant === "header" ? secondaryBtnClass : "rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-800"}
          >
            Edit bio
          </button>
        </div>
      )}
      {feedback ? (
        <p className={`text-xs ${isError ? "text-red-400" : "text-emerald-300"}`}>{feedback}</p>
      ) : null}
    </div>
  );
}
