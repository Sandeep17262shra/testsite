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

function formatGroupedDetail(groups) {
  return groups
    .map((group) => (group.count > 1 ? `${group.name}*${group.count}` : group.name))
    .join(", ");
}

/**
 * Build customize summary rows for only the bead/spacer/charm types present in the pattern.
 */
export function buildPatternCustomizeSummaryLines(pattern = []) {
  const lines = [];
  const beads = pattern.filter((item) => item.type === "bead");
  const spacers = pattern.filter((item) => item.type === "spacer");
  const charms = pattern.filter((item) => item.type === "charm");

  if (beads.length) {
    const groups = groupPatternItems(
      beads,
      (item) => getBeadedAssetLabel("bead", item.asset) || "Bead",
      (item) => getBeadItemPrice(item.asset, item.sizeId)
    );

    lines.push({
      key: "beads",
      count: beads.length,
      title: `Beads (Qty ${beads.length})`,
      detail: formatGroupedDetail(groups),
      price: groups.reduce((total, group) => total + group.totalPrice, 0),
    });
  }

  if (charms.length) {
    const groups = groupPatternItems(
      charms,
      (item) => getBeadedAssetLabel("charm", item.asset) || "Charm",
      (item) => getCharmItemPrice(item.asset)
    );

    lines.push({
      key: "charms",
      count: charms.length,
      title: `Charms (Qty ${charms.length})`,
      detail: formatGroupedDetail(groups),
      price: groups.reduce((total, group) => total + group.totalPrice, 0),
    });
  }

  if (spacers.length) {
    const groups = groupPatternItems(
      spacers,
      (item) => getBeadedAssetLabel("spacer", item.asset) || "Spacer",
      (item) => getSpacerItemPrice(item.asset)
    );

    lines.push({
      key: "spacers",
      count: spacers.length,
      title: `Spacers (Qty ${spacers.length})`,
      detail: formatGroupedDetail(groups),
      price: groups.reduce((total, group) => total + group.totalPrice, 0),
    });
  }

  return lines;
}

function pieceCountLabel(count, singular, plural) {
  if (!count) return "";
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Preview title from what is actually on the string, same shape as the other configurators. */
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
