// The Side Quests hub: today's featured daily, game tiles from games.json, and the Collection.

import { loadMaidens, setImage } from "./kit/assets.js";
import { createStore, persistent } from "./kit/store.js";
import { dayNumber, todayString, timeUntilReset } from "./kit/seed.js";
import { catalogue } from "./kit/rewards.js";
import { el } from "./kit/ui.js";

const $ = (id) => document.getElementById(id);

async function loadGames() {
  try {
    const r = await fetch("games.json", { cache: "no-cache" });
    if (!r.ok) throw new Error(String(r.status));
    return (await r.json()).games || [];
  } catch {
    return [];
  }
}

/** Today's featured game: rotates daily through live daily games (or all daily games before any are live). */
export function featuredGame(games, date = new Date()) {
  const daily = games.filter((g) => g.daily);
  const live = daily.filter((g) => g.status === "live");
  const pool = live.length ? live : daily;
  return pool.length ? pool[dayNumber(date) % pool.length] : null;
}

function renderToday(game, maiden) {
  const box = $("today");
  $("today-date").textContent = todayString();
  if (!game) {
    box.hidden = true;
    return;
  }
  box.style.setProperty("--accent", maiden.accent);
  setImage($("today-art"), maiden, "scene", "card");
  $("today-art").alt = "";
  $("today-title").textContent = game.title;
  $("today-tagline").textContent = game.tagline;
  const play = $("today-play");
  if (game.status === "live") {
    play.href = `${game.href}?mode=daily`;
    play.textContent = "Play today's puzzle";
  } else {
    play.removeAttribute("href");
    play.setAttribute("aria-disabled", "true");
    play.classList.add("is-soon");
    play.textContent = "Arrives soon";
  }
  const store = createStore(game.id);
  const done = store.getDaily();
  if (done) {
    const streak = store.getStreak();
    $("today-done").hidden = false;
    $("today-done").textContent = `Done today${streak.count > 1 ? ` · ${streak.count}-day streak` : ""}. Come back after the reset.`;
  }
  const tick = () => ($("today-reset").textContent = `New puzzle in ${timeUntilReset()}`);
  tick();
  setInterval(tick, 30000);
}

function renderTiles(games, cast) {
  const list = $("tiles");
  list.replaceChildren();
  for (const g of games) {
    const m = cast.find((x) => x.id === g.maiden) || cast[0];
    const live = g.status === "live";
    const img = setImage(el("img", { alt: "", decoding: "async" }), m, "scene_sm", "scene", "card_sm", "card");
    img.alt = "";
    const inner = [
      el("div", { class: "tile__art" }, img),
      el("div", { class: "tile__body" }, [
        el("h3", { text: g.title }),
        el("p", { text: g.tagline }),
        el("span", { class: `tile__badge mono ${live ? "is-live" : ""}`, text: live ? (g.daily ? "Daily + endless" : "Play") : "Coming soon" }),
      ]),
    ];
    const tile = live ? el("a", { class: "tile", href: g.href }, inner) : el("div", { class: "tile is-soon", "aria-disabled": "true" }, inner);
    tile.style.setProperty("--accent", m.accent);
    list.append(el("li", {}, tile));
  }
}

const TYPE_LABEL = { wallpaper: "Wallpaper", cardback: "Card back", background: "Focus background" };

async function renderCollection() {
  const all = await catalogue();
  const owned = all.filter((r) => r.unlocked);
  $("collection-count").textContent = `${owned.length} / ${all.length}`;
  $("collection-empty").hidden = owned.length > 0;
  const grid = $("collection-grid");
  grid.replaceChildren();
  for (const r of owned) {
    const accent = r.maiden?.accent || "var(--pink)";
    let visual;
    if (r.type === "cardback") {
      visual = el("div", { class: "sq-card sq-card--back" });
      visual.style.setProperty("--back-ring", accent);
    } else {
      visual = el("div", { class: "sq-card" }, [el("img", { class: "sq-card__art", src: r.preview, alt: "", loading: "lazy" })]);
    }
    visual.style.setProperty("--accent", accent);
    let action = null;
    if (r.type === "wallpaper") {
      action = r.href
        ? el("a", { class: "btn btn--ghost", href: r.href, download: "", text: "Save wallpaper" })
        : el("span", { class: "collection__soon", text: "File on its way" });
    }
    grid.append(
      el("li", { class: "collection__item" }, [
        visual,
        el("p", { class: "collection__label" }, [el("b", { text: r.label }), el("span", { class: "mono", text: TYPE_LABEL[r.type] || r.type })]),
        action,
      ]),
    );
  }
  $("storage-note").hidden = persistent;
}

async function main() {
  const [games, cast] = await Promise.all([loadGames(), loadMaidens()]);
  const featured = featuredGame(games);
  renderToday(featured, cast.find((m) => m.id === featured?.maiden) || cast[0]);
  renderTiles(games, cast);
  await renderCollection();
  document.documentElement.dataset.ready = "true";
}

main();
