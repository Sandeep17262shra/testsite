import { useEffect, useState } from "react";
import { PAVITRA_CUSTOMIZATION_ENABLED } from "../jewelry-shell/pavitraCustomization";

/**
 * First-load order for the bead bracelet (each step starts after the previous
 * one has finished, so nothing competes with the files the frame needs):
 *
 *   1. style icons          (the four tiny SVGs in the style picker)
 *   2. glass bead model     (glass-bead.glb)
 *   3. metal HDR            (env_metal_studio.hdr, spacer metal)
 *   4. studio HDR           (env_studio.hdr — drei's "studio" preset map,
 *                            self-hosted and 128×64 like the metal HDR: same average light, ~60× smaller)
 *   5. first bead texture   (default bead)
 *
 * Only then is the 3D frame mounted. Everything else (other icons, charms,
 * optional GLB beads…) is loaded afterwards via `whenCriticalReady()`.
 *
 * Kept free of heavy imports so the frame page can start it immediately.
 */
export const GLASS_BEAD_GLB = "/bc-assets/bead_models/glass-bead.glb?v4";
export const BEADS_SPACER_METAL_ENV_URL = "/bc-assets/env_metal_studio.hdr";
export const BEADS_STUDIO_ENV_URL = "/bc-assets/env_studio.hdr";
/** Texture of DEFAULT_BEAD_KEY ("green-aventurine" for Pavitra, else "amethyst") — keep in sync with assets.js. */
export const DEFAULT_BEAD_TEXTURE_URL = PAVITRA_CUSTOMIZATION_ENABLED
  ? "/beeds-assets/bead-textures/Green_Aventurine_1.webp"
  : "/beeds-assets/bead-textures/amethyst.webp";
export const STYLE_ICON_URLS = [
  "/beeds-assets/styles/full-bead.svg",
  "/beeds-assets/styles/style-1.svg",
  "/beeds-assets/styles/style-2.svg",
  "/beeds-assets/styles/style-3.svg",
];

const CRITICAL_TIMEOUT_MS = 10000;

let sequencePromise = null;
let sequenceDone = false;
/** original url -> object URL of the bytes already downloaded by the sequence. */
const warmUrls = new Map();
let metalHdrPromise = null;
let studioHdrPromise = null;

/**
 * Every critical file is downloaded exactly once; consumers (useGLTF,
 * useTexture, RGBELoader, Image) are pointed at the in-memory copy instead of
 * asking the network/HTTP cache again.
 */
export function getWarmUrl(url) {
  return (url && warmUrls.get(url)) || url;
}

async function fetchWarm(url) {
  const res = await fetch(url, { priority: "high" });
  if (!res.ok) {
    return null;
  }
  const objectUrl = URL.createObjectURL(await res.blob());
  warmUrls.set(url, objectUrl);
  return objectUrl;
}

async function safely(task) {
  try {
    return await task();
  } catch {
    return null;
  }
}

async function runSequence() {
  // 1. style icons
  await safely(() => Promise.all(STYLE_ICON_URLS.map((url) => fetch(url, { priority: "high" }).then((r) => r.arrayBuffer()))));
  // 2. glass bead model
  await safely(() => fetchWarm(GLASS_BEAD_GLB));
  // 3. metal HDR, 4. studio HDR
  metalHdrPromise = safely(() => fetchWarm(BEADS_SPACER_METAL_ENV_URL));
  await metalHdrPromise;
  studioHdrPromise = safely(() => fetchWarm(BEADS_STUDIO_ENV_URL));
  await studioHdrPromise;
  // 5. first bead texture
  await safely(() => fetchWarm(DEFAULT_BEAD_TEXTURE_URL));
}

/** Idempotent. Resolves once the critical files are downloaded (or timed out). */
export function startCriticalSequence() {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  if (!sequencePromise) {
    sequencePromise = Promise.race([
      runSequence(),
      new Promise((resolve) => window.setTimeout(resolve, CRITICAL_TIMEOUT_MS)),
    ]).then(() => {
      sequenceDone = true;
    });
  }
  return sequencePromise;
}

/** Use for everything that is NOT needed for the first frame. */
export function whenCriticalReady() {
  return startCriticalSequence();
}

/**
 * Resolve once the (single) HDR download finishes — even if the frame was
 * mounted by the timeout — so a slow network never triggers a second request.
 */
export function getCriticalHdrUrl() {
  return Promise.resolve(metalHdrPromise).then(() => getWarmUrl(BEADS_SPACER_METAL_ENV_URL));
}

export function getCriticalStudioHdrUrl() {
  return startCriticalSequence()
    .then(() => studioHdrPromise)
    .then(() => getWarmUrl(BEADS_STUDIO_ENV_URL));
}

export function useCriticalReady() {
  const [ready, setReady] = useState(sequenceDone);
  useEffect(() => {
    if (ready) {
      return undefined;
    }
    let cancelled = false;
    startCriticalSequence().then(() => {
      if (!cancelled) {
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ready]);
  return ready;
}
