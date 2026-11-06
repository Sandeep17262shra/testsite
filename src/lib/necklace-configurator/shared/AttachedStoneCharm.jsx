/* eslint-disable react/no-unknown-property */
/* eslint-disable react/prop-types */

// ─── AttachedStoneCharm ─────────────────────────────────────────────────────
// Draws one of the stone charms (see attachedCharms.js) standing upright,
// stone towards the viewer, with the point midway between its two link rings at
// the group's origin. The caller puts that origin on the chain.
//
// The metal and the stone are separate meshes in every file. The metal gets the
// same ring-matched recipe as everything else; the stone is baked out and drawn
// through MeshRefractionMaterial, exactly as birthstone/diamond charms are.
import React, { useEffect, useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import { MeshRefractionMaterial } from "@react-three/drei";
import { GLTFLoader, DRACOLoader } from "three-stdlib";
import * as THREE from "three";
import { ringMetalProps } from "./metalMaterial";
import { GEM_REFRACTION_PARAMS, useGemEnvTexture } from "./gemMaterial";
import StoneMaterial, { applyStoneUVs } from "./StoneMaterial";
import { getStoneType } from "./stoneTypes";
import {
  getAttachedCharmMatrix,
  ATTACHED_CHARMS,
  isAttachedCharmStone,
  isAttachedCharmPearl,
  withAttachedCharmVersion,
  DEFAULT_ATTACHED_STONE_COLOR,
} from "./attachedCharms";

// The charm models may be Draco-compressed; a bare GLTFLoader throws "No
// DRACOLoader instance provided" on those. One shared decoder (local files).
let sharedDracoLoader = null;
const withDraco = (loader) => {
  if (!sharedDracoLoader) {
    sharedDracoLoader = new DRACOLoader();
    sharedDracoLoader.setDecoderPath("/draco/gltf/");
  }
  loader.setDRACOLoader(sharedDracoLoader);
};

// Fetch the chain-stone models up front so switching between Oval / Round /
// Square never waits on a download (and the chain never blinks out for it).
if (typeof window !== "undefined") {
  ATTACHED_CHARMS.forEach((def) => {
    useLoader.preload(GLTFLoader, withAttachedCharmVersion(def.path), withDraco);
  });
}

const AttachedStoneCharm = ({
  charm,
  scale = 1,
  metalColor = "#DBDBDB",
  stoneColor = DEFAULT_ATTACHED_STONE_COLOR,
  stoneType = null,   // id from stoneTypes.js; when set the stone is that gemstone, not a diamond
}) => {
  const gltf = useLoader(GLTFLoader, withAttachedCharmVersion(charm.path), withDraco);
  const envTexture = useGemEnvTexture();

  // Geometry is rebuilt in the charm's own frame once per model, never per
  // frame: node transforms (the stone is rotated and scaled in the file) and
  // the model -> scene axis change are both baked in here.
  const parts = useMemo(() => {
    const toScene = getAttachedCharmMatrix(charm);
    gltf.scene.updateMatrixWorld(true);
    const metal = [];
    const stone = [];
    const pearl = [];
    const crystal = [];
    const smoothStone = [];
    gltf.scene.traverse((child) => {
      if (!child.isMesh || !child.geometry) return;
      const geometry = child.geometry.clone();
      geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toScene, child.matrixWorld));
      const label = `${child.name} ${child.material?.name || ""}`;
      const uvScale = getStoneType(stoneType)?.uvScale ?? 1;
      if (stoneType && charm.crystal && /prism|crystal/i.test(label)) {
        // Crystal point set with a chosen stone: faceted, textured like any stone.
        const faceted = geometry.toNonIndexed();
        geometry.dispose();
        faceted.computeVertexNormals();
        applyStoneUVs(faceted, uvScale);
        stone.push(faceted);
      } else if (stoneType && charm.pearl && isAttachedCharmPearl(label)) {
        // Pearl-shaped charm set with a chosen stone: a smooth polished bead.
        const smooth = geometry.toNonIndexed();
        geometry.dispose();
        applyStoneUVs(smooth, uvScale);
        smoothStone.push(smooth);
      } else if (charm.crystal && /prism|crystal/i.test(label)) {
        // The crystal point: flat facets, tinted and translucent.
        const faceted = geometry.toNonIndexed();
        geometry.dispose();
        faceted.computeVertexNormals();
        crystal.push(faceted);
      } else if (charm.pearl && isAttachedCharmPearl(label)) {
        // A pearl is a plain lustrous sphere: smooth normals, no facets.
        pearl.push(geometry);
      } else if (isAttachedCharmStone(label)) {
        // Split the shared vertices so every triangle keeps its own normal -
        // that is what makes the table and pavilion read as cut facets.
        const faceted = geometry.toNonIndexed();
        geometry.dispose();
        faceted.computeVertexNormals();
        applyStoneUVs(faceted, getStoneType(stoneType)?.uvScale ?? 1);
        stone.push(faceted);
      } else {
        metal.push(geometry);
      }
    });
    return { metal, stone, pearl, crystal, smoothStone };
  }, [gltf, charm, stoneType]);

  useEffect(() => () => {
    parts.metal.forEach((g) => g.dispose());
    parts.stone.forEach((g) => g.dispose());
    parts.pearl.forEach((g) => g.dispose());
    parts.crystal.forEach((g) => g.dispose());
    parts.smoothStone.forEach((g) => g.dispose());
  }, [parts]);

  const metalProps = useMemo(() => ringMetalProps(metalColor), [metalColor]);

  return (
    <group scale={scale}>
      {parts.metal.map((geometry, i) => (
        <mesh key={`metal-${i}`} geometry={geometry} castShadow receiveShadow>
          <meshPhysicalMaterial {...metalProps} />
        </mesh>
      ))}
      {parts.crystal.map((geometry, i) => (
        <mesh key={`crystal-${i}`} geometry={geometry} castShadow>
          <meshPhysicalMaterial
            color="#B79AEA"
            metalness={0}
            roughness={0.12}
            transmission={0.55}
            thickness={1.2}
            ior={1.55}
            flatShading
            clearcoat={1}
            clearcoatRoughness={0.05}
            attenuationColor="#8E63D6"
            attenuationDistance={6}
            envMapIntensity={1.4}
          />
        </mesh>
      ))}
      {parts.pearl.map((geometry, i) => (
        <mesh key={`pearl-${i}`} geometry={geometry} castShadow>
          <meshPhysicalMaterial
            color="#E6DDCE"
            metalness={0.05}
            roughness={0.28}
            clearcoat={0.6}
            clearcoatRoughness={0.2}
            sheen={0.6}
            sheenColor="#FFF4E6"
            envMapIntensity={0.7}
          />
        </mesh>
      ))}
      {parts.smoothStone.map((geometry, i) => (
        <mesh key={`smooth-stone-${charm.path}-${i}-${stoneType}`} geometry={geometry} castShadow>
          <StoneMaterial stoneType={stoneType} fallbackColor={stoneColor} flat={false} />
        </mesh>
      ))}
      {parts.stone.map((geometry, i) => (
        <mesh key={`stone-${charm.path}-${i}-${stoneType || stoneColor}`} geometry={geometry} castShadow>
          {stoneType && getStoneType(stoneType) ? (
            <StoneMaterial stoneType={stoneType} fallbackColor={stoneColor} />
          ) : envTexture ? (
            <MeshRefractionMaterial
              envMap={envTexture}
              color={new THREE.Color(stoneColor)}
              ior={GEM_REFRACTION_PARAMS.ior}
              bounces={GEM_REFRACTION_PARAMS.bounces}
              aberrationStrength={GEM_REFRACTION_PARAMS.aberrationStrength}
              fresnel={GEM_REFRACTION_PARAMS.fresnel}
              toneMapped={false}
              transparent
              fastChroma
            />
          ) : (
            // Stand-in until the env map arrives, so the stone is never a hole.
            <meshPhysicalMaterial
              color={stoneColor}
              metalness={0}
              roughness={0.025}
              transmission={0.72}
              thickness={0.35}
              ior={2.417}
              flatShading
              clearcoat={1}
              clearcoatRoughness={0.015}
              envMapIntensity={3}
            />
          )}
        </mesh>
      ))}
    </group>
  );
};

export default AttachedStoneCharm;
