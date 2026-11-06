/**
 * pavitraCustomization.js
 *
 * One place for every option restriction the Pavitra store wants on top of the
 * full Jewelith catalogue. The configurators keep their complete data; they only
 * *show* what is allowed here, so changing a list below (or flipping
 * PAVITRA_CUSTOMIZATION_ENABLED to false) is all it takes to widen or undo it.
 *
 * Necklace + bracelet app (src/lib/necklace-configurator)
 *   - chain metal and charm metal: Yellow Gold + Silver only; Silver is the default
 *   - charms: Stone Charms only (no birthstone / diamond / initial / 2D / 3D)
 *   - no name pendant (necklace) and no name plate (bracelet)
 *
 * Bead bracelet app (src/lib/beeds-configurator)
 *   - no Spacers or Charms tabs, and no preset styles that contain spacers
 *     (Style 1 / Style 2) — only Custom and Full Bead remain
 *   - stone beads: 8mm and 10mm only; Green Aventurine onwards (to the end of
 *     the list) plus Green Quartz and Tiger Eye
 *   - metallic beads stay (they are already 8mm / 10mm only)
 *   - thread colour: Red, Black, Green
 */

export const PAVITRA_CUSTOMIZATION_ENABLED = true;

// ── Necklace / bracelet ──────────────────────────────────────────────────────

/** Metal codes (see NECKLACE_METALS / BRACELET_METALS): YG = Yellow Gold, SL = Silver 925. */
export const PAVITRA_METAL_CODES = ["YG", "SL"];

/** Charm metal swatch keys (CHARM_METAL_SWATCHES / BRACELET_CHARM_METAL_SWATCHES). */
export const PAVITRA_CHARM_METAL_KEYS = ["YG", "SL"];

/** "attached" is the Stone Charms category. */
export const PAVITRA_CHARM_CATEGORY_IDS = ["attached"];
export const PAVITRA_DEFAULT_CHARM_CATEGORY = "attached";

/** false hides the Charms / Text toggle and the name editor on necklace and bracelet. */
export const PAVITRA_NAME_CUSTOMIZATION = false;

/** Metal a fresh session (and Reset) starts on: Silver 925. Hex differs per jewelry type. */
export const PAVITRA_DEFAULT_METAL_HEX = { necklace: "#C0C0C0", bracelet: "#B8B8B8" };

/** Silver has no purity, so it carries no purity surcharge. */
export const getDefaultMetalHex = (jewelryType, fallbackHex) =>
    PAVITRA_CUSTOMIZATION_ENABLED
        ? PAVITRA_DEFAULT_METAL_HEX[jewelryType === "bracelet" ? "bracelet" : "necklace"]
        : fallbackHex;

/** Purity surcharge to apply with the default metal (0 for Silver, else the usual 100). */
export const getDefaultPurityPrice = () => (PAVITRA_CUSTOMIZATION_ENABLED ? 0 : 100);

export const isPavitraMetalAllowed = (code) =>
    !PAVITRA_CUSTOMIZATION_ENABLED || PAVITRA_METAL_CODES.includes(code);

export const isPavitraCharmMetalAllowed = (key) =>
    !PAVITRA_CUSTOMIZATION_ENABLED || PAVITRA_CHARM_METAL_KEYS.includes(key);

export const isPavitraCharmCategoryAllowed = (id) =>
    !PAVITRA_CUSTOMIZATION_ENABLED || PAVITRA_CHARM_CATEGORY_IDS.includes(id);

export const isNameCustomizationEnabled = () =>
    !PAVITRA_CUSTOMIZATION_ENABLED || PAVITRA_NAME_CUSTOMIZATION;

/** Charm category a fresh session should open on. */
export const getInitialCharmCategory = (fallback = "birthstones") =>
    PAVITRA_CUSTOMIZATION_ENABLED ? PAVITRA_DEFAULT_CHARM_CATEGORY : fallback;

// ── Bead bracelet ────────────────────────────────────────────────────────────

/** Bead sizes offered (ids from BEAD_SIZES). */
export const PAVITRA_BEAD_SIZE_IDS = ["8mm", "10mm"];

/**
 * Extra stone beads kept from before the "Green Aventurine onwards" block.
 * (Green Aventurine and everything after it in the BEADS list is kept as a
 * whole — see getPavitraBeads in beeds-configurator/assets.js.)
 */
export const PAVITRA_EXTRA_BEAD_KEYS = ["green-quartz", "tiger-eye"];

/** First bead of the kept "to the end" block. */
export const PAVITRA_BEADS_FROM_KEY = "green-aventurine";

/** Bead a fresh session opens with (must be one of the kept beads). */
export const PAVITRA_DEFAULT_BEAD_KEY = "green-aventurine";

export const PAVITRA_THREAD_COLOR_IDS = ["red", "black", "green"];

/** Customize tabs hidden in the bead app (metallic beads stay). */
export const PAVITRA_HIDDEN_BEAD_TAB_IDS = ["charms", "spacers"];

/** Preset styles hidden because they put spacers on the string (style-3 is already hidden). */
export const PAVITRA_HIDDEN_BEAD_STYLE_IDS = ["style-1", "style-2"];
