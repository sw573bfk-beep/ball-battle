# QuizClash

Live quiz games for classes and friends. Make a quiz in seconds by pasting from any AI, host it with a 6-digit PIN, and let players earn coins to unlock skins.

Everything runs on **Cloudflare**: one Worker serves the website and the API, **D1** is the database (accounts, question sets, coins, skins), a **Durable Object** per game PIN runs each live game, and **Workers AI** writes questions.

## Features

### Making questions without typing them
- **Paste from your own AI.** Type a topic (or paste notes), hit **Copy AI prompt**, paste it into ChatGPT, Claude or Gemini, then paste the answer back. A live preview shows how many questions were found.
- **Built-in AI.** Type a topic and Cloudflare Workers AI writes the questions (25 per account per day).
- **Flashcards / word lists.** One `term - definition` per line. The wrong answers are made from your other cards, so vocab lists and Quizlet exports work.
- The paste importer understands most formats:
  - numbered questions with `A)` / `a.` / `1.` options
  - `Answer: B`, `Correct answer: Paris`, or an answer key at the bottom
  - correct answers marked with `*`, `✓` or `(correct)`
  - markdown bold, true/false, `Q:` / `A:` pairs
  - JSON, CSV with a header row, and tab-separated `question / right / wrong / wrong`
- Questions with problems are highlighted red, so you can pick the right answer by hand.

### Game modes
| Mode | How it works |
| --- | --- |
| **Live Quiz** | The host's big screen shows each question with a timer. Players answer on their phones. Faster answers score more, and streaks add a bonus. Each question ends with a reveal, an answer chart and a leaderboard, then a podium at the end. |
| **Cash Race** | Self-paced. Each correct answer earns cash. Spend it on upgrades: cash per answer, multiplier, streak bonus, and a mistake shield. First to the goal (or richest when time runs out) wins. |
| **Treasure Steal** | Self-paced. A correct answer lets you pick 1 of 3 chests: gold, +%, double, triple, lose some, swap with someone, or steal from someone you choose. The host screen shows a live feed. |

### Accounts, coins and skins
- Sign up with a username and password. New accounts get 100 coins, plus 50 more from a daily bonus.
- Logged-in players earn coins after each game (up to 100), based on correct answers and placement. Guests can play but don't earn coins.
- **4 boxes and 40 original blob skins** across 6 rarities (Common → Mythic). Duplicates refund coins. Equip a skin in the **Locker** and it shows in every lobby and leaderboard.
- Sets can be private or **public**. Anyone can find public sets in **Discover**, then host them or copy them.

## Put it online (Cloudflare, free plan works)

1. **Make a Cloudflare account** at <https://dash.cloudflare.com/sign-up>. Open **Workers & Pages** once so your free `*.workers.dev` subdomain gets set up.
2. **Create an API token**: <https://dash.cloudflare.com/profile/api-tokens> → *Create Token* → *Edit Cloudflare Workers* template → *Add more* and add **Account · D1 · Edit** and **Account · Workers AI · Read**. Create it and copy the token.
3. **Find your Account ID**: it's on the right side of the Workers & Pages overview page.
4. In this GitHub repo: **Settings → Secrets and variables → Actions → New repository secret**, then add:
   - `CLOUDFLARE_API_TOKEN` = the token
   - `CLOUDFLARE_ACCOUNT_ID` = the account ID
5. Push to `main` (or run the workflow from the **Actions** tab). The workflow runs the tests, creates the D1 database the first time (in the Oceania region; set `D1_LOCATION` to change it), applies migrations and deploys. The site goes live at `https://quizclash.<your-subdomain>.workers.dev`.

To deploy from your own computer instead: `npx wrangler login`, then `npm run deploy`.

## Local development

```bash
npm install
npm run dev          # http://127.0.0.1:8787 (local D1, fake AI so no Cloudflare account needed)
npm run typecheck
npm test             # parser + skins/rules unit tests
npm run test:e2e     # full browser test of every flow (needs `npm run dev` running and Playwright installed)
```

`wrangler.local.toml` is the same as `wrangler.toml` except it has no AI binding, because Workers AI only runs on Cloudflare. It returns mock questions instead.

## Layout

```
public/            the website (plain HTML/CSS/JS, no build step)
  js/parse.js      paste importer + AI prompt builder   (shared with the server)
  js/skins.js      skins, boxes, odds, SVG drawing      (shared)
  js/rules.js      game-mode rules and scoring          (shared)
  js/app.js        router, home, auth, dashboard, discover, host setup
  js/editor.js     question set editor + import tools
  js/host.js       host big-screen view
  js/play.js       player phone view
  js/shop.js       shop + locker
src/
  worker.ts        API routes
  auth.ts          accounts + sessions (PBKDF2 password hashing)
  room.ts          GameRoom Durable Object: the live game server for all 3 modes
  ai.ts            Workers AI question generation
migrations/        D1 schema
```
