// 1080x1350 share card on canvas, shared with the Web Share API (file) or downloaded as a PNG.

const W = 1080;
const H = 1350;
const SITE = "sidequestmaidens.com/games";

function loadImage(src) {
  return new Promise((res) => {
    if (!src) return res(null);
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });
}

function cover(ctx, img, x, y, w, h) {
  const r = Math.max(w / img.width, h / img.height);
  const iw = img.width * r, ih = img.height * r;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}

function gem(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = r;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Renders the card and returns a PNG Blob.
 * opts: { maiden: {name, accent, files}, game: "Gem Merge", result: "2,048 · Radiant",
 *         lines: ["Moves 212"], day: "2026-11-01" (for dailies), voted: bool, extra: canvas => void }
 */
export async function renderCard({ maiden, game, result, lines = [], day = null, voted = false, extra } = {}) {
  try { await Promise.all([document.fonts.load('700 64px "Space Grotesk"'), document.fonts.load('600 32px "JetBrains Mono"')]); } catch { /* use fallback */ }
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  const accent = maiden?.accent || "#3DD6C8";

  ctx.fillStyle = "#0B0E16";
  ctx.fillRect(0, 0, W, H);
  const img = await loadImage(maiden?.files?.card || maiden?.files?.scene);
  const artH = 820;
  if (img) {
    cover(ctx, img, 0, 0, W, artH);
  } else {
    const g = ctx.createRadialGradient(W / 2, 300, 40, W / 2, 300, 700);
    g.addColorStop(0, accent);
    g.addColorStop(1, "#0B0E16");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, artH);
  }
  const fade = ctx.createLinearGradient(0, artH - 320, 0, artH);
  fade.addColorStop(0, "rgba(11,14,22,0)");
  fade.addColorStop(1, "#0B0E16");
  ctx.fillStyle = fade;
  ctx.fillRect(0, artH - 320, W, 320);

  extra?.(ctx, c);

  const x = 72;
  let y = artH + 20;
  ctx.fillStyle = accent;
  ctx.font = '600 30px "JetBrains Mono", monospace';
  ctx.fillText((day ? `DAILY SIDE QUEST · ${day}` : "SIDE QUEST").toUpperCase(), x, y);
  y += 84;
  ctx.fillStyle = "#E9EEF6";
  ctx.font = '700 76px "Space Grotesk", sans-serif';
  ctx.fillText(game || "Side Quests", x, y);
  y += 90;
  ctx.font = '700 64px "JetBrains Mono", monospace';
  ctx.fillStyle = accent;
  ctx.fillText(String(result ?? ""), x, y);
  ctx.font = '500 36px "Space Grotesk", sans-serif';
  ctx.fillStyle = "#9AA4B8";
  for (const l of lines.slice(0, 3)) { y += 56; ctx.fillText(l, x, y); }
  if (voted) { y += 56; ctx.fillStyle = "#3DD6C8"; ctx.fillText("I voted on who's next", x, y); }

  gem(ctx, x + 18, H - 70, 18, "#FF3E8A");
  ctx.fillStyle = "#E9EEF6";
  ctx.font = '600 32px "JetBrains Mono", monospace';
  ctx.fillText(SITE, x + 56, H - 58);

  return new Promise((res) => c.toBlob((b) => res(b), "image/png"));
}

/** Share link with UTM tags for this game. */
export function shareUrl(gameId) {
  const u = new URL(`/games/${gameId ? gameId + "/" : ""}`, location.origin);
  u.searchParams.set("utm_source", "share");
  u.searchParams.set("utm_medium", "game");
  u.searchParams.set("utm_campaign", gameId || "hub");
  return u.href;
}

/** Shares the card (Web Share with file), else downloads the PNG and copies the text. */
export async function share({ gameId, text, ...card }) {
  const blob = await renderCard(card);
  const url = shareUrl(gameId);
  const msg = `${text || card.game || "Side Quests"} ${url}`;
  const file = blob && new File([blob], `side-quest-${gameId || "card"}.png`, { type: "image/png" });
  try {
    if (file && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text: msg });
      return "shared";
    }
  } catch (e) {
    if (e?.name === "AbortError") return "cancelled";
  }
  if (blob) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  try { await navigator.clipboard.writeText(msg); } catch { /* clipboard blocked */ }
  return "downloaded";
}
