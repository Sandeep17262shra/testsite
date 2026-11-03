/**
 * attachedCharms.js — the "stone charms" (Oval / Round / Square).
 *
 * Unlike an ordinary charm, which HANGS off the chain, an attached charm sits
 * IN the chain, the way the name plate does: the chain is generated outward
 * from the model's own two link rings and the two halves meet again at the
 * lock. So the only things the scene needs to know about a model are where
 * those two rings are and how big they are.
 *
 * All numbers below were measured from the GLBs in
 * /public/bc-assets/attached_charm/ (model units). The three files were not
 * authored the same way round — Oval has its rings along Z, Round and Square
 * along X — so each entry says which MODEL axis is which:
 *
 *   right  model axis that runs ring-to-ring     -> scene +X (along the chain)
 *   up     model axis that points "up" the face  -> scene +Y
 *   face   model axis the stone faces            -> scene +Z (towards the viewer)
 *
 * (right x up = face for every entry, so the conversion is a pure rotation.)
 *
 * ringCenter  centre of the RIGHT-hand ring, model units. The left ring is its
 *             mirror image across the model's centre.
 * ringOuter / ringInner
 *             outer radius of the ring and radius of its hole. The wire is
 *             (outer - inner) thick, and the ring is as deep as it is thick.
 */
import * as THREE from "three";

// Bump when a file in /bc-assets/attached_charm/ is replaced: the models are
// served with a 1-year immutable cache.
export const ATTACHED_CHARM_MODEL_VERSION = "20261103";
export const withAttachedCharmVersion = (path) =>
  typeof path === "string" && path.startsWith("/bc-assets/attached_charm/") && !path.includes("?")
    ? `${path}?v=${ATTACHED_CHARM_MODEL_VERSION}`
    : path;

// Scene units per model unit. A charm is ~18 model units tip to tip, so 0.028
// makes it ~0.5 across on the bracelet's 0.92 radius ring - about the size of
// a name plate - while keeping each ring's wire (~0.034) inside the opening of
// a chain link.
export const ATTACHED_CHARM_SCALE = {
  bracelet: 0.01,
};

// `price` is a placeholder until these have catalogue products.
export const ATTACHED_CHARMS = [
  {
    id: "oval",
    name: "Oval",
    path: "/bc-assets/attached_charm/Oval.glb",
    price: 150,
    right: [0, 0, 1],
    up: [1, 0, 0],
    face: [0, 1, 0],
    ringCenter: [0, -0.365, 6.69],
    ringOuter: 2.4,
    ringInner: 1.17,
  },
  {
    id: "round",
    name: "Round",
    path: "/bc-assets/attached_charm/Round.glb",
    price: 150,
    right: [1, 0, 0],
    up: [0, 0, -1],
    face: [0, 1, 0],
    ringCenter: [7.39, 0.315, 0],
    ringOuter: 2.3,
    ringInner: 1.05,
  },
  {
    id: "square",
    name: "Square",
    path: "/bc-assets/attached_charm/Square.glb",
    price: 150,
    right: [1, 0, 0],
    up: [0, 0, -1],
    face: [0, 1, 0],
    ringCenter: [7.14, 0.31, 0],
    ringOuter: 2.29,
    ringInner: 1.05,
  },
];

export const getAttachedCharm = (id) => ATTACHED_CHARMS.find((charm) => charm.id === id) || null;

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// Model space -> the charm's own frame: X along the chain, Y up, Z towards the
// viewer, with the point midway between the two rings at the origin. That is
// the point the chain passes through, so placing the charm is just placing that
// origin on the ring.
export function getAttachedCharmMatrix(charm) {
  const basis = new THREE.Matrix4().set(
    charm.right[0], charm.right[1], charm.right[2], 0,
    charm.up[0], charm.up[1], charm.up[2], 0,
    charm.face[0], charm.face[1], charm.face[2], 0,
    0, 0, 0, 1,
  );
  // Both rings share the same height and depth, so the midpoint has no X.
  const midUp = dot(charm.ringCenter, charm.up);
  const midFace = dot(charm.ringCenter, charm.face);
  const recentre = new THREE.Matrix4().makeTranslation(0, -midUp, -midFace);
  return recentre.multiply(basis);
}

// Everything the chain generator needs, in scene units at `scale`.
//   halfSpan  distance from the charm's centre to each ring's centre
//   washer    the ring, in the same {outer, inner, depth} terms as a washer
export function getAttachedCharmDimensions(charm, scale) {
  const wire = charm.ringOuter - charm.ringInner;
  return {
    halfSpan: Math.abs(dot(charm.ringCenter, charm.right)) * scale,
    washer: {
      outer: charm.ringOuter * scale,
      inner: charm.ringInner * scale,
      depth: wire * scale,
    },
  };
}

// The stone is its own mesh in every file; its node is named "all-diamonds.*".
export const isAttachedCharmStone = (name = "") => /all-diamonds|diamond|gem|stone/i.test(name);

export const DEFAULT_ATTACHED_STONE_COLOR = "#F4F8FF";

// ─── Hanging stone charms ───────────────────────────────────────────────────
// Simple charms that HANG from the chain like an initial does: each model has a
// loop of its own at the top, which is treated like an initial's washer, and a
// bail ring goes through it up onto the chain link.
//
// Same measuring conventions as ATTACHED_CHARMS, except that `ringCenter` is the
// centre of the model's single top loop (its centre is the charm's origin, so
// the loop sits exactly where the washer would), and `ringOuter` / `ringInner`
// are that loop's outer and hole radii. `pearl` marks the "Sphere" mesh as a
// pearl rather than a gem.
const HANGING_UP_Z = { right: [1, 0, 0], up: [0, 0, -1], face: [0, 1, 0] };
const HANGING_UP_Y = { right: [1, 0, 0], up: [0, 1, 0], face: [0, 0, 1] };
const hangingEntry = (id, name, file, axes, up, face, outer, inner, extra = {}) => ({
  id, name, path: `/bc-assets/hanging_charm/${file}`, price: 150, ...axes,
  ringCenter: axes === HANGING_UP_Z ? [0, face, -up] : [0, up, face],
  ringOuter: outer, ringInner: inner, ...extra,
});
export const HANGING_CHARMS = [
  hangingEntry('baguette', 'Baguette', 'baguette-gem-charm.glb', HANGING_UP_Z, 5.53, 0.24, 2.1, 1.09),
  hangingEntry('emerald', 'Emerald', 'emerald-gem-charm.glb', HANGING_UP_Z, 5.08, 0.28, 2.39, 1.17),
  hangingEntry('emerald-flat', 'Emerald Flat', 'emerald-gem-flat-charm.glb', HANGING_UP_Z, 7.49, -0.82, 2.3, 1.2),
  hangingEntry('heart', 'Heart', 'heart-gem-charm.glb', HANGING_UP_Z, 5.46, 0.17, 2.36, 1.33),
  hangingEntry('oval', 'Oval Drop', 'oval-gem-charm.glb', HANGING_UP_Z, 5.5, 0.25, 2.4, 1.17),
  hangingEntry('oval-flat', 'Oval Flat', 'oval-gem-flat-charm.glb', HANGING_UP_Z, 5.79, -0.63, 2.55, 1.32),
  hangingEntry('pear', 'Pear', 'pear-gem-charm.glb', HANGING_UP_Z, 5.64, 0.13, 2.39, 1.15),
  hangingEntry('round', 'Round Drop', 'round-gem-charm.glb', HANGING_UP_Y, 6.06, -1.89, 2.39, 1.06),
  hangingEntry('pearl', 'Pearl', 'spherical-pearl-charm.glb', HANGING_UP_Y, 6.33, -0.05, 2.04, 0.91, { pearl: true }),
  // Crystal point (amethyst-like prism, metal cap and loop). The model is upside
  // down in the file: its loop is at -Y and the point at +Y, so "up" is -Y.
  {
    id: 'crystal', name: 'Crystal', path: '/bc-assets/hanging_charm/crystal-charm.glb', price: 150,
    right: [1, 0, 0], up: [0, -1, 0], face: [0, 0, -1],
    ringCenter: [0, -2.24, 0], ringOuter: 2.09, ringInner: 0.97, crystal: true,
  },
];
export const getHangingCharm = (id) => HANGING_CHARMS.find((charm) => charm.id === id) || null;

// Scene units per model unit. A hanging charm is ~12 model units tall, about the
// height of an initial's letter (0.11 on the bracelet, 0.55 on the necklace).
export const HANGING_CHARM_SCALE = { bracelet: 0.01, necklace: 0.05 };

// ─── SCALE TUNING (hanging charms only) ─────────────────────────────────────
// A multiplier per charm, on top of HANGING_CHARM_SCALE above: 1 = default size,
// 1.25 = 25% bigger, 0.8 = 20% smaller. Set the bracelet and the necklace
// separately. The charm scales about the centre of its own loop, so the bail
// ring stays threaded through it; the bail itself keeps its size, so don't go
// much below ~0.6 or the loop's hole gets too small for it.
export const HANGING_CHARM_SCALE_TUNING = {
  baguette:       { bracelet: 1.2, necklace: 1.3 },
  emerald:        { bracelet: 1.2, necklace: 1.2 },
  'emerald-flat': { bracelet: 0.8, necklace: 0.9 },
  heart:          { bracelet: 0.9, necklace: 1 },
  oval:           { bracelet: 1, necklace: 1.2 },
  'oval-flat':    { bracelet: 1, necklace: 1.2 },
  pear:           { bracelet: 1, necklace: 1.3 },
  round:          { bracelet: 1, necklace: 1.2 },
  pearl:          { bracelet: 1, necklace: 1.2 },
  crystal:        { bracelet: 0.8, necklace: 0.8 },
};
// Final scene scale for a hanging charm; `where` is "bracelet" or "necklace".
export const getHangingCharmScale = (id, where) =>
  HANGING_CHARM_SCALE[where] * (HANGING_CHARM_SCALE_TUNING[id]?.[where] ?? 1);

// ─── POSITION TUNING (hanging charms + the four 3D gem charms) ──────────────
// Nudges the WHOLE charm (its bail ring goes with it) so it sits where you want
// on the link it hangs from. Set the bracelet and the necklace separately.
//   x: + moves it to the right, - to the left
//   y: + moves it UP (towards the chain), - moves it down
//   z: + moves it OUT towards the viewer / away from the bracelet centre, - moves it back
// Units are bracelet scene units (0.01 is a small nudge, 0.05 is big). The
// necklace is drawn 5x larger, so its numbers are multiplied by 5 for you:
// write the same kind of small value for both.
// Keys: the hanging charm ids, plus princess / patel / elephant / camel.
const NO_NUDGE = { x: 0, y: 0, z: 0 };
export const CHARM_POSITION_TUNING = {
  baguette:       { bracelet: { x: 0, y: 0.01, z: 0.03 }, necklace: { x: 0, y: 0, z: 0 } },
  emerald:        { bracelet: { x: 0, y: 0.01, z: 0.03 }, necklace: { x: 0, y: 0, z: 0 } },
  'emerald-flat': { bracelet: { x: 0, y: 0.01, z: 0.03 }, necklace: { x: 0, y: 0, z: 0 } },
  heart:          { bracelet: { x: 0, y: 0.01, z: 0.03 }, necklace: { x: 0, y: 0, z: 0 } },
  oval:           { bracelet: { x: 0, y: 0.01, z: 0.03 }, necklace: { x: 0, y: 0, z: 0 } },
  'oval-flat':    { bracelet: { x: 0, y: 0.01, z: 0.03 }, necklace: { x: 0, y: 0, z: 0 } },
  pear:           { bracelet: { x: 0, y: 0.01, z: 0.03 }, necklace: { x: 0, y: 0, z: 0 } },
  round:          { bracelet: { x: 0, y: 0.01, z: 0.03 }, necklace: { x: 0, y: 0, z: 0 } },
  pearl:          { bracelet: { x: 0, y: 0.01, z: 0.03 }, necklace: { x: 0, y: 0, z: 0 } },
  crystal:        { bracelet: { x: 0, y: 0.01, z: 0.03 }, necklace: { x: 0, y: 0, z: 0 } },
  princess:       { bracelet: { x: 0, y: 0.01, z: 0.03 },    necklace: { x: 0, y: 0, z: 0 } },
  patel:          { bracelet: { x: 0, y: 0.01, z: 0.03 },    necklace: { x: 0, y: 0, z: 0 } },
  elephant:       { bracelet: { x: 0, y: 0.01, z: 0.03 },    necklace: { x: 0, y: 0, z: 0 } },
  camel:          { bracelet: { x: 0, y: 0.01, z: 0.03 },    necklace: { x: 0, y: 0, z: 0 } },
};
// Scene-unit nudge for a charm; `where` is "bracelet" or "necklace".
export const getCharmNudge = (id, where) => {
  const n = CHARM_POSITION_TUNING[id]?.[where] ?? NO_NUDGE;
  const k = where === 'necklace' ? 5 : 1;
  return [(n.x ?? 0) * k, (n.y ?? 0) * k, (n.z ?? 0) * k];
};

// ─── Icons (public/bc-assets/images/charms) ─────────────────────────────────
const ICON_DIR = "/bc-assets/images/charms/";
const ATTACHED_CHARM_ICONS = {
  oval: "oval-gem-chain-charm.webp",
  round: "round-gem-chain-charm.webp",
  square: "princess-gem-chain-charm.webp",
};
const HANGING_CHARM_ICONS = {
  baguette: "baguette-gem-charm.webp",
  emerald: "emerald-gem-charm.webp",
  "emerald-flat": "emerald-gem-flat-charm.webp",
  heart: "heart-gem-charm.webp",
  oval: "oval-gem-charm.webp",
  "oval-flat": "oval-gem-flat-charm.webp",
  pear: "pear-gem-charm.webp",
  round: "round-gem-charm.webp",
  pearl: "crystal-charm.webp",
  crystal: "prism-charm.webp",
};
export const getAttachedCharmIcon = (id) => (ATTACHED_CHARM_ICONS[id] ? ICON_DIR + ATTACHED_CHARM_ICONS[id] : null);
export const getHangingCharmIcon = (id) => (HANGING_CHARM_ICONS[id] ? ICON_DIR + HANGING_CHARM_ICONS[id] : null);

export const isAttachedCharmPearl = (name = "") => /sphere|pearl/i.test(name);
