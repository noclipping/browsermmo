"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function CharacterBioEditor({
  initialBio,
  updateBioAction,
}: {
  initialBio: string;
  updateBioAction: (formData: FormData) => Promise<string | null>;
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
            className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
          />
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-zinc-500">{draftBio.length}/180</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraftBio(initialBio);
                  setEditing(false);
                  setFeedback(null);
                }}
                disabled={pending}
                className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg border border-white/20 bg-black/55 px-3 py-1.5 text-xs font-semibold text-zinc-100 hover:border-white/35 hover:bg-black/70 disabled:opacity-50"
              >
                {pending ? "Saving..." : "Save bio"}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="space-y-2">
          <p className="min-h-10 rounded border border-zinc-900 bg-black/20 px-3 py-2 text-sm text-zinc-300">
            {initialBio || "No bio set yet."}
          </p>
          <button
            type="button"
            onClick={() => {
              setDraftBio(initialBio);
              setEditing(true);
              setFeedback(null);
            }}
            className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-800"
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
