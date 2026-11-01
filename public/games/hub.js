// The /games/ hub: today's featured daily, the open vote, game tiles, past votes, Collection.

import { art, loadConfig, loadJSON, loadMaidens } from "./kit/assets.js";
import { collection, unlocked } from "./kit/rewards.js";
import { timeUntilReset, today } from "./kit/seed.js";
import { h, header } from "./kit/ui.js";
import * as vote from "./kit/vote.js";

const $ = (id) => document.getElementById(id);
const fmtDate = (d) => new Date(d + "T00:00:00Z").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

$("header").replaceWith(header({ title: "Side Quests", hub: "/", backLabel: "Back to sidequestmaidens.com" }));

const [config, gamesDoc, maidens] = await Promise.all([loadConfig(), loadJSON("games.json"), loadMaidens()]);
const games = gamesDoc?.games || [];
const liveGames = games.filter((g) => g.live);
const maidenById = new Map(maidens.map((m) => [m.id, m]));
const accentFor = (g) => maidenById.get(g.maiden)?.accent || "#3DD6C8";

// ---------- Footer links (hidden while config is empty) ----------
if (config.shop_url) $("shop-link").href = config.shop_url;
if (config.newsletter_url) {
  const a = $("newsletter-link");
  a.href = config.newsletter_url;
  a.hidden = false;
}

// ---------- Today's Side Quest: rotates daily across games ----------
function renderToday() {
  const pool = liveGames.length ? liveGames : games;
  if (!pool.length) {
    $("today-h").textContent = "Games are on the way";
    return;
  }
  const dayIndex = Math.floor(Date.parse(today() + "T00:00:00Z") / 864e5);
  const g = pool[dayIndex % pool.length];
  $("today").style.setProperty("--accent", accentFor(g));
  $("today-h").textContent = g.name;
  $("today-blurb").textContent = g.blurb || "";
  $("today-reset").textContent = `New daily in ${timeUntilReset()}`;
  $("today-cta").replaceChildren(
    g.live
      ? h("a", { class: "btn btn--primary", href: g.path }, "Play today's side quest")
      : h("span", { class: "game-tile__tag" }, "Coming soon"),
  );
}
renderToday();
setInterval(() => ($("today-reset").textContent && ($("today-reset").textContent = `New daily in ${timeUntilReset()}`)), 60000);

// ---------- Vote card ----------
async function renderVote() {
  const body = $("vote-body");
  const set = await vote.currentSet();
  if (!set) {
    $("vote-h").textContent = "Who's next?";
    body.replaceChildren(h("p", { class: "dim" }, "No vote is open right now. The next round opens soon."));
    return;
  }
  $("vote-h").textContent = set.question;
  const st = await vote.status(set.set_id);
  const castN = vote.castToday().length;
  const total = liveGames.length;
  const waiting = vote.availableGames();

  const kids = [
    h("ul", { class: "vote-cands", "aria-label": "Candidates" }, vote.orderFor(set).map((o) => h("li", {}, o.label))),
    h("div", { class: "vote-meta" },
      h("span", {}, `Winner announced ${fmtDate(set.closes)}`),
      total
        ? h("span", { class: "mono" }, `Votes cast today: ${castN} of ${total}`)
        : h("span", { class: "dim" }, "Games launch soon: each daily side quest earns a vote.")),
  ];
  if (st?.tally) kids.push(h("p", { class: "eyebrow", style: "margin-top:16px" }, "Current results"), vote.tallyList(set, st.tally, st.voted_option));
  if (waiting.length) {
    kids.push(h("p", {}, h("button", {
      class: "btn btn--primary", type: "button",
      onclick: () => vote.panel(waiting[0], { onDone: () => setTimeout(renderVote, 400) }),
    }, "You earned a vote: choose who's next")));
  } else if (total) {
    kids.push(h("p", { class: "dim" }, "Finish a daily side quest to cast your vote. One vote per game per day."));
  }
  body.replaceChildren(...kids);
}

// ---------- Past votes (view-only previews, no downloads) ----------
async function renderPast() {
  const idx = await loadJSON("votes/index.json");
  const ids = idx?.sets || [];
  const sets = (await Promise.all(ids.map((id) => vote.loadSet(id)))).filter((s) => s && s.winner);
  if (!sets.length) return;
  $("past").hidden = false;
  const list = $("past-list");
  for (const set of sets) {
    const win = set.options.find((o) => o.id === set.winner);
    if (!win) continue;
    const others = set.options.filter((o) => o.id !== set.winner);
    const img = h("img", { class: "past__img", src: vote.previewUrl(set, win), alt: win.label.replace(" · ", ", "), loading: "lazy", draggable: "false" });
    const youPicked = h("span", { class: "badge", hidden: true }, "You picked this");
    const card = h("article", { class: "panel past" },
      img,
      h("div", {},
        h("p", { class: "dim", style: "margin:0" }, set.question),
        h("p", { class: "past__won" }, `The party picked ${win.name}`),
        h("p", { class: "dim", style: "margin:0 0 8px" }, win.station + (set.closed ? ` · ${fmtDate(set.closed)}` : "")),
        youPicked,
        set.video_url ? h("p", {}, h("a", { href: set.video_url, rel: "noopener" }, "Watch her first mix ↗")) : null,
        others.length ? h("div", { class: "still" },
          h("span", { class: "dim" }, "Still in the running:"),
          others.map((o) => h("span", { style: "display:inline-flex;align-items:center;gap:6px" },
            h("img", { src: vote.previewUrl(set, o), alt: "", loading: "lazy", draggable: "false" }), o.label))) : null));
    list.append(card);
    vote.status(set.set_id).then((st) => { if (st?.voted_option === set.winner) youPicked.hidden = false; });
  }
  if (config.patreon_url) {
    const p = $("patreon-line");
    p.replaceChildren("Hi-res wallpapers for members on ", h("a", { href: config.patreon_url, rel: "noopener" }, "Patreon"), ".");
    p.hidden = false;
  }
}

// ---------- Game tiles ----------
function renderGames() {
  const grid = $("games");
  if (!games.length) {
    grid.append(h("p", { class: "dim" }, "Games are on the way."));
    return;
  }
  for (const g of games) {
    const inner = [
      h("span", { class: "game-tile__tag" }, g.live ? "Play" : "Coming soon"),
      h("span", { class: "game-tile__name" }, g.name),
      h("span", { class: "dim" }, g.blurb || ""),
    ];
    const tile = g.live
      ? h("a", { class: "game-tile", href: g.path }, inner)
      : h("div", { class: "game-tile", "aria-disabled": "true" }, inner);
    tile.style.setProperty("--c", accentFor(g));
    grid.append(tile);
  }
}

// ---------- Collection (view only) ----------
function renderCollection() {
  const met = collection();
  const cos = unlocked();
  const body = $("col-body");
  if (!met.length && !cos.length) {
    body.append(h("p", { class: "dim" }, "Maidens you meet in games and cosmetics you unlock will show up here."));
    return;
  }
  if (met.length) {
    body.append(h("div", { class: "col-grid" }, met.map((c) => {
      const m = maidenById.get(c.maiden) || { id: c.maiden, name: c.maiden, accent: "#3DD6C8", files: {} };
      const card = h("div", { class: "card", title: m.name });
      card.style.setProperty("--c", m.accent);
      card.append(h("div", { class: "card__art" }, art(m, c.variant, { alts: ["card", "scene"], alt: m.name })), h("div", { class: "card__name" }, m.name));
      return card;
    })));
  }
  if (cos.length) body.append(h("ul", { class: "col-chips", "aria-label": "Unlocked cosmetics" }, cos.map((c) => h("li", {}, c.name))));
}

renderGames();
renderCollection();
await Promise.all([renderVote(), renderPast()]);
