import { CharacterClass } from "@prisma/client";
import { createCharacterAction } from "@/app/actions/character";

export default function NewCharacterPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-semibold">Create your character</h1>
      <form action={createCharacterAction} className="mt-6 space-y-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <div>
          <label className="text-sm">Name</label>
          <input name="name" required minLength={2} maxLength={18} className="mt-1 w-full rounded bg-zinc-950 px-3 py-2" />
        </div>
        <div>
          <label className="text-sm">Class</label>
          <select name="class" className="mt-1 w-full rounded bg-zinc-950 px-3 py-2">
            {Object.values(CharacterClass).map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
        <button className="w-full rounded bg-emerald-600 py-2 font-medium">Create Character</button>
      </form>
    </main>
  );
}
