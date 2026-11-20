# The Maggakes Estate

A 3D luxury-mansion roleplay game for the browser. You work your way up a nine-level mansion by
doing tasks, earning Aura Points, unlocking floors, shopping for clothes, furniture and cars, and
decorating your own bedroom. When you reach the rooftop, **Love Island Mode** unlocks.

**Play:** https://maggakes-estate.sw573bfk.workers.dev

## Who can play

Only the residents can sign in (any capitalisation). Anyone else is kicked at the door:

| Resident | Bedroom | Estate manager (gives VIP, resets passwords) |
| --- | --- | --- |
| Phoebe | Basement (brainrot room) | |
| Serena | Basement (beachy room) | |
| Beau | 1st floor, Guest Bedroom 1 | ✅ |
| Keola | 4th floor (67 + ocean room) | ✅ |
| Jess | 4th floor (concert room) | |
| Ava | 5th floor (coastal + vinyls) | |
| Grace | 5th floor (music room) | |
| Charis | 6th floor | |
| Gabby | 6th floor | |
| Milla | 7th floor (private floor) | ✅ |

The first time a name signs in, that person makes their own password (at least 4 characters).
If someone forgets it, Beau, Milla or Keola can press **Reset password** on the leaderboard,
and the person makes a new one next time.

To change the list, edit `src/shared/people.ts`.

## How it plays

- **Aura Points.** Each floor has 5 tasks worth 200 Aura each. Every 1,000 *Total Aura* unlocks the
  next floor. *Available Aura* is what you spend in the shop. Spending never takes away Total Aura,
  so you can't lose progress.
- **Basement, 1st floor and car park** are open from the start. Your own home floor is always open so
  you can decorate your room, but its tasks only count once you've unlocked it.
- **Replaying** a task gives +50 Available Aura (it doesn't count towards unlocking floors).
- **Daily challenges** (3 a day, plus 1 more for VIPs) give extra Aura.
- **Shop:** outfits, sunglasses, handbags, jewellery, hats, perfume (sparkle trail), furniture and cars.
  Some items need a certain floor, some are VIP-only.
- **Decorate:** stand in your own bedroom and press *Decorate my room*. Everyone on that floor sees it.
- **Car park:** pick a car and paint at the garage, then press *Drive*.
- **Love Island Mode:** couple up with friends or the islanders, win challenges for Villa Points,
  recouple at the firepit, and reach 1,500 Villa Points while coupled to win the final.

Controls: WASD / arrows (or the joystick on phones) to move, drag to turn the camera,
scroll / pinch to zoom, **E** to interact, **Enter** to chat, **1–5** for emotes.

## Developing

```bash
npm install
npm run build          # build the game into dist/
npm run dev:server     # local server + game on http://127.0.0.1:8787
npm test               # game-rule tests
npm run typecheck
npm run deploy         # build + deploy to Cloudflare
```

- `src/shared/` – game rules used by both sides: floors and tasks, shop, saves, Love Island.
- `src/server/` – Cloudflare Worker + one Durable Object that handles sign-in, saves,
  the leaderboard and live multiplayer.
- `src/client/` – the 3D game (three.js). Floors are laid out in `world/layouts.ts`;
  all furniture is built in code in `engine/props.ts`, so there are no model files.

Open the game with `?debug` and run `__checkZones()` in the console to check that every room,
door and task on every floor can be reached on foot.
