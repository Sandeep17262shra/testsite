import {
  getCharmAssetsFromItems,
  getValidCharmGaps,
  pickNearestValidCharmGap,
} from "./beadRingDrag";

/** Empty-string manual build: show randomize after this many beads on the string. */
export const MANUAL_RANDOMIZE_MIN_BEADS = 10;

/** Delay between bead swaps so the shuffle reads as a wave around the ring. */
export const MANUAL_RANDOMIZE_STEP_MS = 90;

/** Matches the swap pop in beads-randomize.css, plus a frame of slack. */
export const MANUAL_RANDOMIZE_POP_MS = 320;

/**
 * Slot types whose artwork can be re-shuffled in place. Charms are deliberately
 * excluded: randomize moves them to new gaps on the ring, but must preserve the
 * selected charm (including its colour/finish).
 */
const SHUFFLED_ASSET_TYPES = ["bead", "spacer"];

export function countManualBeads(manualItems) {
  return manualItems.filter((item) => item.type === "bead").length;
}

function getVariantsOfType(manualItems, type) {
  return manualItems
    .filter((item) => item.type === type)
    .map((item) => ({
      assetKey: item.assetKey,
      // A bead's material and size are one variant. Separating them lets a large
      // purple bead become a small purple bead after shuffle, which is not a
      // configuration the customer selected.
      beadSizeId: type === "bead" ? item.sizeId : undefined,
    }));
}

function getVariantId(variant) {
  return `${variant.assetKey}:${variant.beadSizeId ?? ""}`;
}

function shuffleArray(values) {
  const next = [...values];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

/** Bead/spacer sequence the charm gap indices are measured against. */
function getRingSegmentEntries(manualItems) {
  return manualItems.filter((item) => item.type === "bead" || item.type === "spacer");
}

/**
 * One gap per even slice of the ring, each picked at random inside its slice and the
 * whole set rotated — charms land somewhere new without ever clumping on one arc.
 */
function pickSpreadCharmGaps(segmentCount, charmCount) {
  const slice = segmentCount / charmCount;
  const rotation = Math.floor(Math.random() * segmentCount);
  const gaps = [];

  for (let i = 0; i < charmCount; i += 1) {
    const start = Math.ceil(i * slice);
    const end = Math.max(start, Math.ceil((i + 1) * slice) - 1);
    const pick = start + Math.floor(Math.random() * (end - start + 1));
    gaps.push((pick + rotation) % segmentCount);
  }

  return gaps;
}

/**
 * Charms only ever sit in a gap between two ring items, one charm per gap, so the whole
 * set is re-dealt at once — moving them one at a time would collide mid-sequence.
 */
function buildCharmGapStep(manualItems) {
  const charms = manualItems.filter((item) => item.type === "charm");
  const segmentEntries = getRingSegmentEntries(manualItems);
  const segmentCount = segmentEntries.length;

  // Under two ring items there are no gaps: charms stack in slot order and cannot move.
  if (!charms.length || segmentCount < 2 || charms.length > segmentCount) {
    return null;
  }
  if (getValidCharmGaps(segmentCount, new Set(), segmentEntries).length < 2) {
    return null;
  }

  const charmAssets = getCharmAssetsFromItems(charms);
  // A random spread can occasionally recreate the current layout. Retry a few
  // times so clicking Shuffle reliably moves a charm instead of only changing
  // bead artwork.
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const wanted = pickSpreadCharmGaps(segmentCount, charms.length);
    const occupied = new Set();
    const gaps = [];

    shuffleArray(charms).forEach((charm, i) => {
      const ringGap = pickNearestValidCharmGap(
        wanted[i],
        segmentCount,
        occupied,
        segmentEntries,
        { charmAssets }
      );
      if (ringGap == null) {
        return;
      }
      occupied.add(ringGap);
      gaps.push({ charmId: charm.id, ringGap });
    });

    // A charm left out would keep its old gap and could land on top of a re-dealt one.
    if (gaps.length < charms.length) {
      continue;
    }

    const moved = gaps.some(
      ({ charmId, ringGap }) =>
        charms.find((charm) => charm.id === charmId)?.ringGap !== ringGap
    );
    if (moved) {
      return { kind: "charmGaps", gaps };
    }
  }

  return null;
}

/** Reshuffled complete bead/spacer variants, nudged so a no-op still changes something. */
function shuffleVariantsOfType(manualItems, type) {
  const variants = getVariantsOfType(manualItems, type);
  if (new Set(variants.map(getVariantId)).size < 2) {
    return null;
  }

  let shuffled = shuffleArray(variants);
  if (shuffled.every((variant, i) => getVariantId(variant) === getVariantId(variants[i]))) {
    shuffled = [...variants];
    const swapAt = shuffled.findIndex(
      (variant, i) => i > 0 && getVariantId(variant) !== getVariantId(shuffled[0])
    );
    if (swapAt < 0) {
      return null;
    }
    [shuffled[0], shuffled[swapAt]] = [shuffled[swapAt], shuffled[0]];
  }

  return shuffled;
}

/** True when shuffle can change at least one slot using only what is already on the string. */
export function canManualRandomizeBracelet(manualItems) {
  if (countManualBeads(manualItems) < MANUAL_RANDOMIZE_MIN_BEADS) {
    return false;
  }
  if (
    SHUFFLED_ASSET_TYPES.some(
      (type) => new Set(getVariantsOfType(manualItems, type).map(getVariantId)).size > 1
    )
  ) {
    return true;
  }
  return Boolean(buildCharmGapStep(manualItems));
}

/**
 * Shuffle plan for the whole string: charms are re-dealt across the gaps first, then each
 * bead and spacer slots take a complete variant borrowed from another slot of their own
 * type. Charms keep their selected artwork and are only re-dealt across the gaps. Nothing
 * new is pulled from the catalogue and no slot changes type, so the bracelet keeps its
 * length and its charm-per-gap layout.
 */
export function buildManualRandomizePlan(manualItems) {
  if (countManualBeads(manualItems) < MANUAL_RANDOMIZE_MIN_BEADS) {
    return [];
  }

  const shuffledByType = new Map();
  SHUFFLED_ASSET_TYPES.forEach((type) => {
    const shuffled = shuffleVariantsOfType(manualItems, type);
    if (shuffled) {
      shuffledByType.set(type, { variants: shuffled, cursor: 0 });
    }
  });

  const assetSteps = [];
  manualItems.forEach((item, index) => {
    const shuffle = shuffledByType.get(item.type);
    if (!shuffle) {
      return;
    }
    const variant = shuffle.variants[shuffle.cursor];
    shuffle.cursor += 1;
    if (
      !variant?.assetKey ||
      (variant.assetKey === item.assetKey &&
        (item.type !== "bead" || variant.beadSizeId === item.sizeId))
    ) {
      return;
    }
    assetSteps.push({
      kind: "asset",
      index,
      type: item.type,
      assetKey: variant.assetKey,
      beadSizeId: item.type === "bead" ? variant.beadSizeId : item.sizeId,
    });
  });

  const charmGapStep = buildCharmGapStep(manualItems);
  const plan = charmGapStep ? [charmGapStep, ...assetSteps] : assetSteps;
  return plan;
}
