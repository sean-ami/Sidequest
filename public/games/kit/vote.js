// Side Quest Vote client. Finishing a game's daily side quest earns one vote (max 1 per game per
// UTC day). Each vote picks which Maiden opens her station next. No email or login.
//
// Completion is verified client-side only, so votes are low-stakes signals; the backend's
// unique-voter counts are the number to trust.

import { loadJSON } from "./assets.js";
import { hashString, mulberry32, shuffle, today } from "./seed.js";
import { store } from "./store.js";
import { h, modal, toast } from "./ui.js";

const s = store("vote");
const API = "/api/vote";

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 15) | 64;
  b[8] = (b[8] & 63) | 128;
  const x = [...b].map((v) => v.toString(16).padStart(2, "0")).join("");
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

/** Random id for this browser (sqm:vote:voter). In memory only if storage is blocked. */
export function voterId() {
  let id = s.get("voter", null);
  if (!id) id = s.set("voter", uuid());
  return id;
}

/** Voting is open on [opens, closes): on the closes date the winner is announced. */
export function isOpen(set, day = today()) {
  return !!set && !set.winner && !set.closed && day >= set.opens && day < set.closes;
}

/** The open set (or null). */
export async function currentSet() {
  const cur = await loadJSON("votes/current.json");
  if (!cur?.set_id) return null;
  const set = await loadJSON(`votes/${cur.set_id}/set.json`);
  return set && isOpen(set) ? set : null;
}

export async function loadSet(id) {
  return loadJSON(`votes/${id}/set.json`);
}

/** URL of an option's 960 px watermarked preview. */
export const previewUrl = (set, opt) => new URL(`../votes/${set.set_id}/${opt.preview}`, import.meta.url).href;

// Local bookkeeping: earned[day] = [gameId...]; used[day] = [gameId...]
const earnedToday = () => s.get("earned", {})[today()] || [];
const usedToday = () => s.get("used", {})[today()] || [];
function addTo(key, gameId) {
  const day = today();
  const all = s.get(key, {});
  // keep only the last few days
  for (const d of Object.keys(all)) if (d < new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)) delete all[d];
  all[day] = [...new Set([...(all[day] || []), gameId])];
  s.set(key, all);
}

/** True if this game's vote for today is earned and not yet cast. */
export const available = (gameId) => earnedToday().includes(gameId) && !usedToday().includes(gameId);

/** Games whose vote for today is waiting to be cast. */
export const availableGames = () => earnedToday().filter((g) => !usedToday().includes(g));

/** Votes cast today (by game). */
export const castToday = () => usedToday().slice();

/**
 * Call when a game's daily side quest is completed. Grants one vote for (game, today UTC) if not
 * already earned. Returns whether a vote is available for this game.
 */
export function earn(gameId) {
  if (!earnedToday().includes(gameId)) addTo("earned", gameId);
  return available(gameId);
}

/** Server status: { voted_today_games, voted_option, tally|null }. Null on network failure. */
export async function status(setId) {
  try {
    const r = await fetch(`${API}?set_id=${encodeURIComponent(setId)}&voter=${encodeURIComponent(voterId())}`, { cache: "no-store" });
    if (!r.ok) return null;
    const j = await r.json();
    // Sync: games the server already has for today count as used here too.
    for (const g of j.voted_today_games || []) if (!usedToday().includes(g)) addTo("used", g);
    return j;
  } catch {
    return null;
  }
}

/** POST a vote. Returns { ok, already, tally } or { ok:false, error }. */
export async function cast(optionId, gameId, set) {
  let r;
  try {
    r = await fetch(API, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ set_id: set.set_id, option_id: optionId, game: gameId, voter: voterId() }),
    });
  } catch {
    return { ok: false, error: "network" };
  }
  let j = {};
  try { j = await r.json(); } catch { /* empty */ }
  if (r.ok && j.ok) {
    addTo("used", gameId);
    s.update("history", (hst) => ({ ...hst, [set.set_id]: optionId }), {});
    return { ok: true, already: !!j.already, tally: j.tally };
  }
  return { ok: false, error: j.error || `http_${r.status}` };
}

/** Option order for this player: shuffled, but stable for (voter, set). */
export function orderFor(set) {
  return shuffle(set.options, mulberry32(hashString(`${voterId()}|${set.set_id}`)));
}

const fmtDate = (d) => new Date(d + "T00:00:00Z").toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });

/** Tally list (percentages only). `mine` highlights the player's option. */
export function tallyList(set, tally, mine = null) {
  const opts = orderFor(set);
  return h(
    "ul",
    { class: "tally", "aria-label": "Current results" },
    opts.map((o) => {
      const pct = Math.round(tally?.[o.id] ?? 0);
      const bar = h("span", { class: "tally__bar", "aria-hidden": "true" });
      bar.style.width = `${pct}%`;
      return h("li", { class: o.id === mine ? "mine" : null }, bar, h("span", {}, o.label + (o.id === mine ? " (your pick)" : "")), h("span", { class: "num" }, `${pct}%`));
    }),
  );
}

/**
 * Button for a results screen. Hidden unless this game's vote is available today.
 * Re-renders itself to "Thanks, your vote's in." after casting.
 */
export function button(gameId) {
  const b = h("button", { class: "btn btn--primary", type: "button" }, "🗳 You earned a vote: choose who's next");
  if (!available(gameId)) b.hidden = true;
  b.addEventListener("click", () => panel(gameId, { onDone: () => { b.disabled = true; b.textContent = "Thanks, your vote's in."; } }));
  return b;
}

/** The vote modal for a game. */
export async function panel(gameId, { onDone } = {}) {
  const body = h("div", { class: "vote-panel" }, h("p", { class: "dim" }, "Loading the vote…"));
  const m = modal(body, { label: "Side Quest Vote" });
  const set = await currentSet();
  if (!set) {
    body.replaceChildren(
      h("p", { class: "eyebrow" }, "Side Quest Vote"),
      h("h2", {}, "No vote is open right now"),
      h("p", {}, "Your vote is saved for the rest of today. Check back soon to choose who's next."),
    );
    return m;
  }
  const showTally = (tally, mine, already = false) => {
    body.replaceChildren(
      h("p", { class: "eyebrow" }, "Side Quest Vote"),
      h("h2", {}, already ? "You already voted from this game today" : "Thanks, your vote's in."),
      h("p", { class: "dim" }, set.question),
      tallyList(set, tally, mine),
      h("p", {}, `Winner announced ${fmtDate(set.closes)}.`),
    );
  };

  const st = await status(set.set_id);
  if (st && (st.voted_today_games || []).includes(gameId)) {
    showTally(st.tally, st.voted_option, true);
    return m;
  }
  if (!available(gameId)) {
    body.replaceChildren(
      h("p", { class: "eyebrow" }, "Side Quest Vote"),
      h("h2", {}, set.question),
      h("p", {}, "Finish today's daily side quest in this game to earn a vote."),
      st?.tally ? tallyList(set, st.tally, st.voted_option) : null,
    );
    return m;
  }

  const opts = orderFor(set);
  const status_ = h("p", { class: "dim", role: "status", "aria-live": "polite" });
  const grid = h("div", { class: "vote-grid", role: "radiogroup", "aria-label": set.question });
  grid.style.setProperty("--n", String(opts.length));
  const buttons = opts.map((o, i) => {
    const img = h("img", { src: previewUrl(set, o), alt: o.label.replace(" · ", ", "), loading: "lazy", draggable: "false" });
    img.addEventListener("contextmenu", (e) => e.preventDefault());
    const btn = h("button", { class: "vote-opt", type: "button", role: "radio", "aria-checked": "false", tabindex: i === 0 ? "0" : "-1", "data-option": o.id }, img, h("span", { class: "vote-opt__label" }, o.label));
    btn.addEventListener("click", () => choose(o.id));
    btn.addEventListener("keydown", (e) => {
      const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!d) return;
      e.preventDefault();
      const next = buttons[(i + d + buttons.length) % buttons.length];
      buttons.forEach((x) => x.setAttribute("tabindex", "-1"));
      next.setAttribute("tabindex", "0");
      next.focus();
    });
    return btn;
  });
  grid.append(...buttons);

  let busy = false;
  async function choose(optionId) {
    if (busy) return;
    busy = true;
    buttons.forEach((x) => { x.setAttribute("aria-checked", String(x.dataset.option === optionId)); x.disabled = true; });
    status_.textContent = "Casting your vote…";
    const r = await cast(optionId, gameId, set);
    if (r.ok) {
      showTally(r.tally, optionId, r.already);
      onDone?.();
      return;
    }
    busy = false;
    buttons.forEach((x) => { x.disabled = false; x.setAttribute("aria-checked", "false"); });
    status_.textContent = r.error === "network"
      ? "Couldn't reach the vote just now. Your vote is saved for the rest of today, so try again in a bit."
      : r.error === "closed" ? "This vote has just closed. Thanks for playing!" : "That didn't go through. Please try again.";
    if (r.error === "closed") toast("This vote has closed.");
  }

  body.replaceChildren(
    h("p", { class: "eyebrow" }, "You earned a vote: choose who's next"),
    h("h2", {}, set.question),
    grid,
    status_,
    h("p", { class: "dim", style: "font-size:0.9rem" }, `Cast your vote by tapping a Maiden. Winner announced ${fmtDate(set.closes)}; the others stay in the running.`),
  );
  buttons[0]?.focus();
  return m;
}
