/* eslint-disable react/no-unknown-property */
/* eslint-disable react/prop-types */

// ─── HangingStoneCharm ──────────────────────────────────────────────────────
// A hanging stone charm (see HANGING_CHARMS) built like an initial: the model's
// own top loop plays the washer - flat, facing the viewer - and a round bail
// ring stands edge-on through its hole and up onto the chain link.
//
// The group's origin is the CENTRE OF THE LOOP. The caller positions it (and
// chooses the bail's size, since the bracelet and the necklace differ) the same
// way it positions an initial's washer.
import React, { Suspense } from "react";
import AttachedStoneCharm from "./AttachedStoneCharm";
import { ringMetalProps } from "./metalMaterial";

const HangingStoneCharm = ({
  charm,              // an entry of HANGING_CHARMS
  scale,              // scene units per model unit
  metalColor,
  stoneColor,
  stoneType,
  bailRadius,
  bailTube,
  bailY = 0,          // bail centre, in the charm's frame (loop centre = 0)
  bailZ = 0,
  materialProps,      // optional pre-built metal props (necklace passes DoubleSide)
}) => {
  const metal = materialProps || ringMetalProps(metalColor);
  return (
    <group>
      {/* The bail ring sits in the same Suspense boundary as the model, so the
          ring and the charm appear together once the model has loaded. */}
      <Suspense fallback={null}>
        <AttachedStoneCharm charm={charm} scale={scale} metalColor={metalColor} stoneColor={stoneColor} stoneType={stoneType} />
        <mesh position={[0, bailY, bailZ]} rotation={[0, Math.PI / 2, 0]} castShadow>
          <torusGeometry args={[bailRadius, bailTube, 16, 48]} />
          <meshPhysicalMaterial {...metal} />
        </mesh>
      </Suspense>
    </group>
  );
};

export default HangingStoneCharm;
