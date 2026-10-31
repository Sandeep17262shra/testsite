export const DEFAULT_STOREFRONT_CONTROLS = {
  view360: true,
  cameraView: true,
  reset: true,
  audio: true,
  randomise: true,
  addToCart: true,
  engagement: true,
  wedding: true,
};

const CONTROL_KEYS = Object.keys(DEFAULT_STOREFRONT_CONTROLS);

function readEnabledFlag(value, fallback) {
  if (typeof value === "boolean") return value;
  if (value && typeof value === "object" && typeof value.enabled === "boolean") {
    return value.enabled;
  }
  return fallback;
}

export function parseStorefrontControls(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  const nested =
    source.ringCategories && typeof source.ringCategories === "object"
      ? source.ringCategories
      : {};
  const next = { ...DEFAULT_STOREFRONT_CONTROLS };

  CONTROL_KEYS.forEach((key) => {
    next[key] = readEnabledFlag(
      source[key] ?? nested[key],
      DEFAULT_STOREFRONT_CONTROLS[key],
    );
  });

  if (!next.engagement && !next.wedding) {
    next.engagement = true;
    next.wedding = true;
  }

  return next;
}
