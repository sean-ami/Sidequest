# Side Quest Arcade: what I need from CardForge and the dashboard

*Written 2026-11-02, after Prompt 1 (kit, hub, vote backend) and Prompt 2 (Morning Focus with Nova). Hand this to the CardForge session (Prompt 0) and keep the checklist for launch.*

**Everything works without these items.** Missing art is replaced with stand-ins, and missing music is replaced with procedural lo-fi. Each item below makes the arcade look or sound like the real thing, and the site picks it up as soon as the file and its manifest entry land. No code changes are needed.

---

## 0. Answers to the CardForge update (2026-11-02)

The retargeted export matches what the site expects. Answers to the three questions:

1. **Relative `files.scene` override: yes.** Relative paths resolve against `public/games/assets/`, so `maidens/nova/scene.webp` replaces `/art/nova/scene.webp` for the games only. The main site's station page keeps its own still.
   - When `cutout.png` **and** `scene_bg.webp` are both listed, Focus draws `scene_bg` with the cutout on top.
   - `scene.webp` is used only as the stand-in when one of them is missing.
2. **`h: 1.0`, `bottom: 0`: fine.**
   - The background, cutout and gold streak now share one box that's scaled and cropped exactly like the image. Your `cutout_box` and `roof_y: 0.72` therefore map 1:1 on every screen shape.
   - Tested with a synthetic full-height cutout at your measured box. Cutout-over-plate matched the plain scene to within 0.05% of pixels (antialiased edges only) at 390×844, 1440×900 and 1280×1024.
   - The Dash's lean was halved so a full-height figure doesn't swing too far.
   - The baked golden aura is fine; the charge glow builds on it.
3. **Dash clips: yes, please.** Hand-animated beats moving a cutout in code. Spec below. Until they arrive, the code Dash runs, and it stays as the fallback (plus a fade under reduced motion).

### Dash clip spec

Split the one 86-frame event into **two clips**, because Focus plays them at different moments (break start, and focus resume 5–15 minutes later):

| Clip | Starts | Ends | Cues |
|---|---|---|---|
| `dash_out` | Exactly on `scene.webp` (Nova present) | Exactly on `scene_bg.webp` (empty plate), after the sparkles settle | `whoosh_out`, sparkles |
| `dash_in` | Exactly on `scene_bg.webp` | Exactly on `scene.webp` | `whoosh_in` |

- **Composited over the plate, full frame, no alpha.** Use the same camera and frame as `scene.webp`, so the still → video → still swap is invisible. Skipping alpha avoids WebM-alpha / HEVC-alpha browser gaps.
- **Formats:** MP4 H.264 (High, yuv420p, BT.709 tagged, `+faststart`), plus an optional WebM VP9. No audio track: the code plays the SFX from your cues.
- **Sizes:** 1920×1080 and 960×540 (phones), 24 fps.
- **Budget:** about 1.5 MB per 1080p clip, about 0.5 MB per 540p clip.
- **Colour:** grade the clip to match the WebP stills. A gamma or range shift would show as a flash at the swap, so check the first and last frames against the stills.
- **Files:** `maidens/nova/dash_out.mp4`, `dash_out_sm.mp4`, `dash_in.mp4`, `dash_in_sm.mp4` (+ `.webm` if made).
- **Manifest:** a block on Nova, with cue times in frames relative to each clip:

```json
"dash": {
  "fps": 24,
  "out": { "src": "maidens/nova/dash_out.mp4", "src_sm": "maidens/nova/dash_out_sm.mp4",
           "webm": "maidens/nova/dash_out.webm", "webm_sm": "maidens/nova/dash_out_sm.webm",
           "cues": { "whoosh_out": 5, "sparkles": [24, 36, 48, 54] } },
  "in":  { "src": "maidens/nova/dash_in.mp4",  "src_sm": "maidens/nova/dash_in_sm.mp4",
           "webm": "maidens/nova/dash_in.webm", "webm_sm": "maidens/nova/dash_in_sm.webm",
           "cues": { "whoosh_in": 4 } }
}
```

**Site side: done (2026-11-03).** Focus plays the clips in the same scene box as the stills, exactly as CardForge built them (the cue frames and `webm` / `webm_sm` keys above):

- **Loading:** the clips download on the first Start, not on page load. Phones and small screens get the 540p files. Browsers that can play WebM VP9 get WebM; the rest get the MP4.
- **Swap:** at a break, the clip's first frame covers the cutout, then plays to the empty plate. When focus resumes, `dash_in` plays from the plate and hands back to the cutout on the still.
- **Sound:** whoosh and sparkle sounds are triggered at the cue frames.
- **Fallbacks:** the code Dash runs if a clip is missing, fails, or the tab is hidden. Reduced motion uses a fade and never downloads the clips.
- **Tested** with synthetic clips built to this contract. Clip frame 0 matched the composited stills within about 1 of 255 on average (compression loss only).
- **Not yet checked:** CardForge's real files in a real browser. Do that once they're committed.

**Re-render rule:** the clips only match the stills they were rendered from. If Nova's station set (scene, plate, cutout) is ever regenerated, re-run `game_dash.py` and copy clips and stills together.

**Vega already has a manifest entry** on the site (accent `#FF3E8A`, from `src/data/maidens.ts`), so the merge keeps that.

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
| `cutout.png` | Transparent full body, trimmed, ≤ 1024 px tall, < 600 KB, metadata stripped. **One scarf tail.** No halo or fragments. | Nova herself does the Dash |
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
- `h`: her height ÷ image height (1.0 is fine for a full-height figure).
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
