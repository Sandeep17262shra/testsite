"use client";

import dynamic from "next/dynamic";
import React, { useContext, useEffect } from "react";
import { View360Context } from "../contexts/View360Context";

const BeadsPreview3D = dynamic(() => import("./BeadsPreview3D"), {
  ssr: false,
  loading: () => (
    <div className="beads-3d-preview beads-3d-preview--loading" aria-hidden="true" />
  ),
});

function prefetchBeadsPreview3D() {
  import("./BeadsPreview3D").catch(() => {});
}

/**
 * Overlay title showing bracelet description in 3D preview.
 */
function BeadsPreviewDescriptionOverlay({ visible, previewLabel }) {
  if (!visible || !previewLabel) {
    return null;
  }

  return (
    <div className="theme3-preview-caption beads-preview-desc-overlay" aria-live="polite">
      <strong>{previewLabel}</strong>
    </div>
  );
}

export default function BeadsPreviewMorph({ previewLabel = "" }) {
  const { view360 } = useContext(View360Context);

  useEffect(() => {
    prefetchBeadsPreview3D();
  }, []);

  return (
    <div
      className={`beads-preview-morph is-3d-active ${view360 ? "is-view360-active" : "is-edit-active"}`}
    >
      <BeadsPreviewDescriptionOverlay
        visible={true}
        previewLabel={previewLabel}
      />
      <div className="beads-preview-morph__layer beads-preview-morph__layer--3d">
        <BeadsPreview3D active={true} />
      </div>
    </div>
  );
}
