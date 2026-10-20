// Paths that differ between the Cloudflare build and the shareable preview build (`npm run build:preview`).

const PREVIEW = import.meta.env.MODE === "preview-artifact";

/** Public asset URL that works under any base path. */
export const asset = (p: string) => import.meta.env.BASE_URL + p.replace(/^\//, "");

const OUTBOUND = {
  youtube: "https://www.youtube.com/@sidequestmaidens",
  // Referral invite. Still under the old Whatnot name until pending orders clear and the rename is allowed.
  whatnot: "https://www.whatnot.com/invite/sidequestsupplyco",
  instagram: "https://www.instagram.com/sidequestmaidens",
  tiktok: "https://www.tiktok.com/@sidequestmaidens",
  bluesky: "https://bsky.app/profile/sidequestmaidens.com",
} as const;

/** Outbound link. On the real site it goes through /go/* (public/_redirects) so destinations can change in one place. */
export const go = (name: keyof typeof OUTBOUND) => (PREVIEW ? OUTBOUND[name] : `/go/${name}`);

export const isPreview = PREVIEW;

/** The games hub (public/games/). The preview build doesn't carry it, so it links to the live site. */
export const GAMES = PREVIEW ? "https://sidequestmaidens.com/games/" : "/games/";

/** Public addresses, routed to the owner's inbox by Cloudflare Email Routing. */
export const EMAIL = {
  hello: "hello@sidequestmaidens.com",
  support: "support@sidequestmaidens.com",
} as const;
