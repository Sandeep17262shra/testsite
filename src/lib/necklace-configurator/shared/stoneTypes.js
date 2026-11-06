/**
 * stoneTypes.js — the stones a "Stone Charm" can be set with.
 *
 * Every stone charm (the chain-set Oval / Round / Square, the hanging Baguette /
 * Emerald / Heart / ... charms and the four 3D gem charms) used to carry a
 * diamond-like refractive stone. They now take one of the stones below: the
 * charm's stone mesh is drawn with the stone's texture (its structure) and
 * polish, and the charm remembers the choice in `charm.stoneType`.
 *
 * To add a stone: drop a square image in /public/bc-assets/stone-textures/ and
 * add an entry here. Both the necklace and the bracelet follow.
 *
 *   id        stored on the charm (charm.stoneType)
 *   label     shown in the picker, order summary and cart
 *   texture   the structure image mapped onto the stone
 *   hex       the stone's base colour - used as `charm.gemstoneColor`, as the
 *             colour while the texture loads, and for swatches/summaries
 *   uvScale   how much of the texture one stone shows (1 = whole image across
 *             the stone, 2 = a half-size, finer pattern)
 *   material  polish of the cut stone (three.js MeshPhysicalMaterial values)
 *   charms    optional. A list of the charms the stone is offered on, as
 *             "hanging:<id>" / "attached:<id>" keys (see stoneCharmKey). Leave
 *             it out and the stone is offered on every stone charm.
 */
export const STONE_TEXTURE_BASE_URL = "/bc-assets/stone-textures";
// Bump when texture files change: .webp is served immutable for a year.
const STONE_TEXTURE_VERSION = "20261106";

import { getGemGlbCharm } from "./glbGemCharms";

// Hanging charms that offer the extra stones (Emerald, Round Drop, Oval Drop).
const HANGING_DROP_CHARMS = ["hanging:emerald", "hanging:round", "hanging:oval"];

export const STONE_TYPES = [
  {
    id: "amethyst", label: "Amethyst", hex: "#8E44C8", uvScale: 1.2,
    texture: `${STONE_TEXTURE_BASE_URL}/amethyst.webp?v=${STONE_TEXTURE_VERSION}`,
    material: { roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.5 },
  },
  {
    id: "topaz", label: "Topaz", hex: "#4DA9DB", uvScale: 1.2,
    texture: `${STONE_TEXTURE_BASE_URL}/topaz.webp?v=${STONE_TEXTURE_VERSION}`,
    // Translucent: light passes through the stone (transmission), tinted blue.
    material: { roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.8, transmission: 0.55, thickness: 0.8, ior: 1.63, attenuationColor: "#3F9BD6", attenuationDistance: 1.5, specularIntensity: 1 },
  },
  {
    id: "citrine", label: "Citrine", hex: "#F2A81D", uvScale: 1.2,
    texture: `${STONE_TEXTURE_BASE_URL}/citrine.webp?v=${STONE_TEXTURE_VERSION}`,
    // Translucent: light passes through the stone (transmission), tinted amber.
    material: { roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.6, transmission: 0.5, thickness: 0.8, ior: 1.55, attenuationColor: "#F0A020", attenuationDistance: 1.5, specularIntensity: 1 },
  },
  {
    id: "pink-onyx", label: "Pink Onyx", hex: "#D987A0", uvScale: 1,
    texture: `${STONE_TEXTURE_BASE_URL}/pink-onyx.webp?v=${STONE_TEXTURE_VERSION}`,
    material: { roughness: 0.2, clearcoat: 0.8, clearcoatRoughness: 0.08, envMapIntensity: 1.1 },
  },
  {
    id: "green-onyx", label: "Green Onyx", hex: "#1F7A4A", uvScale: 1,
    texture: `${STONE_TEXTURE_BASE_URL}/green-onyx.webp?v=${STONE_TEXTURE_VERSION}`,
    material: { roughness: 0.2, clearcoat: 0.8, clearcoatRoughness: 0.08, envMapIntensity: 1.1 },
  },
  {
    id: "lapis-lazuli", label: "Lapis Lazuli", hex: "#1D3FB0", uvScale: 1.4,
    texture: `${STONE_TEXTURE_BASE_URL}/lapis-lazuli.webp?v=${STONE_TEXTURE_VERSION}`,
    material: { roughness: 0.28, clearcoat: 0.7, clearcoatRoughness: 0.12, envMapIntensity: 1 },
  },
  {
    id: "tiger-eye", label: "Tiger Eye", hex: "#A86A1A", uvScale: 1.2,
    texture: `${STONE_TEXTURE_BASE_URL}/tiger-eye.webp?v=${STONE_TEXTURE_VERSION}`,
    material: { roughness: 0.22, clearcoat: 0.9, clearcoatRoughness: 0.08, envMapIntensity: 1.1, sheen: 0.6, sheenColor: "#F2C14E" },
  },
  {
    id: "malachite", label: "Malachite", hex: "#0E7A5F", uvScale: 1.2,
    texture: `${STONE_TEXTURE_BASE_URL}/malachite.webp?v=${STONE_TEXTURE_VERSION}`,
    material: { roughness: 0.2, clearcoat: 0.85, clearcoatRoughness: 0.08, envMapIntensity: 1.1 },
  },
  // The stones below are only offered on the Emerald, Round Drop and Oval Drop
  // charms. Delete a stone's `charms` line to offer it on every stone charm.
  {
    id: "garnet", label: "Garnet", hex: "#7B1424", uvScale: 1.2,
    texture: `${STONE_TEXTURE_BASE_URL}/garnet.webp?v=${STONE_TEXTURE_VERSION}`,
    material: { roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.7 },
    charms: HANGING_DROP_CHARMS,
  },
  {
    id: "carnelian", label: "Carnelian", hex: "#D2501A", uvScale: 1,
    texture: `${STONE_TEXTURE_BASE_URL}/carnelian.webp?v=${STONE_TEXTURE_VERSION}`,
    material: { roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.4 },
    charms: HANGING_DROP_CHARMS,
  },
  {
    id: "rainbow-moonstone", label: "Rainbow Moonstone", hex: "#DCE6F6", uvScale: 1.1,
    texture: `${STONE_TEXTURE_BASE_URL}/rainbow-moonstone.webp?v=${STONE_TEXTURE_VERSION}`,
    // Milky body with a blue / rainbow sheen that shifts as the stone turns.
    material: { roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.5, sheen: 0.8, sheenRoughness: 0.35, sheenColor: "#8FB8FF", iridescence: 0.55, iridescenceIOR: 1.35 },
    charms: HANGING_DROP_CHARMS,
  },
  {
    id: "black-onyx", label: "Black Onyx", hex: "#1B1B1D", uvScale: 1.2,
    texture: `${STONE_TEXTURE_BASE_URL}/black-onyx.webp?v=${STONE_TEXTURE_VERSION}`,
    material: { roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.3 },
    charms: HANGING_DROP_CHARMS,
  },
  // Pink Ruby: the only stone the Ganesh charm offers (see STONE_ONLY_CHARMS).
  {
    id: "pink-ruby", label: "Pink Ruby", hex: "#C2255F", uvScale: 1,
    texture: `${STONE_TEXTURE_BASE_URL}/pink-ruby.webp?v=${STONE_TEXTURE_VERSION}`,
    material: { roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.6 },
    charms: ["hanging:ganesh"],
  },
];

// Charms that take ONLY the stones listed here (first = the stone they start with).
// Every other stone is hidden for them, whatever its own `charms` list says.
export const STONE_ONLY_CHARMS = {
  "hanging:ganesh": ["pink-ruby"],
};

export const DEFAULT_STONE_TYPE_ID = STONE_TYPES[0].id;
export const getStoneType = (id) => STONE_TYPES.find((s) => s.id === id) || null;
export const getStoneTypeLabel = (id) => getStoneType(id)?.label ?? null;

// Which charm a stone is being set on, as the key used in a stone's `charms`
// list. Gem (path-only) charms have no key, so they only get unrestricted stones.
export const stoneCharmKey = (charm) => {
  if (charm?.type === "hanging") return `hanging:${charm.hangingId}`;
  if (charm?.type === "attached") return `attached:${charm.attachedId}`;
  return null;
};
export const isStoneAllowedOnCharm = (stone, charmKey) => {
  if (charmKey && STONE_ONLY_CHARMS[charmKey]) return Boolean(stone) && STONE_ONLY_CHARMS[charmKey].includes(stone.id);
  return !stone?.charms || (Boolean(charmKey) && stone.charms.includes(charmKey));
};
// The stones to offer for a charm (null = no stone charm selected yet: the
// unrestricted ones only).
export const getStoneTypesForCharm = (charm) => {
  const key = stoneCharmKey(charm);
  return STONE_TYPES.filter((stone) => isStoneAllowedOnCharm(stone, key));
};
// The stone to use on a charm: the wanted one if the charm offers it, else the default.
export const resolveStoneTypeFor = (stoneTypeId, charmKey) => (
  isStoneAllowedOnCharm(getStoneType(stoneTypeId), charmKey) && getStoneType(stoneTypeId)
    ? stoneTypeId
    : (STONE_ONLY_CHARMS[charmKey]?.[0] ?? DEFAULT_STONE_TYPE_ID)
);

// The charm kinds that are "Stone Charms" (and so take a stone type).
export const STONE_CHARM_TYPES = ["attached", "hanging", "gemglb"];
// (On the bracelet the four 3D gem charms are plain path-only charms, no type.)
export const isStoneCharm = (charm) => Boolean(charm) && (
  STONE_CHARM_TYPES.includes(charm.type)
  || (!charm.type && Boolean(getGemGlbCharm(charm.path)))
);

// The fields a stone charm stores for a stone: the type, plus its base colour in
// `gemstoneColor` so everything that reads the colour (summaries, share links,
// the cart) keeps working.
export const stoneFieldsFor = (stoneTypeId) => {
  const stone = getStoneType(stoneTypeId) || STONE_TYPES[0];
  return { stoneType: stone.id, gemstoneColor: stone.hex };
};
