/**
 * Beaded bracelet store catalogue loader — mirrors braceletPriceApiClient.
 *
 *   1. The store is resolved from parentUrl / shop / canonicalShop
 *      (same resolver as ring, necklace and bracelet), so every embedding
 *      store gets its own prices.
 *   2. The `beaded` slice of the shared pricing API (`/api/ring-pricing`) is used.
 *   3. If the API fails, or answers with an empty / missing `beaded` slice,
 *      the catalogue is loaded from the fallback file
 *      `public/data/beaded-demostore-api-data.json`.
 *
 * The catalogue controls each option's name, price and active / inactive state
 * (see beadedPriceConfig.js). Components re-render when it changes through
 * `subscribeBeadedPriceConfig` / `getBeadedPriceConfigVersion`.
 */

import {
  clearJewelryPricingRemoteCache,
  extractBeadedPricingPayload,
  fetchRemoteJewelryPricing,
  hasBeadedPricingCatalogue,
  normalizeJewelryPriceConfig,
  resolveJewelryPricingApiStore,
} from "../necklace-configurator/jewelryPriceApiShared";

const USE_REMOTE_API = true;
export const LOCAL_BEADED_DEMOSTORE_JSON_URL = "/data/beaded-demostore-api-data.json";

let configCache = null;
let inFlightRequest = null;
let inFlightStoreSlug = "";
let lastError = null;
let lastLoadedStoreSlug = "";
/** "api" | "fallback" | "none" — where the current catalogue came from. */
let lastSource = "none";
/** Bumped per request so a slow response for an old store can't overwrite a newer one. */
let requestSeq = 0;

// ── Change notification (lets React re-render when prices / names / status change)
let configVersion = 0;
const listeners = new Set();

const setConfigCache = (next, source) => {
  configCache = next;
  lastSource = source;
  configVersion += 1;
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.warn("[beadedPriceApiClient] listener failed:", error);
    }
  });
};

export const subscribeBeadedPriceConfig = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getBeadedPriceConfigVersion = () => configVersion;

// ── Loading ───────────────────────────────────────────────────────────────────
const loadLocalFallback = () =>
  fetch(LOCAL_BEADED_DEMOSTORE_JSON_URL).then((res) => {
    if (!res.ok) {
      throw new Error(`Local beaded price fallback failed: ${res.status}`);
    }
    return res.json();
  });

const toBeadedConfig = (response) => {
  const slice = extractBeadedPricingPayload(response);
  if (!slice?.products?.length) {
    throw new Error("Beaded price config response did not contain a pricing catalogue.");
  }
  return normalizeJewelryPriceConfig(slice, response?.store ? { store: response.store } : response);
};

export async function initBeadedPriceConfig({
  force = false,
  parentUrl,
  shop,
  canonicalShop,
} = {}) {
  const hasExplicitStore = [parentUrl, shop, canonicalShop].some(
    (value) => typeof value === "string" && value.trim()
  );
  if (!hasExplicitStore) {
    if (configCache === null || lastLoadedStoreSlug !== "") {
      setConfigCache({}, "none");
    }
    lastLoadedStoreSlug = "";
    lastError = null;
    return configCache;
  }

  const pricingApiStore = USE_REMOTE_API
    ? resolveJewelryPricingApiStore({ parentUrl, shop, canonicalShop })
    : "";
  const storeSlug = USE_REMOTE_API ? pricingApiStore || "none" : "";

  if (configCache !== null && !force && lastLoadedStoreSlug === storeSlug) {
    return configCache;
  }
  if (inFlightRequest && !force && inFlightStoreSlug === storeSlug) {
    return inFlightRequest;
  }

  if (USE_REMOTE_API && !pricingApiStore) {
    if (configCache === null || lastLoadedStoreSlug !== "") {
      setConfigCache({}, "none");
    }
    lastLoadedStoreSlug = "";
    lastError = null;
    return configCache;
  }

  if (force) {
    clearJewelryPricingRemoteCache();
  }

  let source = "api";
  const requestId = ++requestSeq;
  const request = (USE_REMOTE_API
    ? fetchRemoteJewelryPricing(pricingApiStore, { force }).then((data) => {
        if (hasBeadedPricingCatalogue(data)) return data;
        throw new Error("Beaded price config response did not contain a pricing catalogue.");
      })
    : loadLocalFallback()
  )
    .catch((err) => {
      console.warn(
        "[beadedPriceApiClient] Remote beaded pricing unavailable or empty, using fallback file:",
        err
      );
      source = "fallback";
      return loadLocalFallback();
    })
    .then((data) => {
      const nextConfig = toBeadedConfig(data);
      if (requestId !== requestSeq) {
        // A newer request (another store) started meanwhile — keep its result.
        return configCache ?? nextConfig;
      }
      lastLoadedStoreSlug = storeSlug;
      lastError = null;
      setConfigCache(nextConfig, USE_REMOTE_API ? source : "fallback");
      return configCache;
    })
    .catch((err) => {
      console.error("[beadedPriceApiClient] Failed to load beaded price config:", err);
      lastError = err;
      throw err;
    })
    .finally(() => {
      if (inFlightRequest === request) {
        inFlightRequest = null;
        inFlightStoreSlug = "";
      }
    });

  inFlightRequest = request;
  inFlightStoreSlug = storeSlug;
  return request;
}

export function getBeadedConfigCache() {
  return configCache;
}

export function isBeadedPriceConfigReady() {
  return configCache !== null;
}

export function getBeadedPriceConfigError() {
  return lastError;
}

/** "api" | "fallback" | "none" */
export function getBeadedPriceConfigSource() {
  return lastSource;
}

export async function refreshBeadedPriceConfig({ parentUrl, shop, canonicalShop } = {}) {
  lastLoadedStoreSlug = "";
  clearJewelryPricingRemoteCache();
  return initBeadedPriceConfig({ force: true, parentUrl, shop, canonicalShop });
}
