// Groups placed charms into the "Add-ons" lines of the build summary:
//   Letters (Qty 3): A, B, C                  $120
//   3D (Qty 3): Emerald Charm (3 × $150)      $450
//   Birthstones (Qty 2): Ruby, Garnet         $100
// Each charm is written as "name (price)", or "name (count × unit price)" when placed more than once.
// Shared by the necklace and bracelet panels; each passes its own price and
// birthstone-name lookups so the lines always add up to that panel's total.

const ADD_ON_GROUPS = [
  { key: "letters", label: "Letters" },
  { key: "birthstones", label: "Birthstones" },
  { key: "diamonds", label: "Diamonds" },
  { key: "2d", label: "2D" },
  { key: "3d", label: "3D" },
];

const IMAGE_PATH_RE = /\.(png|jpe?g|webp|gif|svg)$/i;

function getAddOnGroupKey(charm) {
  if (charm.type === "initial") return "letters";
  if (charm.type === "birthstone") return "birthstones";
  if (charm.type === "diamond" || charm.type === "cushion") return "diamonds";
  if (charm.imageCharmNumber != null || IMAGE_PATH_RE.test(charm.path || "")) return "2d";
  return "3d";
}

const formatMoney = (amount) => `$${(Number(amount) || 0).toLocaleString()}`;

/** "3 × $150" */
export const formatTimes = (count, unitPrice) => `${count} \u00d7 ${formatMoney(unitPrice)}`;

/**
 * " (7 × $20)" for a per-character priced name: total price / number of characters.
 * Returns "" when the name is free or empty so the summary stays unchanged.
 */
export function perCharSuffix(totalPrice, text) {
  const chars = String(text || "").trim().length;
  const total = Number(totalPrice) || 0;
  if (!chars || total <= 0) return "";
  return ` (${formatTimes(chars, total / chars)})`;
}

// "Pear Petal Charm" -> "Pear Petal" (the section label already says these are charms)
const stripCharmWord = (label) => {
  const text = String(label || "");
  return text.replace(/\s+charm$/i, "").trim() || text;
};

// "Garnet (Jan)" -> "Garnet"
const stripMonth = (label) => String(label || "").replace(/\s*\([^)]*\)\s*$/, "");

export function buildCharmAddOnLines(charms, { getPrice, getBirthstoneLabel, getName }) {
  // Per group: the same charm (same name + unit price) is counted once with its quantity.
  const buckets = new Map(ADD_ON_GROUPS.map((g) => [g.key, { qty: 0, price: 0, items: new Map() }]));
  charms.filter(Boolean).forEach((charm) => {
    const key = getAddOnGroupKey(charm);
    let name;
    if (key === "letters") name = charm.letter || "A";
    else if (key === "birthstones") name = stripMonth(getBirthstoneLabel(charm)) || "Birthstone";
    else name = stripCharmWord(getName(charm));
    const unit = Number(getPrice(charm)) || 0;
    const bucket = buckets.get(key);
    bucket.qty += 1;
    bucket.price += unit;
    const itemKey = `${name}|${unit}`;
    const existing = bucket.items.get(itemKey);
    if (existing) existing.count += 1;
    else bucket.items.set(itemKey, { name, unit, count: 1 });
  });
  return ADD_ON_GROUPS
    .map((g) => ({ ...g, ...buckets.get(g.key) }))
    .filter((g) => g.qty > 0)
    .map((g) => ({
      key: g.key,
      label: `${g.label} (Qty ${g.qty}): ${Array.from(g.items.values())
        .map((item) => `${item.name} (${item.count > 1 ? formatTimes(item.count, item.unit) : formatMoney(item.unit)})`)
        .join(", ")}`,
      price: g.price,
    }));
}
