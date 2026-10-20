// Arcade-wide settings. Edit here; every game reads these.

export const config = {
  site: "https://sidequestmaidens.com",
  /** Printed on share cards, and the base of shared links. */
  shareUrl: "https://sidequestmaidens.com/games",
  shop: "/shop",
  /** Custom Maiden cards. Goes through public/_redirects so the destination can change in one place. */
  whatnot: "/go/whatnot",
  youtube: "/go/youtube",

  rewards: {
    // Off until the shop opens. When on, rewards with a `code` show it on unlock.
    // Client-side codes are visible to anyone who reads this file, so only use low-value codes
    // or Shopify single-use codes that are safe to leak.
    codesEnabled: false,
    codes: {
      // "sticker-10": "SIDEQUEST10",
    },
  },

  /** Optional SFX files in games/assets/sfx/ that replace the generated tones, e.g. { pop: "pop.mp3" }. */
  sfxFiles: {},
};
