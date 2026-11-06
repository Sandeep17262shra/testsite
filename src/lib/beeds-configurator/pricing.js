import { DEFAULT_BEAD_SIZE_ID } from "./assets";
import {
  getBeadedAssetLabel,
  getBeadedBeadPrice,
  getBeadedCharmPrice,
  getBeadedSpacerPrice,
  getBeadedStringLengthPrice,
  getBeadedStylePrice,
  getBeadedThreadColorPrice,
} from "./beadedPriceConfig";

// Built-in prices, used when the store catalogue (API / fallback file) has no
// row for an item. With a catalogue loaded, prices come from the API by
// product_id — see beadedPriceConfig.js and data/beadedProductIds.js.
export const DEFAULT_BEAD_UNIT_PRICE = 8;
export const DEFAULT_SPACER_UNIT_PRICE = 4;

/** Thread/string is included unless the store prices the length (BBLS*) in its catalogue. */
export function getJewelryPriceForLength(lengthId, _displayInches) {
  return getBeadedStringLengthPrice(lengthId);
}

/** String length + style + thread colour. All 0 unless the store prices them in its catalogue. */
export function getJewelrySetupPrice({ lengthId, styleId, threadColorId } = {}) {
  return (
    getJewelryPriceForLength(lengthId) +
    getBeadedStylePrice(styleId) +
    getBeadedThreadColorPrice(threadColorId)
  );
}

export function getBeadItemPrice(bead, sizeId = DEFAULT_BEAD_SIZE_ID) {
  return getBeadedBeadPrice(bead, sizeId);
}

export function getSpacerItemPrice(spacer) {
  return getBeadedSpacerPrice(spacer);
}

export function getCharmItemPrice(charm) {
  return getBeadedCharmPrice(charm);
}

export function getPatternCustomizePrice(pattern = []) {
  return pattern.reduce((total, item) => {
    if (item.type === "bead") {
      return total + getBeadItemPrice(item.asset, item.sizeId);
    }
    if (item.type === "spacer") {
      return total + getSpacerItemPrice(item.asset);
    }
    if (item.type === "charm") {
      return total + getCharmItemPrice(item.asset);
    }
    return total;
  }, 0);
}

function groupPatternItems(items, getLabel, getPrice) {
  const groups = new Map();

  items.forEach((item) => {
    const label = getLabel(item);
    const price = getPrice(item);
    const existing = groups.get(label);

    if (existing) {
      existing.count += 1;
      existing.totalPrice += price;
      return;
    }

    groups.set(label, {
      name: label,
      count: 1,
      totalPrice: price,
    });
  });

  return Array.from(groups.values());
}

const formatMoney = (amount) => `$${(Number(amount) || 0).toLocaleString()}`;

/** "Lotus Charm" -> "Lotus" (the line title already says these are charms). */
const stripCharmWord = (label) => {
  const text = String(label || "");
  return text.replace(/\s+charm$/i, "").trim() || text;
};

/** "3 × $10" */
const formatTimes = (count, unitPrice) => `${count} \u00d7 ${formatMoney(unitPrice)}`;

/** Spacers / charms: "Lotus ($4)", or "Lotus (2 × $4)" when the same piece repeats. */
function formatGroupedDetailLines(groups) {
  return groups.map((group) =>
    `${group.name} (${group.count > 1 ? formatTimes(group.count, group.totalPrice / group.count) : formatMoney(group.totalPrice)})`
  );
}

/**
 * Beads and metalic beads: one line per type, broken down by size, because different mm sizes of
 * the same piece are counted (and may be priced) separately:
 *   Amethyst: 8mm (2 × $10), 10mm (3 × $10)
 *   Ruby: 6mm (4 × $8)
 */
function buildSizedDetailLines(items, assetType, fallbackName, getPrice) {
  const byName = new Map();
  items.forEach((item) => {
    const name = getBeadedAssetLabel(assetType, item.asset) || fallbackName;
    const unit = getPrice(item);
    const sizeLabel = item.sizeId || "";
    if (!byName.has(name)) byName.set(name, new Map());
    const sizes = byName.get(name);
    const sizeKey = `${sizeLabel}|${unit}`;
    const existing = sizes.get(sizeKey);
    if (existing) existing.count += 1;
    else sizes.set(sizeKey, { sizeLabel, unit, count: 1 });
  });

  return Array.from(byName.entries()).map(([name, sizes]) => {
    const entries = Array.from(sizes.values());
    // No size on the piece: "Heart Chakra ($4)" / "Heart Chakra (2 × $4)".
    if (entries.length === 1 && !entries[0].sizeLabel) {
      const [entry] = entries;
      return `${name} (${entry.count > 1 ? formatTimes(entry.count, entry.unit) : formatMoney(entry.unit)})`;
    }
    const parts = entries.map((entry) =>
      `${entry.sizeLabel ? `${entry.sizeLabel} ` : ""}(${formatTimes(entry.count, entry.unit)})`
    );
    return `${name}: ${parts.join(", ")}`;
  });
}

/**
 * Build customize summary rows for only the bead/spacer/charm types present in the pattern.
 * Each row has `detailLines` (one string per line to render) and `detail` (the same, joined).
 */
export function buildPatternCustomizeSummaryLines(pattern = []) {
  const lines = [];
  const beads = pattern.filter((item) => item.type === "bead");
  // Classic spacers have keys like "legacy-s1"; the new metalic spacers (Heart Chakra, Lotus …)
  // are what the "Metalic Beads" tab places, so they get their own summary line.
  const isClassicSpacer = (item) => String(item.asset?.key || "").startsWith("legacy-");
  const spacers = pattern.filter((item) => item.type === "spacer" && isClassicSpacer(item));
  const metalicBeads = pattern.filter((item) => item.type === "spacer" && !isClassicSpacer(item));
  const charms = pattern.filter((item) => item.type === "charm");

  if (beads.length) {
    const detailLines = buildSizedDetailLines(beads, "bead", "Bead", (item) => getBeadItemPrice(item.asset, item.sizeId));
    lines.push({
      key: "beads",
      count: beads.length,
      title: `Beads (Qty ${beads.length})`,
      detailLines,
      detail: detailLines.join(", "),
      price: beads.reduce((total, item) => total + getBeadItemPrice(item.asset, item.sizeId), 0),
    });
  }

  if (charms.length) {
    const groups = groupPatternItems(
      charms,
      (item) => stripCharmWord(getBeadedAssetLabel("charm", item.asset)) || "Charm",
      (item) => getCharmItemPrice(item.asset)
    );
    const detailLines = formatGroupedDetailLines(groups);

    lines.push({
      key: "charms",
      count: charms.length,
      title: `Charms (Qty ${charms.length})`,
      detailLines,
      detail: detailLines.join(", "),
      price: groups.reduce((total, group) => total + group.totalPrice, 0),
    });
  }

  if (spacers.length) {
    const groups = groupPatternItems(
      spacers,
      (item) => getBeadedAssetLabel("spacer", item.asset) || "Spacer",
      (item) => getSpacerItemPrice(item.asset)
    );
    const detailLines = formatGroupedDetailLines(groups);

    lines.push({
      key: "spacers",
      count: spacers.length,
      title: `Spacers (Qty ${spacers.length})`,
      detailLines,
      detail: detailLines.join(", "),
      price: groups.reduce((total, group) => total + group.totalPrice, 0),
    });
  }

  if (metalicBeads.length) {
    const detailLines = buildSizedDetailLines(metalicBeads, "spacer", "Metalic Bead", (item) => getSpacerItemPrice(item.asset));
    lines.push({
      key: "metalic",
      count: metalicBeads.length,
      title: `Metalic Beads (Qty ${metalicBeads.length})`,
      detailLines,
      detail: detailLines.join(", "),
      price: metalicBeads.reduce((total, item) => total + getSpacerItemPrice(item.asset), 0),
    });
  }

  return lines;
}

function pieceCountLabel(count, singular, plural) {
  if (!count) return "";
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Preview title from what is actually on the string, same shape as the other configurators. */
/** Same pieces as buildBeadPreviewLabel, one entry per chip in the 3D preview. */
export function buildBeadPreviewChips(pattern = [], { styleLabel = "", displayLengthLabel = "", pieceLabels = {} } = {}) {
  const beadCount = pattern.filter((item) => item.type === "bead").length;
  const spacerCount = pattern.filter((item) => item.type === "spacer").length;
  const charmCount = pattern.filter((item) => item.type === "charm").length;
  return [
    styleLabel,
    displayLengthLabel,
    pieceCountLabel(beadCount, pieceLabels.bead || "Bead", pieceLabels.beads || "Beads"),
    pieceCountLabel(spacerCount, pieceLabels.spacer || "Spacer", pieceLabels.spacers || "Spacers"),
    pieceCountLabel(charmCount, pieceLabels.charm || "Charm", pieceLabels.charms || "Charms"),
  ].filter(Boolean);
}

export function buildBeadPreviewLabel(pattern = [], { styleLabel = "", displayLengthLabel = "", pieceLabels = {} } = {}) {
  const beadCount = pattern.filter((item) => item.type === "bead").length;
  const spacerCount = pattern.filter((item) => item.type === "spacer").length;
  const charmCount = pattern.filter((item) => item.type === "charm").length;
  const details = [
    displayLengthLabel,
    pieceCountLabel(beadCount, pieceLabels.bead || "Bead", pieceLabels.beads || "Beads"),
    pieceCountLabel(spacerCount, pieceLabels.spacer || "Spacer", pieceLabels.spacers || "Spacers"),
    pieceCountLabel(charmCount, pieceLabels.charm || "Charm", pieceLabels.charms || "Charms"),
  ].filter(Boolean);

  return [styleLabel, details.length ? `(${details.join(", ")})` : ""].filter(Boolean).join(" ");
}
