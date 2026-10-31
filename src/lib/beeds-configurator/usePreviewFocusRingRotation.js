"use client";

import { useEffect, useRef, useState } from "react";
import {
  PREVIEW_FOCUS_ANIM_MS,
  PREVIEW_FOCUS_FRONT_ANGLE_DEG_2D,
  easeInOutCubic,
  getRingRotationToFocusItem,
  getShortestRotationDelta,
} from "./previewFocus";

const PREVIEW_FOCUS_MIN_ROTATE_DEG = 2.5;
import { usePreviewFocus } from "./contexts/PreviewFocusContext";

function resolveFocusItem(settledItems, pattern, focusItemId, focusPatternIndex) {
  if (!settledItems?.length) return null;
  if (focusItemId) {
    const byId = settledItems.find((item) => item.id === focusItemId);
    if (byId) {
      return byId;
    }
  }
  if (focusPatternIndex != null) {
    const bySlot = settledItems.find((item) => item.slotIndex === focusPatternIndex);
    if (bySlot) {
      return bySlot;
    }
    const entry = pattern?.[focusPatternIndex];
    if (entry?.id) {
      const byId = settledItems.find((item) => item.id === entry.id);
      if (byId) return byId;
    }
    if (settledItems[focusPatternIndex]) {
      return settledItems[focusPatternIndex];
    }
  }
  return null;
}

/**
 * Animates ring rotation toward a customization focus target (shared by 2D + 3D previews).
 */
export function usePreviewFocusRingRotation({
  settledItems,
  pattern,
  rotationDeg,
  setRotationDeg,
  rotationRef,
  suppressFocus = false,
  frontAngleDeg = PREVIEW_FOCUS_FRONT_ANGLE_DEG_2D,
}) {
  const { focusItemId, focusPatternIndex, focusUntil } = usePreviewFocus();
  const [focusLockActive, setFocusLockActive] = useState(false);
  const animRef = useRef(null);
  const holdTimerRef = useRef(null);
  const focusUntilRef = useRef(focusUntil);
  const lastAnimatedFocusKeyRef = useRef(null);
  const settledItemsRef = useRef(settledItems);
  const patternRef = useRef(pattern);
  settledItemsRef.current = settledItems;
  patternRef.current = pattern;
  focusUntilRef.current = focusUntil;

  const cancelFocusAnimation = () => {
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    lastAnimatedFocusKeyRef.current = null;
    setFocusLockActive(false);
  };

  useEffect(() => {
    if (suppressFocus) {
      cancelFocusAnimation();
      return undefined;
    }

    const focusKey = focusItemId
      ? `id:${focusItemId}`
      : focusPatternIndex != null
      ? `idx:${focusPatternIndex}`
      : null;

    if (!focusKey) {
      lastAnimatedFocusKeyRef.current = null;
      return undefined;
    }

    if (focusKey === lastAnimatedFocusKeyRef.current) {
      return undefined;
    }

    const item = resolveFocusItem(
      settledItemsRef.current,
      patternRef.current,
      focusItemId,
      focusPatternIndex
    );
    const target = item ? getRingRotationToFocusItem(item, frontAngleDeg) : null;
    if (target == null) {
      return undefined;
    }

    const from = rotationRef.current;
    const delta = getShortestRotationDelta(from, target);
    if (Math.abs(delta) < PREVIEW_FOCUS_MIN_ROTATE_DEG) {
      lastAnimatedFocusKeyRef.current = focusKey;
      return undefined;
    }

    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
    }
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
    }

    const start = performance.now();
    lastAnimatedFocusKeyRef.current = focusKey;
    setFocusLockActive(true);

    const tick = (now) => {
      const t = Math.min(1, (now - start) / PREVIEW_FOCUS_ANIM_MS);
      const next = from + delta * easeInOutCubic(t);
      rotationRef.current = next;
      setRotationDeg(next);
      if (t < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        rotationRef.current = target;
        setRotationDeg(target);
        const remaining = focusUntilRef.current - Date.now();
        holdTimerRef.current = setTimeout(
          () => {
            setFocusLockActive(false);
          },
          Math.max(0, remaining)
        );
      }
    };

    animRef.current = requestAnimationFrame(tick);

    return () => {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
    };
  }, [
    focusItemId,
    focusPatternIndex,
    suppressFocus,
    rotationRef,
    setRotationDeg,
    frontAngleDeg,
  ]);

  return { focusLockActive };
}
