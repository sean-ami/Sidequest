// Shared UI: header, modal, toast, results screen.

import { isMuted, onMuteChange, toggleMute } from "./audio.js";

const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
  return el;
};
export { h };

/** Sticky header: back to hub, title, help (optional), mute. */
export function header({ title, onHelp, hub = "/games/", backLabel = "Back to Side Quests" } = {}) {
  const mute = h("button", { class: "btn btn--icon btn--ghost", type: "button" });
  const paint = (m) => {
    mute.textContent = m ? "🔇" : "🔊";
    mute.setAttribute("aria-label", m ? "Unmute sound" : "Mute sound");
    mute.setAttribute("aria-pressed", String(m));
  };
  paint(isMuted());
  onMuteChange(paint);
  mute.addEventListener("click", () => toggleMute());
  const el = h(
    "header",
    { class: "sq-header" },
    h("a", { class: "btn btn--icon btn--ghost", href: hub, "aria-label": backLabel }, "←"),
    h("div", { class: "sq-header__title" }, h("span", { class: "gem", "aria-hidden": "true" }), title || "Side Quests"),
    onHelp && h("button", { class: "btn btn--icon btn--ghost", type: "button", "aria-label": "How to play", onclick: onHelp }, "?"),
    mute,
  );
  return el;
}

/** Modal dialog. Esc and the close button dismiss it; focus returns to where it was. */
export function modal(content, { label = "Dialog", onClose } = {}) {
  const prev = document.activeElement;
  const box = h("div", { class: "sq-modal__box panel", role: "dialog", "aria-modal": "true", "aria-label": label, tabindex: "-1" });
  const closeBtn = h("button", { class: "btn btn--icon btn--ghost sq-modal__close", type: "button", "aria-label": "Close" }, "✕");
  box.append(closeBtn, content);
  const root = h("div", { class: "sq-modal" }, box);
  const close = () => {
    root.remove();
    document.removeEventListener("keydown", onKey, true);
    prev?.focus?.();
    onClose?.();
  };
  const onKey = (e) => {
    if (e.key === "Escape") { e.stopPropagation(); close(); }
    if (e.key === "Tab") { // keep focus inside
      const f = [...box.querySelectorAll("button, a[href], input, select, [tabindex]:not([tabindex='-1'])")].filter((x) => !x.disabled);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  closeBtn.addEventListener("click", close);
  root.addEventListener("click", (e) => { if (e.target === root) close(); });
  document.addEventListener("keydown", onKey, true);
  document.body.append(root);
  box.focus();
  return { el: box, close };
}

let toastTimer = 0;
export function toast(msg, ms = 2600) {
  document.querySelector(".sq-toast")?.remove();
  const t = h("div", { class: "sq-toast", role: "status", "aria-live": "polite" }, msg);
  document.body.append(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), ms);
}

/**
 * Results screen in a modal. stats = [["Score", "2,048"], ...].
 * voteSlot: an element (e.g. from vote.button()) shown under the stats.
 */
export function results({ title = "Quest complete", stats = [], voteSlot = null, onShare, onAgain } = {}) {
  const body = h(
    "div",
    {},
    h("p", { class: "eyebrow" }, "Results"),
    h("h2", {}, title),
    h("dl", { class: "results-stats", style: "display:grid;grid-template-columns:auto 1fr;gap:6px 16px;margin:16px 0" },
      stats.flatMap(([k, v]) => [h("dt", { class: "dim" }, k), h("dd", { class: "num", style: "margin:0;font-weight:600" }, String(v))])),
    voteSlot && h("div", { class: "results-vote", style: "margin:16px 0" }, voteSlot),
    h("div", { style: "display:flex;gap:8px;flex-wrap:wrap" },
      onShare && h("button", { class: "btn", type: "button", onclick: onShare }, "Share"),
      onAgain && h("button", { class: "btn btn--primary", type: "button", onclick: () => { m.close(); onAgain(); } }, "Play again")),
  );
  const m = modal(body, { label: title });
  return m;
}
