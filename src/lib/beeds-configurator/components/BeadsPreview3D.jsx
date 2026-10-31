"use client";

import React, { Suspense, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Billboard, Environment, OrbitControls, useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";

import {
  GEM_REFRACTION_PARAMS,
  loadGemEnvTexture,
  useGemEnvTexture,
} from "../../necklace-configurator/shared/gemMaterial";
import {
  JEWELRY_ENV_INTENSITY,
  RING_METAL,
  RING_METAL_COLORS,
  toRingMetalColor,
} from "../../necklace-configurator/shared/metalMaterial";
import { RGBELoader } from "three-stdlib";
import {
  getSpacerDiamondVariant,
  getSpacerMetalFinish,
  getRoundSpacer3DTransform,
  isCatalogSpacerSku,
  isDiamondSpacerSku,
  isStoneWheelSpacerSku,
  resolvePatternAsset,
  isHexSpacer3DModel,
  isRoundSpacerSku,
  isColoredCrystalSpacerSku,
  isHexSpacerSku,
  isPlainWheel3DModel,
  isGlassWheelSpacerModel,
  isScene81MetalSpacerSku,
  isTwisterWheelModel,
  resolveSpacer3DModelUrl,
  GLB_BEADS,
} from "../assets";
import { resolveBeadsCharmExtrudeDepth, useThickCharmAssets } from "../thickImageCharm";
import { useBeedsContext } from "../contexts/BeedsContext";
import { View360Context } from "../contexts/View360Context";
import { usePreviewFocus } from "../contexts/PreviewFocusContext";
import { normalizeAngleDelta } from "../beadRingSpin";
import { playBeadMoveSound, playBeadRemoveSound } from "../beadsSounds";
import { usePreviewFocusRingRotation } from "../usePreviewFocusRingRotation";
import { PREVIEW_FOCUS_FRONT_ANGLE_DEG_3D } from "../previewFocus";
import { resolveCharmDragSnapGap } from "../beadRingDrag";
import {
  BEADS_3D_CAMERA_FOV,
  BEADS_3D_ORBIT_ZOOM_SPEED,
  BEADS_3D_RING_TILT_X,
  getBeads3DCameraPosition,
  getBeads3DOrbitLimits,
} from "../beadsPreview3DCamera";
import {
  buildPositionedRingItems,
  CHARM_BAIL_HOOK_DROP_RATIO,
  getCharmPendantLayout,
  getPreviewCenter,
  getRingRadiusForInches,
  MAX_BRACELET_LENGTH_INCHES,
} from "../beadRingLayout";

const { x: CENTER_X, y: CENTER_Y } = getPreviewCenter();
const WORLD_PER_PX = 0.0105;
const BEAD_DIAMETER_SCALE = 0.93;
const SPACER_DIAMETER_SCALE = 0.44;
const GLASS_BEAD_GLB = "/bc-assets/bead_models/glass-bead.glb?v4";
/** Bead bracelet-only HDR for all spacer-metal reflections. */
const BEADS_SPACER_METAL_ENV_URL = "/bc-assets/env_metal_studio.hdr";
const SPACER_RING_LIFT_Y = 0.0012;
const STRING_Y_OFFSET = -0.0005;
/** S1–S3 / generic white pavé base (avoid pure #fff — reads flat). */
const SPACER_DIAMOND_COLOR = "#e8eef6";
const SPACER_FALLBACK_METAL = RING_METAL_COLORS.yellow;
const SPACER_3D_SIZE_BOOST = 1.45;
const SPACER_3D_VISUAL_SCALE = 1;
/** Classic S1–S6: supplied three-stone wheels need a little more 3D presence. */
const CLASSIC_STONE_SPACER_3D_SCALE = 1.8;
/** Fallback until metal3.hdr loads (ring-matched env on spacer bands). */
const SPACER_METAL_ENV_INTENSITY = 1.42;
const SPACER_METAL_TEX_ENV_INTENSITY = 1.58;
/** Same HDR as ring — spacers are small so a touch above necklace JEWELRY_ENV_INTENSITY. */
const SPACER_RING_METAL_ENV_INTENSITY = JEWELRY_ENV_INTENSITY * 1.18;
const SPACER_RING_METAL_TEX_ENV_INTENSITY = JEWELRY_ENV_INTENSITY * 1.22;
/** Global gem env lift (S10+ etc.). S1–S6 use STONE_WHEEL_* — do not stack both. */
const SPACER_GEM_ENV_BOOST = 1.1;
/** Stretch wheel along the string so it meets bead spheres (GLB depth < diameter). */
const SPACER_TANGENT_STRETCH = 1.48;
/** S7–S9 scene.glb — slimmer band; keep cord trim in sync via helpers below. */
const SCENE81_TANGENT_STRETCH = SPACER_TANGENT_STRETCH * 0.9;
const SCENE81_PROFILE_SCALE = 0.82;
/** S7–S9 GLB thickness vs layout slot — slight downscale so band sits in the crevice. */
const SCENE81_3D_TARGET_SCALE = 0.94;
/**
 * S7–S9 twister-wheel.glb — the GLB diameter in scene units is ~4.48 after
 * the authored node scale of 0.222 is applied; the bounding sphere maxDim
 * will therefore be large. Divide the scene81 target by this factor so the
 * ring ends up the same visual size as the old scene.glb band.
 * Tweak this constant if the ring still looks too large/small on the bracelet.
 */
const TWISTER_WHEEL_3D_TARGET_SCALE = SCENE81_3D_TARGET_SCALE * 1;
/** S10–S14 glass-wheel-spacer.glb — rondelle proportion matching round beads. */
const GLASS_WHEEL_3D_TARGET_SCALE = 0.85;
const GLASS_WHEEL_TANGENT_STRETCH = 1;
const GLASS_WHEEL_PROFILE_SCALE = 1;
/** S10–S14 glass wheel — tame HDR/specular so facets stay colored, not milky white. */
const GLASS_WHEEL_LIGHT_SCALE = 0.68;
const GLASS_WHEEL_ENV_INTENSITY = 1.42;
/** Hint of ice-white in the crystal body (kept small so color still reads). */
const GLASS_WHEEL_WHITE_MIX = 0.07;
const _glassWheelTintScratch = new THREE.Color();
const _glassWheelWhiteScratch = new THREE.Color("#eef2f7");

function glassWheelTintedColor(hex, whiteMix = GLASS_WHEEL_WHITE_MIX) {
  return _glassWheelTintScratch.set(hex).lerp(_glassWheelWhiteScratch, whiteMix);
}

function resolveSpacerAssetKey(item) {
  return item?.assetKey ?? item?.asset?.key ?? null;
}

function isRoundSpacerItem(item) {
  return item?.type === "spacer" && isRoundSpacerSku(resolveSpacerAssetKey(item));
}

function isGlassWheelSpacerItem(item) {
  return item?.type === "spacer" && isColoredCrystalSpacerSku(resolveSpacerAssetKey(item));
}

function isClassicStoneSpacerSku(assetKey) {
  return /^legacy-s[1-6]$/i.test(String(assetKey || ""));
}

/** Style 2 ring: bead → bead → spacer (matches beadRingLayout). */
function isStyle2RingItems(ringItems) {
  const count = ringItems.length;
  if (count < 3 || count % 3 !== 0) {
    return false;
  }
  for (let index = 0; index < count; index += 3) {
    if (
      ringItems[index]?.type !== "bead" ||
      ringItems[index + 1]?.type !== "bead" ||
      ringItems[index + 2]?.type !== "spacer"
    ) {
      return false;
    }
  }
  return true;
}

function spacerUsesScene81Band(itemOrKey) {
  return isScene81MetalSpacerSku(
    typeof itemOrKey === "string" ? itemOrKey : resolveSpacerAssetKey(itemOrKey)
  );
}

function getSpacerTangentStretchForItem(item) {
  const assetKey = resolveSpacerAssetKey(item);
  if (
    isRoundSpacerItem(item) ||
    isClassicStoneSpacerSku(assetKey) ||
    isColoredCrystalSpacerSku(assetKey)
  ) {
    return 1;
  }
  return spacerUsesScene81Band(item) ? SCENE81_TANGENT_STRETCH : SPACER_TANGENT_STRETCH;
}

function getSpacerRingScaleForAssetKey(assetKey) {
  // Classic S1–S6 and S10–S14 are round faceted gems. Keep their authored ratio.
  if (
    isRoundSpacerSku(assetKey) ||
    isClassicStoneSpacerSku(assetKey) ||
    isColoredCrystalSpacerSku(assetKey)
  ) {
    return [1, 1, 1];
  }
  if (spacerUsesScene81Band(assetKey)) {
    return [SCENE81_TANGENT_STRETCH, SCENE81_PROFILE_SCALE, SCENE81_PROFILE_SCALE];
  }
  return [SPACER_TANGENT_STRETCH, 1, 1];
}
/** Pull ring items inward — same arc, shorter chord between neighbors (3D only). */
const RING_3D_POSITION_SNUG = 0.952;
/** Extra arc (rad) opened on each bead–bead edge (split ±½ per bead) — 3D only. */
const BEAD_3D_BEAD_GAP_ANGLE_RAD = 0.05;
/** Style 2 (B–B–S): light bead–spacer separation along the string (3D only). */
const STYLE2_BEAD_SPACER_3D_GAP_PULL = 0.028;
/** Style 2 only: open the two beads inside each B–B–S triplet (not spacer gaps). */
const STYLE2_BEAD_PAIR_GAP_ANGLE_RAD = 0.036;
/** Slightly smaller glass mesh than layout art so shells clear neighbours on the string.
 *  Must satisfy: BEAD_DIAMETER_SCALE(0.93) × GLASS_BEAD_SHELL_SCALE(0.98) × this ≤ BEAD_ART_FILL_RATIO(0.76)
 *  i.e. this ≤ 0.76 / (0.93 × 0.98) ≈ 0.833.  Set to 0.78 for a clear margin. */
const BEAD_3D_GLASS_VISUAL_SCALE = 0.8;
/** Extend spacer bore tubes slightly so cord meets the wheel mesh in bead–spacer gaps. */
const STRING_MESH_OVERLAP = 1.32;
/** Beads: trim gap arcs at the glass shell when using partial gap-only cord layouts. */
const BEAD_STRING_SHELL_TRIM = 1;
/** Extra angular padding so the cord stops outside the glass (a cord inside the bead reads pale). */
const BEAD_CORD_ARC_ANGLE_PAD = 0.04;
/** 2D ring string uses `PREVIEW_STRING_STROKE_WIDTH` = 1 in layout px (`BeadsPreview2D`). */
const PREVIEW_STRING_STROKE_WIDTH_PX = 1;
/** Tube radius in world units from 2D stroke (× boost so 360 reads like the flat preview). */
const CORD_TUBE_2D_MATCH_BOOST = 1.55;

function getBraceletCordTubeRadius(avgRingDist) {
  const from2d = (PREVIEW_STRING_STROKE_WIDTH_PX * 0.5) * WORLD_PER_PX * CORD_TUBE_2D_MATCH_BOOST;
  const proportional = avgRingDist * 0.004;
  return Math.max(from2d, proportional, 0.0038);
}
const _nudgeScratch = new THREE.Vector3();
const _elasticAxisScratch = new THREE.Vector3();
const _elasticQuatScratch = new THREE.Quaternion();
/** stone-wheel-1: bore local +Z → string +X (after ring tangent quat). */
const SPACER_STONE_WHEEL_LOCAL_QUAT = new THREE.Quaternion().setFromEuler(
  new THREE.Euler(0, Math.PI / 2, 0)
);
/** plain-wheel-1: bore local +Y → string +X (thin axis Y). */
const PLAIN_WHEEL_ON_STRING_QUAT = new THREE.Quaternion().setFromEuler(
  new THREE.Euler(0, 0, -Math.PI / 2)
);
const _spacerLocalQuatScratch = new THREE.Quaternion();
const IDENTITY_QUAT = new THREE.Quaternion();

function getSpacerModelLocalQuaternion(modelUrl, assetKey = null) {
  if (isCatalogSpacerSku(assetKey)) {
    return _spacerLocalQuatScratch.copy(IDENTITY_QUAT);
  }
  // twister-wheel.glb has its bore along local +Z (ring lies in the XY plane).
  // Rotate +Z → +X so the bore aligns with the string tangent.
  if (isTwisterWheelModel(modelUrl)) {
    return _spacerLocalQuatScratch.copy(SPACER_STONE_WHEEL_LOCAL_QUAT);
  }
  if (
    isPlainWheel3DModel(modelUrl) ||
    isGlassWheelSpacerModel(modelUrl) ||
    isColoredCrystalSpacerSku(assetKey) ||
    isScene81MetalSpacerSku(assetKey)
  ) {
    return _spacerLocalQuatScratch.copy(PLAIN_WHEEL_ON_STRING_QUAT);
  }
  return _spacerLocalQuatScratch.copy(SPACER_STONE_WHEEL_LOCAL_QUAT);
}
const _spacerTangent = new THREE.Vector3();
const _spacerRadial = new THREE.Vector3();
const _spacerUp = new THREE.Vector3(0, 1, 0);
const _spacerBitangent = new THREE.Vector3();
const _spacerBasis = new THREE.Matrix4();

/** Same tangent as `SpacerBoreTube` / ring arcs: atan2(x,z) → (cos θ, 0, −sin θ). */
function getRingStringTangent(worldX, worldZ) {
  const angle = Math.atan2(worldX, worldZ);
  return _spacerTangent.set(Math.cos(angle), 0, -Math.sin(angle)).normalize();
}

/**
 * String tangent at a ring slot: bore along local +X, outward in the XZ plane (+Z).
 * Shared by spacers and glass beads (same rule as 2D `getStrungItemRotationDegrees`).
 */
function getItemOnStringQuaternion(worldX, worldZ) {
  const tangent = getRingStringTangent(worldX, worldZ);
  _spacerRadial.set(worldX, 0, worldZ);
  if (_spacerRadial.lengthSq() < 1e-10) {
    _spacerRadial.set(0, 0, 1);
  } else {
    _spacerRadial.normalize();
  }
  _spacerBitangent.crossVectors(tangent, _spacerUp).normalize();
  _spacerBasis.makeBasis(tangent, _spacerUp, _spacerBitangent);
  return new THREE.Quaternion().setFromRotationMatrix(_spacerBasis);
}

/** 2D charm `hardwareRotation` (tangentDeg): hole along local +X, same as `rotate(hardwareRotation)` in SVG. */
function getCharmHardwareQuaternion(hardwareDeg) {
  const rad = THREE.MathUtils.degToRad(hardwareDeg);
  _spacerTangent.set(Math.cos(rad), 0, -Math.sin(rad)).normalize();
  _spacerBitangent.crossVectors(_spacerTangent, _spacerUp).normalize();
  _spacerBasis.makeBasis(_spacerTangent, _spacerUp, _spacerBitangent);
  return new THREE.Quaternion().setFromRotationMatrix(_spacerBasis);
}
/**
 * glass-bead.glb is authored with its bore facing local +Z.  The ring item
 * wrapper already aligns local +X with the elastic thread, so turn only the
 * bead mesh 90° around Y to put its bore on that thread. Spacers and charms
 * have their own transforms and deliberately do not use this rotation.
 */
const GLASS_BEAD_BORE_ROTATION = [0, Math.PI / 2, 0];
const GLASS_BEAD_SHELL_SCALE = 0.98;
/** Cord vs bead jewelry — separate layers; WebP/glass materials stay independent. */
const RENDER_ORDER_BRACELET_CORD = 1;
/** Back-to-front painter order for ring + charms (updated from camera depth each frame). */
const RENDER_ORDER_RING_BASE = 10;
const RENDER_ORDER_RING_STRIDE = 8;
const RENDER_ORDER_BEAD_GLASS_SHELL = 5;
const _depthEuler = new THREE.Euler();
const _depthScratch = new THREE.Vector3();
/** One loop — matches the string tone seen through the glass shell (avoids black vs pale mismatch). */
const BRACELET_CORD_MAT = new THREE.MeshBasicMaterial({
  color: "#8a8194",
  toneMapped: true,
  depthWrite: true,
  depthTest: true,
});

const CHARM_BAIL_GOLD = "#f6c45e";

const CHARM_BAIL_GOLD_MAT = new THREE.MeshStandardMaterial({
  color: CHARM_BAIL_GOLD,
  metalness: 0.72,
  roughness: 0.28,
  toneMapped: false,
});
/** 3D-only: slightly larger bail; hook Y uses same drop ratio as 2D layout. */
const CHARM_BAIL_3D_SIZE_BOOST = 1.36;
/** Charm view-mode swing: falls down 60° from bracelet plane (in edit mode it lies flat at 0°). */
const CHARM_VIEW_MODE_HANG_ANGLE_DEG = 60;
const _charmTiltAxis = new THREE.Vector3(1, 0, 0);
const _charmOutwardScratch = new THREE.Vector3();
const _charmROut = new THREE.Vector3();
const _charmAxisX = new THREE.Vector3();
const _charmAxisY = new THREE.Vector3();
const _charmBasisMat = new THREE.Matrix4();
const CHARM_BAIL_ANCHOR_RATIO = 0.085;

/** Avoid near-plane slicing when charms / glass rotate edge-on to the camera. */
function PreviewRenderSettings() {
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);

  useLayoutEffect(() => {
    camera.near = 0.2;
    camera.far = 80;
    camera.updateProjectionMatrix();
    gl.sortObjects = true;
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    loadGemEnvTexture().catch(() => {});
    loadSpacerMetalEnvTexture().catch(() => {});
  }, [camera, gl]);

  return null;
}

if (typeof window !== "undefined" && typeof useGLTF.setDecoderPath === "function") {
  useGLTF.setDecoderPath("/draco/gltf/");
}
useGLTF.preload(GLASS_BEAD_GLB);
// Preload GLB-based beads so they are ready before the user picks them.
GLB_BEADS.forEach((bead) => {
  if (bead.modelUrl) {
    useGLTF.preload(bead.modelUrl);
  }
});

function layoutItemsByPattern(pattern, positionedItems) {
  const byId = new Map();
  positionedItems.forEach((item) => {
    if (item.id) {
      byId.set(item.id, item);
    }
  });
  return pattern
    .map((entry, index) => {
      const positioned = entry.id ? byId.get(entry.id) : positionedItems[index];
      if (!positioned) {
        return null;
      }
      return {
        ...positioned,
        asset: entry.asset ?? positioned.asset,
        assetKey: entry.assetKey ?? positioned.assetKey,
        sizeId: entry.sizeId ?? positioned.sizeId,
        patternIndex: index,
      };
    })
    .filter(Boolean);
}

function resolveRingItemImageUrl(item, selectedBead, selectedSeparator) {
  if (item.asset?.image) {
    return item.asset.image;
  }
  if (item.assetKey) {
    return resolvePatternAsset(item.type, item.assetKey)?.image ?? null;
  }
  if (item.type === "spacer") {
    return selectedSeparator?.image ?? null;
  }
  if (item.type === "bead") {
    return selectedBead?.image ?? null;
  }
  return null;
}

function resolveRingItemTextureUrl(item, selectedBead) {
  if (item.asset) {
    return item.asset.texture ?? null;
  }
  if (item.assetKey) {
    return resolvePatternAsset(item.type, item.assetKey)?.texture ?? null;
  }
  return selectedBead?.texture ?? null;
}

function resolveRingItemMaterialType(item, selectedBead) {
  if (item.asset) {
    return item.asset.materialType ?? "solid";
  }
  if (item.assetKey) {
    return resolvePatternAsset(item.type, item.assetKey)?.materialType ?? "solid";
  }
  return selectedBead?.materialType ?? "solid";
}

function resolveRingItemBeadModelUrl(item, selectedBead) {
  if (item.asset) {
    return item.asset.modelUrl ?? null;
  }
  if (item.assetKey) {
    return resolvePatternAsset(item.type, item.assetKey)?.modelUrl ?? null;
  }
  return selectedBead?.modelUrl ?? null;
}

function computeSettledLayout({
  pattern,
  isManualMode,
  layoutRingRadius,
  sizeId,
  isStringFull,
  isFreeSizeLayout,
  hasPresetRingSlots,
  presetHasCharmLayout,
}) {
  const ringRadiusHint = layoutRingRadius;
  if (isManualMode) {
    return buildPositionedRingItems({
      pattern,
      slotCount: pattern.length,
      defaultSizeId: sizeId,
      centerX: CENTER_X,
      centerY: CENTER_Y,
      ringRadiusHint,
      isPartialCluster: !isStringFull,
      useVariableDiameters: true,
      useManualEvenRingLayout: true,
      useFreeSizeGrowingRing: isFreeSizeLayout,
      manualStringFull: isStringFull,
      usePresetFixedRing: false,
    });
  }
  if (hasPresetRingSlots || presetHasCharmLayout) {
    return buildPositionedRingItems({
      pattern,
      slotCount: pattern.length,
      defaultSizeId: sizeId,
      centerX: CENTER_X,
      centerY: CENTER_Y,
      ringRadiusHint: layoutRingRadius,
      isPartialCluster: false,
      useVariableDiameters: true,
      useManualEvenRingLayout: true,
      useFreeSizeGrowingRing: false,
      manualStringFull: true,
      usePresetFixedRing: true,
    });
  }
  return buildPositionedRingItems({
    pattern,
    slotCount: pattern.length,
    defaultSizeId: sizeId,
    centerX: CENTER_X,
    centerY: CENTER_Y,
    ringRadiusHint: layoutRingRadius,
    isPartialCluster: false,
    useVariableDiameters: false,
    useManualEvenRingLayout: false,
    manualStringFull: false,
  });
}

function useBeadsSettledLayout() {
  const { pattern, isManualMode, layoutRingRadius, isStringFull, sizeId, isFreeSizeLayout, presetSlotItems } =
    useBeedsContext();

  const hasPresetRingSlots = !isManualMode && presetSlotItems.length > 0;
  const presetHasCharmLayout = !isManualMode && pattern.some((entry) => entry.type === "charm");

  return useMemo(() => {
    const layout = computeSettledLayout({
      pattern,
      isManualMode,
      layoutRingRadius,
      sizeId,
      isStringFull,
      isFreeSizeLayout,
      hasPresetRingSlots,
      presetHasCharmLayout,
    });
    const usePatternMap = isManualMode || presetHasCharmLayout || hasPresetRingSlots;
    const items = usePatternMap
      ? layoutItemsByPattern(pattern, layout.items)
      : layout.items;
    const stringRadiusPx = layout.ringRadius ?? layoutRingRadius;
    return { items, stringRadiusPx, isStringFull };
  }, [
    pattern,
    isManualMode,
    layoutRingRadius,
    sizeId,
    isStringFull,
    isFreeSizeLayout,
    hasPresetRingSlots,
    presetHasCharmLayout,
  ]);
}

function snugRingPosition(worldX, worldZ) {
  return [worldX * RING_3D_POSITION_SNUG, worldZ * RING_3D_POSITION_SNUG];
}

function getSpacer3DTargetSize(width, assetKey = null, modelUrl = null) {
  // Round spacer GLBs use the same normalized diameter as the glass bead model.
  if (isRoundSpacerSku(assetKey)) {
    const configuredScale = Number(getRoundSpacer3DTransform(assetKey).sizeScale);
    const sizeScale = Number.isFinite(configuredScale) && configuredScale > 0 ? configuredScale : 1;
    return width * BEAD_DIAMETER_SCALE * BEAD_3D_GLASS_VISUAL_SCALE * sizeScale;
  }
  const boost = SPACER_3D_SIZE_BOOST * SPACER_3D_VISUAL_SCALE;
  if (spacerUsesScene81Band(assetKey)) {
    // twister-wheel.glb has a much larger internal bounding-sphere than scene.glb;
    // use a proportionally smaller target scale so the ring reads the same size.
    // Compensate for 2D layout width (60/277 of height vs prior 0.4/0.6) so 3D scale is preserved.
    const twisterWidthRatio = (60 / 277) / (0.4 / 0.6);
    const normalizedWidth = width / twisterWidthRatio;
    const scale = isTwisterWheelModel(modelUrl) ? TWISTER_WHEEL_3D_TARGET_SCALE : SCENE81_3D_TARGET_SCALE;
    return normalizedWidth * boost * scale;
  }
  if (isColoredCrystalSpacerSku(assetKey)) {
    // Compensate for 2D layout width (125/267 of height vs prior 0.4/0.6) so 3D scale is preserved.
    const crystalWidthRatio = (125 / 267) / (0.4 / 0.6);
    const normalizedWidth = width / crystalWidthRatio;
    return normalizedWidth * boost * GLASS_WHEEL_3D_TARGET_SCALE;
  }
  return width * boost * (isClassicStoneSpacerSku(assetKey) ? CLASSIC_STONE_SPACER_3D_SCALE : 1);
}

/** Half-extent along the string for 3D arcs (aligned with mesh scale, not 2D art box). */
function getRingStringLinearHalf(item, tr) {
  if (item.type === "spacer") {
    return (
      tr.width *
      0.5 *
      SPACER_3D_SIZE_BOOST *
      getSpacerTangentStretchForItem(item) *
      GLASS_BEAD_SHELL_SCALE *
      STRING_MESH_OVERLAP
    );
  }
  return tr.diameter * 0.5 * GLASS_BEAD_SHELL_SCALE * BEAD_STRING_SHELL_TRIM;
}

/** World-space glass shell radius — same as `GlassBeadMesh` scale × prototype radius. */
function getGlassBeadEffectiveWorldShellRadius(diameter, maxDim) {
  const safeMaxDim = maxDim > 0 ? maxDim : 1;
  return (diameter / safeMaxDim) * GLASS_BEAD_SHELL_SCALE * (safeMaxDim * 0.5);
}

function getBeadCordArcHalfAngle(diameter, ringDist, maxDim, { anglePad = BEAD_CORD_ARC_ANGLE_PAD } = {}) {
  const effectiveWorldRadius = getGlassBeadEffectiveWorldShellRadius(diameter, maxDim);
  if (ringDist < 1e-5) {
    return effectiveWorldRadius * BEAD_STRING_SHELL_TRIM;
  }
  return Math.asin(Math.min(0.998, effectiveWorldRadius / ringDist)) + anglePad;
}

/** Arc trim at spacers: stay in gaps only — no cord drawn across the wheel face. */
function getRingStringArcTrimHalf(item, tr) {
  return (
    tr.width *
    0.5 *
    SPACER_3D_SIZE_BOOST *
    getSpacerTangentStretchForItem(item) *
    GLASS_BEAD_SHELL_SCALE *
    1.05
  );
}

function getCordArcRadius(current, next, loopRadius) {
  if (loopRadius > 0) {
    return loopRadius;
  }
  return (current.ringDist + next.ringDist) * 0.5;
}

function getCharmOccupiedRingGaps(charmItems, ringCount) {
  if (!ringCount || !charmItems?.length) {
    return null;
  }
  const gaps = new Set();
  charmItems.forEach((charm, index) => {
    const raw = Number.isFinite(charm.ringGap) ? Math.floor(charm.ringGap) : index;
    gaps.add(((raw % ringCount) + ringCount) % ringCount);
  });
  return gaps;
}

function getSnugLayoutWorldXZ(item) {
  const x = (item.x - CENTER_X) * WORLD_PER_PX;
  const z = -(item.y - CENTER_Y) * WORLD_PER_PX;
  return snugRingPosition(x, z);
}

function countBeadBeadRingEdges(ringItems) {
  const count = ringItems.length;
  let edges = 0;
  for (let i = 0; i < count; i += 1) {
    if (ringItems[i].type === "bead" && ringItems[(i + 1) % count].type === "bead") {
      edges += 1;
    }
  }
  return edges;
}

function isStyle2IntraPairBeadEdge(ringIndex, neighborIndex, ringItems) {
  if (!isStyle2RingItems(ringItems)) {
    return false;
  }
  const lo = Math.min(ringIndex, neighborIndex);
  const hi = Math.max(ringIndex, neighborIndex);
  if (hi - lo !== 1) {
    return false;
  }
  return (
    ringItems[lo]?.type === "bead" &&
    ringItems[hi]?.type === "bead" &&
    lo % 3 === 0
  );
}

function getBead3dRingArcBoost() {
  return 1;
}

function scaleRingWorldPositionArcBoost(posX, posZ) {
  return [posX, posZ];
}

/**
 * Bead positions follow the layout ring directly without artificial gap shifts.
 */
function applyBead3dBeadGapSpread(posX, posZ) {
  return [posX, posZ];
}

/** Hairline clearance between touching meshes on the elastic band (world units). */
const ELASTIC_BAND_3D_CONTACT_GAP = 0.0015;
/** Room left on the cord where a charm bail hangs (matches 2D charm gap ≈ 9 px). */
const ELASTIC_BAND_3D_CHARM_GAP = 9 * WORLD_PER_PX;
/** Beads + spacers needed before the 360° cord contracts into an elastic band. */
const ELASTIC_BAND_3D_MIN_RING_ITEMS = 6;

/** Half-extent along the string of a spacer GLB as it is rendered in `SpacerOnRing`. */
function getSpacerAlongStringHalfWorld(item, spacerMetrics, selectedSeparator, selectedBead) {
  const tr = ringItemToTransform(item);
  const assetKey = item.assetKey ?? item.asset?.key ?? selectedSeparator?.key ?? "s2";
  const modelUrl = resolveSpacer3DModelUrl(assetKey);
  const targetSize = getSpacer3DTargetSize(tr.width, assetKey, modelUrl);
  const imageUrl = resolveRingItemImageUrl(item, selectedBead, selectedSeparator);
  const isHexPicker =
    isHexSpacerSku(assetKey) && Boolean(imageUrl) && !isDiamondSpacerSku(assetKey);
  if (isHexPicker) {
    return targetSize * GLASS_BEAD_SHELL_SCALE * 0.5;
  }
  const metric = spacerMetrics?.get(modelUrl);
  if (!metric) {
    // Round S1–S8 models occupy a full bead slot. Reserving their actual
    // radius from the first render prevents an initial collapsed layout while
    // their GLBs are still loading.
    if (isRoundSpacerSku(assetKey)) {
      return targetSize * GLASS_BEAD_SHELL_SCALE * 0.5;
    }
    return targetSize * GLASS_BEAD_SHELL_SCALE * 0.25;
  }
  const localQuat = getSpacerModelLocalQuaternion(modelUrl, assetKey);
  _elasticAxisScratch.set(1, 0, 0).applyQuaternion(_elasticQuatScratch.copy(localQuat).invert());
  const localHalf =
    (Math.abs(_elasticAxisScratch.x) * metric.size.x +
      Math.abs(_elasticAxisScratch.y) * metric.size.y +
      Math.abs(_elasticAxisScratch.z) * metric.size.z) *
    0.5;
  const ringScaleAlong = getSpacerRingScaleForAssetKey(assetKey)[0];
  return (
    localHalf *
    (targetSize / metric.maxDim) *
    GLASS_BEAD_SHELL_SCALE *
    ringScaleAlong
  );
}

function getElasticItemHalfWorld(item, spacerMetrics, selectedSeparator, selectedBead) {
  if (item.type === "spacer") {
    return getSpacerAlongStringHalfWorld(item, spacerMetrics, selectedSeparator, selectedBead);
  }
  const { diameter } = ringItemToTransform(item);
  return diameter * GLASS_BEAD_SHELL_SCALE * BEAD_3D_GLASS_VISUAL_SCALE * 0.5;
}

/**
 * 360° elastic band: places every ring item so neighbours touch along the cord, then solves
 * the loop radius where the chord angles close exactly one full turn. Style-agnostic; the 2D
 * layout only supplies item order, the start angle and the winding direction.
 */
function computeElasticBand3dLayout({
  ringItems,
  charmItems,
  spacerMetrics,
  selectedSeparator,
  selectedBead,
}) {
  const count = ringItems.length;
  if (!count) {
    return null;
  }
  const halves = ringItems.map((item) =>
    getElasticItemHalfWorld(item, spacerMetrics, selectedSeparator, selectedBead)
  );
  const charmGaps = getCharmOccupiedRingGaps(charmItems, count);
  const chords = halves.map((half, index) => {
    const nextHalf = halves[(index + 1) % count];
    const charmExtra = charmGaps?.has(index) ? ELASTIC_BAND_3D_CHARM_GAP : 0;
    return half + nextHalf + ELASTIC_BAND_3D_CONTACT_GAP + charmExtra;
  });

  const first = ringItemToTransform(ringItems[0]);
  const startAngle = Math.atan2(first.x, first.z);
  let direction = 1;
  if (count > 1) {
    const second = ringItemToTransform(ringItems[1]);
    const delta = Math.atan2(second.x, second.z) - startAngle;
    direction = Math.atan2(Math.sin(delta), Math.cos(delta)) < 0 ? -1 : 1;
  }

  const stepAngleAt = (chord, radius) => 2 * Math.asin(Math.min(1, chord / (2 * radius)));
  const totalAngleAt = (radius) => chords.reduce((sum, chord) => sum + stepAngleAt(chord, radius), 0);
  const minRadius = Math.max(Math.max(...chords) / 2, 1e-4);
  let radius = minRadius;
  let stepAngles;
  if (totalAngleAt(minRadius) <= 2 * Math.PI) {
    // Too few items to close a loop by contact (1–2 pieces): spread them evenly on the smallest ring.
    const total = totalAngleAt(minRadius);
    stepAngles = chords.map((chord) => (stepAngleAt(chord, minRadius) * 2 * Math.PI) / total);
  } else {
    let lo = minRadius;
    let hi = Math.max(minRadius * 2, chords.reduce((sum, chord) => sum + chord, 0));
    for (let iteration = 0; iteration < 60; iteration += 1) {
      const mid = (lo + hi) * 0.5;
      if (totalAngleAt(mid) > 2 * Math.PI) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    radius = hi;
    stepAngles = chords.map((chord) => stepAngleAt(chord, radius));
  }

  const itemAngles = [];
  let angle = startAngle;
  for (let index = 0; index < count; index += 1) {
    itemAngles.push(angle);
    angle += direction * stepAngles[index];
  }
  const ringPositions = itemAngles.map((a) => [Math.sin(a) * radius, Math.cos(a) * radius]);
  const charmPositions = charmItems.map((charm, charmIndex) => {
    const raw = Number.isFinite(charm.ringGap) ? Math.floor(charm.ringGap) : charmIndex;
    const gap = ((raw % count) + count) % count;
    // Centre of the free cord between the two surfaces — not the midpoint of their centres,
    // which falls inside the larger neighbour when a bead meets a thin spacer.
    const freeCenter = halves[gap] + (chords[gap] - halves[gap] - halves[(gap + 1) % count]) * 0.5;
    const mid = itemAngles[gap] + direction * stepAngles[gap] * (freeCenter / chords[gap]);
    return [Math.sin(mid) * radius, Math.cos(mid) * radius];
  });
  return { radius, ringPositions, charmPositions };
}

/** Measured when a spacer model actually loads. The scene does not wait on unused GLBs. */
const measuredSpacerMetrics = new Map();
const spacerMetricListeners = new Set();

function rememberSpacerMetric(modelUrl, size, maxDim) {
  if (!modelUrl || measuredSpacerMetrics.has(modelUrl)) {
    return;
  }
  measuredSpacerMetrics.set(modelUrl, { size: size.clone(), maxDim });
  spacerMetricListeners.forEach((listener) => listener());
}

function useSpacerModelMetrics() {
  const [version, refresh] = useState(0);
  useEffect(() => {
    const listener = () => refresh((value) => value + 1);
    spacerMetricListeners.add(listener);
    return () => {
      spacerMetricListeners.delete(listener);
    };
  }, []);
  // Measurements are recorded in a module-level cache. Return a fresh map
  // when it changes so dependent layout memoization recalculates the elastic
  // band with the loaded model's real dimensions.
  return useMemo(() => new Map(measuredSpacerMetrics), [version]);
}

function getRingMeshWorldXZ(item, ringIndex, ringItems, charmGaps = null, isManualMode = false) {
  if (item.elastic3dPos) {
    return item.elastic3dPos;
  }
  const { x, z } = ringItemToTransform(item);
  let [posX, posZ] = snugRingPosition(x, z);
  [posX, posZ] = applyBeadSpacerMeshNudge(posX, posZ, item, ringIndex, ringItems, charmGaps);
  [posX, posZ] = scaleRingWorldPositionArcBoost(posX, posZ, ringItems, isManualMode);
  return applyBead3dBeadGapSpread(posX, posZ, item, ringIndex, ringItems);
}

function nudgeTowardRingNeighbor(posX, posZ, neighbor, amount) {
  const nx = (neighbor.x - CENTER_X) * WORLD_PER_PX * RING_3D_POSITION_SNUG;
  const nz = -(neighbor.y - CENTER_Y) * WORLD_PER_PX * RING_3D_POSITION_SNUG;
  _nudgeScratch.set(nx - posX, 0, nz - posZ);
  const len = _nudgeScratch.length();
  if (len < 1e-8) {
    return [posX, posZ];
  }
  _nudgeScratch.multiplyScalar(amount / len);
  return [posX + _nudgeScratch.x, posZ + _nudgeScratch.z];
}

function applyBeadSpacerMeshNudge(posX, posZ, item, ringIndex, ringItems, charmGaps = null) {
  const count = ringItems.length;
  if (count < 2) {
    return [posX, posZ];
  }
  const prev = ringItems[(ringIndex - 1 + count) % count];
  const next = ringItems[(ringIndex + 1) % count];
  const gapBefore = (ringIndex - 1 + count) % count;
  const gapAfter = ringIndex;
  // Narrow-band spacers need a small inward nudge. Round S1–S8 models are bead-sized,
  // so applying that nudge makes their surfaces overlap neighbouring beads.
  const isThinSpacer = (entry) => entry?.type === "spacer" && !isRoundSpacerItem(entry);
  const isBeadSpacerPair = (a, b) =>
    (a?.type === "bead" && isThinSpacer(b)) || (isThinSpacer(a) && b?.type === "bead");
  const isSpacerSpacerPair = (a, b) => isThinSpacer(a) && isThinSpacer(b);
  const scene81Spacer = item.type === "spacer" && spacerUsesScene81Band(item);
  const scene81Neighbor =
    item.type === "bead" &&
    (spacerUsesScene81Band(prev) || spacerUsesScene81Band(next));
  const style2Ring = isStyle2RingItems(ringItems);
  const style2GlassWheel =
    style2Ring &&
    (isGlassWheelSpacerItem(item) ||
      isGlassWheelSpacerItem(prev) ||
      isGlassWheelSpacerItem(next));
  /** S7–S9: light snug like other spacers — avoid push-apart (shows bare cord). */
  const pull = scene81Spacer
    ? 0.14
    : scene81Neighbor
      ? 0.115
      : style2GlassWheel
        ? item.type === "spacer"
          ? 0.06
          : 0.08
        : item.type === "spacer"
          ? 0.16
          : 0.12;
  const spacerSpacerPull = scene81Spacer ? 0.09 : 0.1;
  let px = posX;
  let pz = posZ;
  const step = (item.width ?? 26) * WORLD_PER_PX * pull;
  const spacerStep = (item.width ?? 26) * WORLD_PER_PX * spacerSpacerPull;
  if (isBeadSpacerPair(item, prev) && !charmGaps?.has(gapBefore)) {
    [px, pz] = nudgeTowardRingNeighbor(px, pz, prev, step);
  }
  if (isBeadSpacerPair(item, next) && !charmGaps?.has(gapAfter)) {
    [px, pz] = nudgeTowardRingNeighbor(px, pz, next, step);
  }
  if (isSpacerSpacerPair(item, prev) && !charmGaps?.has(gapBefore)) {
    [px, pz] = nudgeTowardRingNeighbor(px, pz, prev, spacerStep);
  }
  if (isSpacerSpacerPair(item, next) && !charmGaps?.has(gapAfter)) {
    [px, pz] = nudgeTowardRingNeighbor(px, pz, next, spacerStep);
  }
  return [px, pz];
}

/** Same anchor as 2D `translate(item.x, item.y)` on the snugged string ring. */
function getCharmAttachWorldXZ(charmItem, ringItems = null, isManualMode = false) {
  if (charmItem.elastic3dPos) {
    return charmItem.elastic3dPos;
  }
  const attachX = (charmItem.x - CENTER_X) * WORLD_PER_PX;
  const attachZ = -(charmItem.y - CENTER_Y) * WORLD_PER_PX;
  let [posX, posZ] = snugRingPosition(attachX, attachZ);
  if (ringItems?.length) {
    [posX, posZ] = scaleRingWorldPositionArcBoost(posX, posZ, ringItems, isManualMode);
  }
  return [posX, posZ];
}

function ringItemToTransform(item) {
  const x = (item.x - CENTER_X) * WORLD_PER_PX;
  const z = -(item.y - CENTER_Y) * WORLD_PER_PX;
  const basePx = item.width ?? 26;
  const isSpacer = item.type === "spacer";
  const isRoundSpacer = isRoundSpacerItem(item);
  const diameter =
    basePx * WORLD_PER_PX *
    (isSpacer && !isRoundSpacer ? SPACER_DIAMETER_SCALE : BEAD_DIAMETER_SCALE);
  const width = (item.width ?? basePx) * WORLD_PER_PX;
  const height = (item.height ?? item.width ?? basePx) * WORLD_PER_PX;
  return { x, z, diameter, width, height, radius: Math.hypot(x, z) };
}

function createGlassBeadMaterial(envMap) {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#ffffff"),
    roughness: 0.06,
    metalness: 0,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    envMap: envMap ?? null,
    envMapIntensity: envMap ? 0.68 : 0.45,
    clearcoat: 0.78,
    clearcoatRoughness: 0.07,
    toneMapped: false,
  });
}

/**
 * The supplied stone photos are square. Build the same mirrored 2:1 texture
 * used by the bead demo: it matches spherical 360° × 180° UVs and makes the
 * left/right seam identical instead of stretching a flat catalogue image.
 */
function useWrappedBeadTexture(textureUrl) {
  const source = useTexture(textureUrl);

  return useMemo(() => {
    const image = source.image;
    if (!image?.width || !image?.height || typeof document === "undefined") {
      return source;
    }
    const height = Math.min(1024, image.height);
    const width = height;
    const canvas = document.createElement("canvas");
    canvas.width = width * 2;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0, image.width, image.height, 0, 0, width, height);
    context.save();
    context.translate(width * 2, 0);
    context.scale(-1, 1);
    context.drawImage(image, 0, 0, image.width, image.height, 0, 0, width, height);
    context.restore();

    // Use the map's average tone to tint light travelling through quartz.
    // Sampling every sixteenth pixel is sufficient and avoids a heavy scan.
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let red = 0;
    let green = 0;
    let blue = 0;
    let samples = 0;
    for (let index = 0; index < pixels.length; index += 64) {
      red += pixels[index];
      green += pixels[index + 1];
      blue += pixels[index + 2];
      samples += 1;
    }

    const wrapped = new THREE.CanvasTexture(canvas);
    wrapped.colorSpace = THREE.SRGBColorSpace;
    wrapped.flipY = false;
    wrapped.wrapS = THREE.RepeatWrapping;
    wrapped.wrapT = THREE.MirroredRepeatWrapping;
    wrapped.anisotropy = 8;
    wrapped.userData.averageColor = new THREE.Color().setRGB(
      red / (samples * 255),
      green / (samples * 255),
      blue / (samples * 255),
      THREE.SRGBColorSpace
    );
    return wrapped;
  }, [source]);
}

/** Texture helper for supplied spacer artwork used on 3D metal/crystal models. */
function useBeadArtTexture(imageUrl) {
  const texture = useTexture(imageUrl);

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
  }, [texture]);

  return texture;
}

function useGlassBeadPrototype() {
  const { scene } = useGLTF(GLASS_BEAD_GLB);
  return useMemo(() => {
    let geometry = null;
    scene.traverse((child) => {
      if (child.isMesh && !geometry) {
        geometry = child.geometry.clone();
      }
    });
    if (!geometry) {
      return { geometry: null, maxDim: 1 };
    }
    geometry.center();
    geometry.computeBoundingSphere();
    const maxDim = Math.max((geometry.boundingSphere?.radius ?? 0.5) * 2, 1e-4);
    return { geometry, maxDim };
  }, [scene]);
}

function getRingLocalViewSpaceZ(localX, localY, localZ, ringTiltX, ringYawRad, camera) {
  _depthScratch.set(localX, localY, localZ);
  _depthEuler.set(ringTiltX, ringYawRad, 0);
  _depthScratch.applyEuler(_depthEuler);
  _depthScratch.applyMatrix4(camera.matrixWorldInverse);
  return _depthScratch.z;
}

function computeBraceletDepthBases(
  ringItems,
  charmItems,
  ringTiltX,
  ringYawRad,
  camera,
  charmGaps = null,
  isManualMode = false
) {
  const entries = [];

  ringItems.forEach((item, ringIndex) => {
    const [posX, posZ] = getRingMeshWorldXZ(item, ringIndex, ringItems, charmGaps, isManualMode);
    entries.push({
      kind: "ring",
      index: ringIndex,
      viewZ: getRingLocalViewSpaceZ(posX, 0, posZ, ringTiltX, ringYawRad, camera),
    });
  });

  charmItems.forEach((item, charmIndex) => {
    const [posX, posZ] = getCharmAttachWorldXZ(item, ringItems, isManualMode);
    entries.push({
      kind: "charm",
      index: charmIndex,
      viewZ: getRingLocalViewSpaceZ(posX, STRING_Y_OFFSET, posZ, ringTiltX, ringYawRad, camera),
    });
  });

  entries.sort((a, b) => a.viewZ - b.viewZ);

  const ringBases = ringItems.map(() => RENDER_ORDER_RING_BASE);
  const charmBases = charmItems.map(() => RENDER_ORDER_RING_BASE);

  entries.forEach((entry, sortIndex) => {
    const base = RENDER_ORDER_RING_BASE + sortIndex * RENDER_ORDER_RING_STRIDE;
    if (entry.kind === "ring") {
      ringBases[entry.index] = base;
    } else {
      charmBases[entry.index] = base;
    }
  });

  return { ringBases, charmBases };
}

/** Marks a bead or charm so one shared pass can set painter order. */
function DepthSortApplicator({ index, kind = "ring", children }) {
  return (
    <group userData={{ depthSortIndex: index, depthSortKind: kind }}>{children}</group>
  );
}

function BeadMeshShell({ prototype, diameter, material }) {
  const scale =
    (diameter / prototype.maxDim) * GLASS_BEAD_SHELL_SCALE * BEAD_3D_GLASS_VISUAL_SCALE;

  if (!prototype.geometry) {
    return null;
  }

  return (
    <mesh
      geometry={prototype.geometry}
      scale={scale}
      rotation={GLASS_BEAD_BORE_ROTATION}
      renderOrder={RENDER_ORDER_RING_BASE + RENDER_ORDER_BEAD_GLASS_SHELL}
      userData={{ depthLayerOffset: RENDER_ORDER_BEAD_GLASS_SHELL }}
      material={material}
    />
  );
}

function GlassBeadMesh({ prototype, diameter }) {
  const gemEnv = useGemEnvTexture();
  const material = useMemo(() => createGlassBeadMaterial(gemEnv), [gemEnv]);
  return <BeadMeshShell prototype={prototype} diameter={diameter} material={material} />;
}

const wrappedBeadMaterialCache = new Map();
// Values matched to the active controls in `bead-demo/index-4.html`:
// translucency 75%, colour depth 100%, gloss 100%, texture tiling 1.5×,
// and light 120%. They apply only to quartz/amethyst, never solid stones.
const QUARTZ_DEMO_SETTINGS = {
  // Dialled back 25% from the demo's fully translucent setting so the quartz
  // stays visibly see-through without becoming washed out.
  transmission: 0.75,
  attenuationDistance: 0.45,
  // Soften the studio panels rather than reflecting crisp white rectangles.
  clearcoat: 0.72,
  clearcoatRoughness: 0.16,
  roughness: 0.24,
  textureTiling: 1.5,
  envMapIntensity: 0.025,
};

function getWrappedBeadMaterial(texture, materialType) {
  const isQuartz = materialType === "quartz";
  const cacheKey = `${texture.uuid}:${materialType}`;
  let material = wrappedBeadMaterialCache.get(cacheKey);
  if (!material) {
    material = new THREE.MeshPhysicalMaterial({
      map: texture,
      color: "#ffffff",
      // Polished gemstone finish: the texture remains opaque and saturated,
      // while a restrained clearcoat adds the rounded highlight a real bead has.
      roughness: isQuartz ? QUARTZ_DEMO_SETTINGS.roughness : 0.22,
      metalness: 0,
      clearcoat: isQuartz ? QUARTZ_DEMO_SETTINGS.clearcoat : 0.52,
      clearcoatRoughness: isQuartz ? QUARTZ_DEMO_SETTINGS.clearcoatRoughness : 0.12,
      reflectivity: 0.42,
      transmission: isQuartz ? QUARTZ_DEMO_SETTINGS.transmission : 0,
      thickness: isQuartz ? 0.65 : 0,
      ior: 1.45,
      attenuationColor: isQuartz
        ? (texture.userData.averageColor ?? new THREE.Color("#ffffff"))
            .clone()
            .lerp(new THREE.Color("#ffffff"), 0.45)
        : new THREE.Color("#ffffff"),
      attenuationDistance: isQuartz ? QUARTZ_DEMO_SETTINGS.attenuationDistance : 1,
      // A closed bead only needs the front faces. Rendering both faces for a
      // transmissive mesh makes its back wall compete with neighbouring beads
      // during depth sorting, which is the source of the blinking specks.
      side: isQuartz ? THREE.FrontSide : THREE.DoubleSide,
      depthWrite: true,
      envMapIntensity: isQuartz ? QUARTZ_DEMO_SETTINGS.envMapIntensity : 0.1,
    });
    // The photographed maps are intentionally darker/richer than the studio
    // preview. Apply this before PBR lighting so the bead keeps the source
    // texture's color while its clearcoat can still create a small gloss spot.
    material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        `#include <map_fragment>
          float beadTextureLuma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
          diffuseColor.rgb = mix(vec3(beadTextureLuma), diffuseColor.rgb, ${isQuartz ? "1.08" : "1.16"});
          diffuseColor.rgb = pow(max(diffuseColor.rgb, vec3(0.0)), vec3(${isQuartz ? "0.86" : "1.18"}));`
      );
    };
    material.customProgramCacheKey = () => `wrapped-bead-${materialType}-v1`;
    material.needsUpdate = true;
    wrappedBeadMaterialCache.set(cacheKey, material);
  }
  return material;
}

function WrappedBeadMesh({ prototype, diameter, textureUrl, materialType }) {
  const texture = useWrappedBeadTexture(textureUrl);
  const isQuartz = materialType === "quartz";
  useEffect(() => {
    texture.repeat.setScalar(isQuartz ? QUARTZ_DEMO_SETTINGS.textureTiling : 1);
    texture.needsUpdate = true;
  }, [texture, isQuartz]);
  const material = useMemo(
    () => getWrappedBeadMaterial(texture, materialType),
    [texture, materialType]
  );
  return <BeadMeshShell prototype={prototype} diameter={diameter} material={material} />;
}

// ─── GLB-based bead: renders a model with its own authored materials ──────────
// Used for beads like Rudraksh whose colour is baked into the GLB — no texture
// wrap is needed. The model is scaled so its longest axis matches `diameter`.
function GlbBeadMesh({ modelUrl, diameter }) {
  const { scene } = useGLTF(modelUrl);
  const clone = useMemo(() => {
    const cloned = scene.clone(true);
    // Compute bounding box of the cloned model to derive a normalising scale.
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, 1e-4);
    const targetScale =
      (diameter / maxDim) * GLASS_BEAD_SHELL_SCALE * BEAD_3D_GLASS_VISUAL_SCALE;
    cloned.scale.setScalar(targetScale);
    // Re-centre so the bead sits on the string position correctly.
    box.setFromObject(cloned);
    const center = new THREE.Vector3();
    box.getCenter(center);
    cloned.position.sub(center);

    cloned.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.renderOrder = RENDER_ORDER_RING_BASE + RENDER_ORDER_BEAD_GLASS_SHELL;
        child.userData = { ...child.userData, depthLayerOffset: RENDER_ORDER_BEAD_GLASS_SHELL };
      }
    });

    return cloned;
  }, [scene, diameter]);

  return <primitive object={clone} />;
}

function GlassBeadVisual({ diameter, textureUrl, materialType = "solid", beadPrototype, beadModelUrl }) {
  if (materialType === "glb" && beadModelUrl) {
    return (
      <Suspense fallback={null}>
        <GlbBeadMesh modelUrl={beadModelUrl} diameter={diameter} />
      </Suspense>
    );
  }

  if (!beadPrototype.geometry) {
    return null;
  }

  return textureUrl ? (
    <Suspense fallback={<GlassBeadMesh prototype={beadPrototype} diameter={diameter} />}>
      <WrappedBeadMesh
        prototype={beadPrototype}
        diameter={diameter}
        textureUrl={textureUrl}
        materialType={materialType}
      />
    </Suspense>
  ) : <GlassBeadMesh prototype={beadPrototype} diameter={diameter} />;
}

// ─── Bracelet cord (elastic thread) — own geometry + material, not bead/spacer PBR ───

class RingStringArcCurve extends THREE.Curve {
  constructor(radius, startAngle, endAngle, y) {
    super();
    this.radius = radius;
    this.startAngle = startAngle;
    this.endAngle = endAngle;
    this.y = y;
  }

  getPoint(t) {
    const angle = this.startAngle + (this.endAngle - this.startAngle) * t;
    return new THREE.Vector3(Math.sin(angle) * this.radius, this.y, Math.cos(angle) * this.radius);
  }
}

function buildRingStringEntry(item, ringIndex, ringItems, maxDim, manualPartial, charmGaps, isManualMode = false) {
  const tr = ringItemToTransform(item);
  const [posX, posZ] = getRingMeshWorldXZ(item, ringIndex, ringItems, charmGaps, isManualMode);
  const ringDist = Math.hypot(posX, posZ);
  const angle = Math.atan2(posX, posZ);
  let halfAngle = 0;
  if (ringDist > 1e-5) {
    if (item.type === "bead") {
      halfAngle = getBeadCordArcHalfAngle(tr.diameter, ringDist, maxDim, {
        anglePad: manualPartial ? 0.02 : BEAD_CORD_ARC_ANGLE_PAD,
      });
    } else {
      halfAngle = getRingStringArcTrimHalf(item, tr) / ringDist;
    }
  }
  return { item, angle, ringDist, halfAngle, tr };
}

function computeGapArcAngles(current, next) {
  let centerSpan = next.angle - current.angle;
  if (centerSpan <= 0) {
    centerSpan += Math.PI * 2;
  }
  if (centerSpan <= 1e-5) {
    return null;
  }
  const maxTrim = centerSpan * 0.46;
  const startAngle = current.angle + Math.min(current.halfAngle, maxTrim);
  let endAngle = next.angle - Math.min(next.halfAngle, maxTrim);
  if (endAngle <= startAngle) {
    endAngle += Math.PI * 2;
  }
  if (endAngle - startAngle < 0.012) {
    return null;
  }
  return { startAngle, endAngle };
}

/** Open string along a partial manual cluster (not a full 360° loop). */
function buildManualPartialOpenStringArc(entriesInPatternOrder, stringRadiusPx) {
  if (entriesInPatternOrder.length < 2) {
    return null;
  }
  let minAngle = Infinity;
  let maxAngle = -Infinity;
  entriesInPatternOrder.forEach((entry) => {
    minAngle = Math.min(minAngle, entry.angle);
    maxAngle = Math.max(maxAngle, entry.angle);
  });
  const span = maxAngle - minAngle;
  if (span < 0.015) {
    return null;
  }
  const pad = Math.min(0.05, span * 0.04);
  return {
    startAngle: minAngle - pad,
    endAngle: maxAngle + pad,
    radius: stringRadiusPx * WORLD_PER_PX * RING_3D_POSITION_SNUG,
  };
}

function buildRingStringLayout(
  ringItems,
  beadPrototype,
  { isManualMode = false, isStringFull = true, stringRadiusPx = 0, charmGaps = null } = {}
) {
  if (!ringItems.length) {
    const avgDist =
      stringRadiusPx > 0 ? stringRadiusPx * WORLD_PER_PX * RING_3D_POSITION_SNUG : 0;
    return { tube: getBraceletCordTubeRadius(avgDist), arcs: [] };
  }

  const maxDim = beadPrototype?.maxDim > 0 ? beadPrototype.maxDim : 1;
  const manualPartial = isManualMode && !isStringFull;
  const loopRadius =
    stringRadiusPx > 0 ? stringRadiusPx * WORLD_PER_PX * RING_3D_POSITION_SNUG : 0;

  let ringDistSum = 0;
  ringItems.forEach((item) => {
    ringDistSum += ringItemToTransform(item).radius;
  });
  const avgRingDist = ringDistSum / ringItems.length;
  const tube = getBraceletCordTubeRadius(avgRingDist);

  const entriesInPatternOrder = ringItems.map((item, ringIndex) =>
    buildRingStringEntry(item, ringIndex, ringItems, maxDim, manualPartial, charmGaps, isManualMode)
  );
  const sortedEntries = [...entriesInPatternOrder].sort((a, b) => a.angle - b.angle);

  const arcPairs = sortedEntries.map((current, index) => [
    current,
    sortedEntries[(index + 1) % sortedEntries.length],
  ]);

  const arcs = [];
  for (const [current, next] of arcPairs) {
    const arcAngles = computeGapArcAngles(current, next);
    if (!arcAngles) {
      continue;
    }
    arcs.push({
      startAngle: arcAngles.startAngle,
      endAngle: arcAngles.endAngle,
      radius: getCordArcRadius(current, next, loopRadius),
    });
  }

  const partialOpenArc = manualPartial
    ? buildManualPartialOpenStringArc(entriesInPatternOrder, stringRadiusPx)
    : null;

  return { tube, arcs, partialOpenArc };
}

function RingStringArc({ startAngle, endAngle, radius, tube, closed = false, material = null }) {
  const geometry = useMemo(() => {
    const curve = new RingStringArcCurve(radius, startAngle, endAngle, STRING_Y_OFFSET);
    const segments = closed
      ? 128
      : Math.max(8, Math.ceil((endAngle - startAngle) * 28));
    return new THREE.TubeGeometry(curve, segments, tube, 7, closed);
  }, [startAngle, endAngle, radius, tube, closed]);

  return (
    <mesh
      geometry={geometry}
      renderOrder={RENDER_ORDER_BRACELET_CORD}
      material={material || BRACELET_CORD_MAT}
    />
  );
}

/** Full loop at layout radius — matches 2D `beads-2d-string` circle (beads sit on this ring). */
function RingStringBaseline({ stringRadiusPx, tube, ringArcBoost = 1, worldRadiusOverride = null, material = null }) {
  const worldRadius =
    worldRadiusOverride ??
    (stringRadiusPx > 0 ? stringRadiusPx * WORLD_PER_PX * RING_3D_POSITION_SNUG * ringArcBoost : 0);
  if (worldRadius <= 0) {
    return null;
  }
  return (
    <RingStringArc
      startAngle={0}
      endAngle={Math.PI * 2}
      radius={worldRadius}
      tube={tube}
      closed
      material={material}
    />
  );
}

/**
 * Closed string through the layout ring (same path as 2D) — passes through each bead/spacer bore.
 * Manual partial clusters use an open arc only.
 */
function BraceletCordLayer({
  ringItems,
  stringRadiusPx,
  beadPrototype,
  isManualMode = false,
  isStringFull = true,
  charmGaps = null,
  elasticRadiusWorld = null,
  cordColor = null,
}) {
  const ringArcBoost = 1;

  const { tube } = useMemo(
    () =>
      buildRingStringLayout(ringItems, beadPrototype, {
        isManualMode,
        isStringFull,
        stringRadiusPx,
        charmGaps,
      }),
    [ringItems, beadPrototype, isManualMode, isStringFull, stringRadiusPx, charmGaps]
  );

  const cordMaterial = useMemo(() => {
    if (!cordColor) return BRACELET_CORD_MAT;
    return new THREE.MeshBasicMaterial({
      color: cordColor,
      toneMapped: true,
      depthWrite: true,
      depthTest: true,
    });
  }, [cordColor]);

  // Match 2D `beads-2d-string` — full layout circle (empty / partial manual strings included).
  return (
    <group name="bracelet-cord-layer">
      <RingStringBaseline
        stringRadiusPx={stringRadiusPx}
        tube={tube}
        ringArcBoost={ringArcBoost}
        worldRadiusOverride={elasticRadiusWorld}
        material={cordMaterial}
      />
    </group>
  );
}

function SpacerGlbLoadFallback({ width, assetKey }) {
  const radius = getSpacer3DTargetSize(width, assetKey) * 0.5;
  const metalEnv = useSpacerMetalEnvTexture();
  return (
    <mesh renderOrder={5}>
      <circleGeometry args={[radius, 24]} />
      <meshPhysicalMaterial
        {...RING_METAL}
        color={new THREE.Color(SPACER_FALLBACK_METAL)}
        roughness={0.04}
        envMap={metalEnv ?? null}
        envMapIntensity={metalEnv ? SPACER_RING_METAL_ENV_INTENSITY : SPACER_METAL_ENV_INTENSITY}
        emissive={spacerMetalEmissiveForFinish("yellowGold")}
        emissiveIntensity={0.045}
        toneMapped={false}
      />
    </mesh>
  );
}

function isSpacerDiamondPart(mesh, material, { stoneWheelLuxury = false } = {}) {
  const label = `${mesh.name} ${material?.name || ""}`.toLowerCase();
  if (
    /diamond|diamonds|crystal|hex-stone|hex_gem|pave|material_1|all-diamond|(^|[^a-z])gem([^a-z]|$)/i.test(
      label
    )
  ) {
    return true;
  }
  if (/gold|metal|band|body|rose|silver|halo|wheel/i.test(label)) {
    return false;
  }
  if (/torus/i.test(label)) {
    if (stoneWheelLuxury) {
      return /diamond|diamonds|crystal|pave|(^|[^a-z])gem([^a-z]|$)/i.test(label);
    }
    return true;
  }
  if (!material) {
    return false;
  }
  const metalness =
    material.metalness ??
    material.pbrMetallicRoughness?.metallicFactor ??
    material.metallic ??
    1;
  if (metalness < 0.35) {
    return true;
  }
  const transmission = material.transmission ?? 0;
  return transmission > 0.12 || (material.transparent && (material.opacity ?? 1) < 0.98);
}

/**
 * S7–S9 scene.glb: main band is often a mesh named "Torus" — must not use the generic
 * `isSpacerDiamondPart` torus rule or the whole wheel becomes clear glass (invisible).
 */
function isScene81MetalBandGemPart(mesh, material) {
  const label = `${mesh.name} ${material?.name || ""}`.toLowerCase();
  if (/gold|metal|band|body|rose|silver|wheel|torus|ring|scene/i.test(label)) {
    return false;
  }
  return /diamond|diamonds|crystal|pave|(^|[^a-z])gem([^a-z]|$)|hex-stone|hex_gem/i.test(label);
}

const SPACER_METAL_FINISH_COLOR = {
  yellowGold: RING_METAL_COLORS.yellow,
  silver: RING_METAL_COLORS.white,
  roseGold: RING_METAL_COLORS.rose,
};

/**
 * S1–S6 band tint — slightly richer than flat RING_METAL_COLORS so small meshes
 * do not read washed-out after ACES + studio env (matches 2D picker art).
 */
const STONE_WHEEL_LUXURY_METAL_COLOR = {
  yellowGold: "#ECC875",
  silver: "#E4E4E2",
  roseGold: "#E8A088",
};
/**
 * S1–S6 band: mirror metal + metal3.hdr on tiny torus geometry reads hotter than beads.
 * Keep env below necklace links; ACES tone mapping on (see luxury metal material).
 */
const STONE_WHEEL_METAL_ENV_INTENSITY = JEWELRY_ENV_INTENSITY * 1.04;
/** White/black pavé on stone-wheel — many facets × gem HDR; no extra SPACER_GEM_ENV_BOOST. */
const STONE_WHEEL_WHITE_GEM_ENV = 3.05;
const STONE_WHEEL_BLACK_GEM_ENV = 2.25;

function spacerMetalEmissiveForFinish(metalFinish) {
  if (metalFinish === "roseGold") {
    return new THREE.Color("#6a3828");
  }
  if (metalFinish === "silver") {
    return new THREE.Color("#323238");
  }
  return new THREE.Color("#6a4818");
}

let _spacerMetalEnvTexture = null;
let _spacerMetalEnvPromise = null;

function loadSpacerMetalEnvTexture() {
  if (_spacerMetalEnvTexture) {
    return Promise.resolve(_spacerMetalEnvTexture);
  }
  if (!_spacerMetalEnvPromise) {
    _spacerMetalEnvPromise = new Promise((resolve, reject) => {
      new RGBELoader().load(
        BEADS_SPACER_METAL_ENV_URL,
        (texture) => {
          texture.mapping = THREE.EquirectangularReflectionMapping;
          _spacerMetalEnvTexture = texture;
          resolve(texture);
        },
        undefined,
        (err) => {
          _spacerMetalEnvPromise = null;
          reject(err);
        }
      );
    });
  }
  return _spacerMetalEnvPromise;
}

function useSpacerMetalEnvTexture() {
  const [texture, setTexture] = useState(_spacerMetalEnvTexture);
  useEffect(() => {
    if (texture) {
      return undefined;
    }
    loadSpacerMetalEnvTexture()
      .then((map) => setTexture(map))
      .catch((err) => console.warn("[beads-3d] metal env failed", err));
    return undefined;
  }, [texture]);
  return texture;
}

function createStoneWheelLuxuryMetalMaterial(metalFinish, metalEnv) {
  const ringColor = toRingMetalColor(
    STONE_WHEEL_LUXURY_METAL_COLOR[metalFinish] ?? STONE_WHEEL_LUXURY_METAL_COLOR.yellowGold
  );
  const base = new THREE.Color(ringColor);
  const emissive = spacerMetalEmissiveForFinish(metalFinish);

  return new THREE.MeshPhysicalMaterial({
    ...RING_METAL,
    color: base,
    roughness: 0.022,
    envMap: metalEnv ?? null,
    envMapIntensity: metalEnv ? STONE_WHEEL_METAL_ENV_INTENSITY : SPACER_METAL_ENV_INTENSITY,
    specularIntensity: 1.18,
    specularColor: base.clone(),
    emissive,
    emissiveIntensity: metalEnv ? 0.05 : 0.026,
    toneMapped: false,
  });
}

/** S1–S3 stone-wheel pavé only — conservative env (shared gem HDR + dozens of faces). */
function createStoneWheelWhitePaveMaterial(envMap) {
  const envIntensity = envMap ? STONE_WHEEL_WHITE_GEM_ENV : 1.1;
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(SPACER_DIAMOND_COLOR),
    metalness: 0,
    roughness: 0.022,
    transmission: 0.96,
    thickness: 0.36,
    ior: GEM_REFRACTION_PARAMS.ior,
    envMap: envMap ?? null,
    envMapIntensity: envIntensity,
    clearcoat: 0.92,
    clearcoatRoughness: 0.035,
    specularIntensity: 1.16,
    specularColor: new THREE.Color("#b8c8de"),
    attenuationColor: new THREE.Color("#8fa4be"),
    attenuationDistance: 0.55,
    iridescence: 0.06,
    iridescenceIOR: 1.28,
    iridescenceThicknessRange: [120, 320],
    reflectivity: 0.8,
    transparent: true,
    side: THREE.DoubleSide,
    toneMapped: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
}

/** Other spacers / fallbacks — high transmission glass diamond. */
function createSpacerWhiteGlassDiamondMaterial(envMap) {
  const envIntensity = (envMap ? 2.85 : 1.2) * SPACER_GEM_ENV_BOOST;
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(SPACER_DIAMOND_COLOR),
    metalness: 0,
    roughness: 0.032,
    transmission: 0.95,
    thickness: 0.38,
    ior: GEM_REFRACTION_PARAMS.ior,
    envMap: envMap ?? null,
    envMapIntensity: envIntensity,
    clearcoat: 0.8,
    clearcoatRoughness: 0.06,
    specularIntensity: 0.98,
    specularColor: new THREE.Color("#c0d0e4"),
    attenuationColor: new THREE.Color("#8fa4be"),
    attenuationDistance: 0.52,
    iridescence: 0.08,
    iridescenceIOR: 1.28,
    iridescenceThicknessRange: [120, 320],
    reflectivity: 0.84,
    transparent: true,
    side: THREE.DoubleSide,
    toneMapped: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
}

function createStoneWheelBrilliantWhiteDiamond(envMap) {
  return createStoneWheelWhitePaveMaterial(envMap);
}

/** S4–S6 pavé: black brilliant — low transmission so stones read jet, not gray glass. */
function createStoneWheelBrilliantBlackDiamond(envMap) {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#010102"),
    metalness: 0,
    roughness: 0.024,
    transmission: 0.62,
    thickness: 0.72,
    ior: 2.42,
    envMap: envMap ?? null,
    envMapIntensity: envMap ? STONE_WHEEL_BLACK_GEM_ENV : 1.22,
    clearcoat: 0.96,
    clearcoatRoughness: 0.035,
    specularIntensity: 1.02,
    specularColor: new THREE.Color("#5a6068"),
    attenuationColor: new THREE.Color("#000000"),
    attenuationDistance: 0.045,
    transparent: true,
    side: THREE.DoubleSide,
    toneMapped: true,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
}

/** S10–S14 colored crystal: preset hue + gem sheen / refraction (Swarovski-style). */
function createStoneWheelBrilliantColoredCrystal(envMap, presetKey) {
  const preset = SPACER_CRYSTAL_GEM_PRESETS[presetKey] ?? SPACER_CRYSTAL_GEM_PRESETS.crystalPink;
  const transmission = preset.transmission ?? 0.20;
  const envIntensity =
    (envMap ? (preset.bodyEnvIntensity ?? 0.85) : 0.65) * SPACER_GEM_ENV_BOOST;
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(preset.color),
    metalness: 0,
    roughness: preset.roughness ?? 0.01,
    transmission,
    thickness: preset.thickness ?? 0.80,
    ior: preset.ior ?? 2.42,
    envMap: envMap ?? null,
    envMapIntensity: envIntensity,
    clearcoat: preset.bodyClearcoat ?? 1.0,
    clearcoatRoughness: preset.bodyClearcoatRoughness ?? 0.01,
    specularIntensity: preset.bodySpecularIntensity ?? 0.90,
    specularColor: new THREE.Color(preset.specular ?? "#ffffff"),
    attenuationColor: new THREE.Color(preset.attenuation),
    attenuationDistance: preset.attenuationDistance ?? 0.04,
    emissive: new THREE.Color(preset.emissive ?? preset.color),
    emissiveIntensity: preset.emissiveIntensity ?? 0.28,
    transparent: true,
    opacity: 1,
    reflectivity: 0.9,
    side: THREE.DoubleSide,
    flatShading: true,
    toneMapped: true,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  if (preset.bodySheen != null) {
    material.sheen = preset.bodySheen;
    material.sheenColor = new THREE.Color(preset.bodySheenColor ?? preset.color);
    material.sheenRoughness = preset.bodySheenRoughness ?? 0.25;
  }
  if (preset.bodyAnisotropy != null) {
    material.anisotropy = preset.bodyAnisotropy;
    material.anisotropyRotation = preset.bodyAnisotropyRotation ?? 0.35;
  }
  if (preset.bodyIridescence != null && preset.bodyIridescence > 0) {
    material.iridescence = preset.bodyIridescence;
    material.iridescenceIOR = preset.bodyIridescenceIOR ?? 1.28;
    material.iridescenceThicknessRange = preset.bodyIridescenceThicknessRange ?? [120, 360];
  }

  return material;
}

function createStoneWheelBrilliantDiamond(envMap, variant) {
  if (variant === "black") {
    return createStoneWheelBrilliantBlackDiamond(envMap);
  }
  if (variant && SPACER_CRYSTAL_GEM_PRESETS[variant]) {
    return createStoneWheelBrilliantColoredCrystal(envMap, variant);
  }
  return createStoneWheelBrilliantWhiteDiamond(envMap);
}

function createSpacerMetalMaterial({
  metalMap = null,
  metalFinish = "yellowGold",
  metalEnv = null,
} = {}) {
  const ringColor =
    toRingMetalColor(SPACER_METAL_FINISH_COLOR[metalFinish] ?? RING_METAL_COLORS.yellow);

  const emissive = spacerMetalEmissiveForFinish(metalFinish);

  if (metalMap) {
    return new THREE.MeshPhysicalMaterial({
      map: metalMap,
      color: new THREE.Color("#ffffff"),
      metalness: 1,
      roughness: 0.028,
      reflectivity: 1,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      envMap: metalEnv ?? null,
      envMapIntensity: metalEnv ? SPACER_RING_METAL_TEX_ENV_INTENSITY : SPACER_METAL_TEX_ENV_INTENSITY,
      specularIntensity: 1.22,
      specularColor: new THREE.Color(ringColor),
      emissive,
      emissiveIntensity: 0.05,
      toneMapped: false,
    });
  }

  return new THREE.MeshPhysicalMaterial({
    ...RING_METAL,
    color: new THREE.Color(ringColor),
    roughness: 0.018,
    envMap: metalEnv ?? null,
    envMapIntensity: metalEnv ? SPACER_RING_METAL_ENV_INTENSITY : SPACER_METAL_ENV_INTENSITY,
    specularIntensity: 1.2,
    specularColor: new THREE.Color(ringColor),
    emissive,
    emissiveIntensity: metalEnv ? 0.062 : 0.038,
    toneMapped: false,
  });
}

function createSpacerWhiteDiamondMaterial(envMap) {
  return createSpacerWhiteGlassDiamondMaterial(envMap);
}

function createSpacerBlackDiamondMaterial(envMap) {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#030308"),
    metalness: 0,
    roughness: 0.04,
    transmission: 0.64,
    thickness: 0.68,
    ior: 2.42,
    envMap: envMap ?? null,
    envMapIntensity: (envMap ? 2.05 : 1.32) * SPACER_GEM_ENV_BOOST,
    clearcoat: 0.94,
    clearcoatRoughness: 0.055,
    specularIntensity: 0.88,
    specularColor: new THREE.Color("#4a4e58"),
    attenuationColor: new THREE.Color("#000000"),
    attenuationDistance: 0.05,
    transparent: true,
    side: THREE.DoubleSide,
    toneMapped: false,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
}

const SPACER_CRYSTAL_GEM_PRESETS = {
  crystalSilver: {
    color: "#ffffff",
    attenuation: "#6b7280",
    specular: "#ffffff",
    emissive: "#ffffff",
    emissiveIntensity: 0.08,
    transmission: 0.48,
    roughness: 0.01,
    thickness: 0.72,
    ior: 2.42,
    attenuationDistance: 0.15,
    iridescence: 0.12,
  },
  crystalPink: {
    // S11 — Hot Pink / Ruby crystal
    color: "#c20052",
    attenuation: "#550022",
    specular: "#ffffff",
    emissive: "#d60055",
    emissiveIntensity: 0.30,
    transmission: 0.20,
    roughness: 0.01,
    thickness: 0.80,
    ior: 2.42,
    attenuationDistance: 0.04,
    iridescence: 0.06,
  },
  crystalPurple: {
    // S12 — Royal Purple / Amethyst crystal
    color: "#520099",
    attenuation: "#240044",
    specular: "#ffffff",
    emissive: "#520099",
    emissiveIntensity: 0.30,
    transmission: 0.20,
    roughness: 0.01,
    thickness: 0.80,
    ior: 2.42,
    attenuationDistance: 0.04,
    iridescence: 0.06,
  },
  crystalBlue: {
    // S13 — Sapphire / Deep Blue crystal
    color: "#0033cc",
    attenuation: "#001155",
    specular: "#ffffff",
    emissive: "#0033cc",
    emissiveIntensity: 0.30,
    transmission: 0.20,
    roughness: 0.01,
    thickness: 0.80,
    ior: 2.42,
    attenuationDistance: 0.04,
    iridescence: 0.06,
  },
  crystalEmerald: {
    // S14 — Emerald Green crystal
    color: "#007a33",
    attenuation: "#002b11",
    specular: "#ffffff",
    emissive: "#007a33",
    emissiveIntensity: 0.30,
    transmission: 0.20,
    roughness: 0.01,
    thickness: 0.80,
    ior: 2.42,
    attenuationDistance: 0.04,
    iridescence: 0.06,
  },
  crystalRoyalBlue: {
    color: "#0033cc",
    attenuation: "#001155",
    specular: "#ffffff",
    emissive: "#0033cc",
    emissiveIntensity: 0.30,
    transmission: 0.20,
    roughness: 0.01,
    thickness: 0.80,
    ior: 2.42,
    attenuationDistance: 0.04,
    iridescence: 0.06,
  },
};

/** S10–S14 glass-wheel-spacer.glb — brilliant faceted crystal gemstone body with rich saturated color & semi-translucency. */
function createGlassWheelFacetedCrystalMaterial(envMap, presetKey) {
  const preset =
    SPACER_CRYSTAL_GEM_PRESETS[presetKey] ??
    SPACER_CRYSTAL_GEM_PRESETS.crystalSilver;
  // Reduce env boost slightly so white studio panels don't wash out saturation.
  const envIntensity = (envMap ? 0.85 : 0.65) * SPACER_GEM_ENV_BOOST;
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(preset.color),
    metalness: 0,
    roughness: preset.roughness ?? 0.01,
    transmission: preset.transmission ?? 0.20,
    thickness: preset.thickness ?? 0.80,
    ior: preset.ior ?? 2.42,
    envMap: envMap ?? null,
    envMapIntensity: envIntensity,
    clearcoat: 1.0,
    clearcoatRoughness: 0.01,
    specularIntensity: 0.90,
    specularColor: new THREE.Color(preset.specular ?? "#ffffff"),
    iridescence: preset.iridescence ?? 0.06,
    iridescenceIOR: 1.33,
    iridescenceThicknessRange: [120, 360],
    attenuationColor: new THREE.Color(preset.attenuation),
    attenuationDistance: preset.attenuationDistance ?? 0.04,
    emissive: new THREE.Color(preset.emissive ?? preset.color),
    emissiveIntensity: preset.emissiveIntensity ?? 0.28,
    transparent: true,
    opacity: 1,
    reflectivity: 0.9,
    side: THREE.DoubleSide,
    flatShading: true,
    toneMapped: true,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  return material;
}

/**
 * S10–S14 hex-wheel GLB: faceted crystal body (no WebP billboard) — matches S1–S6 pavé fire.
 */
function createHexWheelFacetedCrystalMaterial(envMap, presetKey) {
  const preset = SPACER_CRYSTAL_GEM_PRESETS[presetKey] ?? SPACER_CRYSTAL_GEM_PRESETS.crystalSilver;
  const light = GLASS_WHEEL_LIGHT_SCALE;
  const emissiveHex = preset.hexEmissive;
  const transmission = Math.min(preset.hexTransmission ?? 0.9, 0.64);
  const material = new THREE.MeshPhysicalMaterial({
    color: glassWheelTintedColor(preset.color).clone(),
    metalness: 0,
    roughness: 0.036,
    transmission,
    thickness: preset.hexThickness ?? 0.52,
    ior: 2.42,
    envMap: envMap ?? null,
    envMapIntensity:
      (envMap ? preset.bodyEnvIntensity ?? GLASS_WHEEL_ENV_INTENSITY : 1.2) *
      SPACER_GEM_ENV_BOOST *
      light *
      1.06,
    clearcoat: 0.84,
    clearcoatRoughness: 0.062,
    specularIntensity: 0.76 * light,
    specularColor: glassWheelTintedColor(
      preset.glassSpecular ?? preset.specular,
      GLASS_WHEEL_WHITE_MIX * 1.4
    ).clone(),
    iridescence: 0.04,
    iridescenceIOR: 1.28,
    iridescenceThicknessRange: [140, 280],
    attenuationColor: new THREE.Color(preset.attenuation),
    attenuationDistance: Math.min(preset.hexAttenuationDistance ?? 0.11, 0.055),
    emissive: emissiveHex ? new THREE.Color(emissiveHex) : new THREE.Color(preset.bodyEmissive ?? "#000000"),
    emissiveIntensity: (preset.hexEmissiveIntensity ?? preset.bodyEmissiveIntensity ?? 0) * 0.8,
    transparent: true,
    opacity: 1,
    side: THREE.DoubleSide,
    toneMapped: true,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  material.sheen = 0.12;
  material.sheenColor = _glassWheelWhiteScratch.clone();
  material.sheenRoughness = 0.32;
  return material;
}

/** Colored stones — same diamond refraction as S1–S3 pavé (not glassy plastic). */
function createSpacerCrystalMaterial(envMap, presetKey, gemMap = null) {
  const preset = SPACER_CRYSTAL_GEM_PRESETS[presetKey] ?? SPACER_CRYSTAL_GEM_PRESETS.crystalSilver;
  const textured = Boolean(gemMap);
  return new THREE.MeshPhysicalMaterial({
    map: gemMap,
    color: new THREE.Color(textured ? "#ffffff" : preset.color),
    metalness: 0,
    roughness: textured ? 0.06 : 0,
    transmission: textured ? 0.28 : 0.9,
    thickness: textured ? 0.38 : 0.52,
    ior: 2.415,
    envMap: envMap ?? null,
    envMapIntensity: (envMap ? preset.envIntensity + (textured ? 0.8 : 0) : 3.2) * SPACER_GEM_ENV_BOOST,
    clearcoat: 1,
    clearcoatRoughness: textured ? 0.04 : 0,
    specularIntensity: textured ? 1.15 : 1,
    specularColor: new THREE.Color(preset.specular),
    attenuationColor: new THREE.Color(preset.attenuation),
    attenuationDistance: textured ? 0.22 : 0.1,
    emissive: textured ? new THREE.Color(preset.attenuation) : new THREE.Color("#000000"),
    emissiveIntensity: textured ? 0.12 : 0,
    emissiveMap: gemMap,
    transparent: true,
    side: THREE.DoubleSide,
    toneMapped: false,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
}

function createSpacerDiamondMaterial(envMap, variant = "white", gemMap = null) {
  if (variant === "black") {
    return createSpacerBlackDiamondMaterial(envMap);
  }
  if (variant && SPACER_CRYSTAL_GEM_PRESETS[variant]) {
    return createSpacerCrystalMaterial(envMap, variant, gemMap);
  }
  return createSpacerWhiteDiamondMaterial(envMap);
}

function ensureMeshNormals(geometry) {
  if (!geometry || geometry.getAttribute("normal")) {
    return;
  }
  geometry.computeVertexNormals();
}

/** Zero-area triangles shade as random specks and hide the real facet faces. */
function withoutDegenerateTriangles(geometry) {
  const indexAttr = geometry.getIndex();
  const position = geometry.getAttribute("position");
  if (!indexAttr || !position) {
    return geometry;
  }
  const src = indexAttr.array;
  const kept = [];
  for (let i = 0; i < src.length; i += 3) {
    const ia = src[i];
    const ib = src[i + 1];
    const ic = src[i + 2];
    const ax = position.getX(ia);
    const ay = position.getY(ia);
    const az = position.getZ(ia);
    const bx = position.getX(ib);
    const by = position.getY(ib);
    const bz = position.getZ(ib);
    const cx = position.getX(ic);
    const cy = position.getY(ic);
    const cz = position.getZ(ic);
    const nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
    const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
    const nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (nx * nx + ny * ny + nz * nz < 1e-12) {
      continue;
    }
    kept.push(ia, ib, ic);
  }
  const next = geometry.clone();
  next.setIndex(kept);
  return next;
}

function buildSpacerModelWithMaterials(
  source,
  gemEnv,
  {
    metalMap = null,
    metalFinish = "yellowGold",
    diamondVariant = "white",
    isHexWheel = false,
    hexGemMap = null,
    stoneWheelLuxury = false,
    metalEnv = null,
    plainWheelColoredCrystal = false,
    glassWheelFacetedCrystal = false,
    scene81MetalBand = false,
    forceOpaqueMetal = false,
  } = {}
) {
  const model = source.clone(true);

  model.traverse((child) => {
    if (!child.isMesh) {
      return;
    }
    child.castShadow = true;
    child.receiveShadow = true;
    const sourceMat = Array.isArray(child.material) ? child.material[0] : child.material;

    if (scene81MetalBand) {
      if (isScene81MetalBandGemPart(child, sourceMat)) {
        if (child.geometry) {
          ensureMeshNormals(child.geometry);
        }
        child.material = createStoneWheelBrilliantDiamond(gemEnv, "white");
        child.renderOrder = RENDER_ORDER_RING_BASE + 6;
        child.userData.depthLayerOffset = 6;
        return;
      }
      child.material = metalEnv
        ? createStoneWheelLuxuryMetalMaterial(metalFinish, metalEnv)
        : createSpacerMetalMaterial({ metalMap: null, metalFinish, metalEnv });
      child.renderOrder = RENDER_ORDER_RING_BASE + 5;
      child.userData.depthLayerOffset = 5;
      return;
    }

    if (glassWheelFacetedCrystal) {
      const crystalMat = createGlassWheelFacetedCrystalMaterial(
        gemEnv,
        diamondVariant
      );
      if (child.geometry) {
        ensureMeshNormals(child.geometry);
      }
      child.material = crystalMat;
      child.renderOrder = RENDER_ORDER_RING_BASE + 6;
      child.userData.depthLayerOffset = 6;
      return;
    }

    if (plainWheelColoredCrystal) {
      const crystalMat = createStoneWheelBrilliantColoredCrystal(gemEnv, diamondVariant);
      if (child.geometry) {
        ensureMeshNormals(child.geometry);
      }
      child.material = crystalMat;
      child.renderOrder = RENDER_ORDER_RING_BASE + 6;
      child.userData.depthLayerOffset = 6;
      return;
    }

    // Catalog exports such as the replacement S19 may use a generic
    // non-metal PBR material name/value even though the model is meant to be
    // metal. Do not send those meshes through the transparent gem fallback.
    if (forceOpaqueMetal) {
      child.material = createSpacerMetalMaterial({ metalMap: null, metalFinish, metalEnv });
      child.renderOrder = RENDER_ORDER_RING_BASE + 5;
      child.userData.depthLayerOffset = 5;
      return;
    }

    if (isHexWheel || isSpacerDiamondPart(child, sourceMat, { stoneWheelLuxury })) {
      let gemMat;
      if (stoneWheelLuxury && !isHexWheel) {
        gemMat = createStoneWheelBrilliantDiamond(gemEnv, diamondVariant);
      } else if (isHexWheel && !hexGemMap) {
        gemMat = createHexWheelFacetedCrystalMaterial(gemEnv, diamondVariant);
      } else {
        gemMat = createSpacerDiamondMaterial(gemEnv, diamondVariant, isHexWheel ? hexGemMap : null);
      }
      if (child.geometry) {
        ensureMeshNormals(child.geometry);
      }
      child.material = gemMat;
      child.renderOrder = RENDER_ORDER_RING_BASE + 6;
      child.userData.depthLayerOffset = 6;
      return;
    }

    child.material =
      stoneWheelLuxury && !metalMap
        ? createStoneWheelLuxuryMetalMaterial(metalFinish, metalEnv)
        : createSpacerMetalMaterial({ metalMap, metalFinish, metalEnv });
    child.renderOrder = RENDER_ORDER_RING_BASE + 5;
    child.userData.depthLayerOffset = 5;
  });

  return model;
}

const spacerPrototypeCache = new Map();
const preparedSpacerCache = new Map();

function useSpacerPrototype(modelUrl) {
  const { scene } = useGLTF(modelUrl);
  return useMemo(() => {
    const cached = spacerPrototypeCache.get(modelUrl);
    if (cached) {
      return cached;
    }
    const model = scene.clone(true);
    const showGlassTriangles = isGlassWheelSpacerModel(modelUrl);
    model.traverse((child) => {
      if (!child.isMesh) {
        return;
      }
      child.castShadow = true;
      child.receiveShadow = true;
      if (showGlassTriangles && child.geometry) {
        const clean = withoutDegenerateTriangles(child.geometry);
        const nonIndexed = clean.toNonIndexed();
        nonIndexed.computeVertexNormals();
        child.geometry = nonIndexed;
      }
    });
    const box = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3();
    box.getCenter(center);
    model.position.sub(center);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, 1e-4);
    rememberSpacerMetric(modelUrl, size, maxDim);
    const prototype = { model, maxDim };
    spacerPrototypeCache.set(modelUrl, prototype);
    return prototype;
  }, [scene, modelUrl]);
}

function SpacerGlbMeshCore({
  modelUrl,
  targetSize,
  diamondVariant,
  metalFinish,
  metalMap,
  hexGemMap = null,
  assetKey = null,
}) {
  const gemEnv = useGemEnvTexture();
  const coloredCrystalSpacer = isColoredCrystalSpacerSku(assetKey);
  const scene81MetalBand = isScene81MetalSpacerSku(assetKey);
  const isPlainWheel = isPlainWheel3DModel(modelUrl);
  const glassWheelFacetedCrystal =
    coloredCrystalSpacer && isGlassWheelSpacerModel(modelUrl);
  const plainWheelColoredCrystal =
    coloredCrystalSpacer && isPlainWheel && !glassWheelFacetedCrystal;
  const stoneWheelLuxury = isStoneWheelSpacerSku(assetKey);
  // The new spacer collection is yellow gold throughout. Override every mesh,
  // including pavé/gem-marked meshes in source GLBs, so no dark authored
  // materials show through on designs such as S6 and S7.
  const forceOpaqueMetal = isCatalogSpacerSku(assetKey);
  const metalEnv = useSpacerMetalEnvTexture();
  const isHexWheel = isHexSpacer3DModel(modelUrl);
  const localQuat = useMemo(() => {
    const q = new THREE.Quaternion();
    q.copy(getSpacerModelLocalQuaternion(modelUrl, assetKey));
    return q;
  }, [modelUrl, assetKey]);
  const { model: source, maxDim } = useSpacerPrototype(modelUrl);
  const model = useMemo(() => {
    const cacheKey = [
      modelUrl,
      metalFinish,
      diamondVariant,
      isHexWheel ? "hex" : "",
      stoneWheelLuxury ? "luxury" : "",
      plainWheelColoredCrystal ? "plain-crystal" : "",
      glassWheelFacetedCrystal ? "glass-crystal" : "",
      scene81MetalBand ? "scene81" : "",
      forceOpaqueMetal ? "opaque-metal" : "",
      gemEnv?.uuid ?? "",
      metalEnv?.uuid ?? "",
      metalMap?.uuid ?? "",
      hexGemMap?.uuid ?? "",
    ].join("|");
    let prepared = preparedSpacerCache.get(cacheKey);
    if (!prepared) {
      prepared = buildSpacerModelWithMaterials(source, gemEnv, {
        metalMap,
        metalFinish,
        diamondVariant,
        isHexWheel,
        hexGemMap,
        stoneWheelLuxury,
        metalEnv,
        plainWheelColoredCrystal,
        glassWheelFacetedCrystal,
        scene81MetalBand,
        forceOpaqueMetal,
      });
      preparedSpacerCache.set(cacheKey, prepared);
    }
    return prepared.clone();
  }, [
    source,
    modelUrl,
    gemEnv,
    metalMap,
    metalFinish,
    diamondVariant,
    isHexWheel,
    hexGemMap,
    stoneWheelLuxury,
    metalEnv,
    plainWheelColoredCrystal,
    glassWheelFacetedCrystal,
    scene81MetalBand,
    forceOpaqueMetal,
  ]);

  const scale = (targetSize / maxDim) * GLASS_BEAD_SHELL_SCALE;

  return (
    <group quaternion={localQuat} scale={scale}>
      <primitive object={model} />
    </group>
  );
}

function SpacerGlbMeshTextured({
  modelUrl,
  imageUrl,
  targetSize,
  diamondVariant,
  metalFinish,
  assetKey,
}) {
  const metalMap = useBeadArtTexture(imageUrl);
  return (
    <SpacerGlbMeshCore
      modelUrl={modelUrl}
      targetSize={targetSize}
      diamondVariant={diamondVariant}
      metalFinish={metalFinish}
      metalMap={metalMap}
      assetKey={assetKey}
    />
  );
}

function SpacerGlbOnRing({
  modelUrl,
  imageUrl,
  targetSize,
  assetKey,
  diamondVariant,
  metalFinish,
}) {
  if (isDiamondSpacerSku(assetKey) || isScene81MetalSpacerSku(assetKey)) {
    return (
      <SpacerGlbMeshCore
        modelUrl={modelUrl}
        targetSize={targetSize}
        diamondVariant={diamondVariant}
        metalFinish={metalFinish}
        metalMap={null}
        assetKey={assetKey}
      />
    );
  }
  // New catalog spacers use the GLB's own 3D material. Their shared image is
  // only the 2D top-view representation, not a texture for the 3D mesh.
  if (imageUrl && !isCatalogSpacerSku(assetKey)) {
    return (
      <Suspense fallback={null}>
        <SpacerGlbMeshTextured
          modelUrl={modelUrl}
          imageUrl={imageUrl}
          targetSize={targetSize}
          diamondVariant={diamondVariant}
          metalFinish={metalFinish}
          assetKey={assetKey}
        />
      </Suspense>
    );
  }
  return (
    <SpacerGlbMeshCore
      modelUrl={modelUrl}
      targetSize={targetSize}
      diamondVariant={diamondVariant}
      metalFinish={metalFinish}
      metalMap={null}
      assetKey={assetKey}
    />
  );
}

/** S1–S6 + S10–S14 crystal PBR; S7–S9 scene.glb gold / silver / rose PBR. */
function SpacerOnRing({ worldX, worldZ, width, height, modelUrl, imageUrl, assetKey }) {
  const diamondVariant = getSpacerDiamondVariant(assetKey);
  const metalFinish = getSpacerMetalFinish(assetKey);
  const targetSize = getSpacer3DTargetSize(width, assetKey, modelUrl);
  /** S10–S14: glass-wheel-spacer GLB + crystal tint (not flat picker WebP in 3D). */
  const isHexPicker =
    isHexSpacerSku(assetKey) && Boolean(imageUrl) && !isDiamondSpacerSku(assetKey);
  const orientQuat = useMemo(
    () => getItemOnStringQuaternion(worldX, worldZ),
    [worldX, worldZ]
  );
  const ringScale = isHexPicker ? [1, 1, 1] : getSpacerRingScaleForAssetKey(assetKey);
  const modelTransform = getRoundSpacer3DTransform(assetKey);
  const modelRotation = modelTransform.rotationDeg.map((degrees) => (degrees * Math.PI) / 180);

  // Catalog spacers (s1–s19) and colored crystal rondelles (s10–s14) are beads centered on the cord line (STRING_Y_OFFSET).
  // Legacy thin-wheel spacers remain lifted slightly so they do not clip the baseline.
  const isCatalogSpacer = isCatalogSpacerSku(assetKey);
  const spacerLiftY =
    isCatalogSpacer || isColoredCrystalSpacerSku(assetKey)
      ? STRING_Y_OFFSET
      : SPACER_RING_LIFT_Y;

  return (
    <group position={[0, spacerLiftY, 0]} quaternion={orientQuat}>
      <group position={modelTransform.position} rotation={modelRotation} scale={ringScale}>
        {isHexPicker ? (
          <SpacerHexPickerVisual
            imageUrl={imageUrl}
            targetSize={targetSize}
            width={width}
            height={height}
          />
        ) : (
          <Suspense fallback={<SpacerGlbLoadFallback width={width} assetKey={assetKey} />}>
            <SpacerGlbOnRing
              modelUrl={modelUrl}
              imageUrl={imageUrl}
              targetSize={targetSize}
              assetKey={assetKey}
              diamondVariant={diamondVariant}
              metalFinish={metalFinish}
            />
          </Suspense>
        )}
      </group>
    </group>
  );
}

/**
 * Edge-on string bail (hole along local +X) — same proportions as `buildEdgeOnStringBail`.
 * A thin gold torus only; no gem spheres or extra arcs (those read as a distorted “flower” in 3D).
 */
function getCharmBailDimensions(jumpRing) {
  return {
    ringR: (jumpRing?.ry ?? 4) * WORLD_PER_PX * CHARM_BAIL_3D_SIZE_BOOST,
    ringTube: Math.max(
      (jumpRing?.rx ?? 1) * WORLD_PER_PX * 0.92 * CHARM_BAIL_3D_SIZE_BOOST,
      0.007
    ),
  };
}

function CharmStringBail3D({ jumpRing }) {
  const { ringR, ringTube } = getCharmBailDimensions(jumpRing);

  return (
    <mesh
      rotation={[Math.PI / 2, Math.PI / 2, 0]}
      material={CHARM_BAIL_GOLD_MAT}
      renderOrder={RENDER_ORDER_RING_BASE + 7}
      userData={{ depthLayerOffset: 7 }}
    >
      <torusGeometry args={[ringR, ringTube, 12, 32]} />
    </mesh>
  );
}

function CharmThickPendantBody({ assets, charmDepth, position }) {
  if (!assets) {
    return null;
  }
  const { bodyGeo, bodyMat, faceMat, backFaceMat, W, H, offX, offY } = assets;
  const faceZ = charmDepth / 2 + 0.0006;

  return (
    <group position={position}>
      <mesh
        geometry={bodyGeo}
        material={bodyMat}
        castShadow
        receiveShadow
        renderOrder={RENDER_ORDER_RING_BASE + 14}
        userData={{ depthLayerOffset: 14 }}
      />
      <mesh
        material={faceMat}
        position={[-offX, -offY, faceZ]}
        renderOrder={RENDER_ORDER_RING_BASE + 16}
        userData={{ depthLayerOffset: 16 }}
      >
        <planeGeometry args={[W, H]} />
      </mesh>
      <mesh
        material={backFaceMat}
        position={[-offX, -offY, -faceZ]}
        rotation={[0, Math.PI, 0]}
        renderOrder={RENDER_ORDER_RING_BASE + 15}
        userData={{ depthLayerOffset: 15 }}
      >
        <planeGeometry args={[W, H]} />
      </mesh>
    </group>
  );
}

function BeadSelectionRing({ diameter = 0.1, width, isSpacer = false, plane = "xz" }) {
  const ringRef = useRef();
  const baseDim = isSpacer && width ? width : diameter;
  const radius = (baseDim / 2) * 1.18;
  const tube = Math.max(baseDim * 0.04, 0.0028);

  useFrame((state) => {
    if (ringRef.current) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 4.5) * 0.035;
      ringRef.current.scale.set(pulse, pulse, pulse);
    }
  });

  const meshRotation = plane === "xy" ? [0, 0, 0] : [Math.PI / 2, 0, 0];

  return (
    <group position={[0, 0, 0]}>
      {/* Outer luminous accent */}
      <mesh ref={ringRef} rotation={meshRotation} renderOrder={9998}>
        <torusGeometry args={[radius, tube * 1.6, 16, 48]} />
        <meshBasicMaterial color="#d4af37" transparent opacity={0.65} depthTest={false} />
      </mesh>
      {/* Crisp inner halo */}
      <mesh rotation={meshRotation} renderOrder={9999}>
        <torusGeometry args={[radius, tube, 16, 48]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.95} depthTest={false} />
      </mesh>
    </group>
  );
}

/** Extruded charm (bracelet-style thickness) at the gap — same layout as 2D bail + pendant. */
function CharmFlatVisual({
  item,
  charmIndex,
  ringItems,
  activeSlotIndex,
  customizeSlotItems,
  onSelectBead,
  isEditMode,
  isDraggingRef,
  suppressClickRef,
  onCharmPointerDown,
  isBeingDragged = false,
  isRemoveZone = false,
  dragPosition = null,
}) {
  const imageUrl = item.asset?.image;
  const pendant = getCharmPendantLayout(item);
  const img = pendant.charmImage;
  const h = img.height * WORLD_PER_PX;
  const charmDepth = resolveBeadsCharmExtrudeDepth(h);
  const assets = useThickCharmAssets(imageUrl, h, charmDepth, "#b5b5b5");
  const [attachX, attachZ] = getCharmAttachWorldXZ(item, ringItems);

  const groupRef = useRef(null);
  const currentAngleRef = useRef(isEditMode ? 0 : CHARM_VIEW_MODE_HANG_ANGLE_DEG);

  const { quatFlat, quatView } = useMemo(() => {
    const curX = isBeingDragged && dragPosition ? dragPosition[0] : attachX;
    const curZ = isBeingDragged && dragPosition ? dragPosition[1] : attachZ;
    _charmOutwardScratch.set(curX, 0, curZ);
    if (_charmOutwardScratch.lengthSq() > 1e-10) {
      _charmROut.copy(_charmOutwardScratch).normalize();
    } else {
      _charmROut.set(0, 0, -1);
    }
    // Local axes in bracelet space:
    // local +Z (charm face) points UP (_spacerUp)
    // local -Y (charm pendant hanging direction) points OUTWARD (_charmROut) => local +Y is -_charmROut
    // local +X (cord tangent) is local +Y x local +Z = (-_charmROut) x _spacerUp = _spacerUp x _charmROut
    _charmAxisX.crossVectors(_spacerUp, _charmROut).normalize();
    _charmAxisY.copy(_charmROut).negate();
    _charmBasisMat.makeBasis(_charmAxisX, _charmAxisY, _spacerUp);
    const flat = new THREE.Quaternion().setFromRotationMatrix(_charmBasisMat);

    // In view mode, charm falls down swinging outward about its bail cord axis (local +X) by 60°
    const view = flat.clone().multiply(
      new THREE.Quaternion().setFromAxisAngle(_charmTiltAxis, THREE.MathUtils.degToRad(CHARM_VIEW_MODE_HANG_ANGLE_DEG))
    );
    return { quatFlat: flat, quatView: view };
  }, [attachX, attachZ, isBeingDragged, dragPosition]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const targetAngle = isEditMode || isBeingDragged ? 0 : CHARM_VIEW_MODE_HANG_ANGLE_DEG;
    currentAngleRef.current = THREE.MathUtils.damp(
      currentAngleRef.current,
      targetAngle,
      14,
      Math.min(delta, 0.1)
    );
    const t = currentAngleRef.current / CHARM_VIEW_MODE_HANG_ANGLE_DEG;
    groupRef.current.quaternion.copy(quatFlat).slerp(quatView, t);
  });
  const stringJumpRing = pendant.stringJumpRing;
  const bailCx = (stringJumpRing?.cx ?? 0) * WORLD_PER_PX;
  const bailCy = (stringJumpRing?.cy ?? 0) * WORLD_PER_PX;
  const bailXPx = item.asset?.bailX ?? 0.5;
  const bailYPx = item.asset?.bailY3d ?? item.asset?.bailY ?? CHARM_BAIL_ANCHOR_RATIO;
  const charmCenterY_px = img.y + img.height / 2;
  const charmHookY_px = img.y + img.height * bailYPx;
  const charmHookX_px = img.x + img.width * bailXPx;
  const charmCenterX_px = img.x + img.width / 2;
  const pendantCenterX = charmCenterX_px * WORLD_PER_PX;
  let pendantPosY = -charmCenterY_px * WORLD_PER_PX;
  let hookThreeY = pendantPosY;
  let hookPivotX = bailCx;
  if (stringJumpRing) {
    const hookCenterY_px =
      (stringJumpRing.cy ?? 0) +
      (stringJumpRing.ry ?? 4) *
        CHARM_BAIL_3D_SIZE_BOOST *
        (1 + CHARM_BAIL_HOOK_DROP_RATIO);
    hookThreeY = -hookCenterY_px * WORLD_PER_PX;
    hookPivotX = charmHookX_px * WORLD_PER_PX;
    pendantPosY = hookThreeY - (charmCenterY_px - charmHookY_px) * WORLD_PER_PX;
  }
  const centerOffsetX = pendantCenterX - hookPivotX;
  const centerOffsetY = pendantPosY - hookThreeY;

  const [hovered, setHovered] = useState(false);

  const isSelected = useMemo(() => {
    if (activeSlotIndex == null) return false;
    if (item.id && customizeSlotItems?.[activeSlotIndex]?.id === item.id) return true;
    if (item.slotIndex != null && item.slotIndex === activeSlotIndex) return true;
    if (item.patternIndex != null && item.patternIndex === activeSlotIndex) return true;
    return false;
  }, [activeSlotIndex, customizeSlotItems, item.id, item.slotIndex, item.patternIndex]);

  useEffect(() => {
    if (hovered && isEditMode) {
      document.body.style.cursor = "pointer";
      return () => {
        document.body.style.cursor = "default";
      };
    }
  }, [hovered, isEditMode]);

  const handleClick = useCallback(
    (e) => {
      e.stopPropagation();
      if (!isEditMode || suppressClickRef?.current || isDraggingRef?.current) return;
      onSelectBead?.(item);
    },
    [isEditMode, suppressClickRef, isDraggingRef, onSelectBead, item]
  );

  const handlePointerDown = useCallback(
    (e) => {
      if (!isEditMode) return;
      onCharmPointerDown?.(e, item, charmIndex);
    },
    [isEditMode, onCharmPointerDown, item, charmIndex]
  );

  const handlePointerOver = useCallback(
    (e) => {
      if (!isEditMode) return;
      e.stopPropagation();
      setHovered(true);
    },
    [isEditMode]
  );

  const handlePointerOut = useCallback(() => {
    setHovered(false);
  }, []);

  if (!imageUrl) {
    return null;
  }

  const pX = stringJumpRing ? hookPivotX + centerOffsetX : pendantCenterX;
  const pY = stringJumpRing ? hookThreeY + centerOffsetY : pendantPosY;
  const finalPos = isBeingDragged && dragPosition
    ? [dragPosition[0], STRING_Y_OFFSET + 0.04, dragPosition[1]]
    : [attachX, STRING_Y_OFFSET, attachZ];

  return (
    <group
      ref={groupRef}
      position={finalPos}
      quaternion={isEditMode ? quatFlat : quatView}
      scale={isBeingDragged ? (isRemoveZone ? [0.82, 0.82, 0.82] : [1.14, 1.14, 1.14]) : [1, 1, 1]}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      <DepthSortApplicator index={charmIndex} kind="charm">
        {stringJumpRing ? (
          <group position={[bailCx, -bailCy, 0]}>
            <CharmStringBail3D jumpRing={stringJumpRing} />
          </group>
        ) : null}
        {stringJumpRing ? (
          <group position={[hookPivotX, hookThreeY, 0]}>
            <group position={[centerOffsetX, centerOffsetY, 0]}>
              <CharmThickPendantBody assets={assets} charmDepth={charmDepth} position={[0, 0, 0]} />
            </group>
          </group>
        ) : (
          <group position={[pendantCenterX, pendantPosY, 0]}>
            <CharmThickPendantBody assets={assets} charmDepth={charmDepth} position={[0, 0, 0]} />
          </group>
        )}
      </DepthSortApplicator>
      {isSelected && isEditMode && (
        <group position={[pX, pY, 0.001]}>
          <BeadSelectionRing diameter={h * 1.05} plane="xy" />
        </group>
      )}
    </group>
  );
}

const ALLOWED_TILTING_BEAD_KEYS = new Set([
  "pearl-star",
  "pearl_star",
  "pearlstar",
  "firosha",
  "firoza",
  "firoze",
  "firosha-star",
  "firosha_star",
  "amethyst-star",
  "amethyst_star",
  "amethyststar",
]);

function isStarBeadTiltItem(item, selectedBead, beadModelUrl) {
  if (item?.type === "spacer" || item?.type === "charm") return false;

  const asset =
    item?.asset ||
    (item?.assetKey ? resolvePatternAsset(item.type || "bead", item.assetKey) : selectedBead);
  if (!asset) return false;

  // Rudraksh and other beads must NEVER tilt
  if (
    asset.key === "rudraksh" ||
    asset.aliases?.includes("rudraksha") ||
    asset.aliases?.includes("rudraksh")
  ) {
    return false;
  }

  const key = (asset.key || "").toLowerCase();
  if (ALLOWED_TILTING_BEAD_KEYS.has(key)) {
    return true;
  }

  if (
    Array.isArray(asset.aliases) &&
    asset.aliases.some((a) => ALLOWED_TILTING_BEAD_KEYS.has(String(a).toLowerCase()))
  ) {
    return true;
  }

  const modelUrl = asset.modelUrl || beadModelUrl;
  if (modelUrl && /(?:pearl_star|Firosha|amethyst_star)\.glb$/i.test(modelUrl)) {
    return true;
  }

  return false;
}

const STAR_BEAD_VIEW_MODE_HANG_ANGLE_DEG = 90;

function TiltingBeadGroup({ stringQuat, isEditMode, isBeingDragged, children }) {
  const groupRef = useRef(null);
  const currentAngleRef = useRef(isEditMode ? 0 : STAR_BEAD_VIEW_MODE_HANG_ANGLE_DEG);

  const { quatFlat, quatView } = useMemo(() => {
    const flat = stringQuat.clone();
    const view = flat.clone().multiply(
      new THREE.Quaternion().setFromAxisAngle(
        _charmTiltAxis,
        THREE.MathUtils.degToRad(STAR_BEAD_VIEW_MODE_HANG_ANGLE_DEG)
      )
    );
    return { quatFlat: flat, quatView: view };
  }, [stringQuat]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const targetAngle = isEditMode || isBeingDragged ? 0 : STAR_BEAD_VIEW_MODE_HANG_ANGLE_DEG;
    currentAngleRef.current = THREE.MathUtils.damp(
      currentAngleRef.current,
      targetAngle,
      14,
      Math.min(delta, 0.1)
    );
    const t = currentAngleRef.current / STAR_BEAD_VIEW_MODE_HANG_ANGLE_DEG;
    groupRef.current.quaternion.copy(quatFlat).slerp(quatView, t);
  });

  return (
    <group ref={groupRef} quaternion={isEditMode ? quatFlat : quatView}>
      {children}
    </group>
  );
}

function BeadOnRing({
  item,
  ringIndex,
  ringItems,
  charmGaps,
  selectedBead,
  selectedSeparator,
  beadPrototype,
  activeSlotIndex,
  customizeSlotItems,
  onSelectBead,
  isEditMode,
  isDraggingRef,
  suppressClickRef,
  onBeadPointerDown,
  isManualMode = false,
  isBeingDragged = false,
  isDropTarget = false,
  isRemoveZone = false,
  dragPosition = null,
}) {
  const { diameter, width, height } = ringItemToTransform(item);
  const [posX, posZ] = getRingMeshWorldXZ(item, ringIndex, ringItems, charmGaps, isManualMode);
  const imageUrl = resolveRingItemImageUrl(item, selectedBead, selectedSeparator);
  const isSpacer = item.type === "spacer";
  const textureUrl = isSpacer ? null : resolveRingItemTextureUrl(item, selectedBead);
  const materialType = isSpacer ? "solid" : resolveRingItemMaterialType(item, selectedBead);
  const beadModelUrl = isSpacer ? null : resolveRingItemBeadModelUrl(item, selectedBead);
  const tiltsInView = !isSpacer && isStarBeadTiltItem(item, selectedBead, beadModelUrl);
  const stringQuat = useMemo(() => getItemOnStringQuaternion(posX, posZ), [posX, posZ]);
  const spacerKey =
    item.assetKey ?? item.asset?.key ?? selectedSeparator?.key ?? "s2";
  const spacerModelUrl = resolveSpacer3DModelUrl(spacerKey);
  const [hovered, setHovered] = useState(false);

  const isSelected = useMemo(() => {
    if (activeSlotIndex == null) return false;
    if (item.id && customizeSlotItems?.[activeSlotIndex]?.id === item.id) return true;
    if (item.slotIndex != null && item.slotIndex === activeSlotIndex) return true;
    if (item.patternIndex != null && item.patternIndex === activeSlotIndex) return true;
    return ringIndex === activeSlotIndex;
  }, [activeSlotIndex, customizeSlotItems, item.id, item.slotIndex, item.patternIndex, ringIndex]);

  useEffect(() => {
    if (hovered && isEditMode) {
      document.body.style.cursor = "pointer";
      return () => {
        document.body.style.cursor = "default";
      };
    }
  }, [hovered, isEditMode]);

  const handleClick = useCallback(
    (e) => {
      e.stopPropagation();
      if (!isEditMode || suppressClickRef?.current || isDraggingRef?.current) return;
      onSelectBead?.(item, ringIndex);
    },
    [isEditMode, suppressClickRef, isDraggingRef, onSelectBead, item, ringIndex]
  );

  const handlePointerDown = useCallback(
    (e) => {
      if (!isEditMode) return;
      onBeadPointerDown?.(e, item, ringIndex);
    },
    [isEditMode, onBeadPointerDown, item, ringIndex]
  );

  const handlePointerOver = useCallback(
    (e) => {
      if (!isEditMode) return;
      e.stopPropagation();
      setHovered(true);
    },
    [isEditMode]
  );

  const handlePointerOut = useCallback(() => {
    setHovered(false);
  }, []);

  const finalPos = isBeingDragged && dragPosition
    ? [dragPosition[0], 0.05, dragPosition[1]]
    : [posX, 0, posZ];

  return (
    <group
      position={finalPos}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      <group scale={isBeingDragged ? (isRemoveZone ? [0.82, 0.82, 0.82] : [1.14, 1.14, 1.14]) : [1, 1, 1]}>
        <DepthSortApplicator index={ringIndex} kind="ring">
          {isSpacer ? (
            <SpacerOnRing
              worldX={posX}
              worldZ={posZ}
              width={width}
              height={height}
              modelUrl={spacerModelUrl}
              imageUrl={imageUrl}
              assetKey={spacerKey}
            />
          ) : tiltsInView ? (
            <TiltingBeadGroup
              stringQuat={stringQuat}
              isEditMode={isEditMode}
              isBeingDragged={isBeingDragged}
            >
              <GlassBeadVisual
                diameter={diameter}
                textureUrl={textureUrl}
                materialType={materialType}
                beadPrototype={beadPrototype}
                beadModelUrl={beadModelUrl}
              />
            </TiltingBeadGroup>
          ) : (
            <group quaternion={stringQuat}>
              <GlassBeadVisual
                diameter={diameter}
                textureUrl={textureUrl}
                materialType={materialType}
                beadPrototype={beadPrototype}
                beadModelUrl={beadModelUrl}
              />
            </group>
          )}
        </DepthSortApplicator>
      </group>
      {isSelected && isEditMode && (
        <BeadSelectionRing
          diameter={diameter}
          width={width}
          isSpacer={isSpacer}
        />
      )}
      {/* Target drop indicator when dragging another bead over this slot */}
      {isDropTarget && isEditMode && !isRemoveZone && (
        <mesh rotation={[Math.PI / 2, 0, 0]} renderOrder={10001}>
          <torusGeometry args={[((isSpacer && width ? width : diameter) / 2) * 1.35, 0.0042, 16, 48]} />
          <meshBasicMaterial color="#10b981" transparent opacity={0.92} depthTest={false} />
        </mesh>
      )}
    </group>
  );
}

/** Distance beyond the bracelet ring line (screen px) before drag counts as remove. */
const DRAG_3D_REMOVE_THRESHOLD_PX = 42;
/** Pulling back inside this distance leaves the remove state again (screen px). */
const DRAG_3D_REMOVE_EXIT_THRESHOLD_PX = 26;

function BeadsRingScene({
  active = true,
  isEditMode: isEditModeProp,
  view360: view360Prop,
  onRemoveZoneChange,
}) {
  const context360 = useContext(View360Context);
  const view360 = view360Prop !== undefined ? view360Prop : (context360?.view360 ?? false);
  const isEditMode = isEditModeProp !== undefined ? isEditModeProp : !view360;
  const {
    activeSlotIndex,
    customizeSlotItems,
    selectSlotById,
    selectSlotIndex,
    setActiveSlotIndex,
    reorderManualItems,
    reorderPresetSlotItems,
    removeManualItemAt,
    removePresetSlotAt,
    removeBraceletCharmById,
    updateBraceletCharmGap,
    selectedBead,
    selectedSeparator,
    pattern,
    manualItems,
    presetSlotItems,
    isManualMode,
    isStringFull,
    sizeId,
    selectedThreadColor,
  } = useBeedsContext();
  const { requestPreviewFocus, clearPreviewFocus } = usePreviewFocus();
  const beadPrototype = useGlassBeadPrototype();
  const spacerMetrics = useSpacerModelMetrics();
  const { items: displayItems, stringRadiusPx: layoutStringRadiusPx } = useBeadsSettledLayout();
  useEffect(() => {
    const urls = new Set();
    pattern.forEach((item) => {
      if (item?.type !== "spacer") {
        return;
      }
      const key = item.assetKey ?? item.asset?.key ?? selectedSeparator?.key;
      if (key) {
        urls.add(resolveSpacer3DModelUrl(key));
      }
    });
    urls.forEach((url) => useGLTF.preload(url));
  }, [pattern, selectedSeparator]);
  const ringYawRef = useRef(0);
  const [ringYawDeg, setRingYawDeg] = useState(0);
  const isDraggingRef = useRef(false);
  const beadDragRef = useRef(null);
  const [beadDragState, setBeadDragState] = useState(null);
  const suppressClickRef = useRef(false);

  usePreviewFocusRingRotation({
    settledItems: displayItems,
    pattern,
    rotationDeg: ringYawDeg,
    setRotationDeg: setRingYawDeg,
    rotationRef: ringYawRef,
    frontAngleDeg: PREVIEW_FOCUS_FRONT_ANGLE_DEG_3D,
    suppressFocus: !isEditMode || Boolean(beadDragState) || isDraggingRef.current,
  });
  const layoutRingItems = useMemo(
    () => displayItems.filter((item) => item.type === "bead" || item.type === "spacer"),
    [displayItems]
  );
  const layoutCharmItems = useMemo(
    () => displayItems.filter((item) => item.type === "charm"),
    [displayItems]
  );
  // In editing mode, retain string/thread gaps so the pattern remains easy to edit.
  // When switching to 360 view mode, collapse the string like an elastic strand.
  const compact3dLayout = useMemo(() => {
    if (isEditMode || layoutRingItems.length < ELASTIC_BAND_3D_MIN_RING_ITEMS) {
      return null;
    }
    return computeElasticBand3dLayout({
      ringItems: layoutRingItems,
      charmItems: layoutCharmItems,
      spacerMetrics,
      selectedSeparator,
      selectedBead,
    });
  }, [isEditMode, layoutRingItems, layoutCharmItems, spacerMetrics, selectedSeparator, selectedBead]);
  const ringItems = useMemo(
    () =>
      compact3dLayout
        ? layoutRingItems.map((item, index) => ({
            ...item,
            elastic3dPos: compact3dLayout.ringPositions[index],
          }))
        : layoutRingItems,
    [layoutRingItems, compact3dLayout]
  );
  const charmItems = useMemo(
    () =>
      compact3dLayout
        ? layoutCharmItems.map((item, index) => ({
            ...item,
            elastic3dPos: compact3dLayout.charmPositions[index],
          }))
        : layoutCharmItems,
    [layoutCharmItems, compact3dLayout]
  );
  const stringRadiusPx = compact3dLayout
    ? compact3dLayout.radius / WORLD_PER_PX
    : layoutStringRadiusPx;
  const charmGaps = useMemo(
    () => getCharmOccupiedRingGaps(charmItems, ringItems.length),
    [charmItems, ringItems.length]
  );
  const ringTiltX = BEADS_3D_RING_TILT_X;
  const ringYawRad = THREE.MathUtils.degToRad(ringYawDeg);
  const { camera } = useThree();
  const controlsRef = useRef(null);

  // Frame camera distance based on maximum bracelet length (5.5") so that beads
  // maintain the exact same visual size regardless of string length. When bracelet
  // length increases (e.g. from 4" to 5.5"), the string ring expands in the view
  // while the beads remain at their true physical scale without shrinking.
  const maxBraceletRadiusPx = useMemo(
    () => getRingRadiusForInches(MAX_BRACELET_LENGTH_INCHES),
    []
  );
  const cameraFramingRadiusPx = useMemo(
    () => Math.max(layoutStringRadiusPx, maxBraceletRadiusPx),
    [layoutStringRadiusPx, maxBraceletRadiusPx]
  );

  const [orbitLimits, setOrbitLimits] = useState(() =>
    getBeads3DOrbitLimits(cameraFramingRadiusPx, false)
  );
  const orbitBaseLimitsRef = useRef(orbitLimits);

  useLayoutEffect(() => {
    const applyFraming = () => {
      const mobile = typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches;
      const aspect = camera.aspect > 0 ? camera.aspect : 1.2;
      const limits = getBeads3DOrbitLimits(cameraFramingRadiusPx, mobile, aspect);
      orbitBaseLimitsRef.current = limits;
      setOrbitLimits(limits);
      camera.position.copy(getBeads3DCameraPosition(cameraFramingRadiusPx, mobile, aspect));
      camera.updateProjectionMatrix();
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
      }
    };
    applyFraming();
    const mq = typeof window !== "undefined" ? window.matchMedia("(max-width: 900px)") : null;
    mq?.addEventListener("change", applyFraming);
    window.addEventListener("resize", applyFraming);
    return () => {
      mq?.removeEventListener("change", applyFraming);
      window.removeEventListener("resize", applyFraming);
    };
  }, [camera, cameraFramingRadiusPx]);

  const sortRootRef = useRef(null);
  const sortablesRef = useRef([]);
  const sortSignatureRef = useRef("");
  const sortRefreshRef = useRef(0);
  const gl = useThree((state) => state.gl);
  const setDpr = useThree((state) => state.setDpr);
  const restingDprRef = useRef(1);

  useEffect(() => {
    // Match the necklace-bracelet canvas density. The previous 1.5 cap softened the
    // small round spacer GLBs, especially on Retina/high-density screens.
    restingDprRef.current = Math.min(window.devicePixelRatio || 1, 2);
    setDpr(restingDprRef.current);
  }, [setDpr]);

  const handleBeadPointerDown = useCallback(
    (e, item, ringIndex) => {
      if (!isEditMode) return;
      e.stopPropagation();
      beadDragRef.current = {
        item,
        isCharm: false,
        ringIndex,
        startX: e.clientX,
        startY: e.clientY,
        hasMoved: false,
        isRemoveZone: false,
        hoverTargetIndex: null,
      };
    },
    [isEditMode]
  );

  const handleCharmPointerDown = useCallback(
    (e, item, charmIndex) => {
      if (!isEditMode) return;
      e.stopPropagation();
      beadDragRef.current = {
        item,
        isCharm: true,
        charmIndex,
        startX: e.clientX,
        startY: e.clientY,
        hasMoved: false,
        isRemoveZone: false,
        hoverTargetIndex: null,
      };
    },
    [isEditMode]
  );

  const handleSelectBead = useCallback(
    (item, fallbackRingIndex) => {
      if (!item) return;

      const isCurrentlySelected =
        activeSlotIndex !== null &&
        (customizeSlotItems?.[activeSlotIndex]?.id === item.id ||
          customizeSlotItems?.[activeSlotIndex]?.slotIndex === item.slotIndex ||
          activeSlotIndex === fallbackRingIndex);

      if (isCurrentlySelected) {
        setActiveSlotIndex(null);
        clearPreviewFocus();
        return;
      }

      let slotIndex = -1;
      if (item.id) {
        slotIndex = customizeSlotItems?.findIndex((slot) => slot.id === item.id) ?? -1;
      }
      if (slotIndex < 0 && item.slotIndex != null) {
        slotIndex = item.slotIndex;
      }
      if (slotIndex < 0 && item.patternIndex != null) {
        slotIndex = item.patternIndex;
      }
      if (slotIndex < 0 && fallbackRingIndex != null) {
        slotIndex = fallbackRingIndex;
      }

      if (item.id) {
        selectSlotById(item.id);
      } else if (slotIndex >= 0) {
        selectSlotIndex(slotIndex);
      }

      requestPreviewFocus({
        itemId: item.id ?? null,
        patternIndex: slotIndex >= 0 ? slotIndex : null,
      });
    },
    [activeSlotIndex, customizeSlotItems, setActiveSlotIndex, clearPreviewFocus, selectSlotById, selectSlotIndex, requestPreviewFocus]
  );

  // Ensure ring camera resets to flat-lay position when entering Edit Mode
  useEffect(() => {
    if (isEditMode) {
      userOrbitRef.current = false;
      const mobile = typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches;
      const aspect = camera.aspect > 0 ? camera.aspect : 1.2;
      const targetPos = getBeads3DCameraPosition(cameraFramingRadiusPx, mobile, aspect);
      camera.position.copy(targetPos);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
      }
    }
  }, [isEditMode, camera, cameraFramingRadiusPx]);

  // Bead drag & swap / remove interaction in Edit Mode (no canvas spin)
  useEffect(() => {
    const canvas = gl.domElement;
    if (!canvas || !isEditMode) return undefined;

    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const dragRaycaster = new THREE.Raycaster();
    const dragMouse = new THREE.Vector2();
    const dragIntersect = new THREE.Vector3();

    const handlePointerDown = (event) => {
      if (event.button != null && event.button !== 0) return;
      isDraggingRef.current = false;
    };

    const handlePointerMove = (event) => {
      const beadDrag = beadDragRef.current;
      if (!beadDrag) return;

      const dist = Math.hypot(event.clientX - beadDrag.startX, event.clientY - beadDrag.startY);
      if (dist > 8) {
        beadDrag.hasMoved = true;
        isDraggingRef.current = true;

        const rect = canvas.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // Calculate 3D intersection on the bracelet plane (local to sortRootRef)
        dragMouse.set(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -(((event.clientY - rect.top) / rect.height) * 2 - 1)
        );
        dragRaycaster.setFromCamera(dragMouse, camera);

        let localDragX = 0;
        let localDragZ = 0;
        let hasHit = false;

        if (sortRootRef.current) {
          sortRootRef.current.updateMatrixWorld(true);
          const invMatrix = sortRootRef.current.matrixWorld.clone().invert();
          const localRay = dragRaycaster.ray.clone().applyMatrix4(invMatrix);
          const localHit = new THREE.Vector3();
          if (localRay.intersectPlane(dragPlane, localHit)) {
            localDragX = localHit.x;
            localDragZ = localHit.z;
            hasHit = true;
          }
        }

        // Calculate screen-space ring radius to detect dragging outside the line of bracelet
        const ringRadiusWorld = compact3dLayout ? compact3dLayout.radius : (stringRadiusPx * WORLD_PER_PX);
        const braceletCenterWorld = sortRootRef.current
          ? sortRootRef.current.getWorldPosition(new THREE.Vector3())
          : new THREE.Vector3(0, 0, 0);
        const centerV = braceletCenterWorld.clone().project(camera);
        const edgeV = braceletCenterWorld.clone().add(new THREE.Vector3(ringRadiusWorld, 0, 0)).project(camera);
        const screenCenterX = rect.left + (centerV.x + 1) * 0.5 * rect.width;
        const screenCenterY = rect.top + (1 - centerV.y) * 0.5 * rect.height;
        const screenEdgeX = rect.left + (edgeV.x + 1) * 0.5 * rect.width;
        const screenEdgeY = rect.top + (1 - edgeV.y) * 0.5 * rect.height;
        const screenRingRadius = Math.hypot(screenEdgeX - screenCenterX, screenEdgeY - screenCenterY);

        const pointerDistToCenter = Math.hypot(event.clientX - screenCenterX, event.clientY - screenCenterY);
        const deltaOutsideRing = pointerDistToCenter - screenRingRadius;

        // Outside-ring threshold with hysteresis (42px to enter, 26px to exit)
        const wasInRemoveZone = Boolean(beadDrag.isRemoveZone);
        const isRemoveZone = deltaOutsideRing > (wasInRemoveZone ? DRAG_3D_REMOVE_EXIT_THRESHOLD_PX : DRAG_3D_REMOVE_THRESHOLD_PX);
        beadDrag.isRemoveZone = isRemoveZone;
        onRemoveZoneChange?.(isRemoveZone);

        if (isRemoveZone) {
          beadDrag.hoverTargetIndex = null;
          setBeadDragState({
            fromIndex: beadDrag.isCharm ? null : beadDrag.ringIndex,
            charmIndex: beadDrag.isCharm ? beadDrag.charmIndex : null,
            isCharm: beadDrag.isCharm,
            toIndex: null,
            isRemoveZone: true,
            dragPos: hasHit ? [localDragX, localDragZ] : null,
          });
        } else if (!beadDrag.isCharm) {
          // Angle in local coordinate space of the ring
          const pointerAngleDeg = (Math.atan2(localDragZ, localDragX) * 180) / Math.PI;

          let closestIndex = -1;
          let minDiff = Infinity;
          for (let i = 0; i < ringItems.length; i++) {
            const rItem = ringItems[i];
            const [px, pz] = getRingMeshWorldXZ(rItem, i, ringItems, charmGaps, isManualMode);
            const beadAngleDeg = (Math.atan2(pz, px) * 180) / Math.PI;
            const diff = Math.abs(normalizeAngleDelta(pointerAngleDeg - beadAngleDeg));
            if (diff < minDiff) {
              minDiff = diff;
              closestIndex = i;
            }
          }

          beadDrag.hoverTargetIndex = closestIndex;
          setBeadDragState({
            fromIndex: beadDrag.ringIndex,
            charmIndex: null,
            isCharm: false,
            toIndex: closestIndex,
            isRemoveZone: false,
            dragPos: hasHit ? [localDragX, localDragZ] : null,
          });
        } else {
          // Charm dragged inside the ring without remove zone
          const pointerAngle = Math.atan2(-localDragZ, localDragX);
          const ringBeadCount = layoutRingItems.length;
          const resolved = resolveCharmDragSnapGap({
            gapItems: layoutRingItems,
            centerX: CENTER_X,
            centerY: CENTER_Y,
            pointerAngle,
            segmentCount: ringBeadCount,
            pattern,
            excludeCharmId: beadDrag.item?.id,
            closedLoop: true,
            defaultSizeId: sizeId || undefined,
          });

          const snapGap = resolved?.snapGap ?? 0;
          let gapWorldX = localDragX;
          let gapWorldZ = localDragZ;

          if (ringItems.length >= 2) {
            const [p1x, p1z] = getRingMeshWorldXZ(ringItems[snapGap], snapGap, ringItems, charmGaps, isManualMode);
            const nextIndex = (snapGap + 1) % ringItems.length;
            const [p2x, p2z] = getRingMeshWorldXZ(ringItems[nextIndex], nextIndex, ringItems, charmGaps, isManualMode);
            const midX = (p1x + p2x) / 2;
            const midZ = (p1z + p2z) / 2;
            const ringRadiusWorld = compact3dLayout ? compact3dLayout.radius : (stringRadiusPx * WORLD_PER_PX);
            const midLen = Math.hypot(midX, midZ);
            gapWorldX = midLen > 1e-6 ? (midX / midLen) * ringRadiusWorld : midX;
            gapWorldZ = midLen > 1e-6 ? (midZ / midLen) * ringRadiusWorld : midZ;
          }

          beadDrag.targetGap = snapGap;
          beadDrag.targetGapPos = [gapWorldX, gapWorldZ];

          setBeadDragState({
            fromIndex: null,
            charmIndex: beadDrag.charmIndex,
            isCharm: true,
            toIndex: snapGap,
            targetGap: snapGap,
            targetGapPos: [gapWorldX, gapWorldZ],
            isRemoveZone: false,
            dragPos: hasHit ? [localDragX, localDragZ] : null,
          });
        }
      }
    };

    const handlePointerUp = (event) => {
      const beadDrag = beadDragRef.current;
      if (beadDrag) {
        beadDragRef.current = null;
        const { hasMoved, ringIndex: fromRingIndex, hoverTargetIndex, item, isRemoveZone, isCharm } = beadDrag;
        setBeadDragState(null);
        onRemoveZoneChange?.(false);

        if (hasMoved && isRemoveZone) {
          suppressClickRef.current = true;
          window.setTimeout(() => {
            suppressClickRef.current = false;
          }, 250);
          if (isCharm) {
            removeBraceletCharmById(item.id, { playSound: false });
          } else {
            const slotItems = isManualMode ? manualItems : presetSlotItems;
            let fromSlot = slotItems.findIndex((entry) => entry.id === item.id);
            if (fromSlot < 0) {
              const fromItem = ringItems[fromRingIndex];
              fromSlot = fromItem?.slotIndex ?? fromRingIndex;
            }
            if (fromSlot >= 0) {
              if (isManualMode) {
                removeManualItemAt(fromSlot, { playSound: false });
              } else {
                removePresetSlotAt(fromSlot, { playSound: false });
              }
            }
          }
          playBeadRemoveSound();
          setActiveSlotIndex(null);
          clearPreviewFocus();
          isDraggingRef.current = false;
          return;
        }

        if (hasMoved) {
          suppressClickRef.current = true;
          window.setTimeout(() => {
            suppressClickRef.current = false;
          }, 250);

          if (isCharm) {
            if (beadDrag.targetGap != null) {
              const currentGap = Number.isFinite(item.ringGap) ? Math.floor(item.ringGap) : null;
              if (currentGap !== beadDrag.targetGap) {
                updateBraceletCharmGap(item.id, beadDrag.targetGap);
                playBeadMoveSound();
              }
            }
          } else if (hoverTargetIndex != null && hoverTargetIndex !== fromRingIndex) {
            const fromItem = ringItems[fromRingIndex];
            const toItem = ringItems[hoverTargetIndex];
            const fromSlot = fromItem?.slotIndex ?? fromRingIndex;
            const toSlot = toItem?.slotIndex ?? hoverTargetIndex;

            const reorderFn = isManualMode ? reorderManualItems : reorderPresetSlotItems;
            reorderFn(fromSlot, toSlot);
            playBeadMoveSound();
          }
          // Drag-and-drop bead/charm reorder: do not auto-rotate the ring, do not leave any bead active
          setActiveSlotIndex(null);
          clearPreviewFocus();
          isDraggingRef.current = false;
          return;
        } else {
          // Click-to-select: auto-rotates bead to front for swapping via bead options
          handleSelectBead(item, fromRingIndex);
          suppressClickRef.current = true;
          window.setTimeout(() => {
            suppressClickRef.current = false;
          }, 250);
          isDraggingRef.current = false;
          return;
        }
      }
      isDraggingRef.current = false;
    };

    canvas.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [
    gl,
    isEditMode,
    camera,
    ringItems,
    charmGaps,
    isManualMode,
    manualItems,
    presetSlotItems,
    reorderManualItems,
    reorderPresetSlotItems,
    removeManualItemAt,
    removePresetSlotAt,
    removeBraceletCharmById,
    updateBraceletCharmGap,
    selectSlotIndex,
    handleSelectBead,
    onRemoveZoneChange,
    compact3dLayout,
    stringRadiusPx,
    setActiveSlotIndex,
    clearPreviewFocus,
    layoutRingItems,
    pattern,
    sizeId,
  ]);

  const userOrbitRef = useRef(false);

  const onOrbitStart = useCallback(() => {
    userOrbitRef.current = true;
    setDpr(restingDprRef.current);
  }, [setDpr]);

  const onOrbitEnd = useCallback(() => {
    userOrbitRef.current = false;
    setDpr(restingDprRef.current);
    gl.shadowMap.needsUpdate = true;
  }, [gl, setDpr]);

  // OrbitControls auto-rotate advances once per frame only during 360 view mode
  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (isEditMode || !active || !controls || userOrbitRef.current) {
      return;
    }
    const step = ((2 * Math.PI) / 60) * 5 * Math.min(delta, 0.05);
    controls.setAzimuthalAngle(controls.getAzimuthalAngle() - step);
  });

  useFrame(() => {
    const root = sortRootRef.current;
    if (!root) {
      return;
    }
    const { ringBases, charmBases } = computeBraceletDepthBases(
      ringItems,
      charmItems,
      ringTiltX,
      ringYawRad,
      camera,
      charmGaps,
      isManualMode
    );
    sortRefreshRef.current += 1;
    const signature = `${ringItems.length}:${charmItems.length}`;
    if (sortSignatureRef.current !== signature || sortRefreshRef.current < 90) {
      gl.shadowMap.needsUpdate = true;
    }
    if (sortSignatureRef.current !== signature || sortRefreshRef.current % 45 === 0) {
      const sortables = [];
      root.traverse((obj) => {
        const layer = obj.userData?.depthLayerOffset;
        if (layer == null) {
          return;
        }
        let node = obj.parent;
        let sortIndex = null;
        let sortKind = "ring";
        while (node) {
          if (node.userData?.depthSortIndex != null) {
            sortIndex = node.userData.depthSortIndex;
            sortKind = node.userData.depthSortKind || "ring";
            break;
          }
          node = node.parent;
        }
        if (sortIndex == null) {
          return;
        }
        sortables.push({ obj, layer, sortIndex, sortKind });
      });
      sortablesRef.current = sortables;
      sortSignatureRef.current = signature;
    }
    const sortables = sortablesRef.current;
    for (let index = 0; index < sortables.length; index += 1) {
      const entry = sortables[index];
      const bases = entry.sortKind === "charm" ? charmBases : ringBases;
      entry.obj.renderOrder = (bases[entry.sortIndex] ?? RENDER_ORDER_RING_BASE) + entry.layer;
    }
  }, -1);
  return (
    <>
      <group ref={sortRootRef} rotation={[ringTiltX, ringYawRad, 0]}>
        <BraceletCordLayer
          ringItems={ringItems}
          stringRadiusPx={stringRadiusPx}
          beadPrototype={beadPrototype}
          isManualMode={isManualMode}
          isStringFull={isStringFull}
          charmGaps={charmGaps}
          elasticRadiusWorld={compact3dLayout?.radius ?? null}
          cordColor={selectedThreadColor?.preview3d || selectedThreadColor?.color || "#111111"}
        />
        {ringItems.map((item, index) => (
          <BeadOnRing
            key={item.id ?? `ring-${index}`}
            item={item}
            ringIndex={index}
            ringItems={ringItems}
            charmGaps={charmGaps}
            beadPrototype={beadPrototype}
            selectedBead={selectedBead}
            selectedSeparator={selectedSeparator}
            activeSlotIndex={activeSlotIndex}
            customizeSlotItems={customizeSlotItems}
            onSelectBead={handleSelectBead}
            isEditMode={isEditMode}
            isDraggingRef={isDraggingRef}
            suppressClickRef={suppressClickRef}
            onBeadPointerDown={handleBeadPointerDown}
            isManualMode={isManualMode}
            isBeingDragged={!beadDragState?.isCharm && beadDragState?.fromIndex === index}
            isDropTarget={!beadDragState?.isCharm && beadDragState?.toIndex === index && beadDragState?.fromIndex !== index}
            isRemoveZone={beadDragState?.isRemoveZone}
            dragPosition={!beadDragState?.isCharm && beadDragState?.fromIndex === index ? beadDragState?.dragPos : null}
          />
        ))}
        {charmItems.map((item, index) => (
          <Suspense key={item.id ?? `charm-${index}`} fallback={null}>
            <CharmFlatVisual
              item={item}
              charmIndex={index}
              ringItems={ringItems}
              activeSlotIndex={activeSlotIndex}
              customizeSlotItems={customizeSlotItems}
              onSelectBead={handleSelectBead}
              isEditMode={isEditMode}
              isDraggingRef={isDraggingRef}
              suppressClickRef={suppressClickRef}
              onCharmPointerDown={handleCharmPointerDown}
              isBeingDragged={beadDragState?.isCharm && beadDragState?.charmIndex === index}
              isRemoveZone={beadDragState?.isRemoveZone}
              dragPosition={beadDragState?.isCharm && beadDragState?.charmIndex === index ? beadDragState?.dragPos : null}
            />
          </Suspense>
        ))}
        {/* Charm drop gap target indicator */}
        {beadDragState?.isCharm && beadDragState?.targetGapPos && !beadDragState?.isRemoveZone && (
          <group position={[beadDragState.targetGapPos[0], STRING_Y_OFFSET, beadDragState.targetGapPos[1]]}>
            <mesh rotation={[Math.PI / 2, 0, 0]} renderOrder={10001}>
              <torusGeometry args={[0.042, 0.0042, 16, 48]} />
              <meshBasicMaterial color="#10b981" transparent opacity={0.92} depthTest={false} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]} renderOrder={10002}>
              <circleGeometry args={[0.022, 32]} />
              <meshBasicMaterial color="#d4af37" transparent opacity={0.88} depthTest={false} />
            </mesh>
          </group>
        )}
      </group>
      <OrbitControls
        ref={controlsRef}
        enabled={!isEditMode && active}
        enablePan={false}
        enableZoom={!isEditMode}
        enableDamping
        dampingFactor={0.12}
        minDistance={orbitLimits.min}
        maxDistance={orbitLimits.max}
        zoomSpeed={BEADS_3D_ORBIT_ZOOM_SPEED}
        onStart={onOrbitStart}
        onEnd={onOrbitEnd}
        makeDefault
      />
    </>
  );
}

export default function BeadsPreview3D({ active = true }) {
  const { view360 } = useContext(View360Context);
  const isEditMode = !view360;
  const [isRemoveZone, setIsRemoveZone] = useState(false);
  const {
    activeSlotIndex,
    customizeSlotItems,
    setActiveSlotIndex,
  } = useBeedsContext();
  const { clearPreviewFocus } = usePreviewFocus();

  const handleDeselect = useCallback(
    (e) => {
      e?.stopPropagation();
      setActiveSlotIndex(null);
      clearPreviewFocus();
    },
    [setActiveSlotIndex, clearPreviewFocus]
  );

  return (
    <div
      className={`beads-3d-preview${isEditMode ? " is-edit-mode" : " beads-3d-preview--view-only"}`}
      aria-label="Bead bracelet 3D preview"
      aria-hidden={active ? undefined : true}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        frameloop={active ? "always" : "demand"}
        camera={{ position: [0.01, 7.2, 0.37], fov: BEADS_3D_CAMERA_FOV, near: 0.2, far: 80 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
          stencil: false,
        }}
      >
        <PreviewRenderSettings />
        <color attach="background" args={["#f8f8f8"]} />
        {/* A restrained studio rig gives the polished bead material its shape
            without bleaching the photographed stone texture. */}
        <ambientLight intensity={0.33} />
        <directionalLight
          position={[5, 9, 5]}
          intensity={0.64}
          color="#fff6e8"
          castShadow
          shadow-mapSize={[256, 256]}
        />
        <directionalLight position={[-6, 4, -4]} intensity={0.2} color="#e8ecf4" />
        <directionalLight position={[0, 2, 8]} intensity={0.18} color="#ffffff" />
        <directionalLight position={[-2, 7, -8]} intensity={0.13} color="#fff8ec" />
        <Suspense fallback={null}>
          <Environment preset="studio" environmentIntensity={0.3} />
        </Suspense>
        <BeadsRingScene
          active={active}
          isEditMode={isEditMode}
          view360={view360}
          onRemoveZoneChange={setIsRemoveZone}
        />
      </Canvas>

      {/* Remove indicator badge when dragging outside bracelet ring */}
      {isEditMode && (
        <div
          className={`beads-2d-remove-indicator beads-3d-remove-indicator${isRemoveZone ? " is-visible" : ""}`}
          aria-live="polite"
        >
          <span className="beads-2d-remove-indicator__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
            </svg>
          </span>
          Remove
        </div>
      )}

      {/* Floating selection arrow */}
      {isEditMode && activeSlotIndex != null && customizeSlotItems?.length > 0 && (
        <div className="beads-3d-selection-bar" aria-label="Bead selection indicator">
          <button
            type="button"
            className="beads-selection-nav-arrow"
            onClick={handleDeselect}
            aria-label="Deselect bead"
            title="Active bead indicator (click to deselect)"
          >
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <path d="M16 26V8M9 15l7-7 7 7" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M16 26V8M9 15l7-7 7 7" stroke="#171717" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
