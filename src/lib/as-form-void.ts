/**
 * Type-only adapter for `<form action={...}>` to satisfy Promise<void> signatures.
 * IMPORTANT: this must return the original function reference so Next still recognizes
 * it as a server action. Do not wrap with a new closure here.
 */
export function asFormVoid(fn: (fd: FormData) => Promise<unknown>): (fd: FormData) => Promise<void> {
  return fn as (fd: FormData) => Promise<void>;
}
