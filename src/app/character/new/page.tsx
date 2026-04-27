import Link from "next/link";
import { CharacterCreateForm } from "@/components/character-create-form";

export default function NewCharacterPage() {
  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-0"
      >
        <div className="relative w-full max-md:min-h-[72vh] max-md:overflow-hidden leading-none">
          {/* eslint-disable-next-line @next/next/no-img-element -- decorative background banner */}
          <img
            src="/images/areabanners/townbanner.png"
            alt=""
            width={1717}
            height={916}
            className="block h-auto w-full max-w-full select-none max-md:absolute max-md:inset-0 max-md:h-full max-md:object-cover max-md:object-center max-md:scale-125"
            decoding="async"
          />
          <div className="absolute inset-0 bg-linear-to-b from-black/35 via-[#0c0a09]/70 to-[#0c0a09]" />
        </div>
      </div>

      <section className="relative z-10 w-full max-w-5xl rounded-2xl border border-amber-900/40 bg-zinc-950/20 p-4 backdrop-blur-[1px] md:p-6">
        <div className="grid items-center gap-6 rounded-xl bg-linear-to-b from-black/45 via-black/65 to-black/88 p-4 md:grid-cols-2 md:p-6">
          <div className="flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- static branding image */}
            <img
              src="/images/branding/duskforgelogo.png"
              alt="Duskforge logo"
              width={1024}
              height={1024}
              className="w-full max-w-88 select-none"
              decoding="async"
            />
          </div>

          <div>
            <h1 className="text-2xl font-semibold text-amber-100">Create your character</h1>
            <p className="mt-2 text-sm text-zinc-300">
              Pick your class and lock your unique character name.
            </p>
            <CharacterCreateForm />
            <p className="mt-4 text-sm text-zinc-300">
              Need a different account?{" "}
              <Link className="text-amber-300 hover:text-amber-200" href="/">
                Back to home
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
