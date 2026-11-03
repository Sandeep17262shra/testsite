/**
 * beadedProductIds.js
 *
 * Central registry of product IDs for the Beaded Bracelet configurator
 * (same idea as necklaceProductIds.js / braceletProductIds.js).
 *
 * Every selectable option in the configurator has one product ID. The store's
 * pricing API (`beaded.products[]`) is matched on `product_id`, and it controls
 * the option's name, price and active / inactive status.
 *
 * ID prefixes:
 *   BBLS = Beaded Bracelet String length     (BBLS01 - BBLS04)
 *   BBST = Beaded Bracelet Style             (BBST01 - BBST04)
 *   BBD  = Beaded Bracelet Bead (stone)      (BBD01  - BBD29)
 *   BBSZ = Beaded Bracelet bead SiZe         (BBSZ01 - BBSZ04)
 *   BBSP = Beaded Bracelet SPacer (classic)  (BBSP01 - BBSP14)
 *   BBMS = Beaded Bracelet Metalic Spacer    (BBMS01 - BBMS19, number = sN model)
 *   BBC  = Beaded Bracelet Charm             (BBC01  - BBC12)
 *   BBTC = Beaded Bracelet Thread Colour     (BBTC01 - BBTC05)
 *
 * `proposed: true` marks IDs that are NOT in the first API sample
 * (beaded_sample_products CSV). They follow the same naming scheme and must be
 * created with exactly these IDs in the store admin / API. Until the API returns
 * them, the configurator keeps using its built-in name, price and "active".
 *
 * `assetKey` is the key used in `./assets.js`, so the price layer can go from a
 * picked asset to its product ID.
 */

// ── String length (BBLS01 - BBLS04) ───────────────────────────────────────────
export const BEADED_STRING_LENGTH_IDS = {
  length4:   { id: "BBLS01", rawLabel: "4 inch",   assetKey: "4"   },
  length4_5: { id: "BBLS02", rawLabel: "4.5 inch", assetKey: "4.5" },
  length5:   { id: "BBLS03", rawLabel: "5 inch",   assetKey: "5"   },
  length5_5: { id: "BBLS04", rawLabel: "5.5 inch", assetKey: "5.5" },
};

// ── Style (BBST01 - BBST04) ───────────────────────────────────────────────────
export const BEADED_STYLE_IDS = {
  empty:    { id: "BBST01", rawLabel: "Empty",     assetKey: "empty"     },
  fullBead: { id: "BBST02", rawLabel: "Full Bead", assetKey: "full-bead" },
  style1:   { id: "BBST03", rawLabel: "Style 1",   assetKey: "style-1"   },
  style2:   { id: "BBST04", rawLabel: "Style 2",   assetKey: "style-2"   },
};

// ── Beads ─────────────────────────────────────────────────────────────────────
// BBD01 - BBD14: stone beads in the API sample.
// BBD15 - BBD29: newer beads (proposed IDs, add them to the API with these IDs).
export const BEADED_BEAD_IDS = {
  amethyst:      { id: "BBD01", rawLabel: "Amethyst",      assetKey: "amethyst" },
  clearQuartz:   { id: "BBD02", rawLabel: "Clear Quartz",  assetKey: "clear-quartz" },
  greenQuartz:   { id: "BBD03", rawLabel: "Green Quartz",  assetKey: "green-quartz" },
  jadeStone:     { id: "BBD04", rawLabel: "Jade Stone",    assetKey: "jade-stone" },
  moonstone:     { id: "BBD05", rawLabel: "Moonstone",     assetKey: "moonstone" },
  mossStone:     { id: "BBD06", rawLabel: "Moss Stone",    assetKey: "moss-stone" },
  orangeQuartz:  { id: "BBD07", rawLabel: "Orange Quartz", assetKey: "orange-quartz" },
  peachQuartz:   { id: "BBD08", rawLabel: "Peach Quartz",  assetKey: "peach-quartz" },
  pyrite:        { id: "BBD09", rawLabel: "Pyrite",        assetKey: "pyrite" },
  skyQuartz:     { id: "BBD10", rawLabel: "Sky Quartz",    assetKey: "sky-quartz" },
  tigerEye:      { id: "BBD11", rawLabel: "Tiger Eye",     assetKey: "tiger-eye" },
  // Spelled "Tuorquiose" in the API / asset file name — kept as-is so they match.
  tuorquiose:    { id: "BBD12", rawLabel: "Tuorquiose",    assetKey: "tuorquiose" },
  whiteMarble:   { id: "BBD13", rawLabel: "White Marble",  assetKey: "white-marble" },
  yellowQuartz:  { id: "BBD14", rawLabel: "Yellow Quartz", assetKey: "yellow-quartz" },

  // New beads (proposed IDs)
  greenAventurine: { id: "BBD15", rawLabel: "Green Aventurine", assetKey: "green-aventurine", proposed: true },
  ruby:            { id: "BBD16", rawLabel: "Ruby",             assetKey: "ruby",             proposed: true },
  tspMoti:         { id: "BBD17", rawLabel: "TSP Moti",         assetKey: "tsp-moti",         proposed: true },
  agate:           { id: "BBD18", rawLabel: "Agate",            assetKey: "agate",            proposed: true },
  apatite:         { id: "BBD19", rawLabel: "Apatite",          assetKey: "apatite",          proposed: true },
  blackOnyx:       { id: "BBD20", rawLabel: "Black Onyx",       assetKey: "black-onyx",       proposed: true },
  citrine:         { id: "BBD21", rawLabel: "Citrine",          assetKey: "citrine",          proposed: true },
  lapis:           { id: "BBD22", rawLabel: "Lapis Lazuli",     assetKey: "lapis",            proposed: true },
  malachite:       { id: "BBD23", rawLabel: "Malachite",        assetKey: "malachite",        proposed: true },
  pinkTigerEye:    { id: "BBD24", rawLabel: "Pink Tiger Eye",   assetKey: "pink-tiger-eye",   proposed: true },
  sunStone:        { id: "BBD25", rawLabel: "Sunstone",         assetKey: "sun-stone",        proposed: true },
  rudraksh:        { id: "BBD26", rawLabel: "Rudraksh",         assetKey: "rudraksh",         proposed: true },
  pearlStar:       { id: "BBD27", rawLabel: "Pearl Star",       assetKey: "pearl-star",       proposed: true },
  firosha:         { id: "BBD28", rawLabel: "Firosha",          assetKey: "firosha",          proposed: true },
  amethystStar:    { id: "BBD29", rawLabel: "Amethyst Star",    assetKey: "amethyst-star",    proposed: true },
};

// ── Bead size (BBSZ01 - BBSZ04) ───────────────────────────────────────────────
export const BEADED_BEAD_SIZE_IDS = {
  mm6:  { id: "BBSZ01", rawLabel: "6mm",  assetKey: "6mm",  mm: 6  },
  mm8:  { id: "BBSZ02", rawLabel: "8mm",  assetKey: "8mm",  mm: 8  },
  mm10: { id: "BBSZ03", rawLabel: "10mm", assetKey: "10mm", mm: 10 },
  mm12: { id: "BBSZ04", rawLabel: "12mm", assetKey: "12mm", mm: 12 },
};

// ── Spacers — "Spacers" tab (classic S1 - S14) ────────────────────────────────
// assetKey matches CLASSIC_SEPARATORS in assets.js ("legacy-sN").
export const BEADED_SPACER_IDS = {
  s1:  { id: "BBSP01", rawLabel: "S1",  assetKey: "legacy-s1"  },
  s2:  { id: "BBSP02", rawLabel: "S2",  assetKey: "legacy-s2"  },
  s3:  { id: "BBSP03", rawLabel: "S3",  assetKey: "legacy-s3"  },
  s4:  { id: "BBSP04", rawLabel: "S4",  assetKey: "legacy-s4"  },
  s5:  { id: "BBSP05", rawLabel: "S5",  assetKey: "legacy-s5"  },
  s6:  { id: "BBSP06", rawLabel: "S6",  assetKey: "legacy-s6"  },
  s7:  { id: "BBSP07", rawLabel: "S7",  assetKey: "legacy-s7"  },
  s8:  { id: "BBSP08", rawLabel: "S8",  assetKey: "legacy-s8"  },
  s9:  { id: "BBSP09", rawLabel: "S9",  assetKey: "legacy-s9"  },
  s10: { id: "BBSP10", rawLabel: "S10", assetKey: "legacy-s10" },
  s11: { id: "BBSP11", rawLabel: "S11", assetKey: "legacy-s11" },
  s12: { id: "BBSP12", rawLabel: "S12", assetKey: "legacy-s12" },
  s13: { id: "BBSP13", rawLabel: "S13", assetKey: "legacy-s13" },
  s14: { id: "BBSP14", rawLabel: "S14", assetKey: "legacy-s14" },
};

// ── Metalic spacers — "Metalic Beads" tab (proposed IDs) ──────────────────────
// The number in the ID is the spacer model number (s1.glb ... s19.glb), so
// BBMS19 is always s19. s16 / s17 are retired duplicates and have no ID.
// assetKey is the spacerKey in METALIC_BEADS / the key in SEPARATORS.
export const BEADED_METALIC_SPACER_IDS = {
  s1:  { id: "BBMS01", rawLabel: "Lotus",            assetKey: "s1",  proposed: true },
  s2:  { id: "BBMS02", rawLabel: "Lotus Bloom",      assetKey: "s2",  proposed: true },
  s3:  { id: "BBMS03", rawLabel: "Om",               assetKey: "s3",  proposed: true },
  s4:  { id: "BBMS04", rawLabel: "Spacer S4",        assetKey: "s4",  proposed: true },
  s5:  { id: "BBMS05", rawLabel: "Solar Chakra",     assetKey: "s5",  proposed: true },
  s6:  { id: "BBMS06", rawLabel: "Heart Chakra",     assetKey: "s6",  proposed: true },
  s7:  { id: "BBMS07", rawLabel: "Throat Chakra",    assetKey: "s7",  proposed: true },
  s8:  { id: "BBMS08", rawLabel: "Silver Twister",   assetKey: "s8",  proposed: true },
  s9:  { id: "BBMS09", rawLabel: "Gold Twister",     assetKey: "s9",  proposed: true },
  s10: { id: "BBMS10", rawLabel: "Anahata",          assetKey: "s10", proposed: true },
  s11: { id: "BBMS11", rawLabel: "Compass Rose",     assetKey: "s11", proposed: true },
  s12: { id: "BBMS12", rawLabel: "Amethyst Wheel",   assetKey: "s12", proposed: true },
  s13: { id: "BBMS13", rawLabel: "Circle Medallion", assetKey: "s13", proposed: true },
  s14: { id: "BBMS14", rawLabel: "Tree of Life",     assetKey: "s14", proposed: true },
  s15: { id: "BBMS15", rawLabel: "Spacer S15",       assetKey: "s15", proposed: true },
  s18: { id: "BBMS18", rawLabel: "Spacer S18",       assetKey: "s18", proposed: true },
  s19: { id: "BBMS19", rawLabel: "Sacred Geometry",  assetKey: "s19", proposed: true },
};

// ── Charms (BBC01 - BBC12) ────────────────────────────────────────────────────
// BBC12 "Hello Kitty" is in the API sample but there is no artwork for it in the
// configurator yet (assetKey: null) — it is registered so its ID is reserved.
export const BEADED_CHARM_IDS = {
  catFace:      { id: "BBC01", rawLabel: "Cat Face",      assetKey: "cat-face" },
  daisy:        { id: "BBC02", rawLabel: "Daisy",         assetKey: "daisy" },
  flower:       { id: "BBC03", rawLabel: "Flower",        assetKey: "flower" },
  heart:        { id: "BBC04", rawLabel: "Heart",         assetKey: "heart" },
  kitten:       { id: "BBC05", rawLabel: "Kitten",        assetKey: "kitten" },
  moon:         { id: "BBC06", rawLabel: "Moon",          assetKey: "moon-2" },
  crescentMoon: { id: "BBC07", rawLabel: "Crescent Moon", assetKey: "moon" },
  paw:          { id: "BBC08", rawLabel: "Paw",           assetKey: "paw" },
  puppy:        { id: "BBC09", rawLabel: "Puppy",         assetKey: "puppy" },
  rainbow:      { id: "BBC10", rawLabel: "Rainbow",       assetKey: "rainbow" },
  tulip:        { id: "BBC11", rawLabel: "Tulip",         assetKey: "tulip" },
  helloKitty:   { id: "BBC12", rawLabel: "Hello Kitty",   assetKey: null },
};

// ── Thread colour (BBTC01 - BBTC05, proposed IDs) ─────────────────────────────
export const BEADED_THREAD_COLOR_IDS = {
  red:    { id: "BBTC01", rawLabel: "Red",    assetKey: "red",    proposed: true },
  black:  { id: "BBTC02", rawLabel: "Black",  assetKey: "black",  proposed: true },
  yellow: { id: "BBTC03", rawLabel: "Yellow", assetKey: "yellow", proposed: true },
  green:  { id: "BBTC04", rawLabel: "Green",  assetKey: "green",  proposed: true },
  white:  { id: "BBTC05", rawLabel: "White",  assetKey: "white",  proposed: true },
};

// ── Grouped export ────────────────────────────────────────────────────────────
export const BEADED_PRODUCT_IDS = {
  string_length: BEADED_STRING_LENGTH_IDS,
  style:         BEADED_STYLE_IDS,
  bead:          BEADED_BEAD_IDS,
  bead_size:     BEADED_BEAD_SIZE_IDS,
  spacer:        BEADED_SPACER_IDS,
  metalic_spacer: BEADED_METALIC_SPACER_IDS,
  charm:         BEADED_CHARM_IDS,
  thread_color:  BEADED_THREAD_COLOR_IDS,
};

// ── Reverse lookups ───────────────────────────────────────────────────────────
const byField = (map, field) =>
  Object.fromEntries(
    Object.entries(map)
      .filter(([, entry]) => entry[field] != null)
      .map(([key, entry]) => [entry[field], { key, ...entry }])
  );

export const BEADED_STRING_LENGTH_BY_ASSET_KEY = byField(BEADED_STRING_LENGTH_IDS, "assetKey");
export const BEADED_STYLE_BY_ASSET_KEY         = byField(BEADED_STYLE_IDS, "assetKey");
export const BEADED_BEAD_BY_ASSET_KEY          = byField(BEADED_BEAD_IDS, "assetKey");
export const BEADED_BEAD_SIZE_BY_ASSET_KEY     = byField(BEADED_BEAD_SIZE_IDS, "assetKey");
export const BEADED_SPACER_BY_ASSET_KEY        = byField(BEADED_SPACER_IDS, "assetKey");
export const BEADED_METALIC_SPACER_BY_ASSET_KEY = byField(BEADED_METALIC_SPACER_IDS, "assetKey");
export const BEADED_CHARM_BY_ASSET_KEY         = byField(BEADED_CHARM_IDS, "assetKey");
export const BEADED_THREAD_COLOR_BY_ASSET_KEY  = byField(BEADED_THREAD_COLOR_IDS, "assetKey");

/** Every registered entry, flat: [{ category, key, id, rawLabel, assetKey, proposed? }, ...] */
export const BEADED_ALL_PRODUCTS = Object.entries(BEADED_PRODUCT_IDS).flatMap(
  ([category, map]) => Object.entries(map).map(([key, entry]) => ({ category, key, ...entry }))
);

/** product_id -> registry entry (with its category). */
export const BEADED_PRODUCT_BY_ID = Object.fromEntries(
  BEADED_ALL_PRODUCTS.map((entry) => [entry.id, entry])
);

// ── Helpers: configurator asset -> product ID ─────────────────────────────────

/** @param {string} lengthId  "4" | "4.5" | "5" | "5.5" ("free" has no product) */
export const getBeadedStringLengthProductId = (lengthId) =>
  BEADED_STRING_LENGTH_BY_ASSET_KEY[String(lengthId)]?.id;

/** @param {string} styleId  "empty" | "full-bead" | "style-1" | "style-2" */
export const getBeadedStyleProductId = (styleId) =>
  BEADED_STYLE_BY_ASSET_KEY[String(styleId)]?.id;

/** @param {string} beadKey  canonical key from BEADS, e.g. "tiger-eye" */
export const getBeadedBeadProductId = (beadKey) =>
  BEADED_BEAD_BY_ASSET_KEY[String(beadKey)]?.id;

/** @param {string} sizeId  "6mm" | "8mm" | "10mm" | "12mm" */
export const getBeadedBeadSizeProductId = (sizeId) =>
  BEADED_BEAD_SIZE_BY_ASSET_KEY[String(sizeId || "").toLowerCase()]?.id;

/** @param {string} spacerKey  classic spacer key from CLASSIC_SEPARATORS, e.g. "legacy-s3" */
export const getBeadedSpacerProductId = (spacerKey) =>
  BEADED_SPACER_BY_ASSET_KEY[String(spacerKey)]?.id;

/** @param {string} spacerKey  metalic spacer model key, e.g. "s1" */
export const getBeadedMetalicSpacerProductId = (spacerKey) =>
  BEADED_METALIC_SPACER_BY_ASSET_KEY[String(spacerKey || "").toLowerCase()]?.id;

/** @param {string} charmKey  key from BEAD_CHARMS, e.g. "moon-2" */
export const getBeadedCharmProductId = (charmKey) =>
  BEADED_CHARM_BY_ASSET_KEY[String(charmKey)]?.id;

/** @param {string} threadColorId  "red" | "black" | "yellow" | "green" | "white" */
export const getBeadedThreadColorProductId = (threadColorId) =>
  BEADED_THREAD_COLOR_BY_ASSET_KEY[String(threadColorId)]?.id;

/**
 * Product ID for any placed pattern asset ("bead" | "spacer" | "charm").
 * A spacer is either a classic spacer ("legacy-sN") or a metalic spacer ("sN").
 */
export function getBeadedPatternAssetProductId(type, asset) {
  if (!asset) return undefined;
  if (type === "bead") return getBeadedBeadProductId(asset.key);
  if (type === "charm") return getBeadedCharmProductId(asset.key);
  if (type === "spacer") {
    return (
      getBeadedSpacerProductId(asset.key) ||
      getBeadedMetalicSpacerProductId(asset.spacerKey || asset.key)
    );
  }
  return undefined;
}

export default BEADED_PRODUCT_IDS;
