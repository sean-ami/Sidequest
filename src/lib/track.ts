// Per-video attribution. Video descriptions link to /<maiden>?v=<tag>; station pages report the
// visit (and later clicks) to /api/hit, which counts them by station × source. See worker/index.ts.

import { isPreview } from "./paths";

export type TrackEvent = "visit" | "playlist" | "video" | "youtube" | "shop";

// The page this visit started on. Any later station view came from inside the site.
const LANDING = typeof window === "undefined" ? "" : window.location.pathname;
let leftLanding = false;

/** Called by the layout on every route change. */
export function notePageView(pathname: string) {
  if (pathname !== LANDING) leftLanding = true;
}

/** Where this station view came from: the ?v= tag, a direct visit, or a page elsewhere on the site. */
export function sourceFor(pathname: string, search: string) {
  const v = new URLSearchParams(search).get("v")?.toLowerCase().trim();
  if (v && /^[a-z0-9][a-z0-9_-]{0,39}$/.test(v)) return v;
  return pathname === LANDING && !leftLanding ? "direct" : "site";
}

export function track(slug: string, event: TrackEvent, src: string) {
  if (isPreview || typeof navigator === "undefined") return;
  const body = new Blob([JSON.stringify({ slug, event, src })], { type: "application/json" });
  try {
    if (!navigator.sendBeacon?.("/api/hit", body)) {
      fetch("/api/hit", { method: "POST", body, keepalive: true }).catch(() => {});
    }
  } catch {
    // counting is best-effort; never break the page over it
  }
}
