/* eslint-disable react/no-unknown-property */
/* eslint-disable react/prop-types */

// ─── DrapeStonePendant ──────────────────────────────────────────────────────
// Stone charms (Oval / Round / Square) set IN a drape chain. They take the very
// same slots along the chain as hanging charms do (getChainCharmTransform), and
// each one follows the chain's slope there. Like DrapeNamePendant, it reports
// the link rings upward as the chain's anchors and the chain is rebuilt to run
// ring-to-ring through them (anchors.gaps for the stretches between stones).
import React, { useEffect, useMemo, Suspense } from 'react';
import AttachedStoneCharm from '../shared/AttachedStoneCharm';
import { getAttachedCharm, getAttachedCharmDimensions } from '../shared/attachedCharms';
import { getChainPointAtX, getChainCharmTransform, getChainXAtT } from './DrapeChain';

// Scene units per model unit on the necklace (its scene is ~12 wide, against
// ~1.8 for the bracelet). Keeps each ring's wire inside a chain link's opening.
export const NECKLACE_ATTACHED_CHARM_SCALE = 0.04;
// Clear chain wanted between a stone charm and its neighbour.
const MIN_CLEARANCE = 0.2;
// Rough width of an ordinary hanging charm.
const HANGING_WIDTH = 0.6;

const stoneDims = (charm) => {
  const def = getAttachedCharm(charm?.attachedId);
  return def ? { def, dims: getAttachedCharmDimensions(def, NECKLACE_ATTACHED_CHARM_SCALE) } : null;
};
const charmWidth = (charm) => {
  const s = charm?.type === 'attached' ? stoneDims(charm) : null;
  return s ? 2 * (s.dims.halfSpan + s.dims.washer.outer) : HANGING_WIDTH;
};

// Where the charm in slot `i` of `list` sits along X. A stone charm takes the
// slot's exact, evenly spaced spot; a hanging charm snaps to a link.
export const getSlotX = (charm, i, total, cfg) => {
  const slot = getChainCharmTransform(i, total, cfg);
  return charm?.type === 'attached' ? getChainXAtT(cfg, slot.t) : slot.linkPosition[0];
};
export const getSlotXs = (list, cfg) => list.map((c, i) => getSlotX(c, i, list.length, cfg));

// True when no stone charm overlaps a neighbour in its slot.
export function stoneCharmsFitOnChain(list, cfg) {
  if (!cfg || !list.some((c) => c?.type === 'attached')) return true;
  const xs = getSlotXs(list, cfg);
  return list.every((c, i) => {
    if (i === 0) return true;
    if (c?.type !== 'attached' && list[i - 1]?.type !== 'attached') return true;
    return Math.abs(xs[i] - xs[i - 1]) >= (charmWidth(c) + charmWidth(list[i - 1])) / 2 + MIN_CLEARANCE;
  });
}

// `items`: [{ charm, x }] left to right - x is the slot's position on the chain.
const NO_ITEMS = [];
const DrapeStonePendant = ({ items = NO_ITEMS, drapeCfg, onAnchorsChange }) => {
  // Each charm is centred on the chain at its slot and turned to the chain's
  // slope there; both rings are then pushed onto that line.
  const placed = useMemo(() => {
    if (!drapeCfg) return null;
    return items.map(({ charm, x }) => {
      const s = stoneDims(charm);
      if (!s) return null;
      const a = getChainPointAtX(drapeCfg, x - s.dims.halfSpan);
      const b = getChainPointAtX(drapeCfg, x + s.dims.halfSpan);
      if (!a || !b) return null;
      const theta = Math.atan2(b[1] - a[1], b[0] - a[0]);
      return {
        charm, ...s, theta,
        x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, z: (a[2] + b[2]) / 2,
      };
    });
  }, [drapeCfg, items]);

  const anchors = useMemo(() => {
    if (!placed || !placed.length || placed.some((p) => !p)) return null;
    // The chain aims at a washer's mid-plane, which it takes to sit half its
    // depth BEHIND the anchor, so push the anchor forward by that much.
    const ring = (p, side) => [
      p.x + side * p.dims.halfSpan * Math.cos(p.theta),
      p.y + side * p.dims.halfSpan * Math.sin(p.theta),
      p.z + p.dims.washer.depth / 2,
    ];
    const first = placed[0];
    const last = placed[placed.length - 1];
    return {
      left: ring(first, -1),
      right: ring(last, 1),
      washer: first.dims.washer,
      washerLeft: first.dims.washer,
      washerRight: last.dims.washer,
      gaps: placed.slice(0, -1).map((p, i) => ({
        from: ring(p, 1),
        to: ring(placed[i + 1], -1),
        washerFrom: p.dims.washer,
        washerTo: placed[i + 1].dims.washer,
      })),
    };
  }, [placed]);

  useEffect(() => { onAnchorsChange?.(anchors); }, [anchors, onAnchorsChange]);
  useEffect(() => () => onAnchorsChange?.(null), [onAnchorsChange]);

  if (!placed) return null;
  return (
    <Suspense fallback={null}>
      {placed.filter(Boolean).map((p, i) => (
        <group key={p.charm.id ?? i} position={[p.x, p.y, p.z]} rotation={[0, 0, p.theta]}>
          <AttachedStoneCharm
            charm={p.def}
            scale={NECKLACE_ATTACHED_CHARM_SCALE}
            metalColor={p.charm.bodyColor}
            stoneColor={p.charm.gemstoneColor}
          />
        </group>
      ))}
    </Suspense>
  );
};

export default DrapeStonePendant;
