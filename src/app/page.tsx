import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  const character = user
    ? await prisma.character.findFirst({
        where: { userId: user.id },
        select: { id: true, name: true },
      })
    : null;

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

      <section className="relative z-10 w-full max-w-lg rounded-2xl border border-amber-900/40 bg-zinc-950/20 p-6 backdrop-blur-[1px]">
        <div className="bg-linear-to-b from-black/45 via-black/65 to-black/88 p-6 rounded-xl">
          <div className="mb-6 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- static branding image from public assets */}
            <img
              src="/images/branding/duskforgelogo.png"
              alt="Duskforge logo"
              width={1024}
              height={1024}
              className="mx-auto mb-3 w-full max-w-88 select-none"
              decoding="async"
            />
            <h1 className="font-serif text-3xl text-amber-100">Duskforge</h1>
            <p className="mt-2 text-sm text-zinc-300">
              Build your hero and step into the outskirts.
            </p>
          </div>

          <div className="space-y-3">
            {!user ? (
              <>
                <Link
                  href="/login"
                  className="block w-full rounded-lg border border-amber-800/60 bg-amber-950/30 px-4 py-3 text-center font-semibold text-amber-100 hover:bg-amber-900/35"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="block w-full rounded-lg border border-amber-800/60 bg-amber-950/30 px-4 py-3 text-center font-semibold text-amber-100 hover:bg-amber-900/35"
                >
                  Register
                </Link>
              </>
            ) : character ? (
              <>
                <Link
                  href="/town"
                  className="block w-full rounded-lg border border-amber-800/60 bg-amber-950/30 px-4 py-3 text-center font-semibold text-amber-100 hover:bg-amber-900/35"
                >
                  Play
                </Link>
                <p className="text-center text-sm text-zinc-300">
                  Welcome back, {character.name}.
                </p>
                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="block w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-center font-semibold text-zinc-300 hover:bg-zinc-800"
                  >
                    Logout
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link
                  href="/character/new"
                  className="block w-full rounded-lg border border-amber-800/60 bg-amber-950/30 px-4 py-3 text-center font-semibold text-amber-100 hover:bg-amber-900/35"
                >
                  Create Character
                </Link>
                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="block w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-center font-semibold text-zinc-300 hover:bg-zinc-800"
                  >
                    Logout
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
