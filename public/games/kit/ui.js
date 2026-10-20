// Shared chrome: header (back to hub, mute, help), modal, toast and the results screen.

import { isMuted, toggleMute, onMuteChange } from "./audio.js";
import { share } from "./share.js";

const ICONS = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13"/></svg>',
  muted: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M22 9l-6 6M16 9l6 6"/></svg>',
  help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2.2M12 17h.01"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v; // only ever used with the static ICONS above
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of [].concat(children)) if (c != null) node.append(c);
  return node;
}
export { el };

/**
 * Mounts the shared header at the top of <body> (or `into`).
 * opts: { title, back = hub URL, help: () => Node|string, mute = true }
 */
export function header({ title = "", back = new URL("../", import.meta.url).href, help = null, mute = true, into = document.body } = {}) {
  const muteBtn = mute
    ? el("button", { class: "icon-btn", type: "button", "data-action": "mute" })
    : null;
  const paintMute = () => {
    if (!muteBtn) return;
    const m = isMuted();
    muteBtn.innerHTML = m ? ICONS.muted : ICONS.sound;
    muteBtn.setAttribute("aria-label", m ? "Unmute sound" : "Mute sound");
    muteBtn.setAttribute("aria-pressed", String(m));
  };
  if (muteBtn) {
    muteBtn.addEventListener("click", () => toggleMute());
    onMuteChange(paintMute);
    paintMute();
  }
  const helpBtn = help
    ? el("button", { class: "icon-btn", type: "button", "aria-label": "How to play", html: ICONS.help, onclick: () => modal({ title: "How to play", content: typeof help === "function" ? help() : help }) })
    : null;
  const bar = el("header", { class: "sq-header" }, [
    el("a", { class: "sq-header__back", href: back, "aria-label": "Back to Side Quests" }, [el("span", { html: ICONS.back }), el("span", { text: "Side Quests" })]),
    el("h1", { class: "sq-header__title", text: title }),
    helpBtn,
    muteBtn,
  ]);
  into.prepend(bar);
  return bar;
}

/**
 * Opens a modal dialog. Esc and the close button dismiss it; focus is trapped by <dialog>
 * and returns to the opener on close. Returns { el, body, close }.
 */
export function modal({ title = "", content = "", onClose = null, dismissible = true } = {}) {
  const opener = document.activeElement;
  const body = el("div", { class: "sq-modal__body" });
  if (typeof content === "string") body.append(el("p", { text: content }));
  else if (content) body.append(content);
  const dialog = el("dialog", { class: "sq-modal", "aria-label": title || "Dialog" }, [
    el("div", { class: "sq-modal__head" }, [
      el("h2", { text: title }),
      dismissible ? el("button", { class: "icon-btn", type: "button", "aria-label": "Close", html: ICONS.close, onclick: () => close() }) : null,
    ]),
    body,
  ]);
  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    if (dialog.open) dialog.close();
    dialog.remove();
    opener?.focus?.();
    onClose?.();
  }
  dialog.addEventListener("cancel", (e) => {
    if (!dismissible) e.preventDefault();
  });
  dialog.addEventListener("close", close);
  dialog.addEventListener("click", (e) => {
    if (dismissible && e.target === dialog) close(); // backdrop click
  });
  document.body.append(dialog);
  dialog.showModal();
  return { el: dialog, body, close };
}

let toastRegion = null;
/** A short message at the bottom of the screen, announced to screen readers. */
export function toast(message, ms = 3200) {
  if (!toastRegion) {
    toastRegion = el("div", { class: "sq-toasts", role: "status", "aria-live": "polite" });
    document.body.append(toastRegion);
  }
  const t = el("div", { class: "sq-toast", text: message });
  toastRegion.append(t);
  setTimeout(() => t.remove(), ms);
  return t;
}

/**
 * Results screen.
 * opts: { title, subtitle, stats: [[label, value], …], note: Node|string,
 *         share: share() opts or null, actions: [{ label, onClick, primary }], onClose }
 */
export function results({ title = "Quest complete", subtitle = "", stats = [], note = null, share: shareOpts = null, actions = [], onClose = null } = {}) {
  const content = el("div", { class: "sq-results" });
  if (subtitle) content.append(el("p", { class: "eyebrow", text: subtitle }));
  if (stats.length) {
    content.append(el("ul", { class: "sq-results__stats" }, stats.map(([label, value]) => el("li", {}, [el("span", { text: label }), el("b", { text: String(value) })]))));
  }
  if (note) content.append(typeof note === "string" ? el("p", { text: note }) : note);
  const row = el("div", { class: "sq-results__actions" });
  let m;
  if (shareOpts) {
    row.append(
      el("button", {
        class: "btn",
        type: "button",
        text: "Share",
        onclick: async (e) => {
          e.currentTarget.disabled = true;
          const how = await share(shareOpts).catch(() => "failed");
          e.currentTarget.disabled = false;
          if (how === "downloaded") toast("Share card saved. The result text is on your clipboard.");
          else if (how === "failed") toast("Couldn't make the share card this time.");
        },
      }),
    );
  }
  for (const a of actions) {
    row.append(el("button", { class: a.primary ? "btn" : "btn btn--ghost", type: "button", text: a.label, onclick: () => (m.close(), a.onClick?.()) }));
  }
  content.append(row);
  m = modal({ title, content, onClose });
  return m;
}

/** True when the player asked for less motion. Games read this rather than matching media themselves. */
export const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
