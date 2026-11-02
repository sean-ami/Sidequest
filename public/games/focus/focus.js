// Morning Focus with Nova: a Pomodoro timer. Nova Dashes off when a break starts and lands back
// when focus resumes. Four focus sessions in a UTC day is the Focus daily side quest (one vote).

import { loadMaidens } from "../kit/assets.js";
import { playStation, setMusicLevel, sfx } from "../kit/audio.js";
import { isUnlocked as cosmeticUnlocked, select, selected, unlock } from "../kit/rewards.js";
import { share } from "../kit/share.js";
import { markDaily, store } from "../kit/store.js";
import { h, header, modal, toast } from "../kit/ui.js";
import * as vote from "../kit/vote.js";
import * as T from "./timer.js";

const GAME = "focus";
const DAILY_GOAL = 4;
const STREAK_GOLDEN = 7;
const STATION_UNLOCK = 4; // total focus sessions
const db = store(GAME);
const $ = (id) => document.getElementById(id);
const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- Settings + state ----------
const SETTINGS_DEFAULT = { ...T.DEFAULT_SETTINGS, quietBreaks: true, notify: false };
let settings = { ...SETTINGS_DEFAULT, ...db.get("settings", {}) };
let state = db.get("state", null) || T.initial(settings);
const saveState = () => db.set("state", state);
const saveSettings = () => db.set("settings", settings);

// ---------- Cast ----------
const maidens = await loadMaidens();
const nova = maidens.find((m) => m.id === "nova") || maidens[0];
const stationChoices = [nova, ...maidens.filter((m) => m.id !== nova.id && m.station_live)];
const stationUnlockId = (m) => `station-${m.id}`;
const canUse = (m) => m.id === nova.id || cosmeticUnlocked(stationUnlockId(m));
let station = stationChoices.find((m) => m.id === selected("focus-station") && canUse(m)) || nova;

$("header").replaceWith(header({ title: "Morning Focus with Nova", onHelp: showHelp }));

// ---------- Scene ----------
function paintScene() {
  const m = station;
  document.documentElement.style.setProperty("--accent", m.accent || "#FF9A3D");
  const bg = $("bg");
  bg.replaceChildren();
  // With a real cutout, use the clean plate (scene_bg) so Nova isn't drawn twice.
  const isNova = m.id === nova.id;
  const src = (isNova && m.files.cutout && m.files.scene_bg) || m.files.scene || m.files.scene_bg || m.files.card;
  if (src) {
    const img = h("img", { src, alt: "", decoding: "async" });
    img.onerror = () => img.remove();
    bg.append(img);
  }
  const box = m.cutout_box || {};
  const st = document.documentElement.style;
  st.setProperty("--fx", `${Math.round((m.focus?.x ?? 0.42) * 100)}%`);
  st.setProperty("--fy", `${Math.round((m.focus?.y ?? 0.42) * 100)}%`);
  st.setProperty("--nx", `${Math.round((box.x ?? 0.3) * 100)}%`);
  st.setProperty("--nb", `${Math.round((box.bottom ?? 0) * 100)}vh`);
  st.setProperty("--nh", `${Math.round((box.h ?? 0.62) * 100)}vh`);
  st.setProperty("--roof", `${Math.round((m.roof_y ?? 0.6) * 100)}%`);
  // Nova and her Dash only on her own station; other stations are moods, shown as their scene.
  $("nova").hidden = !isNova;
  const body = $("nova-body");
  body.replaceChildren();
  const nv = $("nova");
  nv.classList.remove("nova--crop");
  // Until CardForge exports cutout.png: a soft-edged crop of the scene, lined up exactly over
  // the painted Nova, does the Dash, and the scene behind blurs while she's away.
  const useCrop = () => {
    nv.classList.add("nova--crop");
    body.replaceChildren(h("img", { src, alt: "" }));
  };
  if (isNova) {
    // A cutout needs the clean plate too, or Nova would be drawn twice.
    if (m.files.cutout && m.files.scene_bg) {
      const img = h("img", { src: m.files.cutout, alt: "" });
      img.onerror = () => (src ? useCrop() : body.replaceChildren(h("div", { class: "ph" })));
      body.append(img);
    } else if (src) useCrop();
    else body.append(h("div", { class: "ph" }));
  }
  document.body.classList.toggle("crop", isNova && !(m.files.cutout && m.files.scene_bg) && !!src);
  const av = $("mini-avatar");
  av.replaceChildren();
  av.style.background = `radial-gradient(circle at 50% 35%, ${m.accent}, var(--navy) 75%)`;
  if (m.files.avatar) {
    const img = h("img", { src: m.files.avatar, alt: "", style: "width:100%;height:100%;object-fit:cover" });
    img.onerror = () => img.remove();
    av.append(img);
  }
  document.body.classList.toggle("golden", selected("timer-bg") === "timer-golden-hour" && cosmeticUnlocked("timer-golden-hour"));
}

/** Nova's Dash. dir "out" = break starts (she launches right), "in" = focus resumes (she lands). */
function dash(dir) {
  const el = $("nova");
  if (el.hidden) return;
  el.classList.remove("charge", "dash-out", "dash-in", "fade-out", "fade-in");
  void el.offsetWidth; // restart animations
  if (dir === "out") {
    el.dataset.state = "leaving";
    if (reduced()) {
      el.classList.add("fade-out");
      setTimeout(() => { el.dataset.state = "away"; el.classList.remove("fade-out"); }, 650);
      return;
    }
    el.classList.add("charge");
    setTimeout(() => {
      el.classList.remove("charge");
      el.classList.add("dash-out");
      sfx("whoosh", { gain: 0.35 });
      fx("speedlines", 900);
      setTimeout(() => fx("streak", 1400), 120);
    }, 450);
    setTimeout(() => { el.dataset.state = "away"; el.classList.remove("dash-out"); }, 1250);
  } else {
    el.dataset.state = "here";
    el.classList.add(reduced() ? "fade-in" : "dash-in");
    if (!reduced()) fx("speedlines", 900);
    setTimeout(() => el.classList.remove("dash-in", "fade-in"), 1000);
  }
}
function fx(id, ms) {
  const el = $(id);
  el.classList.remove("on");
  void el.offsetWidth;
  el.classList.add("on");
  setTimeout(() => el.classList.remove("on"), ms);
}

// ---------- Progress ----------
const days = () => db.get("days", {});
const todayCount = () => days()[dayOf(Date.now())] || 0;

function recordSession(at) {
  const day = dayOf(at);
  const d = days();
  d[day] = (d[day] || 0) + 1;
  // keep ~2 months
  for (const k of Object.keys(d)) if (k < dayOf(at - 62 * 864e5)) delete d[k];
  db.set("days", d);
  const total = db.update("total", (n) => (n || 0) + 1, 0);
  const { streak } = markDaily(GAME, day);
  const unlocked = [];
  if (streak >= STREAK_GOLDEN) unlocked.push(unlock("timer-golden-hour"));
  if (total >= STATION_UNLOCK) for (const m of stationChoices.slice(1)) unlocked.push(unlock(stationUnlockId(m)));
  unlocked.filter(Boolean).forEach((c, i) => setTimeout(() => toast(`Unlocked: ${c.name}`), 2800 * (i + 1)));
  if (d[day] >= DAILY_GOAL && day === dayOf(Date.now())) {
    const fresh = !vote.available(GAME) && !vote.castToday().includes(GAME);
    vote.earn(GAME);
    if (fresh) setTimeout(() => toast("Daily side quest complete: you earned a vote"), 1200);
  }
}

// ---------- Engine ----------
function notify(title, body) {
  if (!settings.notify || typeof Notification === "undefined" || Notification.permission !== "granted" || !document.hidden) return;
  try { new Notification(title, { body, icon: "/favicon.svg", tag: "sqm-focus" }); } catch { /* some browsers need a service worker */ }
}

function musicLevel() {
  if (!state.running) return 0;
  return state.phase !== "focus" && settings.quietBreaks ? 0.35 : 0.85;
}

function apply(events) {
  for (const e of events) if (e.phase === "focus") recordSession(e.at);
  const last = events[events.length - 1];
  if (!last) return;
  sfx("chime", { pitch: last.next === "focus" ? 1 : 1.25 });
  const toBreak = last.next !== "focus";
  notify(toBreak ? "Focus done. Break time ✦" : "Break's over. Back to focus", toBreak ? "Nova's off on a Dash. Stretch, sip some water." : "Nova's back. Let's go.");
  $("announce").textContent = toBreak ? `Focus complete. ${T.PHASES[last.next]} started.` : "Break over. Focus started.";
  // Animate only the final transition (catch-up after sleep doesn't replay every Dash).
  if (last.phase === "focus" && toBreak) dash("out");
  else if (last.phase !== "focus" && last.next === "focus") dash("in");
}

function tick() {
  // Another tab may have moved the timer on: adopt the newest state first.
  const stored = db.get("state", null);
  if (stored && stored.id > state.id) state = stored;
  const { state: next, events } = T.advance(state, Date.now(), settings);
  if (events.length) {
    state = next;
    saveState();
    apply(events);
  }
  render();
}

function setState(next) {
  const prevPhase = state.phase;
  state = next;
  saveState();
  if (prevPhase === "focus" && state.phase !== "focus") dash("out");
  if (prevPhase !== "focus" && state.phase === "focus") dash("in");
  render();
}

// ---------- Render ----------
let lastTitle = "";
function render() {
  const now = Date.now();
  const ms = T.remainingMs(state, now);
  const time = T.fmt(ms);
  $("time").textContent = time;
  $("phase").textContent = T.PHASES[state.phase] + (state.running ? "" : " · paused");
  document.body.dataset.phase = state.phase;
  document.body.dataset.running = String(state.running);
  const title = `${time} · ${T.PHASES[state.phase]}`;
  if (title !== lastTitle) document.title = lastTitle = title;
  const tg = $("toggle");
  tg.textContent = state.running ? "Pause" : ms < T.durationMs(state.phase, settings) ? "Resume" : "Start";
  tg.setAttribute("aria-pressed", String(state.running));
  // Nova is away for the whole break (also after a reload mid-break).
  const n = $("nova");
  if (!["charge", "dash-out", "dash-in", "fade-out", "fade-in"].some((c) => n.classList.contains(c))) n.dataset.state = state.phase === "focus" ? "here" : "away";
  setMusicLevel(musicLevel());
  renderCycle();
}

function renderCycle() {
  const ol = $("cycle");
  const every = settings.every;
  const done = state.phase === "long" ? every : state.cycle;
  if (ol.children.length !== every || ol.dataset.done !== String(done)) {
    ol.replaceChildren(...Array.from({ length: every }, (_, i) => h("li", { class: i < done ? "done" : null, "aria-label": `Session ${i + 1}${i < done ? ", done" : ""}` })));
    ol.dataset.done = String(done);
  }
}

let lastProgressKey = "";
function renderProgress() {
  const d = days();
  const today = dayOf(Date.now());
  const n = d[today] || 0;
  const streak = db.get("streak", 0);
  const last = db.get("streak_last", null);
  const yesterday = dayOf(Date.now() - 864e5);
  const liveStreak = last === today || last === yesterday ? streak : 0;
  const key = JSON.stringify([n, liveStreak, db.get("total", 0), today, state.phase, state.running, vote.available(GAME), vote.castToday().includes(GAME)]);
  if (key === lastProgressKey) return;
  lastProgressKey = key;
  $("today-n").textContent = String(n);
  $("today-h").lastChild.textContent = n === 1 ? " side quest completed" : " side quests completed";
  $("streak-n").textContent = `${liveStreak} day${liveStreak === 1 ? "" : "s"}`;
  $("total-n").textContent = String(db.get("total", 0));
  const doneToday = n >= DAILY_GOAL;
  $("daily-line").textContent = doneToday ? "Daily side quest complete ✦" : `Finish ${DAILY_GOAL} focus sessions today to earn a vote (${n}/${DAILY_GOAL}).`;

  // Vote + share: never during a running focus session.
  const quiet = state.phase === "focus" && state.running;
  const dd = $("daily-done");
  dd.replaceChildren();
  dd.hidden = !doneToday;
  const slot = $("break-slot");
  slot.replaceChildren();
  if (doneToday && !quiet) {
    const shareBtn = h("button", { class: "btn", type: "button", onclick: shareToday }, "Share");
    if (vote.available(GAME)) {
      dd.append(vote.button(GAME), shareBtn);
      if (state.phase !== "focus") slot.append(h("p", { class: "dim", style: "margin:0" }, "Break time. You earned a vote today:"), vote.button(GAME));
    } else dd.append(h("p", { class: "dim", style: "margin:0" }, vote.castToday().includes(GAME) ? "Thanks, your vote's in." : ""), shareBtn);
  } else if (doneToday) {
    dd.append(h("p", { class: "dim", style: "margin:0" }, "Your vote waits for the break."));
  }

  // Week chart: last 7 UTC days.
  const week = $("week");
  const list = Array.from({ length: 7 }, (_, i) => dayOf(Date.now() - (6 - i) * 864e5));
  const max = Math.max(DAILY_GOAL, ...list.map((k) => d[k] || 0));
  week.setAttribute("aria-label", "Focus sessions, last 7 days: " + list.map((k) => `${new Date(k + "T00:00:00Z").toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" })} ${d[k] || 0}`).join(", "));
  week.replaceChildren(...list.map((k) => {
    const v = d[k] || 0;
    const fill = h("div", { class: "week__fill" });
    fill.style.height = `${(v / max) * 100}%`;
    return h("div", { class: "week__bar" + (k === today ? " is-today" : ""), title: `${k}: ${v}` }, fill, new Date(k + "T00:00:00Z").toLocaleDateString(undefined, { weekday: "narrow", timeZone: "UTC" }));
  }));
}

async function shareToday() {
  const n = todayCount();
  const r = await share({
    gameId: GAME,
    maiden: nova,
    game: "Morning Focus with Nova",
    result: `${n} side quests done today`,
    lines: [`Streak: ${db.get("streak", 0)} days`],
    day: dayOf(Date.now()),
    voted: vote.castToday().includes(GAME),
    text: `${n} side quests done today with Nova ✦`,
  });
  if (r === "downloaded") toast("Share card saved");
}

// ---------- Controls ----------
function toggle() {
  if (state.running) setState(T.pause(state, Date.now()));
  else {
    playStation(station);
    setState(T.start(state, Date.now()));
  }
}
$("toggle").addEventListener("click", toggle);
$("skip").addEventListener("click", () => setState(T.skip(state, Date.now(), settings)));
$("reset").addEventListener("click", () => setState(T.reset(state, settings)));
$("settings").addEventListener("click", showSettings);
document.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector(".sq-modal")) return;
  const tag = e.target?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
  if (e.code === "Space") {
    if (tag === "BUTTON" || tag === "A") return; // native activation handles it
    e.preventDefault();
    toggle();
  } else if (e.key === "s" || e.key === "S") setState(T.skip(state, Date.now(), settings));
  else if (e.key === "r" || e.key === "R") setState(T.reset(state, settings));
});

// ---------- Settings ----------
function showSettings() {
  const num = (key, label, min, max) => h("label", { class: "row" }, h("span", {}, label),
    h("input", { type: "number", name: key, min, max, step: 1, value: settings[key], inputmode: "numeric" }));
  const check = (key, label, hint) => h("label", { class: "opt" }, h("input", { type: "checkbox", name: key, checked: settings[key] }), h("span", {}, label, hint ? h("span", { class: "hint" }, ` ${hint}`) : null));
  const stationOpts = stationChoices.map((m) => {
    const ok = canUse(m);
    return h("label", { class: "opt" + (ok ? "" : " locked") },
      h("input", { type: "radio", name: "station", value: m.id, checked: m.id === station.id, disabled: !ok }),
      h("span", {}, `${m.name} · ${m.station}`, ok ? null : h("span", { class: "hint" }, ` (unlocks after ${STATION_UNLOCK} focus sessions)`)));
  });
  const golden = cosmeticUnlocked("timer-golden-hour");
  const form = h("form", { class: "settings" },
    h("h2", {}, "Timer settings"),
    h("fieldset", {}, h("legend", {}, "Lengths (minutes)"),
      num("focus", "Focus", 1, 120), num("short", "Break", 1, 60), num("long", "Long break", 1, 90), num("every", "Long break after sessions", 2, 8)),
    h("fieldset", {}, h("legend", {}, "Behaviour"),
      check("auto", "Start the next phase automatically"),
      check("quietBreaks", "Quieter music during breaks"),
      check("notify", "Notify me when a phase ends", "(asks your browser's permission)")),
    h("fieldset", {}, h("legend", {}, "Station"), stationOpts),
    h("fieldset", {}, h("legend", {}, "Timer background"),
      h("label", { class: "opt" }, h("input", { type: "radio", name: "bg", value: "", checked: !document.body.classList.contains("golden") }), h("span", {}, "Station scene")),
      h("label", { class: "opt" + (golden ? "" : " locked") }, h("input", { type: "radio", name: "bg", value: "timer-golden-hour", checked: document.body.classList.contains("golden"), disabled: !golden }),
        h("span", {}, "Golden hour", golden ? null : h("span", { class: "hint" }, ` (unlocks with a ${STREAK_GOLDEN}-day streak)`)))),
    h("div", { style: "display:flex;gap:8px;justify-content:flex-end" }, h("button", { class: "btn btn--primary", type: "submit" }, "Save")));
  const m = modal(form, { label: "Timer settings" });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const old = { ...settings };
    for (const k of ["focus", "short", "long", "every"]) {
      const v = Math.round(Number(f.get(k)));
      if (Number.isFinite(v) && v > 0) settings[k] = Math.min(k === "every" ? 8 : 120, Math.max(k === "every" ? 2 : 1, v));
    }
    settings.auto = f.get("auto") === "on";
    settings.quietBreaks = f.get("quietBreaks") === "on";
    const wantNotify = f.get("notify") === "on";
    if (wantNotify && !old.notify && typeof Notification !== "undefined" && Notification.permission !== "granted") {
      try { settings.notify = (await Notification.requestPermission()) === "granted"; } catch { settings.notify = false; }
      if (!settings.notify) toast("Notifications are blocked in this browser");
    } else settings.notify = wantNotify;
    saveSettings();
    // A phase that hasn't started yet picks up its new length.
    if (!state.running && state.remaining === T.durationMs(state.phase, old)) setState({ ...state, id: state.id + 1, remaining: T.durationMs(state.phase, settings) });
    const sid = f.get("station");
    const next = stationChoices.find((x) => x.id === sid && canUse(x));
    if (next && next.id !== station.id) {
      station = next;
      select("focus-station", next.id);
      if (state.running) playStation(station);
    }
    select("timer-bg", f.get("bg") || null);
    paintScene();
    render();
    m.close();
  });
}

function showHelp() {
  modal(h("div", {},
    h("p", { class: "eyebrow" }, "How it works"),
    h("h2", {}, "Morning Focus with Nova"),
    h("ul", {},
      h("li", {}, `Focus for ${settings.focus} minutes, then take a ${settings.short}-minute break. Every ${settings.every} sessions, take a ${settings.long}-minute long break.`),
      h("li", {}, "When your break starts, Nova goes on a Dash. She's back when it's time to focus."),
      h("li", {}, `Each focus session is a side quest. Finish ${DAILY_GOAL} in a day (UTC) to earn a vote on which Maiden opens her station next.`),
      h("li", {}, "Keys: Space start/pause · S skip · R reset."),
      h("li", {}, "Shrink the window for a mini timer.")),
  ), { label: "How it works" });
}

// ---------- Boot ----------
paintScene();
tick();
renderProgress();
setInterval(() => { tick(); renderProgress(); }, 250);
document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });
addEventListener("storage", (e) => { if (e.key === "sqm:focus:state") tick(); });
