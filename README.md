# sidequestforge.com

The Side Quest Forge site: React + Vite, served from Cloudflare Workers (static assets plus a small edge API).

## Run it

```bash
npm install
npm run dev        # Vite dev server with hot reload, http://localhost:5173
npm run preview    # production build served by the real Workers runtime, http://localhost:8787
npm run deploy     # build and deploy to Cloudflare (first time: `npx wrangler login`)
```

## What's where

| Path | What it is |
|---|---|
| `src/data/maidens.ts` | **The cast**: stations, colours, BPM, keys and art paths. Edit this first. |
| `public/art/<slug>/` | Art drop-in. `scene.webp` (1920w) + `scene-sm.webp` (960w), optional `card.webp`. |
| `public/_redirects` | `/go/youtube`, `/go/whatnot`… Video descriptions link here, so one edit re-points every upload. |
| `src/components/ForgeCanvas.tsx` | three.js hero: shader nebula + embers tinted by the tuned station, floating diamond. |
| `src/components/StationDial.tsx` | Radio tuner (drag, click, or arrow keys). Re-themes the whole site per station. |
| `src/components/ParallaxScene.tsx` | Station scene: pointer/tilt parallax, mood particles, Vega's bubble pop. |
| `src/components/Atmosphere.tsx` | Canvas particles per mood: rain + lightning, neon, sun motes, petals, stars… |
| `src/components/HoloCard.tsx` | Trading-card gallery with holo foil, glare and flip. |
| `src/audio/ambience.ts` | Procedural Web Audio lo-fi in each station's key and tempo; thunder and pop SFX. |
| `worker/index.ts` | Edge API (`/api/*` only). Future home of the Shopify Storefront proxy. |

## Routes

`/` · `/maidens` · `/shop` · `/live` · `/<slug>` per Maiden (`/briar`, `/vega`, …, the per-video link slugs) · `/studio` (internal print-crop checker, `noindex`).

## Adding a Maiden's art

1. Export a 16:9 still and convert it:
   ```bash
   python3 -c "from PIL import Image; im=Image.open('in.png').convert('RGB'); [im.resize((w, w*im.height//im.width), Image.LANCZOS).save(f'public/art/tsukiyo/scene{s}.webp', quality=82, method=6) for w,s in ((1920,''),(960,'-sm'))]"
   ```
2. In `maidens.ts`, add `art: a("tsukiyo", { focus: { x: 0.55, y: 0.4 } })`. `focus` is where her face is, 0–1. It anchors the glow and keeps her on screen on phones.
3. Open `/studio` to check the scene against the locked print crops (§11 of the strategy).

## Deploy to sidequestforge.com

1. `npx wrangler login`, then `npm run deploy`. You get a `*.workers.dev` URL.
2. Uncomment `routes` in `wrangler.jsonc` (custom domains for the apex and `www`) and deploy again. Cloudflare creates the DNS records since the zone is already on your account.
3. Optional: connect this repo in **Workers & Pages → your worker → Settings → Builds** so every push to `main` deploys.
