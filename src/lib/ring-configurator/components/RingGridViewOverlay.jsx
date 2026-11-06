import { useContext } from "react";
import { GridViewContext } from "../contexts/GridViewContext";
import { CameraViewContext } from "../contexts/CameraViewContext";
import { LoaderContext } from "../contexts/LoaderContext";

const CELLS = [
  { id: "top", label: "Top view", title: "Top view (click to view in 3D)" },
  { id: "3d", label: "3D", title: "" },
  { id: "front", label: "Front view", title: "Front view (click to view in 3D)" },
  { id: "perspective", label: "Perspective view", title: "Side perspective view (click to view in 3D)" },
];

/**
 * 2 x 2 grid drawn over the preview pane in grid view. Three cells show still images of the ring;
 * the fourth (top right) is empty because the live 3D viewer is positioned underneath it.
 * Clicking a still image points the 3D viewer at that angle.
 */
export default function RingGridViewOverlay() {
  const { snapshots } = useContext(GridViewContext);
  const { setCameraView } = useContext(CameraViewContext);
  const { loader } = useContext(LoaderContext);

  return (
    <div className="ring-grid-view" aria-label="Ring views">
      {CELLS.map((cell) =>
        cell.id === "3d" ? (
          <div className="ring-grid-view__cell ring-grid-view__cell--live" key={cell.id}>
            <span className="ring-grid-view__label">3D</span>
            <span className="ring-grid-view__hint">Drag to rotate • Scroll to zoom</span>
          </div>
        ) : (
          <button
            type="button"
            className="ring-grid-view__cell ring-grid-view__cell--still"
            key={cell.id}
            title={cell.title}
            aria-label={cell.title}
            onClick={(event) => {
              event.stopPropagation();
              setCameraView(cell.id);
            }}
          >
            <span className="ring-grid-view__label">{cell.label}</span>
            {snapshots[cell.id] ? (
              <img src={snapshots[cell.id]} alt={cell.label} draggable={false} />
            ) : (
              <span className="ring-grid-view__placeholder" aria-hidden="true">
                {loader ? "" : "…"}
              </span>
            )}
          </button>
        )
      )}
    </div>
  );
}
