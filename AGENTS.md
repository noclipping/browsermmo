<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Mobile + LAN dev (Next.js dev server)

Phones load the app from a **different origin** than `localhost` (e.g. `http://10.0.0.x:3000`). Next can **block** dev-only assets (`/_next/webpack-hmr`, etc.) for cross-origin requests unless you allow those origins.

- Keep `allowedDevOrigins` in `next.config.ts` aligned with how you open the app on the phone (hostname or pattern from Next docs).
- After changing `next.config.ts`, **restart** `next dev`.
- Optional sanity check: `ClientHydrationProbe` in `src/app/layout.tsx` posts to `/api/client-log` — you should see `[client-log] probe-mounted` in the terminal when the client bundle runs.

## Interactive controls (buttons, combat, adventure)

Assume **Android Chrome over LAN** may not run client handlers reliably until hydration is healthy.

1. **Prefer progressive enhancement**: critical flows should work with **`<form action={serverAction}>`** + **`type="submit"`** (not `onClick`-only).
2. **Optional** snappy UX: after hydration, you may layer `fetch` + local state — but do not remove the form/server-action path unless you explicitly accept “SSR-only / no JS” breakage.
3. **`key` on large client subtrees**: only use `key` when you **intend** to discard all React state. Do **not** key a whole arena (or similar) off **DB row ids that disappear** (e.g. encounter id vanishing on victory) — that remounts the tree and wipes local UI like victory panels.
4. **Hooks**: `useEffect` / `useLayoutEffect` dependency arrays must stay **consistent** across renders (same shape); avoid `setState` during layout for non-essential UI unless deferred.

For deeper Cursor-only rules, you can add `.cursor/rules/*.mdc` later; this file is always loaded via workspace rules.
