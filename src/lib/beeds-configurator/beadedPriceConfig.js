/**
 * Beaded bracelet catalogue adapter — product rows from the API / fallback JSON,
 * looked up by product_id (see data/beadedProductIds.js).
 *
 * The catalogue controls three things per option:
 *   - name    -> getBeadedCatalogLabel / the decorate* helpers
 *   - price   -> getBeadedCatalogPrice / getBeaded*Price
 *   - status  -> isBeadedCatalogProductActive / the decorate* + getBeadedVisible* helpers
 *
 * Anything the API does not return (for example a new bead whose product_id has
 * not been created yet) keeps the configurator's built-in name and price, and
 * stays active. So the app works with no catalogue, a partial one or a full one.
 */
import { useSyncExternalStore } from "react";
import {
  getBeadedBeadProductId,
  getBeadedBeadSizeProductId,
  getBeadedCharmProductId,
  getBeadedMetalicSpacerProductId,
  getBeadedPatternAssetProductId,
  getBeadedSpacerProductId,
  getBeadedStringLengthProductId,
  getBeadedStyleProductId,
  getBeadedThreadColorProductId,
} from "./data/beadedProductIds";
import {
  getBeadedConfigCache,
  getBeadedPriceConfigError,
  getBeadedPriceConfigSource,
  getBeadedPriceConfigVersion,
  initBeadedPriceConfig,
  isBeadedPriceConfigReady,
  refreshBeadedPriceConfig,
  subscribeBeadedPriceConfig,
} from "./beadedPriceApiClient";

const DEFAULT_BEAD_PRICE = 8;
const DEFAULT_SPACER_PRICE = 4;
const DEFAULT_CHARM_PRICE = 50;

const isActiveRow = (row) => String(row?.status ?? "active").toLowerCase() === "active";

// ── Catalogue index (rebuilt only when the catalogue changes) ─────────────────
let indexVersion = -1;
let indexCache = null;

const getCatalogue = () => {
  const cache = getBeadedConfigCache();
  const raw = cache?.default ?? cache;
  return Array.isArray(raw?.products) ? raw : null;
};

const productIndex = () => {
  const version = getBeadedPriceConfigVersion();
  if (indexVersion === version) return indexCache;

  const catalogue = getCatalogue();
  let next = null;
  if (catalogue?.products?.length) {
    next = new Map();
    catalogue.products.forEach((row) => {
      if (row?.product_id) next.set(String(row.product_id).toUpperCase(), row);
    });
  }
  indexVersion = version;
  indexCache = next;
  return next;
};

// ── Product lookups ───────────────────────────────────────────────────────────

/** The API row for a product_id (any status), or null when the API has no such row. */
export function getBeadedCatalogProduct(productId) {
  if (!productId) return null;
  return productIndex()?.get(String(productId).toUpperCase()) ?? null;
}

export function getBeadedCatalogPrice(productId, fallback = 0) {
  const row = getBeadedCatalogProduct(productId);
  if (!row || row.price === null || row.price === undefined || row.price === "") return fallback;
  const price = Number(row.price);
  return Number.isFinite(price) && price >= 0 ? price : fallback;
}

export function getBeadedCatalogLabel(productId, fallback = "") {
  const name = String(getBeadedCatalogProduct(productId)?.name ?? "").trim();
  return name || fallback;
}

/** Missing id or missing row -> true (only an explicit non-active status hides an option). */
export function isBeadedCatalogProductActive(productId) {
  if (!productId) return true;
  const row = getBeadedCatalogProduct(productId);
  return row ? isActiveRow(row) : true;
}

// ── Prices for configurator assets ────────────────────────────────────────────

/** Bead price + bead-size add-on (BBSZ*, 0 unless the store sets one). */
export function getBeadedBeadPrice(bead, sizeId) {
  const base = getBeadedCatalogPrice(getBeadedBeadProductId(bead?.key), bead?.price ?? DEFAULT_BEAD_PRICE);
  const sizeAddOn = sizeId ? getBeadedCatalogPrice(getBeadedBeadSizeProductId(sizeId), 0) : 0;
  return base + sizeAddOn;
}

/** Classic spacer (legacy-sN) or metalic spacer (sN / metalic-sN). */
export function getBeadedSpacerPrice(spacer) {
  return getBeadedCatalogPrice(
    getBeadedPatternAssetProductId("spacer", spacer),
    spacer?.price ?? DEFAULT_SPACER_PRICE
  );
}

export function getBeadedCharmPrice(charm) {
  return getBeadedCatalogPrice(getBeadedCharmProductId(charm?.key), charm?.price ?? DEFAULT_CHARM_PRICE);
}

export function getBeadedStringLengthPrice(lengthId) {
  return getBeadedCatalogPrice(getBeadedStringLengthProductId(lengthId), 0);
}

export function getBeadedStylePrice(styleId) {
  return getBeadedCatalogPrice(getBeadedStyleProductId(styleId), 0);
}

export function getBeadedThreadColorPrice(threadColorId) {
  return getBeadedCatalogPrice(getBeadedThreadColorProductId(threadColorId), 0);
}

// ── Names ─────────────────────────────────────────────────────────────────────

/** Display name of a placed / picked asset ("bead" | "spacer" | "charm"). */
export function getBeadedAssetLabel(type, asset) {
  return getBeadedCatalogLabel(getBeadedPatternAssetProductId(type, asset), asset?.name ?? "");
}

export function getBeadedCatalogStyleLabel(styleId, fallback = "") {
  return getBeadedCatalogLabel(getBeadedStyleProductId(styleId), fallback);
}

export function getBeadedCatalogLengthLabel(lengthId, fallback = "") {
  return getBeadedCatalogLabel(getBeadedStringLengthProductId(lengthId), fallback);
}

export function getBeadedCatalogThreadColorLabel(threadColorId, fallback = "") {
  return getBeadedCatalogLabel(getBeadedThreadColorProductId(threadColorId), fallback);
}

// ── Active / inactive ─────────────────────────────────────────────────────────

export function isBeadedAssetActive(type, asset) {
  return isBeadedCatalogProductActive(getBeadedPatternAssetProductId(type, asset));
}

export function isBeadedBeadSizeActive(sizeId) {
  return isBeadedCatalogProductActive(getBeadedBeadSizeProductId(sizeId));
}

// ── UI list helpers (picker lists: drop inactive, apply API name + price) ─────

const decorate = (type, asset) => ({
  ...asset,
  name: getBeadedAssetLabel(type, asset),
  price: type === "bead"
    ? getBeadedCatalogPrice(getBeadedBeadProductId(asset.key), asset.price ?? DEFAULT_BEAD_PRICE)
    : type === "spacer"
      ? getBeadedSpacerPrice(asset)
      : getBeadedCharmPrice(asset),
});

/** @param {"bead"|"spacer"|"charm"} type */
export function getBeadedCatalogAssets(type, assets = []) {
  return assets.filter((asset) => isBeadedAssetActive(type, asset)).map((asset) => decorate(type, asset));
}

/**
 * Bead / metalic picker grid items ({ key, asset, sizeId, ... }):
 * hides inactive items and inactive bead sizes, applies API name + price.
 * @param {"bead"|"spacer"} type  metalic beads are "spacer" items (their asset has spacerKey)
 */
export function getBeadedCatalogGridItems(type, items = []) {
  return items
    .filter(
      (entry) =>
        isBeadedAssetActive(type, entry.asset) &&
        (type !== "bead" || isBeadedBeadSizeActive(entry.sizeId))
    )
    .map((entry) => ({ ...entry, asset: decorate(type, entry.asset) }));
}

/** Style cards ({ id, label, ... }) — drops inactive styles. */
export function getBeadedVisibleStyles(styles = []) {
  return styles.filter((style) => isBeadedCatalogProductActive(getBeadedStyleProductId(style.id)));
}

/** Length chips ({ id, label, ... }) — drops inactive lengths ("free" is never filtered). */
export function getBeadedVisibleLengths(lengths = []) {
  return lengths.filter((length) =>
    isBeadedCatalogProductActive(getBeadedStringLengthProductId(length.id))
  );
}

/** Thread colours ({ id, label, ... }) — drops inactive, applies API name. */
export function getBeadedVisibleThreadColors(colors = []) {
  return colors
    .filter((color) => isBeadedCatalogProductActive(getBeadedThreadColorProductId(color.id)))
    .map((color) => ({ ...color, label: getBeadedCatalogThreadColorLabel(color.id, color.label) }));
}

/** Size filter chips ({ id: "all" | "6" | "8" ... }) — drops filters for inactive sizes. */
export function getBeadedVisibleSizeFilters(filters = []) {
  return filters.filter(
    (filter) => filter.id === "all" || isBeadedBeadSizeActive(`${String(filter.id).replace(/mm$/i, "")}mm`)
  );
}

// ── React hook ────────────────────────────────────────────────────────────────

/**
 * Re-renders the component when the catalogue (re)loads. Use the returned number
 * as a dependency of any useMemo that reads catalogue prices / names / status.
 */
export function useBeadedPriceConfigVersion() {
  return useSyncExternalStore(subscribeBeadedPriceConfig, getBeadedPriceConfigVersion, () => 0);
}

export {
  initBeadedPriceConfig,
  isBeadedPriceConfigReady,
  getBeadedPriceConfigError,
  getBeadedPriceConfigSource,
  getBeadedPriceConfigVersion,
  refreshBeadedPriceConfig,
};
