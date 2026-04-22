# Assets plan

Placeholder-first. Ship readable UI; swap art/audio when budget and direction firm.

---

## Placeholder images (needed soon)

| Slot | Purpose | Notes |
|------|---------|--------|
| **Favicon / app icon** | Tab + future PWA | Simple mark (sword, flame, or abstract sigil). |
| **Town hero / banner** | Town landing mood | Optional strip or illustration behind vitals. |
| **Adventure header** | Region identity | Per-region silhouette or texture (reuse + tint OK). |
| **Enemy portraits** | Combat panel | Emoji or 64–128px placeholders until real sprites. |
| **Empty slot icons** | Equipment paper doll | Grayed silhouettes per slot. |
| **Class icons** | Character create / sheet | One icon per class. |

---

## Future art slots (when upgrading)

- Region backgrounds (static or parallax-lite).
- Character paper doll layers (base + armor pieces).
- Enemy full sprites or spine-style rigs (long-term; browser weight matters).
- Boss splash / vignette for minibosses.
- Shopkeeper / forge NPC bust (town flavor).

---

## Sound effects (checklist)

**Combat**

- Light hit, heavy hit, blocked / mitigated, crit sting.
- Player defend, player skill cast (per class or shared + pitch).
- Enemy wind-up (heavy attack telegraph), guard shell, heal tick.
- Victory sting, defeat / down, flee whoosh.

**UI**

- Button tap / confirm, tab change, modal open-close.
- Level-up, rare drop fanfare (subtle), gold pickup.

**Town**

- Shop buy, forge hammer, campfire rest complete, campfire on cooldown deny.

**Ambient (optional later)**

- Town loop (low), adventure loop per region family, combat tension bed.

Format: **short** `.ogg` / `.webm` where possible for size; lazy-load; mute toggle in settings when you add a settings screen.

---

## Optional polish (later)

- Screen shake or flash on heavy hits (subtle, accessibility-off switch).
- Particle bursts on crit or legendary drop (CSS-first).
- Loading skeleton for slow data routes.
- Haptic hooks if wrapping in a native shell (Play Store path).
