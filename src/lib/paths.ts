// Paths that differ between the Cloudflare build and the shareable preview build (`npm run build:preview`).

const PREVIEW = import.meta.env.MODE === "preview-artifact";

/** Public asset URL that works under any base path. */
export const asset = (p: string) => import.meta.env.BASE_URL + p.replace(/^\//, "");

const OUTBOUND = {
  youtube: "https://www.youtube.com/@sidequestlofi",
  whatnot: "https://www.whatnot.com/user/sidequestsupplyco",
  instagram: "https://www.instagram.com/sidequestforge",
  tiktok: "https://www.tiktok.com/@sidequestforge",
  bluesky: "https://bsky.app/profile/sidequestforge.com",
} as const;

/** Outbound link. On the real site it goes through /go/* (public/_redirects) so destinations can change in one place. */
export const go = (name: keyof typeof OUTBOUND) => (PREVIEW ? OUTBOUND[name] : `/go/${name}`);

export const isPreview = PREVIEW;
