// Browser checks for the Side Quest Arcade (public/games/). Run `npm run test:games`.
// Builds nothing itself: it serves dist/ (run `npm run build` first), or tests APP_URL if set.
// SHOTS=<dir> saves screenshots and the rendered share card there.

import { createServer } from "node:http";
import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";

const ROOT = new URL("../dist/", import.meta.url).pathname;
const SHOTS = process.env.SHOTS || "";
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".txt": "text/plain",
};

/** Static server mimicking Workers assets: dir → index.html, unknown extensionless → SPA index. */
function serve() {
  const server = createServer(async (req, res) => {
    let path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
    let file = join(ROOT, path);
    try {
      let s = await stat(file).catch(() => null);
      if (s?.isDirectory()) {
        file = join(file, "index.html");
        s = await stat(file).catch(() => null);
      }
      if (!s) {
        if (extname(path)) throw new Error("404");
        file = join(ROOT, "index.html");
      }
      res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" });
      res.end(await readFile(file));
    } catch {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("not found");
    }
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

let failures = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`  ok  ${name}`);
  } catch (e) {
    failures++;
    console.log(`FAIL  ${name}\n      ${e.message.split("\n").join("\n      ")}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

/** Opens a page that records console errors, page errors and off-origin requests. */
async function open(context, url, { allow = [] } = {}) {
  const page = await context.newPage();
  const errors = [];
  const external = [];
  const origin = new URL(url).origin;
  page.on("console", (m) => m.type() === "error" && !allow.some((a) => m.text().includes(a)) && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("request", (r) => {
    const u = r.url();
    if (!u.startsWith(origin) && !u.startsWith("data:") && !u.startsWith("blob:")) external.push(u);
  });
  await page.goto(url);
  return { page, errors, external };
}

const server = process.env.APP_URL ? null : await serve();
const BASE = process.env.APP_URL || `http://127.0.0.1:${server.address().port}`;
const HUB = `${BASE}/games/`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
if (SHOTS) await mkdir(SHOTS, { recursive: true });
console.log(`Testing ${HUB}`);

for (const [w, h] of [[390, 844], [1440, 900]]) {
  await test(`hub loads clean at ${w}x${h} (no console errors, no external requests, local fonts)`, async () => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w < 500 ? 3 : 1 });
    const { page, errors, external } = await open(ctx, HUB);
    await page.waitForSelector("html[data-ready]");
    await page.evaluate(() => document.fonts.ready);
    const fonts = await page.evaluate(() => ({
      grotesk: document.fonts.check('600 16px "Space Grotesk"'),
      mono: document.fonts.check('400 16px "JetBrains Mono"'),
      loaded: [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family),
    }));
    await page.waitForFunction(() => [...document.images].every((i) => i.complete));
    const tiles = await page.locator("#tiles li").count();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (SHOTS) await page.screenshot({ path: join(SHOTS, `hub-${w}.png`), fullPage: true });
    await ctx.close();
    assert(errors.length === 0, `console errors: ${errors.join(" | ")}`);
    assert(external.length === 0, `external requests: ${external.join(", ")}`);
    assert(fonts.loaded.includes("Space Grotesk") && fonts.loaded.includes("JetBrains Mono"), `fonts not loaded locally: ${JSON.stringify(fonts)}`);
    assert(tiles === 5, `expected 5 tiles, got ${tiles}`);
    assert(overflow <= 0, `horizontal overflow ${overflow}px`);
  });
}

await test("missing manifest falls back to placeholder art", async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route("**/games/assets/manifest.json", (r) => r.fulfill({ status: 404, body: "" }));
  const { page, errors } = await open(ctx, HUB, { allow: ["404"] });
  await page.waitForSelector("html[data-ready]");
  const imgs = await page.$$eval("#tiles img, #today-art", (els) => els.map((e) => ({ ph: e.dataset.placeholder, src: e.src.slice(0, 20), ok: e.complete && e.naturalWidth > 0 })));
  if (SHOTS) await page.screenshot({ path: join(SHOTS, "hub-no-manifest.png"), fullPage: true });
  await ctx.close();
  assert(errors.length === 0, `console errors: ${errors.join(" | ")}`);
  assert(imgs.length === 6 && imgs.every((i) => i.ph === "true" && i.src.startsWith("data:image/svg")), `not all placeholders: ${JSON.stringify(imgs)}`);
});

await test("a manifest file that 404s swaps to its placeholder", async () => {
  const ctx = await browser.newContext();
  await ctx.route("**/art/vega/**", (r) => r.fulfill({ status: 404, body: "" }));
  const { page } = await open(ctx, HUB);
  await page.waitForSelector("html[data-ready]");
  await page.waitForFunction(() => [...document.querySelectorAll("#tiles img")].every((i) => i.complete));
  const vega = await page.$$eval("#tiles img", (els) => els.filter((e) => e.dataset.placeholder === "true").length);
  await ctx.close();
  assert(vega === 2, `expected the 2 Vega tiles to fall back, got ${vega}`);
});

await test("dailySeed is stable for a fixed date across reloads, and differs by game and day", async () => {
  const ctx = await browser.newContext();
  const { page } = await open(ctx, HUB);
  const read = () =>
    page.evaluate(async () => {
      const s = await import("./kit/seed.js");
      const d = new Date("2026-10-20T08:00:00Z");
      const late = new Date("2026-10-20T23:59:59Z");
      const next = new Date("2026-10-21T00:00:00Z");
      const rng = s.dailyRng("potion-sort", d);
      return {
        a: s.dailySeed("gem-merge", d),
        sameDay: s.dailySeed("gem-merge", late),
        nextDay: s.dailySeed("gem-merge", next),
        other: s.dailySeed("memory", d),
        seq: [rng.next(), rng.next(), rng.int(1, 6)],
        today: s.todayString(late),
        reset: s.msUntilReset(new Date("2026-10-20T23:00:00Z")),
      };
    });
  const first = await read();
  await page.reload();
  const second = await read();
  await ctx.close();
  assert(JSON.stringify(first) === JSON.stringify(second), `changed across reload: ${JSON.stringify([first, second])}`);
  assert(first.a === first.sameDay, "seed changed within the same UTC day");
  assert(first.a !== first.nextDay && first.a !== first.other, "seed should differ by day and by game");
  assert(first.today === "2026-10-20" && first.reset === 3600000, `UTC clock wrong: ${first.today} ${first.reset}`);
});

await test("storage blocked: hub still renders and says progress won't persist", async () => {
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { get() { throw new DOMException("blocked", "SecurityError"); } });
  });
  const { page, errors } = await open(ctx, HUB);
  await page.waitForSelector("html[data-ready]");
  const r = await page.evaluate(async () => {
    const { createStore, persistent } = await import("./kit/store.js");
    const st = createStore("test");
    st.set("x", { n: 1 });
    const daily = st.recordDaily({ score: 5 });
    return { persistent, x: st.get("x"), scored: daily.scored, note: !document.getElementById("storage-note").hidden, tiles: document.querySelectorAll("#tiles li").length };
  });
  await ctx.close();
  assert(errors.length === 0, `console errors: ${errors.join(" | ")}`);
  assert(!r.persistent && r.x?.n === 1 && r.scored && r.note && r.tiles === 5, JSON.stringify(r));
});

await test("store: best, one scored daily per day, streaks across days", async () => {
  const ctx = await browser.newContext();
  const { page } = await open(ctx, HUB);
  const r = await page.evaluate(async () => {
    const { createStore } = await import("./kit/store.js");
    const st = createStore("streak-test");
    const d1 = new Date("2026-10-18T10:00:00Z"), d2 = new Date("2026-10-19T10:00:00Z"), d4 = new Date("2026-10-21T10:00:00Z");
    const a = st.recordDaily({ s: 1 }, d1);
    const again = st.recordDaily({ s: 99 }, d1);
    const b = st.recordDaily({ s: 2 }, d2);
    const gap = st.getStreak(d4);
    const c = st.recordDaily({ s: 3 }, d4);
    const best1 = st.best("score", 10), best2 = st.best("score", 5), best3 = st.best("time", 30, { lower: true }), best4 = st.best("time", 20, { lower: true });
    return { a: a.streak.count, again: [again.scored, again.result.s], b: b.streak.count, gap: gap.count, c: c.streak, best: [best1.isNew, best2.isNew, best2.best, best3.isNew, best4.isNew, best4.best], key: Object.keys(localStorage).filter((k) => k.startsWith("sqm:streak-test:")).length };
  });
  await ctx.close();
  assert(r.a === 1 && r.again[0] === false && r.again[1] === 1 && r.b === 2 && r.gap === 0 && r.c.count === 1 && r.c.best === 2, JSON.stringify(r));
  assert(JSON.stringify(r.best) === JSON.stringify([true, false, 10, true, true, 20]), `best: ${JSON.stringify(r.best)}`);
  assert(r.key > 0, "keys are not namespaced sqm:<game>:");
});

await test("rewards: unlocks show up in the hub Collection after reload", async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const { page, errors } = await open(ctx, HUB);
  await page.waitForSelector("html[data-ready]");
  const empty = await page.locator("#collection-empty").isVisible();
  const r = await page.evaluate(async () => {
    const rw = await import("./kit/rewards.js");
    const one = await rw.unlock("wallpaper:nova:phone", { source: "test" });
    const twice = await rw.unlock("wallpaper:nova:phone");
    await rw.unlock("cardback:briar");
    await rw.unlock("background:vega");
    return { first: one.isNew, second: twice.isNew, pending: one.reward.pending, code: one.code, owned: (await rw.collectedMaidenIds()).sort() };
  });
  await page.reload();
  await page.waitForSelector("html[data-ready]");
  const items = await page.locator("#collection-grid li").count();
  const count = await page.textContent("#collection-count");
  if (SHOTS) await page.locator(".collection").screenshot({ path: join(SHOTS, "collection.png") });
  await ctx.close();
  assert(empty, "empty state should show before any unlocks");
  assert(r.first && !r.second && r.pending === true && r.code === null, JSON.stringify(r));
  assert(JSON.stringify(r.owned) === '["briar","nova","vega"]', JSON.stringify(r.owned));
  assert(items === 3 && count.startsWith("3 /"), `collection shows ${items} items, count "${count}"`);
  assert(errors.length === 0, `console errors: ${errors.join(" | ")}`);
});

await test("share card renders a 1080x1350 PNG", async () => {
  const ctx = await browser.newContext();
  const { page, errors } = await open(ctx, HUB);
  const r = await page.evaluate(async () => {
    const { renderShareCard, shareLink } = await import("./kit/share.js");
    const { getMaiden } = await import("./kit/assets.js");
    const canvas = await renderShareCard({ game: "Gem Merge", maiden: await getMaiden("nova"), result: "12,480", detail: "Radiant · 412 moves", daily: true, date: new Date("2026-10-20T12:00:00Z"), lines: ["💗💗🩵💛", "💗🩵💛⭐"] });
    const png = canvas.toDataURL("image/png");
    return { w: canvas.width, h: canvas.height, png, link: shareLink("gem-merge") };
  });
  await ctx.close();
  assert(r.w === 1080 && r.h === 1350, `size ${r.w}x${r.h}`);
  assert(r.png.startsWith("data:image/png;base64,") && r.png.length > 50000, `png looks empty (${r.png.length} chars)`);
  assert(r.link === "https://sidequestmaidens.com/games/gem-merge/?utm_source=share&utm_medium=game&utm_campaign=gem-merge", r.link);
  assert(errors.length === 0, `console errors: ${errors.join(" | ")}`);
  if (SHOTS) await writeFile(join(SHOTS, "share-card.png"), Buffer.from(r.png.split(",")[1], "base64"));
});

await test("share falls back to PNG download when Web Share can't take files", async () => {
  const ctx = await browser.newContext({ acceptDownloads: true });
  const { page } = await open(ctx, HUB);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.evaluate(async () => {
      const { share } = await import("./kit/share.js");
      const { getMaiden } = await import("./kit/assets.js");
      navigator.canShare = () => false;
      return share({ gameId: "memory", game: "Maiden Memory", maiden: await getMaiden("vega"), result: "24 moves" });
    }),
  ]);
  const name = download.suggestedFilename();
  await ctx.close();
  assert(/^sidequest-memory-\d{4}-\d{2}-\d{2}\.png$/.test(name), name);
});

await test("ui kit: header, help modal (Esc closes, focus returns), mute persists, results", async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const { page, errors } = await open(ctx, HUB);
  await page.waitForSelector("html[data-ready]"); // let the hub finish before clearing its markup
  await page.evaluate(async () => {
    const ui = await import("./kit/ui.js");
    document.body.replaceChildren();
    ui.header({ title: "Kit test", help: "Tap things." });
  });
  await page.getByRole("button", { name: "How to play" }).click();
  const opened = await page.locator("dialog[open]").count();
  await page.keyboard.press("Escape");
  await page.locator("dialog").waitFor({ state: "detached", timeout: 2000 }).catch(() => {});
  const closed = await page.locator("dialog").count();
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
  await page.getByRole("button", { name: "Mute sound" }).click();
  const muted = await page.evaluate(() => localStorage.getItem("sqm:kit:muted"));
  await page.evaluate(async () => {
    const ui = await import("./kit/ui.js");
    ui.results({ title: "Quest complete", stats: [["Score", 120], ["Moves", 33]], actions: [{ label: "Again", primary: true }] });
  });
  const stats = await page.locator(".sq-results__stats li").count();
  if (SHOTS) await page.screenshot({ path: join(SHOTS, "results.png") });
  await page.getByRole("button", { name: "Again" }).click();
  await page.locator("dialog").waitFor({ state: "detached", timeout: 2000 }).catch(() => {});
  const after = await page.locator("dialog").count();
  await ctx.close();
  assert(opened === 1 && closed === 0 && focused === "How to play", `modal: opened ${opened}, closed ${closed}, focus ${focused}`);
  assert(muted === "true", `mute not persisted (${muted})`);
  assert(stats === 2 && after === 0, `results: ${stats} stats, ${after} dialogs after action`);
  assert(errors.length === 0, `console errors: ${errors.join(" | ")}`);
});

await test("audio waits for a gesture, then plays a station without errors", async () => {
  const ctx = await browser.newContext();
  const { page, errors } = await open(ctx, HUB);
  const before = await page.evaluate(async () => {
    const audio = await import("./kit/audio.js");
    const { getMaiden } = await import("./kit/assets.js");
    audio.playStation(await getMaiden("briar"));
    audio.sfx("chime");
    return audio.isUnlocked();
  });
  await page.mouse.click(5, 5);
  const after = await page.evaluate(async () => {
    const audio = await import("./kit/audio.js");
    for (const n of ["chime", "pop", "whoosh", "pour", "thunder"]) audio.sfx(n, { pitch: 3 });
    audio.setStationLevel(0.4);
    await new Promise((r) => setTimeout(r, 300));
    return audio.isUnlocked();
  });
  await ctx.close();
  assert(before === false && after === true, `unlocked before=${before} after=${after}`);
  assert(errors.length === 0, `console errors: ${errors.join(" | ")}`);
});

await test("main site nav links to /games/", async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`);
  const link = page.locator('header nav a[href="/games/"]');
  await link.waitFor();
  await link.click();
  await page.waitForSelector("html[data-ready]");
  const title = await page.title();
  await ctx.close();
  assert(title.startsWith("Side Quests"), `landed on "${title}"`);
});

await browser.close();
server?.close();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
