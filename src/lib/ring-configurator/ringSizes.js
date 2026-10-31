/**
 * Storefront ring sizes from appearance-page `ringSizes`.
 * Shape: { region, label, sizes: string[] }.
 * Missing block keeps the built-in size systems.
 */

const REGION_TO_SYSTEM = {
  "us-mx-ca": "US",
  "uk-za-nz-au": "UK",
  fr: "EU",
  "ua-ru-de-asia": "UA",
  "tr-sa-sg-jp-il-in-cn": "TR",
  "ch-es-nl-it": "IT",
};

const normalizeSizeToken = (value) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

export function extractRingSizes(response) {
  const block = response?.ringSizes;
  if (!block || typeof block !== "object") return null;

  const sizes = Array.isArray(block.sizes)
    ? block.sizes
        .map((size) => String(size ?? "").trim().replace(/\s+/g, " "))
        .filter(Boolean)
    : [];
  const region = typeof block.region === "string" ? block.region.trim() : "";
  const label = typeof block.label === "string" ? block.label.trim() : "";

  if (!region && sizes.length === 0) return null;

  return { region, label, sizes };
}

/** Built-in system for the API region, limited to the sizes the store offers. */
export function ringSizeSystemForStorefront(systems, ringSizes) {
  if (!ringSizes?.region || !Array.isArray(systems)) return null;

  const systemLabel = REGION_TO_SYSTEM[ringSizes.region];
  const base = systems.find((system) => system.label === systemLabel);
  if (!base) return null;

  const requested = ringSizes.sizes?.length ? ringSizes.sizes : base.value;
  const value = [];
  const mm = [];

  for (const size of requested) {
    const index = base.value.findIndex(
      (candidate) => normalizeSizeToken(candidate) === normalizeSizeToken(size)
    );
    value.push(index >= 0 ? base.value[index] : size);
    mm.push(index >= 0 ? base.mm[index] : "");
  }

  if (value.length === 0) return null;

  return {
    ...base,
    value,
    mm,
    longName: ringSizes.label || base.longName,
  };
}
