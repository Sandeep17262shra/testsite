/* eslint-disable react/prop-types */
import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

// Same directions the camera uses for its "top", "front" and "perspective" views
// (see viewDirections in CameraController.js).
export const GRID_SNAPSHOT_VIEWS = [
  { id: "top", direction: [0, 15, 0.001] },
  { id: "front", direction: [0, 2, 15] },
  { id: "perspective", direction: [10, 8, -13] },
];

// Short debounce so a burst of changes (e.g. clicking through options) takes one set of stills, then
// two animation frames so the live scene has applied the new materials before it is read.
const SETTLE_DELAY_MS = 120;

/**
 * Lives inside the <Canvas>. While grid view is on, it re-renders the current ring from the top,
 * front and perspective directions and hands the three images (data URLs) to `onSnapshots`.
 * It runs once the ring has finished loading (`ready`) and the settings in `snapshotKey` stopped
 * changing, and it restores the live camera immediately, so the 3D viewer never visibly moves.
 */
export function GridSnapshotter({ enabled, ready, snapshotKey, distance, onSnapshots }) {
  const { gl, scene, camera, size } = useThree();
  const callbackRef = useRef(onSnapshots);
  callbackRef.current = onSnapshots;

  useEffect(() => {
    if (!enabled || !ready) return undefined;
    if (!(size.width > 40 && size.height > 40)) return undefined;

    let cancelled = false;
    let frameA = 0;
    let frameB = 0;

    const takeSnapshots = () => {
      if (cancelled) return;
      const savedPosition = camera.position.clone();
      const savedQuaternion = camera.quaternion.clone();
      const savedUp = camera.up.clone();
      const result = {};

      try {
        GRID_SNAPSHOT_VIEWS.forEach(({ id, direction }) => {
          const position = new THREE.Vector3(...direction).normalize().multiplyScalar(distance);
          camera.position.copy(position);
          camera.up.set(0, 1, 0);
          camera.lookAt(0, 0, 0);
          camera.updateMatrixWorld(true);
          gl.render(scene, camera);
          // The canvas keeps its drawing buffer (preserveDrawingBuffer), so it can be read right away.
          result[id] = gl.domElement.toDataURL("image/jpeg", 0.88);
        });
      } catch (error) {
        console.warn("[ring-configurator] Grid view snapshot failed:", error);
      } finally {
        camera.position.copy(savedPosition);
        camera.quaternion.copy(savedQuaternion);
        camera.up.copy(savedUp);
        camera.updateMatrixWorld(true);
        // Put the live view back on the canvas straight away.
        gl.render(scene, camera);
      }

      if (result.top && result.front && result.perspective) {
        callbackRef.current?.(result);
      }
    };

    const timer = window.setTimeout(() => {
      frameA = window.requestAnimationFrame(() => {
        frameB = window.requestAnimationFrame(takeSnapshots);
      });
    }, SETTLE_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.cancelAnimationFrame(frameA);
      window.cancelAnimationFrame(frameB);
    };
    // gl/scene/camera are stable for the life of the canvas.
  }, [enabled, ready, snapshotKey, distance, size.width, size.height]);

  return null;
}

export default GridSnapshotter;
