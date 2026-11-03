"use client";

import dynamic from "next/dynamic";
import ConfiguratorSkeleton from "@/components/ConfiguratorSkeleton";
import { startCriticalSequence } from "@/lib/beeds-configurator/beadsCriticalAssets";

if (typeof window !== "undefined") {
  // Start the ordered first-load sequence (icons → bead GLB → HDRs → texture), and fetch the (large) three.js preview
  // chunk in parallel with the configurator chunk instead of after it.
  startCriticalSequence();
  import("@/lib/beeds-configurator/components/BeadsPreview3D").catch(() => {});
}

const BeedsConfiguratorClient = dynamic(
  () => import("@/components/BeedsConfiguratorClient"),
  { ssr: false, loading: () => <ConfiguratorSkeleton /> }
);

/**
 * Frame route used by /Jewelery-customizer. Its own document keeps the bead
 * app's global css away from the necklace app's — see lib/jewelry-shell.
 */
export default function BeadBraceletFramePage() {
  return <BeedsConfiguratorClient />;
}
