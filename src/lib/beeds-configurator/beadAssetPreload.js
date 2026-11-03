import {
  BEADS,
  BEAD_CHARMS,
  DEFAULT_BEAD_KEY,
  DEFAULT_CHARM_KEY,
  DEFAULT_SEPARATOR_KEY,
  SEPARATORS,
} from "./assets";
import { getWarmUrl, whenCriticalReady } from "./beadsCriticalAssets";

const warmedUrls = new Set();
const decodedUrls = new Set();
const decodePromises = new Map();

function scheduleIdle(task) {
  if (typeof window === "undefined") {
    return;
  }
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(() => task(), { timeout: 2500 });
    return;
  }
  window.setTimeout(task, 0);
}

function finishImageDecode(img, url, resolve) {
  if (typeof img.decode === "function") {
    img
      .decode()
      .catch(() => {})
      .finally(() => {
        decodedUrls.add(url);
        resolve();
      });
    return;
  }
  decodedUrls.add(url);
  resolve();
}

/** True once the URL has been fetched and decoded for at least one consumer. */
export function isBeadImageDecoded(url) {
  return Boolean(url && decodedUrls.has(url));
}

/**
 * Fetch + decode a catalog image. Shared across the ring preview and picker so cold
 * live loads do not paint drop shadows before WebP art is ready.
 */
export function ensureBeadImageReady(url) {
  if (!url) {
    return Promise.resolve();
  }
  if (decodedUrls.has(url)) {
    return Promise.resolve();
  }
  const pending = decodePromises.get(url);
  if (pending) {
    return pending;
  }

  warmedUrls.add(url);

  const promise = new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";

    const done = () => finishImageDecode(img, url, resolve);

    img.onload = done;
    img.onerror = () => {
      decodedUrls.add(url);
      resolve();
    };

    img.src = getWarmUrl(url);
    if (img.complete && img.naturalWidth > 0) {
      done();
    }
  });

  decodePromises.set(url, promise);
  promise.finally(() => {
    decodePromises.delete(url);
  });

  return promise;
}

export function ensureBeadImagesReady(urls) {
  const unique = [...new Set(urls.filter(Boolean))];
  if (!unique.length) {
    return Promise.resolve();
  }
  return Promise.all(unique.map((url) => ensureBeadImageReady(url)));
}

/** Best-effort HTTP cache warm — failures must not affect the configurator. */
export function preloadBeadImageUrl(url) {
  if (!url || warmedUrls.has(url)) {
    return;
  }
  ensureBeadImageReady(url).catch(() => {});
}

/** Start loading default full-bead art as early as possible (live / embed first paint). */
export function preloadCriticalBeadsConfiguratorImages() {
  if (typeof window === "undefined") {
    return;
  }

  const bead =
    BEADS.find((entry) => entry.key === DEFAULT_BEAD_KEY) || BEADS[0];
  const separator =
    SEPARATORS.find((entry) => entry.key === DEFAULT_SEPARATOR_KEY) || SEPARATORS[0];
  const charm =
    BEAD_CHARMS.find((entry) => entry.key === DEFAULT_CHARM_KEY) || BEAD_CHARMS[0];

  // The first bead texture is part of the ordered critical sequence; the
  // default spacer / charm art follows once that sequence has finished.
  whenCriticalReady().then(() => {
    [bead?.texture, separator?.image, charm?.image]
      .filter(Boolean)
      .forEach((url) => {
        preloadBeadImageUrl(url);
      });
  });
}

/**
 * Warm bead, spacer, and charm thumbnails after first paint so the ring and picker
 * reuse cached responses instead of dozens of cold requests on live.
 */
export function preloadBeadsConfiguratorAssets({
  beadUrls = [],
  spacerUrls = [],
  charmUrls = [],
} = {}) {
  if (typeof window === "undefined") {
    return;
  }

  preloadCriticalBeadsConfiguratorImages();

  // Picker thumbnails are not needed for first paint. Wait until the 3D scene
  // has had time to load, then fetch in small batches so they never compete
  // with the critical bead / HDR / texture requests.
  const unique = [...new Set([...beadUrls, ...spacerUrls, ...charmUrls].filter(Boolean))];
  if (!unique.length) {
    return;
  }

  const BATCH = 4;
  const startAfterMs = 600;
  const runBatch = (index) => {
    unique.slice(index, index + BATCH).forEach((url) => {
      try {
        preloadBeadImageUrl(url);
      } catch {
        // ignore
      }
    });
    if (index + BATCH < unique.length) {
      window.setTimeout(() => scheduleIdle(() => runBatch(index + BATCH)), 250);
    }
  };
  whenCriticalReady().then(() => {
    window.setTimeout(() => scheduleIdle(() => runBatch(0)), startAfterMs);
  });
}
