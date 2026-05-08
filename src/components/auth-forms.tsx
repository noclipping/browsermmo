"use client";

import { useActionState } from "react";
import { loginAction, registerAction } from "@/app/actions/auth";

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="mt-1 w-full rounded bg-zinc-950 px-3 py-2" />;
}

export function RegisterForm() {
  const [error, action, pending] = useActionState(registerAction, null);
  return (
    <form action={action} className="mt-6 space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <div><label className="text-sm">Email</label><Input name="email" type="email" required /></div>
      <div><label className="text-sm">Password</label><Input name="password" type="password" minLength={8} required /></div>
      <div><label className="text-sm">Confirm password</label><Input name="confirmPassword" type="password" minLength={8} required /></div>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <button
        disabled={pending}
        className="w-full rounded-lg border border-amber-800/60 bg-amber-950/30 py-2 font-semibold text-amber-100 hover:bg-amber-900/35 disabled:opacity-70"
      >
        {pending ? "Creating..." : "Create account"}
      </button>
    </form>
  );
}

export function LoginForm() {
  const [error, action, pending] = useActionState(loginAction, null);
  return (
    <form action={action} className="mt-6 space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <div><label className="text-sm">Email</label><Input name="email" type="email" required /></div>
      <div><label className="text-sm">Password</label><Input name="password" type="password" minLength={8} required /></div>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <button
        disabled={pending}
        className="w-full rounded-lg border border-amber-800/60 bg-amber-950/30 py-2 font-semibold text-amber-100 hover:bg-amber-900/35 disabled:opacity-70"
      >
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
