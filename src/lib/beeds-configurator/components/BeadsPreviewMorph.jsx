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
function BeadsPreviewDescriptionOverlay({ visible, previewLabel, previewChips }) {
  if (!visible || !previewLabel) {
    return null;
  }

  const chips = previewChips?.length ? previewChips : [previewLabel];

  return (
    <div
      className="theme3-preview-caption beads-preview-desc-overlay ring-preview-selection-chips"
      aria-label={previewLabel}
      aria-live="polite"
    >
      {chips.map((chip, index) => (
        <span className="ring-preview-selection-chip" key={`${chip}-${index}`}>
          {chip}
        </span>
      ))}
    </div>
  );
}

export default function BeadsPreviewMorph({ previewLabel = "", previewChips = [] }) {
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
        previewChips={previewChips}
      />
      <div className="beads-preview-morph__layer beads-preview-morph__layer--3d">
        <BeadsPreview3D active={true} />
      </div>
    </div>
  );
}
