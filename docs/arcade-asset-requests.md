# Side Quest Arcade: what I need from CardForge and the dashboard

*Written 2026-11-02, after Prompt 1 (kit, hub, vote backend) and Prompt 2 (Morning Focus with Nova). Hand this to the CardForge session (Prompt 0) and keep the checklist for launch.*

**Everything works without these items.** Missing art is replaced with stand-ins, and missing music is replaced with procedural lo-fi. Each item below makes the arcade look or sound like the real thing, and the site picks it up as soon as the file and its manifest entry land. No code changes are needed.

---

## 1. Path change for CardForge (do this first)

The site is React + Vite on Cloudflare Workers, so static files live under **`public/`**. Change every CardForge target from `<SITE_REPO>\games\…` to:

| CardForge action | Write to |
|---|---|
| Game assets "Copy to site" | `<SITE_REPO>\public\games\assets\maidens\<id>\` |
| Manifest merge | `<SITE_REPO>\public\games\assets\manifest.json` |
| "Open vote" / "Close vote" / "Set video link" | `<SITE_REPO>\public\games\votes\…` (`current.json`, `index.json`, `<set_id>\set.json`, `preview_*.webp`) |

---

## 2. Nova: needed for Focus (highest priority)

Put these files in `public/games/assets/maidens/nova/`.

| File | Spec | What it unlocks |
|---|---|---|
| `cutout.png` | Transparent full body, trimmed, 1024 px tall, < 600 KB, metadata stripped. **One scarf tail.** No halo or fragments. | Nova herself does the Dash |
| `scene_bg.webp` | 1920×1080, the **same frame** as `scene.webp` with Nova removed (inpainted). If it can't be inpainted cleanly, send neither this nor the cutout (see the note below) | The clean background behind her |
| `avatar.png` | 512×512 head and shoulders, transparent | Mini timer mode |
| `card.webp` | 750×1050 portrait card crop, < 250 KB | Share cards ("4 side quests done today") |
| `station_loop.mp3` | 2–3 min loop of Morning Focus, −16 LUFS, crossfaded so it loops with no gap, seed marked "game" in the ledger | Her real station replaces the procedural fallback |

> **Cutout and clean plate go together.** Focus only uses `cutout.png` once `scene_bg.webp` also exists, otherwise Nova would be drawn twice. Until both land, a soft crop of her from `scene.webp` does the Dash and the scene blurs while she's away.

### Placement data, added to Nova's manifest entry

The cutout needs to land where she stands in the scene. Measure against `scene.webp` (all values 0–1):

```json
"cutout_box": { "x": 0.42, "bottom": 0.0, "h": 0.62 },
"roof_y": 0.60
```

- `x`: horizontal centre of her figure ÷ image width.
- `bottom`: gap under her feet ÷ image height (0 if she's cut off at the bottom).
- `h`: her height ÷ image height.
- `roof_y`: height of the rooftop line ÷ image height, where the gold streak runs. Optional (default 0.60).

---

## 3. Briar and Vega: their stations in Focus

Both unlock in Focus after 4 completed sessions. Their `scene.webp` is already in use from `/art/`.

| Maiden | Needed | Nice to have |
|---|---|---|
| Briar | `station_loop.mp3` (Rainfall) | `avatar.png`, `card.webp`, `card_eyes.webp` |
| Vega | `station_loop.mp3` (Neon Signal) | `avatar.png`, `card_eyes.webp` |

The rest of the Prompt 0 list (`chibi.png`, `card_eyes.webp`, `scene_bg.webp` for Briar and Vega) is for Prompts 3–6, not Focus.

---

## 4. Manifest format (merge rules)

`public/games/assets/manifest.json`. **When merging, keep the keys that are already there**: `sfx`, `station_live`, `music`, `focus`. They drive the stand-in audio, the station picker and framing.

```json
{
  "sfx": [],
  "maidens": [
    {
      "id": "nova",
      "name": "Nova",
      "station": "Morning Focus",
      "accent": "#FF9A3D",
      "station_live": true,
      "focus": { "x": 0.42, "y": 0.42 },
      "music": { "bpm": [80, 90], "key": { "root": 52, "mode": "major" }, "mood": "sun" },
      "cutout_box": { "x": 0.42, "bottom": 0.0, "h": 0.62 },
      "roof_y": 0.60,
      "files": {
        "scene": "/art/nova/scene.webp",
        "scene_bg": "maidens/nova/scene_bg.webp",
        "cutout": "maidens/nova/cutout.png",
        "avatar": "maidens/nova/avatar.png",
        "card": "maidens/nova/card.webp",
        "card_eyes": "maidens/nova/card_eyes.webp",
        "chibi": "maidens/nova/chibi.png",
        "station_loop": "maidens/nova/station_loop.mp3"
      }
    }
  ]
}
```

- Relative paths resolve against `public/games/assets/`. Absolute paths (`/art/...`) point at the main site's art.
- **List only files that exist.** A listed file that's missing still falls back cleanly, but adds a wasted request.
- `accent` must match `src/data/maidens.ts` (the site's colours, not the older doc values).

---

## 5. Optional sound effects

The kit synthesises these. Real files sound nicer:

| File (`public/games/assets/sfx/`) | Used for |
|---|---|
| `chime.mp3` | Phase change in Focus, merges in Gem Merge |
| `whoosh.mp3` | Nova's Dash |
| `pop.mp3`, `pour.mp3`, `thunder.mp3` | Later games |

Keep each under 50 KB. **List every file you add in the manifest's `"sfx": ["chime", "whoosh"]`.** Unlisted files are never fetched, which keeps the console free of 404s.

---

## 6. Links: `public/games/config.json`

Anything left empty stays hidden.

| Key | Value |
|---|---|
| `whatnot_url` | Whatnot invite link (Maiden Memory results, Prompt 4) |
| `newsletter_url` | Side Quest Log signup |
| `shop_url` | Shop URL. The hub falls back to `/shop` if empty |
| `patreon_url` | Once Patreon exists. Shows "Hi-res wallpapers for members on Patreon" under past votes |

---

## 7. Cloudflare: before merging to production

1. **`VOTE_SALT` secret:** Workers & Pages → sidequestmaidens → Settings → Variables and Secrets → Add → Secret → name `VOTE_SALT`, a long random value. **Set once, never change.**
2. **Cloudflare Access on `/admin/*`:**
   1. Zero Trust → Access → Applications → Add → Self-hosted.
   2. Domains: `sidequestmaidens.com` and `www.sidequestmaidens.com`, path `admin/*`.
   3. Policy: Allow → Emails → your address only.
3. `STATS_KEY` already exists (it's the same key `/studio/stats` uses). The vote stats page uses it too.
4. Nothing else to set up: the vote store is created automatically by the next deploy.

---

## 8. First real vote

1. Confirm the round one lineup. Proposed: **Tsukiyo, Aurelia, Mimi**.
2. Make one concept image each at matching polish, then run "Vote candidate set" and "Open vote" in CardForge.
3. **Delete the test sets:**
   - remove `public/games/votes/placeholder-open/`, `placeholder-two/` and `placeholder-closed/`
   - remove their entries from `votes/index.json`
   - point `votes/current.json` at the real set
4. Voting is open from `opens` up to, but not including, `closes` (UTC). The `closes` date is announcement day.

---

## Checklist

- [ ] CardForge targets point at `public\games\…`
- [ ] Nova: `cutout.png` + `scene_bg.webp` + `cutout_box` (together), `avatar.png`, `card.webp`, `station_loop.mp3`
- [ ] Briar, Vega: `station_loop.mp3` (+ `avatar.png`)
- [ ] Optional SFX listed in `manifest.sfx`
- [ ] `config.json` links
- [ ] `VOTE_SALT` secret + Cloudflare Access on `/admin/*`
- [ ] Round one lineup confirmed, concept art made, placeholder vote sets deleted
