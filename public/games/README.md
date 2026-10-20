# Side Quest Arcade: read this first

Every games session starts here. This is the spec for `/games/`: the brand rules, the tech rules,
and the shared kit that every game builds on. Prompts written before this repo was checked say
`games/…` and "Cloudflare Pages". In this repo the games live in **`public/games/`**, and the site
is a **Cloudflare Worker with static assets** (`wrangler.jsonc`), not Pages. Read every
`games/<x>` path in those prompts as `public/games/<x>`.

This file is kept off the live site by `public/.assetsignore`.

## Brand

- **Name:** Side Quest Maidens. The hub is "Side Quests".
- **Palette:** navy `#0B0E16` / `#10141F`, ink `#E9EEF6`, teal `#3DD6C8`, pink `#FF3E8A`.
- **Maiden accents (games):** Nova `#FF8A1F`, Briar `#7EC13A`, Vega `#16D9E3`. The other six
  use their site colours from `src/data/maidens.ts`. All accents come from
  `assets/manifest.json`, so read `maiden.accent` and never hard-code them.
  - Note: the main site uses different station colours for these three (Nova `#FF9A3D`,
    Briar `#8E6CFF`, Vega `#FF3E8A`). The games follow the arcade spec. If the CardForge
    bible says otherwise, change `manifest.json` and nothing else.
- **Fonts:** Space Grotesk (UI), JetBrains Mono (numbers, technical text). Both are self-hosted
  OFL variable woff2 files in `assets/fonts/` (Latin subset, licences alongside), and
  `kit/theme.css` declares them.

## Rules (non-negotiable)

1. **Maidens are rewards and companions, never ranked game pieces.** No Maiden art on tiles you
   merge, discard or beat. Reveal copy celebrates ("Briar joined your party") and never ranks
   anyone ("rarest", "best", "tier").
2. **Never write "No AI".**
3. **Whatnot means custom Maiden cards.** Never write breaks, packs, pulls, openings or "chase".
4. **All art is SFW.**
5. **Tech:** vanilla JS ES modules, no frameworks, no build step, no external CDNs, no trackers,
   no email gates. Every request stays on our own origin. Each game is under 300 KB, art and
   audio excluded.
6. **UX:** works at 390×844 portrait and on desktop. Touch, mouse and keyboard. Respect
   `prefers-reduced-motion` (`ui.reducedMotion()`). Audio never autoplays: it starts on the
   first user gesture, and the mute toggle persists. Focus states stay visible.
7. **No backend.** Scores, streaks and unlocks live in localStorage through `kit/store.js`.

## Layout

```
public/games/
  README.md            this file (not deployed)
  index.html hub.js hub.css   the hub
  games.json           hub tiles and the daily rotation
  kit/                 shared ES modules (below)
  assets/
    manifest.json      the cast: id, name, station, accent, bpm, files
    fonts/             woff2 + OFL licences
    maidens/<id>/      CardForge game-asset export drops files here
    sfx/               optional SFX files (see config.sfxFiles)
  <game>/index.html    one folder per game: focus, gem-merge, memory, potion-sort, nova-dash
```

Vite copies `public/` into `dist/` verbatim, so nothing in here is bundled or transformed.
`/games/` is a separate static app, outside the React router. The Worker serves
`dist/games/index.html` directly. An unknown path under `/games/` with no extension falls through
to the SPA's 404 page (`not_found_handling: single-page-application`).

A new game:

```html
<link rel="stylesheet" href="../kit/theme.css" />
<script type="module">
  import { header, results, toast, reducedMotion } from "../kit/ui.js";
  import { getMaiden } from "../kit/assets.js";
  import { playStation, sfx } from "../kit/audio.js";
  import { createStore } from "../kit/store.js";
  import { dailyRng } from "../kit/seed.js";
  import * as rewards from "../kit/rewards.js";
  header({ title: "Gem Merge", help: "Swipe to slide…" });
</script>
```

To launch it, set its `status` to `"live"` in `games.json`. `"daily": true` adds it to the
"Today's Side Quest" rotation, and the hub links the banner to `<href>?mode=daily`.

## Kit API

| Module | What it gives you |
|---|---|
| `theme.css` | Tokens (`--navy`, `--accent`, …), fonts, `.btn` / `.btn--ghost` / `.icon-btn`, `.panel`, `.sq-card` frame (5:7, gem badge, `--accent` border), `.sq-card--back` (navy, gem, `--back-ring` ring, teal by default), header, modal, toast and results styles, plus a reduced-motion reset. |
| `assets.js` | `loadMaidens()` returns the cast (never rejects; falls back to a built-in Nova/Briar/Vega with no files). `getMaiden(id)`. Each Maiden has `.file(...keys)` (URL or null) and `.art(...keys)` (URL or placeholder). `loadImage(maiden, ...keys)` gives an `<img>` that falls back to the placeholder on 404. `setImage(imgEl, maiden, ...keys)`. `placeholder(maiden, kind)` returns an accent silhouette (`card`, `scene`, `avatar`, `cutout`, `wallpaper_*`). |
| `audio.js` | `playStation(maiden)` loops `station_loop.mp3` gaplessly (an AudioBufferSourceNode loop) or, until that file exists, a quiet procedural pad. `stopStation()`. `setStationLevel(0–1)` (e.g. quieter breaks). `sfx("chime" \| "pop" \| "whoosh" \| "pour" \| "thunder", { pitch })` uses generated tones; `pitch` is in semitones. `toggleMute()`, `isMuted()`, `onMuteChange(fn)`, `setVolume()`. All persisted. Nothing sounds before the first gesture. |
| `seed.js` | `dailySeed(gameId, date?)` is the same for everyone on a UTC date. `dailyRng(gameId)` and `createRng(seed)` give `{ next, int, pick, chance, shuffle }` (mulberry32). Also `todayString()`, `dayNumber()`, `msUntilReset()`, `timeUntilReset()`. |
| `store.js` | `createStore(gameId)` is namespaced `sqm:<game>:<key>` with JSON values, and works with storage blocked (in-memory). Methods: `get/set/update/remove`, `best(key, value, { lower })`, `recordDaily(result)` (first result per UTC day is scored; later ones return `scored: false`), `getDaily()`, `getStreak()`. `persistent` is false when progress won't survive the tab. |
| `rewards.js` | Catalogue per Maiden: `wallpaper:<id>:phone`, `wallpaper:<id>:desktop`, `cardback:<id>`, `background:<id>`. `define()` adds game-specific ones. `unlock(id, { source })` returns `{ reward, isNew, code }`. Also `isUnlocked`, `unlocked()`, `catalogue()`, `collectedMaidenIds()`. A wallpaper whose file isn't exported yet unlocks with `pending: true`, and the hub shows "File on its way". |
| `share.js` | `renderShareCard(opts)` draws a 1080×1350 canvas: art, game, result, detail, an optional emoji grid, the daily date, gem and URL. `share(opts)` uses the Web Share API with the file, falling back to a PNG download plus copied text. `shareLink(gameId)` adds `?utm_source=share&utm_medium=game&utm_campaign=<game>`. |
| `ui.js` | `header({ title, help, mute })`, `modal({ title, content })` (a `<dialog>`: Esc, focus trap, focus restored), `toast(msg)` (aria-live), `results({ title, subtitle, stats, note, share, actions })`, `reducedMotion()`, `el()`. |
| `config.js` | Site and shop links, `whatnot` (`/go/whatnot`, see `public/_redirects`), `rewards.codesEnabled` (false) and `codes`, `sfxFiles`. Client-side codes are visible to anyone, so only use low-value or Shopify single-use codes. |

## Manifest (`assets/manifest.json`)

```json
{ "version": 1, "maidens": [
  { "id": "nova", "name": "Nova", "station": "Morning Focus", "accent": "#FF8A1F", "bpm": [80, 90],
    "files": ["cutout.png", "avatar.png", "card.webp", "card_eyes.webp", "scene.webp", "scene_bg.webp",
              "chibi.png", "wallpaper_phone.webp", "wallpaper_desktop.webp", "station_loop.mp3"] } ] }
```

`files` is either a **list of filenames**, which resolves to `assets/maidens/<id>/<file>` with the
key being the filename stem (the CardForge fragment format), or an **object** of
`key → path`, where a path starting with `/` is site-absolute. Today the manifest is seeded from
the existing site art in `public/art/` as objects. When the CardForge export's "Copy to site" runs,
its target is `<SITE_REPO>\public\games\assets\maidens\<id>\`, and it merges its list into this
file. Keys games look for: `cutout`, `avatar`, `card`, `card_eyes`, `scene`, `scene_bg`,
`scene_sm`, `card_sm`, `chibi`, `wallpaper_phone`, `wallpaper_desktop`, `station_loop`.

## Main-site link

The site is React source (not a prebuilt bundle), so the "Games" link is a normal source edit:

- `src/lib/paths.ts`: `GAMES` is `/games/`, or the live URL in the preview build, which doesn't
  carry `public/games`.
- `src/components/Layout.tsx`: `<a href={GAMES}>Games</a>` in the header nav, and "Side Quests"
  in the footer's Explore column. These are plain `<a>` tags, not router `<Link>`s, so the
  browser leaves the SPA.

## Testing

```bash
npm run build && npm run test:games              # serves dist/ and runs Playwright headless
SHOTS=/tmp/shots npm run test:games              # also saves screenshots and the share card
APP_URL=https://<preview>.workers.dev npm run test:games   # against a deployed build
```

`scripts/test-games.mjs` covers the hub at 390×844 and 1440×900 (no console errors, no
off-origin requests, local fonts, no horizontal scroll), missing-manifest and 404 placeholders,
daily-seed determinism, storage blocked, store streak logic, rewards to Collection, the share card
PNG and its download fallback, the UI kit, the audio gesture gate, and the site nav link. **Each
game adds its own checks to this file.**
