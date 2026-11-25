# Browser & server tests

Run against a local server (`npm run build && npm run dev:server`), with a fresh state
(`rm -rf .wrangler/state` first). Each prints ✓ / ✗ lines.

| Script | What it checks |
| --- | --- |
| `check.mjs` | every room, door and station on every floor is reachable |
| `e2e.mjs` | sign-in, tasks, shop, wardrobe, multiplayer, VIP |
| `e2e2.mjs` | progression through all floors, decorating, cars, villa |
| `e2e3.mjs` | a full Love Island season through the screens |
| `e2e4.mjs` | sign-ups, approval, residence floors, admin tools |
| `e2e5.mjs` | mini karts, pets, spin, shells, fireworks, party, tag, race, slide |
| `e2e6.mjs` | stuck-moment fix, break-ups, problem reports |
| `e2e7.mjs` | customisation: colours, mix & match, saved outfits, profiles, room style, furniture editing, car/kart/pet colours |
| `e2e8.mjs` | the six newer mini-games (catch, memory, rhythm, spot, maze, unscramble) can be won |
| `e2e9.mjs` | outside world (beach, mall, town) and quests: travel, talk to the Mayor, accept, complete, claim (`--render` for screenshots) |
| `e2e10.mjs` | Staff Chat: admins + VIPs only, added when given VIP/admin, kicked when it is taken away |
| `e2e11.mjs` | soccer stadium: live match, bots fill teams, friends balance, kicking (`--render` for a screenshot) |
| `e2e12.mjs` | progression: streak claim (once a day), collection book, pet level & tricks, estate upgrades in order |
| `aura-audit*.mjs` | every way to earn/spend Aura; run `aura-after-restart*.mjs` after restarting the server |

They use the machine's Playwright install (`/opt/node-tools/node_modules/playwright`); change that import path if yours is elsewhere.
