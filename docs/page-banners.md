# Page background banners (full-bleed, fade to page bg)

This document describes how the **town hub** (`/`) implements `public/images/areabanners/townbanner.png` so you can repeat the pattern for other routes or swap art later.

## Goals

- Banner sits **behind** nav and content (decorative only).
- **Entire image visible** (no `background-size: cover` crop on a short box).
- Bottom **fades into the real page background color** so the layout feels continuous.
- Works on **mobile** and **desktop** (town uses a responsive split — see below).

## Asset placement

- Put files under `public/images/areabanners/` (e.g. `public/images/areabanners/townbanner.png`).
- Reference in markup as **`/images/areabanners/<filename>`** (leading slash, no `public/`).

## Implementation pattern (reference)

See **`src/app/page.tsx`** — the outer shell and banner block look like this:

1. **Page root** — `relative isolate min-h-screen` (or at least `relative isolate`) plus the normal page background classes (e.g. `bg-[#0c0a09]` and any radial gradients).
2. **Banner layer** — `pointer-events-none absolute inset-x-0 top-0 z-0` so it never steals clicks and stays under UI.
3. **Inner wrapper** — `relative w-full leading-none` around the image (removes stray gap under inline images). On **narrow viewports only**, town adds `max-md:min-h-[46vh] max-md:overflow-hidden` so the banner can occupy more vertical space behind the first cards.
4. **Image** — use a real **`<img>`**, not a CSS background:
   - **Desktop (`md+`)** — show the **full frame** (no crop): `block h-auto w-full max-w-full select-none`.
   - **Mobile (`max-md`)** — fill that taller wrapper while keeping aspect ratio (crops **left/right** only): `max-md:absolute max-md:inset-0 max-md:h-full max-md:object-cover max-md:object-center`.
   - **`width` and `height` attributes must match the file’s pixel dimensions`** (reduces layout shift; preserves aspect ratio before decode). Get dimensions from the file (e.g. `file public/images/areabanners/yourbanner.png`, or read PNG `IHDR`).
5. **Fade overlay** — absolutely positioned on top of the image, same box as the image:
   - `absolute inset-0 bg-linear-to-b from-transparent … via-[PAGE_BG]/55 … to-[PAGE_BG]`
   - **`PAGE_BG` must match** the solid background color of the page (town uses `#0c0a09`). If you change the page bg, update the gradient stops.
   - Town uses **slightly different gradient stops on `md+` vs default** so the fade reads well for both the tall mobile crop and the full desktop image.
6. **Content** — wrap `<main>` (and any chrome that should sit above the art) in **`relative z-10`** so text and controls stay interactive and readable.

## Why not only `background-size: cover`?

- `cover` in a short box **crops** unpredictably; wide town art on a phone becomes a thin strip if height comes only from intrinsic width scaling.
- Town’s **desktop** behavior uses **`w-full` + `h-auto`** so the **entire** image is visible.
- Town’s **mobile** behavior intentionally uses **`object-cover`** inside a **`min-height`** box so the art **extends further down** behind content (center crop), without stretching pixels.

If you need “never crop anywhere,” drop the mobile `min-h` + `object-cover` branch and accept a shorter banner on phones.

## Readability over the banner

If a hero or header sits where the art is visible:

- Avoid stacking a second full-bleed background image on the same real estate.
- Prefer **semi-opaque panels** (`bg-zinc-950/20`, `backdrop-blur`, dark gradient scrims) so text stays legible while the banner still reads through.

Town example: the “Town Outskirts” hero uses a light glass + dark linear scrim instead of a duplicate background photo.

## Accessibility

- Decorative banners: **`aria-hidden` on the banner wrapper** and **`alt=""` on the image**.
- Keep **`pointer-events-none`** on the decorative layer so buttons/links are not blocked.

## Linting (`next/no-img-element`)

For static decorative art where intrinsic `width`/`height` matter, a plain `<img>` is fine. If ESLint complains, use a file-local disable with a short justification (see `page.tsx`).

## Checklist for a new banner on another page

1. Add PNG/WebP under `public/images/areabanners/`.
2. Note **exact width × height**; set matching `width`/`height` on `<img>`.
3. Copy the banner structure from `src/app/page.tsx` into that page’s root layout (only the routes that should show it).
4. Match **`to-[#…]` and `via-[#…]/opacity`** to that page’s base `background` color.
5. Ensure **main content** has **`relative z-10`** (or higher) vs banner `z-0`.
6. Smoke-test **narrow mobile width** — image should shrink, not overflow horizontally (`overflow-x-hidden` on the page root helps).

## Scope note

The town implementation is intentionally on **`src/app/page.tsx` only** (town hub). Other routes (shop, adventure, character) do not use this banner unless you add the same pattern there.
