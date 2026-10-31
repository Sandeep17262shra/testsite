"use client";

/**
 * Disabled per user request: selecting spacers or metallic beads
 * should not trigger an extra camera zoom.
 */
export function usePreviewFocusSpacerZoom() {
  // No-op: camera stays at standard view distance for all selections.
}
