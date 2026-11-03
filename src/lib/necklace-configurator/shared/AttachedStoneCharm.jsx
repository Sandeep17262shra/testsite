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
import { GLTFLoader } from "three-stdlib";
import * as THREE from "three";
import { ringMetalProps } from "./metalMaterial";
import { GEM_REFRACTION_PARAMS, useGemEnvTexture } from "./gemMaterial";
import {
  getAttachedCharmMatrix,
  isAttachedCharmStone,
  isAttachedCharmPearl,
  withAttachedCharmVersion,
  DEFAULT_ATTACHED_STONE_COLOR,
} from "./attachedCharms";

const AttachedStoneCharm = ({
  charm,
  scale = 1,
  metalColor = "#DBDBDB",
  stoneColor = DEFAULT_ATTACHED_STONE_COLOR,
}) => {
  const gltf = useLoader(GLTFLoader, withAttachedCharmVersion(charm.path));
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
    gltf.scene.traverse((child) => {
      if (!child.isMesh || !child.geometry) return;
      const geometry = child.geometry.clone();
      geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toScene, child.matrixWorld));
      const label = `${child.name} ${child.material?.name || ""}`;
      if (charm.crystal && /prism|crystal/i.test(label)) {
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
        stone.push(faceted);
      } else {
        metal.push(geometry);
      }
    });
    return { metal, stone, pearl, crystal };
  }, [gltf, charm]);

  useEffect(() => () => {
    parts.metal.forEach((g) => g.dispose());
    parts.stone.forEach((g) => g.dispose());
    parts.pearl.forEach((g) => g.dispose());
    parts.crystal.forEach((g) => g.dispose());
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
      {parts.stone.map((geometry, i) => (
        <mesh key={`stone-${i}-${stoneColor}`} geometry={geometry} castShadow>
          {envTexture ? (
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
