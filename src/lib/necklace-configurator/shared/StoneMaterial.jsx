/* eslint-disable react/no-unknown-property */
/* eslint-disable react/prop-types */

// ─── StoneMaterial ──────────────────────────────────────────────────────────
// The material for a stone charm's stone mesh: the chosen stone's texture
// (structure) on a polished physical material. Used in place of the diamond-like
// MeshRefractionMaterial by every stone charm, on the necklace and the bracelet.
//
// Not Suspense-based (the bracelet's charms have no Suspense boundary). Two rules
// keep a stone from ever showing without its texture:
//   1. The textures start downloading as soon as this module loads (bottom of the
//      file) - at the same moment as the charm models - and a texture that is
//      already in is used on the very first frame.
//   2. A stone whose texture is still on its way is not drawn at all, instead of
//      being drawn flat; and the material is rebuilt when the texture arrives
//      (three.js only compiles a texture slot into the shader when the material
//      is created with one, so just setting `map` later leaves the stone white).
import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { getStoneType, STONE_TYPES, DEFAULT_STONE_TYPE_ID } from "./stoneTypes";

const textureCache = new Map();    // url -> Promise<Texture>
const readyTextures = new Map();   // url -> Texture, once it has loaded

const loadStoneTexture = (url) => {
  if (!textureCache.has(url)) {
    textureCache.set(url, new Promise((resolve, reject) => {
      new THREE.TextureLoader().load(url, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.MirroredRepeatWrapping;
        texture.wrapT = THREE.MirroredRepeatWrapping;
        texture.anisotropy = 8;
        texture.needsUpdate = true;
        readyTextures.set(url, texture);
        resolve(texture);
      }, undefined, (err) => {
        textureCache.delete(url);
        reject(err);
      });
    }));
  }
  return textureCache.get(url);
};

// { texture, failed }: `texture` is read straight from the cache, so a stone
// that was preloaded has it on its first render. `failed` only turns true if the
// download errors, so the stone falls back to its base colour instead of staying
// invisible.
const useStoneTexture = (url) => {
  const [failedUrl, setFailedUrl] = useState(null);
  const [, setTick] = useState(0);
  const texture = url ? readyTextures.get(url) ?? null : null;
  useEffect(() => {
    if (!url || readyTextures.has(url)) return undefined;
    let cancelled = false;
    loadStoneTexture(url)
      .then(() => { if (!cancelled) setTick((n) => n + 1); })
      .catch((err) => {
        console.warn("[stone] texture failed to load", url, err);
        if (!cancelled) setFailedUrl(url);
      });
    return () => { cancelled = true; };
  }, [url]);
  return { texture, failed: failedUrl === url };
};

// Warm the cache so switching stones never waits on a download.
export const preloadStoneTextures = (stones) => {
  if (typeof window === "undefined") return;
  stones.forEach((stone) => { loadStoneTexture(stone.texture).catch(() => {}); });
};

// Box-map the stone's faces onto the texture. Each triangle is projected along
// the axis its normal points down most, so a faceted stone shows the pattern on
// every facet without stretching. `geometry` must be non-indexed (one normal per
// triangle - the charms already split their stone vertices to get cut facets).
export function applyStoneUVs(geometry, uvScale = 1) {
  const pos = geometry.getAttribute("position");
  if (!pos) return geometry;
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;
  const size = Math.max(max.x - min.x, max.y - min.y, max.z - min.z) || 1;
  const uv = new Float32Array(pos.count * 2);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i + 2 < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    n.subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b));
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    for (let v = 0; v < 3; v += 1) {
      const p = v === 0 ? a : v === 1 ? b : c;
      let u; let w;
      if (az >= ax && az >= ay) { u = p.x - min.x; w = p.y - min.y; }       // faces the viewer
      else if (ax >= ay) { u = p.z - min.z; w = p.y - min.y; }             // side facets
      else { u = p.x - min.x; w = p.z - min.z; }                           // top / bottom facets
      uv[(i + v) * 2] = (u / size) * uvScale;
      uv[(i + v) * 2 + 1] = (w / size) * uvScale;
    }
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return geometry;
}

const StoneMaterial = ({ stoneType, fallbackColor, flat = true }) => {
  const def = getStoneType(stoneType);
  const { texture, failed } = useStoneTexture(def?.texture);
  const props = useMemo(() => ({
    metalness: 0,
    roughness: 0.15,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.2,
    ...(def?.material || {}),
  }), [def]);

  // Hidden until the texture is in (or has failed, or the stone has none).
  const visible = Boolean(texture) || failed || !def?.texture;

  return (
    <meshPhysicalMaterial
      // A new material when the texture arrives, so it is compiled with the map.
      key={texture ? "textured" : "plain"}
      {...props}
      color={texture ? "#ffffff" : (def?.hex || fallbackColor || "#cccccc")}
      map={texture || null}
      flatShading={flat}
      visible={visible}
      toneMapped
    />
  );
};

// Start every stone's texture downloading now, default stone first, rather than
// waiting for the control panel to mount.
if (typeof window !== "undefined") {
  const first = STONE_TYPES.filter((stone) => stone.id === DEFAULT_STONE_TYPE_ID);
  preloadStoneTextures([...first, ...STONE_TYPES.filter((stone) => stone.id !== DEFAULT_STONE_TYPE_ID)]);
}

export default StoneMaterial;
