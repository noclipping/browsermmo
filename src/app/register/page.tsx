import Link from "next/link";
import { RegisterForm } from "@/components/auth-forms";

export default function RegisterPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-semibold">Create account</h1>
      <p className="mt-2 text-sm text-zinc-400">Phase 1 local auth for Browser MMO.</p>
      <RegisterForm />
      <p className="mt-4 text-sm text-zinc-400">Already have an account? <Link className="text-emerald-400" href="/login">Login</Link></p>
    </main>
  );
}
