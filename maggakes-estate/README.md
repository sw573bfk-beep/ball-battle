# The Maggakes Estate

A 3D luxury-mansion roleplay game for the browser. You work your way up a nine-level mansion by
doing tasks, earning Aura Points, unlocking floors, shopping for clothes, furniture and cars, and
decorating your own bedroom. When you reach the rooftop, **Love Island Mode** unlocks.

**Play:** https://maggakes-estate.sw573bfk.workers.dev

## Who can play

**Anyone can make an account** — they pick a username (3–16 letters, numbers or _) and a password.
New accounts wait until an **admin approves** them. Admins see a red badge on the 👥 **Admin** button
and approve or reject from the Accounts page. Every two approved newcomers get a brand-new
**Residence floor** with two bedrooms they can decorate.

- **Admins:** Beau (main admin — only Beau can ban, demote or reset Beau), Keola and Milla.
  Admins can approve/reject sign-ups, give/remove VIP, reset passwords, ban/unban and make other admins.
- **VIPs** can see every account but can't change anything.
- Passwords are scrambled (hashed) — nobody can read them, only reset them.

The 10 original residents keep their bedrooms on the original floor plan:
Phoebe & Serena (Basement), Beau (1st floor guest room), Keola & Jess (4th), Ava & Grace (5th),
Charis & Gabby (6th), Milla (7th).

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
- **Car park:** pick a car, paint and wheels at the garage, then press *Drive*.
- **Love Island Mode:** couple up with friends or the islanders, win challenges for Villa Points,
  recouple at the firepit, and reach 1,500 Villa Points while coupled to win the final.

- **🎉 Fun menu (F):** hop in a **mini kart** and drive on any floor, **daily spin wheel**, **party**
  (disco lights + music; dancing earns Aura), **tag** with friends, **fireworks** (buy in the shop),
  your **pet** (adopt a puppy, kitten or bunny at the 2nd floor Pet Room — it follows you everywhere),
  **golden shell** tracker (30 hidden around the mansion, +1,000 Aura for finding them all) and **music**.
- **🏁 Kart race** at the car park (lap timer + best-lap board) and a **🌊 water slide** on the rooftop.
- **Day & night:** a shared 20-minute day — sunrise, sunset and starry nights for everyone at once.
- **🎨 Make it yours.** Almost everything can be changed:
  - **Wardrobe** has five tabs. *Look*: any colour skin, hair, eyes and lips, plus build, height,
    hairstyle and facial hair. *Clothes*: a shop outfit or 🧩 mix & match (9 tops, 8 bottoms,
    7 shoes) in any colour. *Extras*: accessories. *Saved*: 6 named outfit slots. *Profile*: name-tag
    colour, a badge and a short bio. Walk up to another player and press *👤 profile* to read theirs.
  - **Bedroom:** in *Decorate*, give a piece of furniture any colour and size before placing it.
    *✏️ Edit nearest* lets you recolour, resize, spin, move or put away something already placed.
    *🎨 Walls & floor* sets any wall colour, 11 floor styles and a floor tint.
  - **Garage:** any paint colour and any wheel colour for every car, including the Mini Kart.
  - **Pets:** any fur and collar colour.

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
