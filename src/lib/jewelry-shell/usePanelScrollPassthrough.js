import { useEffect } from "react";

const PANEL_SELECTOR = ".theme3-panel-scroll";
const EDGE_PX = 5;

const panelFromTarget = (target) =>
  target instanceof Element ? target.closest(PANEL_SELECTOR) : null;

const panelEdges = (panel) => ({
  atBottom: panel.scrollTop + panel.clientHeight >= panel.scrollHeight - EDGE_PX,
  atTop: panel.scrollTop <= EDGE_PX,
});

/**
 * Forwards wheel / touch scrolling that goes past the top or bottom of the
 * options panel (`.theme3-panel-scroll`) to the embedding page, which scrolls
 * itself via /scroll-passthrough.js. Only active when the app runs in an iframe.
 *
 * The listeners live on `document` and look the panel up from the event target
 * every time, instead of being bound once to the panel element found on mount.
 * Necklace <-> bracelet switches (and late mounts) replace the panel element,
 * which left listeners bound on mount attached to a detached node.
 */
export function usePanelScrollPassthrough(messageType) {
  useEffect(() => {
    if (typeof window === "undefined" || window.self === window.top) return undefined;

    const forward = (deltaY) => {
      try {
        window.parent.postMessage({ type: messageType, deltaY }, "*");
      } catch {}
    };

    const handleWheel = (event) => {
      const panel = panelFromTarget(event.target);
      if (!panel) return;
      const { atBottom, atTop } = panelEdges(panel);
      if ((atBottom && event.deltaY > 0) || (atTop && event.deltaY < 0)) {
        event.preventDefault();
        forward(event.deltaY);
      }
    };

    let touchPanel = null;
    let lastTouchY = null;

    const handleTouchStart = (event) => {
      touchPanel = panelFromTarget(event.target);
      lastTouchY = null;
      if (!touchPanel) return;
      const { atBottom, atTop } = panelEdges(touchPanel);
      if (atBottom || atTop) lastTouchY = event.touches[0]?.clientY ?? null;
    };

    const handleTouchMove = (event) => {
      if (!touchPanel || lastTouchY === null) return;
      const { atBottom, atTop } = panelEdges(touchPanel);
      if (!atBottom && !atTop) return;
      const currentY = event.touches[0]?.clientY;
      if (currentY == null) return;
      const deltaY = lastTouchY - currentY;
      if ((atBottom && deltaY > 0) || (atTop && deltaY < 0)) {
        event.preventDefault();
        lastTouchY = currentY;
        forward(deltaY);
      }
    };

    const handleTouchEnd = () => {
      touchPanel = null;
      lastTouchY = null;
    };

    document.addEventListener("wheel", handleWheel, { passive: false });
    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });
    document.addEventListener("touchcancel", handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("wheel", handleWheel);
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [messageType]);
}
