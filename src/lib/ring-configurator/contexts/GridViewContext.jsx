import { createContext, useCallback, useMemo, useState } from "react";

/**
 * Preview layout of the ring configurator.
 *   gridView = false -> one big interactive 3D viewer ("normal view")
 *   gridView = true  -> 2 x 2 grid: top / front / perspective snapshots + the live 3D viewer
 *
 * `snapshots` holds the three still images ({ top, front, perspective } as data URLs).
 * They are produced by <GridSnapshotter /> from the same scene the 3D viewer shows.
 */
export const GridViewContext = createContext({
  gridView: false,
  setGridView: () => {},
  snapshots: {},
  setSnapshots: () => {},
});

export const GridViewProvider = ({ children }) => {
  const [gridView, setGridViewState] = useState(false);
  const [snapshots, setSnapshots] = useState({});
  // Switching layout drops the old stills, so a stale ring is never shown while new ones render.
  const setGridView = useCallback((next) => {
    setGridViewState(next);
    setSnapshots({});
  }, []);
  const value = useMemo(
    () => ({ gridView, setGridView, snapshots, setSnapshots }),
    [gridView, setGridView, snapshots]
  );
  return <GridViewContext.Provider value={value}>{children}</GridViewContext.Provider>;
};
