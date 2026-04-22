import Link from "next/link";
import { LoginForm } from "@/components/auth-forms";

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-semibold">Login</h1>
      <p className="mt-2 text-sm text-zinc-400">Use seeded account: tester@local.dev / password123</p>
      <LoginForm />
      <p className="mt-4 text-sm text-zinc-400">Need an account? <Link className="text-emerald-400" href="/register">Register</Link></p>
    </main>
  );
}
