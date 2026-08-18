# Ball Combat

Fast, chaotic 2D ball-arena combat for the browser. Dash, wall-bounce, shoot,
and one-shot people with a sword. Built to be understood in five seconds and
argued about for an hour.

**Play:** deployed on Vercel (see the repo's Deployments).

## Controls

| Action | Key |
| --- | --- |
| Move | `W` `A` `S` `D` |
| Aim | Mouse |
| Dash | `Space` |
| Gun | Left click *(Milestone 2)* |
| Sword | Right click / `E` *(Milestone 2)* |
| Debug overlay | `F1` |

Dash into a wall to **bounce** off it. Touching a wall **refreshes your dash**,
so chaining wall-dashes is the fastest way around the arena.

## Architecture

```
shared/     framework-free, DOM-free, deterministic game code
  config.ts   every balance number in the game — nothing is hard-coded elsewhere
  math.ts     vectors, damping, circle-vs-AABB collision
  types.ts    player state, input commands, map/world types
  maps.ts     arena definitions
  sim.ts      the authoritative fixed-timestep simulation
client/     rendering, input, effects, UI
server/     Cloudflare Worker + Durable Object room server (Milestone 4)
tests/      simulation unit tests + headless browser smoke test
```

`shared/sim.ts` is deterministic and has no dependency on the browser, so the
exact same code runs as client-side prediction and as the server's authority.
That is what makes server-authoritative multiplayer cheap to add later instead
of a rewrite.

Hosting split: **Vercel** serves the client, **Cloudflare Durable Objects** will
host the rooms (one object per room code = a natural authoritative game server).

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm run verify     # typecheck + sim tests + build + headless browser test
```

## Milestones

- [x] **M0** Project foundation, deploy pipeline
- [x] **M1** Core movement: dash, wall slide, wall dash, wall bounce
- [ ] **M2** Combat: gun, sword, health
- [ ] **M3** Death, respawn, scoreboard
- [ ] **M4** Multiplayer (1v1, server-authoritative)
- [ ] **M5**–**M18** Match system, teams, modes, maps, powerups, polish
