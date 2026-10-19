// The cast and their stations. This is the one file to edit when art, colours or links change.
//
// ART DROP-IN: put files in public/art/<slug>/ and list them under `art` below.
//   scene.webp / scene-sm.webp  16:9 station still (1920 / 960 wide)
//   card.webp  / card-sm.webp   optional alternate render used on the holo card
// Portrait-only art (2:3 character renders) uses `p("<slug>")`: the card shows it as-is and
// station scenes stage the figure over a blurred wash of the same art until a 16:9 scene exists.
// Anything without art renders a procedural placeholder in the Maiden's colours.
//
// Accent colours for Maidens without art yet are first guesses; replace with the bible values.

import { asset } from "../lib/paths";

export type Mood = "rain" | "neon" | "sun" | "moon" | "stars" | "smoke" | "city" | "dust" | "pixel";

export type Art = {
  scene: string;
  sceneSm: string;
  card?: string;
  cardSm?: string;
  /** Vega's bubble-pop sequence: idle (bubble) → pop → after (no bubble). */
  bubble?: { idle: string; pop: string; after: string; idleSm: string; popSm: string; afterSm: string };
  /** Art is a 2:3 character portrait rather than a 16:9 scene. */
  portrait?: boolean;
  /** Where the scene's focal point sits (0–1), used to anchor glows and the bubble hotspot. */
  focus?: { x: number; y: number };
};

export type Maiden = {
  slug: string;
  name: string;
  station: string;
  tagline: string;
  genre: string;
  bpm: [number, number];
  /** Root note + mode the ambience engine plays in. */
  key: { root: number; mode: "major" | "minor" | "dorian" | "pentatonic" };
  mood: Mood;
  use: string;
  color: string;
  color2: string;
  freq: string;
  priority: 1 | 2;
  /** Station is launched. Everyone else shows "Coming soon". */
  live?: boolean;
  signature?: string;
  art?: Art;
};

const a = (slug: string, extra: Partial<Art> = {}): Art => ({
  scene: asset(`/art/${slug}/scene.webp`),
  sceneSm: asset(`/art/${slug}/scene-sm.webp`),
  ...extra,
});

const p = (slug: string): Art => ({
  scene: asset(`/art/${slug}/card.webp`),
  sceneSm: asset(`/art/${slug}/card-sm.webp`),
  card: asset(`/art/${slug}/card.webp`),
  cardSm: asset(`/art/${slug}/card-sm.webp`),
  portrait: true,
  focus: { x: 0.72, y: 0.3 },
});

export const MAIDENS: Maiden[] = [
  {
    slug: "briar",
    name: "Briar",
    station: "Rainfall",
    tagline: "Sparse rainy lo-fi with storms rolling in.",
    genre: "Rain lo-fi",
    bpm: [70, 80],
    key: { root: 50, mode: "dorian" },
    mood: "rain",
    use: "Sleep · Study",
    color: "#8E6CFF",
    color2: "#5CFF9D",
    freq: "88.1",
    priority: 1,
    live: true,
    signature: "Lightning synced to the thunder",
    art: a("briar", { focus: { x: 0.6, y: 0.35 } }),
  },
  {
    slug: "vega",
    name: "Vega",
    station: "Neon Signal",
    tagline: "Synthwave lo-fi for late-night coding.",
    genre: "Cyber lo-fi",
    bpm: [85, 100],
    key: { root: 45, mode: "minor" },
    mood: "neon",
    use: "Coding · Deep work",
    color: "#FF3E8A",
    color2: "#3DE0F0",
    freq: "91.7",
    priority: 1,
    live: true,
    signature: "Bubble Pop",
    art: a("vega", {
      card: asset("/art/vega/card.webp"),
      cardSm: asset("/art/vega/card-sm.webp"),
      focus: { x: 0.66, y: 0.29 },
      bubble: {
        idle: asset("/art/vega/bubble.webp"),
        pop: asset("/art/vega/pop.webp"),
        after: asset("/art/vega/scene.webp"),
        idleSm: asset("/art/vega/bubble-sm.webp"),
        popSm: asset("/art/vega/pop-sm.webp"),
        afterSm: asset("/art/vega/scene-sm.webp"),
      },
    }),
  },
  {
    slug: "nova",
    name: "Nova",
    station: "Morning Focus",
    tagline: "Bright major-key lo-fi to start your day.",
    genre: "Morning lo-fi",
    bpm: [80, 90],
    key: { root: 52, mode: "major" },
    mood: "sun",
    use: "Morning study · Pomodoro",
    color: "#FF9A3D",
    color2: "#FFE07A",
    freq: "94.3",
    priority: 1,
    live: true,
    signature: "Nova's Dash",
    art: a("nova", { focus: { x: 0.42, y: 0.42 } }),
  },
  {
    slug: "tsukiyo",
    name: "Tsukiyo",
    station: "Moonlight",
    tagline: "Japanese lo-fi: koto, shakuhachi and quiet water.",
    genre: "Japanese lo-fi",
    bpm: [70, 85],
    key: { root: 50, mode: "pentatonic" },
    mood: "moon",
    use: "Meditation · Calm",
    color: "#B77CFF",
    color2: "#DCE6FF",
    freq: "96.9",
    priority: 1,
    art: p("tsukiyo"),
  },
  {
    slug: "aurelia",
    name: "Aurelia",
    station: "Starfall",
    tagline: "Ambient sleep: slow pads, almost no drums.",
    genre: "Ambient sleep",
    bpm: [60, 70],
    key: { root: 48, mode: "major" },
    mood: "stars",
    use: "Sleep · Insomnia relief",
    color: "#FFC84A",
    color2: "#8A6BFF",
    freq: "99.5",
    priority: 1,
    art: p("aurelia"),
  },
  {
    slug: "mara",
    name: "Mara",
    station: "After Hours",
    tagline: "Jazzhop from a lounge that never quite closes.",
    genre: "Jazzhop",
    bpm: [80, 90],
    key: { root: 46, mode: "dorian" },
    mood: "smoke",
    use: "Reading · Unwind",
    color: "#E3263A",
    color2: "#F5B82E",
    freq: "101.3",
    priority: 2,
    art: p("mara"),
  },
  {
    slug: "mimi",
    name: "Mimi",
    station: "Rooftop Lights",
    tagline: "City pop under a sky full of signs.",
    genre: "City pop",
    bpm: [95, 110],
    key: { root: 53, mode: "major" },
    mood: "city",
    use: "Chill · Cleaning",
    color: "#FF8FC8",
    color2: "#F0A58C",
    freq: "103.9",
    priority: 2,
    art: p("mimi"),
  },
  {
    slug: "jackie",
    name: "Jackie",
    station: "Desert Highway",
    tagline: "Dusty western lo-fi for long drives.",
    genre: "Western lo-fi",
    bpm: [75, 85],
    key: { root: 45, mode: "minor" },
    mood: "dust",
    use: "Driving · Focus",
    color: "#2ED3C6",
    color2: "#D9A15A",
    freq: "105.1",
    priority: 2,
    art: p("jackie"),
  },
  {
    slug: "tilt",
    name: "Tilt",
    station: "After Closing",
    tagline: "Chiptune lo-fi from the arcade after hours.",
    genre: "Chiptune lo-fi",
    bpm: [90, 100],
    key: { root: 48, mode: "pentatonic" },
    mood: "pixel",
    use: "Gaming · Coding",
    color: "#B6FF2E",
    color2: "#FF3EDB",
    freq: "107.7",
    priority: 2,
    art: p("tilt"),
  },
];

export const bySlug = (slug: string | undefined) => MAIDENS.find((m) => m.slug === slug);
