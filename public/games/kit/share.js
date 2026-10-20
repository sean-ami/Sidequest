// 1080×1350 share card on canvas, shared as a file through the Web Share API, with a PNG
// download plus copy-to-clipboard text as the fallback.

import { loadImage } from "./assets.js";
import { config } from "./config.js";
import { todayString } from "./seed.js";

const W = 1080;
const H = 1350;

/** The game's link with share UTM tags. */
export function shareLink(gameId) {
  const u = new URL(`${config.shareUrl}/${gameId ? gameId + "/" : ""}`);
  u.searchParams.set("utm_source", "share");
  u.searchParams.set("utm_medium", "game");
  u.searchParams.set("utm_campaign", gameId || "hub");
  return u.href;
}

function drawGem(g, x, y, size) {
  const s = size / 140;
  const P = (pts) => {
    g.beginPath();
    pts.forEach(([px, py], i) => (i ? g.lineTo : g.moveTo).call(g, x + px * s, y + py * s));
    g.closePath();
  };
  const facets = [
    ["#DB3577", [[40, 30], [20, 52], [45, 52]]],
    ["#FF8BB9", [[40, 30], [45, 52], [70, 30]]],
    ["#FF3E8A", [[70, 30], [45, 52], [95, 52]]],
    ["#FF8BB9", [[70, 30], [95, 52], [100, 30]]],
    ["#DB3577", [[100, 30], [95, 52], [120, 52]]],
    ["#9E2656", [[20, 52], [45, 52], [70, 120]]],
    ["#FF3E8A", [[45, 52], [70, 52], [70, 120]]],
    ["#DB3577", [[70, 52], [95, 52], [70, 120]]],
    ["#9E2656", [[95, 52], [120, 52], [70, 120]]],
  ];
  for (const [fill, pts] of facets) {
    P(pts);
    g.fillStyle = fill;
    g.fill();
  }
  g.strokeStyle = "#fff";
  g.lineJoin = "round";
  g.lineWidth = 2.2 * s;
  for (const line of [
    [[20, 52], [120, 52]],
    [[40, 30], [45, 52], [70, 30], [95, 52], [100, 30]],
    [[45, 52], [70, 120], [95, 52]],
  ]) {
    g.beginPath();
    line.forEach(([px, py], i) => (i ? g.lineTo : g.moveTo).call(g, x + px * s, y + py * s));
    g.stroke();
  }
  P([[40, 30], [100, 30], [120, 52], [70, 120], [20, 52]]);
  g.lineWidth = 3.5 * s;
  g.stroke();
}

function cover(g, img, x, y, w, h, focusX = 0.5, focusY = 0.4) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const scale = Math.max(w / iw, h / ih);
  const sw = w / scale;
  const sh = h / scale;
  const sx = Math.min(iw - sw, Math.max(0, iw * focusX - sw / 2));
  const sy = Math.min(ih - sh, Math.max(0, ih * focusY - sh / 2));
  g.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h);
}

function fitText(g, text, maxWidth, size, weight = 700, family = "Space Grotesk") {
  let s = size;
  do {
    g.font = `${weight} ${s}px "${family}", system-ui, sans-serif`;
    s -= 4;
  } while (g.measureText(text).width > maxWidth && s > 20);
}

/**
 * Renders the share card. Returns a canvas.
 * opts: { game: "Gem Merge", maiden, result: "12,480", detail: "Radiant · 412 moves",
 *         daily: true, date, lines: ["🟪🟪🟦🟨", …] (emoji grid, optional), artKeys }
 */
export async function renderShareCard(opts) {
  const { game, maiden, result = "", detail = "", daily = false, date = new Date(), lines = [], artKeys = ["scene", "card"] } = opts;
  try {
    await Promise.all([document.fonts.load('700 64px "Space Grotesk"'), document.fonts.load('600 32px "JetBrains Mono"')]);
  } catch {
    /* system fonts are fine */
  }
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d");
  const accent = maiden?.accent || "#FF3E8A";

  g.fillStyle = "#0B0E16";
  g.fillRect(0, 0, W, H);

  // art panel
  const art = maiden ? await loadImage(maiden, ...artKeys) : null;
  const ax = 60, ay = 60, aw = W - 120, ah = 720;
  g.save();
  roundRect(g, ax, ay, aw, ah, 36);
  g.clip();
  g.fillStyle = "#10141F";
  g.fillRect(ax, ay, aw, ah);
  if (art) cover(g, art, ax, ay, aw, ah);
  const fade = g.createLinearGradient(0, ay + ah * 0.45, 0, ay + ah);
  fade.addColorStop(0, "rgba(11,14,22,0)");
  fade.addColorStop(0.55, "rgba(11,14,22,0.7)");
  fade.addColorStop(1, "rgba(11,14,22,0.92)");
  g.fillStyle = fade;
  g.fillRect(ax, ay, aw, ah);
  g.restore();
  roundRect(g, ax, ay, aw, ah, 36);
  g.lineWidth = 6;
  g.strokeStyle = accent;
  g.stroke();

  // game name + date over the bottom of the art
  g.fillStyle = "#E9EEF6";
  fitText(g, game, aw - 80, 72);
  g.textBaseline = "alphabetic";
  g.fillText(game, ax + 40, ay + ah - 48);
  g.font = '600 30px "JetBrains Mono", ui-monospace, monospace';
  g.fillStyle = accent;
  const tag = daily ? `DAILY SIDE QUEST · ${todayString(date)}` : maiden ? `WITH ${maiden.name.toUpperCase()}` : "SIDE QUEST";
  g.fillText(tag, ax + 40, ay + ah - 140);

  // result
  let y = ay + ah + 130;
  g.fillStyle = "#E9EEF6";
  fitText(g, result, W - 120, 120, 700, "JetBrains Mono");
  g.fillText(result, 60, y);
  if (detail) {
    y += 64;
    g.fillStyle = "#B8C0D0";
    fitText(g, detail, W - 120, 40, 500);
    g.fillText(detail, 60, y);
  }
  if (lines.length) {
    y += 40;
    const size = Math.min(56, Math.floor((H - 200 - y) / lines.length) - 6);
    g.font = `${size}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    for (const line of lines) {
      y += size + 6;
      g.fillText(line, 60, y);
    }
  }

  // footer: gem + url
  g.fillStyle = "#10141F";
  g.fillRect(0, H - 130, W, 130);
  drawGem(g, 50, H - 122, 110);
  g.fillStyle = "#E9EEF6";
  g.font = '700 40px "Space Grotesk", system-ui, sans-serif';
  g.fillText("SIDEQUEST MAIDENS", 180, H - 66);
  g.font = '600 28px "JetBrains Mono", ui-monospace, monospace';
  g.fillStyle = "#3DD6C8";
  g.fillText("sidequestmaidens.com/games", 180, H - 26);
  return canvas;
}

export function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Renders and shares. Returns "shared" | "downloaded" | "cancelled".
 * opts = renderShareCard opts + { gameId, text } (text is the caption; the link is appended).
 */
export async function share(opts) {
  const canvas = await renderShareCard(opts);
  const blob = await canvasToBlob(canvas);
  const url = shareLink(opts.gameId);
  const text = `${opts.text || `${opts.game}: ${opts.result}`}\n${(opts.lines || []).join("\n")}`.trim();
  const fileName = `sidequest-${opts.gameId || "arcade"}-${todayString(opts.date)}.png`;
  const file = blob && typeof File === "function" ? new File([blob], fileName, { type: "image/png" }) : null;

  if (file && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: opts.game, text: `${text}\n${url}` });
      return "shared";
    } catch (e) {
      if (e?.name === "AbortError") return "cancelled";
      /* fall through to download */
    }
  }
  if (blob) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  await copyText(`${text}\n${url}`);
  return "downloaded";
}
