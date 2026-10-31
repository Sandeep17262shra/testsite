import { getPreviewCenter } from "./beadRingLayout";
import { normalizeAngleDelta } from "./beadRingSpin";

const { x: CENTER_X, y: CENTER_Y } = getPreviewCenter();

export const PREVIEW_FOCUS_HOLD_MS = 4800;
export const PREVIEW_FOCUS_ANIM_MS = 560;

/** Layout angle in SVG space (0° = east, 90° = south / preview front). */
export function getLayoutAngleDegFromItem(item) {
  if (!item || item.x == null || item.y == null) {
    return null;
  }
  return (Math.atan2(item.y - CENTER_Y, item.x - CENTER_X) * 180) / Math.PI;
}

/** 2D SVG: front of preview is 6 o'clock (south). */
export const PREVIEW_FOCUS_FRONT_ANGLE_DEG_2D = 90;

/**
 * 3D flat-lay: layout +Y → world −Z. The edit camera has a small +X/+Z offset
 * (rather than sitting directly above the origin), so its visual front is 3.8°
 * clockwise of +Z. Matching that azimuth keeps a focused bead at the actual
 * screen bottom-center instead of a little to the left of it.
 */
export const PREVIEW_FOCUS_FRONT_ANGLE_DEG_3D = 273.8;

/** `ringViewRotation` / ring yaw that places the item at the front of the preview. */
export function getRingRotationToFocusItem(item, frontAngleDeg = PREVIEW_FOCUS_FRONT_ANGLE_DEG_2D) {
  const layoutAngle = getLayoutAngleDegFromItem(item);
  if (layoutAngle == null) {
    return null;
  }
  let target = frontAngleDeg - layoutAngle;
  while (target > 180) {
    target -= 360;
  }
  while (target < -180) {
    target += 360;
  }
  return target;
}

export function getRingRotationToFocusItem3D(item) {
  return getRingRotationToFocusItem(item, PREVIEW_FOCUS_FRONT_ANGLE_DEG_3D);
}

export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function getShortestRotationDelta(fromDeg, toDeg) {
  return normalizeAngleDelta(toDeg - fromDeg);
}
