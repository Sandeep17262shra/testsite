/**
 * Price line shown inside an option button (style / length / metal / charm cards …),
 * styled like the bead picker's "6mm · $8" meta line. Renders nothing when there is no amount.
 * `gb-delta-label` (same as the ring configurator's price spans) keeps it out of the
 * `.gb-metal-option span:not(.gb-delta-label)` rule, which turns every other span in a metal button into a 20px circle.
 */
export function formatOptionPrice(amount) {
  if (amount === null || amount === undefined || amount === "") return "";
  const n = Number(amount);
  return Number.isFinite(n) ? `$${n.toLocaleString()}` : "";
}

export default function OptionPrice({ amount, suffix = "" }) {
  const text = formatOptionPrice(amount);
  if (!text) return null;
  return (
    <span className="gb-delta-label theme3-option-box-price">
      {text}
      {suffix}
    </span>
  );
}

/**
 * Price *difference* shown inside an option button, like the ring configurator:
 * "+$100" / "-$100" relative to what is currently selected. Nothing is shown on
 * the selected button itself, or when the option costs the same as the current one.
 */
export function formatOptionPriceDelta(delta) {
  const n = Math.round(Number(delta) * 100) / 100;
  if (!Number.isFinite(n) || n === 0) return "";
  return `${n > 0 ? "+" : "-"}$${Math.abs(n).toLocaleString()}`;
}

export function OptionPriceDelta({ delta, active = false }) {
  const text = active ? "" : formatOptionPriceDelta(delta);
  if (!text) return null;
  return <span className="gb-delta-label theme3-option-box-price">{text}</span>;
}
