# Sword Arena

Free-for-all ball brawler for the browser. You're a ball, swords spin around
you, and anything they touch gets hurt. Grab more swords to build a bigger
spinning shield, throw them at people, then go pick them back up.

## Play

```bash
cd sword-arena
npm install
npm run dev        # open http://localhost:5173
```

`npm run build` produces a static site in `dist/` that any static host can serve.

**Shareable link:** every push to `main` that touches `sword-arena/` is built and
published to GitHub Pages by `.github/workflows/sword-arena-pages.yml`, at
https://sw573bfk-beep.github.io/ball-battle/. One-time setup: repo
**Settings → Pages → Source: GitHub Actions**.

## Controls

| Action | PC | Phone / tablet |
| --- | --- | --- |
| Move | `W` `A` `S` `D` / arrows | left-side stick |
| Aim | mouse | right-side stick |
| Throw sword | `Space` / left click | release the right stick (quick tap = auto-aim) |
| Dash | `Shift` / right click | DASH button |
| Pause / mute | `Esc` / `M` | ❚❚ button |

## Rules

- Swords **orbit** you and damage enemies they touch. Hold up to 8.
- **Throw** sends your best sword at your aim. It sticks where it lands, and
  anyone can pick it up.
- Each sword you carry slows you down a little.
- Enemy blades can **block** a thrown sword. Blades that touch **clash** and
  shove both players apart.
- Tiers: **Iron** (common), **Ruby** (rarer, hits harder), **Gold** (rare, hits hardest).
- **Crates** break into a sword or a health pack. Green pads heal.
- A knockout drops **all** the loser's swords and heals the winner a little.
- First to 15 knockouts wins, or whoever has the most when the 3-minute timer ends.

## Code

```
src/sim/      game rules — no DOM, deterministic (seeded RNG, fixed 60 Hz tick)
  config.ts   every balance number
  world.ts    the simulation step: movement, orbits, throws, pickups, crates, deaths
  bots.ts     bot AI (grid pathfinding + simple goals); outputs the same InputCmd a player does
  maps.ts     arena layout
src/client/   browser only: input (keyboard/mouse/touch), renderer, effects, sound, menus
tests/        sim.test.ts (rules + full bot matches), browser.test.mjs (headless smoke test)
```

Bots and humans both drive the sim only through `InputCmd`, and the sim never
touches the browser. That's what makes **online play** a drop-in later: a server
runs `stepWorld()` (and `thinkBot()` for any bots), clients send inputs and draw
snapshots. The old Ball Combat code in this repo has a Cloudflare Durable Object
room server that's a good template for that.

```bash
npm run verify     # typecheck + sim tests + build + headless browser test
```
