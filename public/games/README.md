# Side Quest Arcade: spec and rules

**Every game session reads this first.** Games are static files in `public/games/<game>/`, served at `/games/<game>/`. Vite copies `public/` into `dist/` unchanged, so there is no build step for games. The vote API runs in the site's Worker (`worker/index.ts`).

> This file is kept out of the deploy by `public/.assetsignore`.

## How this differs from the hand-off doc

The hand-off assumed Cloudflare Pages, a prebuilt bundle and D1. The repo is React + Vite source on **Cloudflare Workers**, so:

| Hand-off said | Built as | Why |
|---|---|---|
| `games/` at repo root | `public/games/` (URL is still `/games/`) | Vite publishes `public/` as-is |
| Pages Functions `functions/api/vote.js`, `functions/admin/votes.js` | Routes in `worker/index.ts` (`/api/vote`, `/api/vote/stats`, `/admin/votes`) | The site is a Worker; `run_worker_first` covers `/api/*` and `/admin/*` |
| D1 + `migrations/0001_votes.sql` | SQLite-backed Durable Object `VoteBox`, same `votes` table and unique key, created in its constructor | Same pattern as `StatsCounter`; no dashboard setup, free plan |
| Nav link patched into built files | `<a href="/games/">Games</a>` in `src/components/Layout.tsx` (header nav + footer "Explore") | Source exists, so it survives rebuilds |
| Accents Nova #FF8A1F, Briar #7EC13A, Vega #16D9E3 | Taken from `src/data/maidens.ts` | Games match the station pages |
| CardForge copies into `<SITE_REPO>\games\...` | Point CardForge at `<SITE_REPO>\public\games\...` | Same layout under `public/` |

## Brand

- Name: Side Quest Maidens.
- Palette: navy `#0B0E16` / `#10141F`, ink `#E9EEF6`, teal `#3DD6C8`, pink `#FF3E8A`.
- Maiden accents (from `src/data/maidens.ts`): Nova `#FF9A3D`, Briar `#8E6CFF`, Vega `#FF3E8A`, Tsukiyo `#B77CFF`, Aurelia `#FFC84A`, Mara `#E3263A`, Mimi `#FF8FC8`, Jackie `#2ED3C6`, Tilt `#B6FF2E`. `assets/manifest.json` carries each one as `accent`.
- Fonts: Space Grotesk (UI) and JetBrains Mono (numbers and technical text), self-hosted OFL variable woff2 files in `assets/fonts/` with their licences.

## Rules

- **The Maidens are rewards and companions, never ranked game pieces.** Never use Maiden art on tiles or as obstacles.
- Never write "No AI".
- Whatnot is for custom Maiden cards only. Never write breaks, packs, pulls, openings or "chase".
- All art is SFW.
- **Rewards:** games reward **votes** and **in-game cosmetics** only (`kit/rewards.js`).
  - The site never offers wallpaper downloads, at any resolution. Wallpapers are Patreon-only and must never be committed to this repo: no `patreon_*` folders, no `wallpaper_*` files.
  - The only vote images on the site are the 960 px watermarked previews, shown view-only: no download buttons, and no links to the image file.
- **Vote copy:** "Cast your vote" / "Choose who's next". Never "pull" or "reveal".
- **Vote rule:** each vote picks which Maiden opens her station next, from 3 labeled candidates (name + station mood), or 2 when the pool runs short. The ones not picked are "still in the running", never "lost" or "eliminated".

## Tech

- Vanilla JS ES modules. No frameworks, no build step, no external CDNs, no trackers, no email gates.
- Each game < 300 KB, excluding art and audio.
- Import the kit with relative paths, e.g. `import { dailySeed } from "../kit/seed.js"`, and link `../kit/theme.css`.

## UX

- Works at 390×844 portrait and on desktop, with touch, mouse and keyboard.
- Respects `prefers-reduced-motion` (theme.css already shortens animations; also skip shakes, flashes and wobble in JS).
- Audio never autoplays: `kit/audio.js` waits for the first gesture. The header has a persistent mute toggle.
- Visible focus states (theme.css provides `:focus-visible`).

## Kit (`kit/`)

| Module | What it gives you |
|---|---|
| `theme.css` | Tokens, font faces, `.btn`, `.panel`, `.eyebrow`, the `.card` frame with gem mark (`.card--back` for backs), the `.ph` placeholder, header, modal, toast and vote styles |
| `assets.js` | `loadMaidens()`, `maiden(id)`, `art(m, kind, {alts, alt})` (img with a placeholder fallback), `loadJSON(rel)`, `loadConfig()` |
| `audio.js` | `playStation(url)` (gapless `AudioBufferSourceNode` loop), `stopStation()`, `setMusicLevel(v)`, `sfx("chime"\|"pop"\|"whoosh"\|"pour"\|"thunder", {pitch})`, mute/volume |
| `seed.js` | `mulberry32`, `hashString`, `today()`, `dailySeed(gameId)`, `dailyRng(gameId)`, `timeUntilReset()`, `shuffle(arr, rng)` |
| `store.js` | `store(ns).get/set/update/del` (keys `sqm:<ns>:<key>`; in-memory if storage is blocked), `recordBest`, `markDaily` (streaks) |
| `rewards.js` | `COSMETICS`, `unlock(id)`, `isUnlocked`, `select(kind, id)`, `meet(maidenId, variant, game)` for the Collection. `codesEnabled = false` (stub) |
| `vote.js` | `earn(gameId)`, `button(gameId)` for results screens, `panel(gameId)`, `available`, `voterId` |
| `share.js` | `share({gameId, maiden, game, result, lines, day, voted, text})`: a 1080×1350 PNG via Web Share, or a download plus copied text. Links carry `utm_source=share&utm_medium=game&utm_campaign=<game>` |
| `ui.js` | `header({title, onHelp})`, `modal`, `toast`, `results({title, stats, voteSlot, onShare, onAgain})`, `h()` element helper |

### Wiring a daily side quest to the vote

```js
import * as vote from "../kit/vote.js";
import { results } from "../kit/ui.js";
// when today's scored daily is finished:
vote.earn("gem-merge");
results({ title: "Daily complete", stats: [["Score", score]], voteSlot: vote.button("gem-merge") });
```

Never interrupt active play with the vote panel; offer it on a results or break screen.

## Data files

- `config.json`: `whatnot_url`, `patreon_url`, `newsletter_url`, `shop_url`. Anything driven by an empty value stays hidden. (The hub's Shop link falls back to `/shop`.)
- `games.json`: `{ games: [{ id, name, blurb, maiden, live, path }] }`. Set `live: true` when a game ships. The vote API only accepts game ids listed here.
- `assets/manifest.json`: `{ maidens: [{ id, name, station, accent, files: { cutout, avatar, card, card_eyes, scene, scene_bg, chibi, station_loop } }] }`. Paths are relative to `games/assets/` (CardForge output, e.g. `maidens/nova/card.webp`) or absolute (`/art/nova/scene.webp`). For now it points at the site's existing `/art/` stills; CardForge "Copy to site" merges real game assets in.
- `votes/current.json`: `{"set_id": "..."}` or `{"set_id": null}`.
- `votes/index.json`: `{"sets": [ids, newest first]}`.
- `votes/<set_id>/set.json`: `{ set_id, kind: "next_maiden", question, options: [{ id, maiden, name, station, label, preview }], opens, closes, winner, closed, video_url }`, plus `preview_<id>.webp` (≤ 960 px wide, watermarked).
  - **Voting is open on `[opens, closes)` UTC.** The closes date is announcement day. Setting `winner` or `closed` also closes it.

**Placeholders:** `votes/placeholder-open` (current, 3 options), `placeholder-two` (open, 2 options) and `placeholder-closed` (closed, winner "b") exist for testing. **Delete them and their `index.json` entries before the first real vote opens.**

## Vote backend

- `POST /api/vote {set_id, option_id, game, voter}`
  - Uses the server's UTC day, never the client's.
  - Rejects with `unknown_set` 404, `closed` 409, `invalid_option` / `invalid_game` / `invalid` 400, or `rate_limited` 429 (more than 25 votes from one IP per day).
  - A duplicate `(set, game, day, voter)` returns 200 with `already: true`.
  - Responds with percentages per option.
- `GET /api/vote?set_id=&voter=` → `{voted_today_games, voted_option, tally}`. The tally is null until this voter has voted in the set.
- **Stored per vote:** `SHA-256(VOTE_SALT + voter)` and `SHA-256(VOTE_SALT + day + IP)`. No raw IP, user agent or email.
- Completion is verified client-side only, so votes are low-stakes signals. **Unique voters are the number to trust.**
- **Stats:** `/admin/votes` (page) → `/api/vote/stats` (JSON, needs `Authorization: Bearer <STATS_KEY>`, the same key as `/studio/stats`). It shows total votes, unique voters, and per option (by label), per game and per day.

### One-time setup (Cloudflare dashboard)

1. **`VOTE_SALT` secret:** Workers & Pages → sidequestmaidens → Settings → Variables and Secrets → Add → type **Secret**, name `VOTE_SALT`, a long random value. Set it once and never change it: changing it resets duplicate detection. Locally, put it in `.dev.vars`.
2. **Durable Object:** the `VoteBox` class is created by the `v2` migration in `wrangler.jsonc` on the next deploy. Nothing to click.
3. **Before merging to production, protect `/admin/*` with Cloudflare Access:** Zero Trust → Access → Applications → Add → Self-hosted.
   - Domain: `sidequestmaidens.com`, path `admin/*` (add `www.sidequestmaidens.com` too).
   - Policy: Allow, Include → Emails → the owner's email only.
   - The stats JSON also needs `STATS_KEY`, so Access is a second lock.

## Main-site changes made for the arcade

- `src/components/Layout.tsx`: a "Games" link in the header nav and "Side Quests" in the footer's Explore column. Both are plain `<a href="/games/">` (a full page load, outside the React router).
- `wrangler.jsonc`:
  - `assets.binding: "ASSETS"` (the vote API reads `set.json` and `games.json`)
  - `run_worker_first` adds `/admin/*`
  - a `VOTES` Durable Object binding and the `v2` migration
- `public/_redirects` is unchanged. Its `/go/*` lines don't touch `/games/`, `/api/*` or `/admin/*`; Worker routes run before redirects anyway.

## Testing locally

```bash
npm run build && npx wrangler dev   # http://localhost:8787/games/  (Worker + local Durable Objects)
```

Use `.dev.vars` with `STATS_KEY=...` and `VOTE_SALT=...`. `npm run dev` (Vite) serves the static games but not the vote API.
