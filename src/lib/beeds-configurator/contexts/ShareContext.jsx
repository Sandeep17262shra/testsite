import { createContext, useEffect, useState } from "react";
import { useStoreContext } from "@/lib/ring-configurator/contexts/StoreContext";
import { initBeadedPriceConfig } from "../beadedPriceConfig";

export const ShareContext = createContext(false);

export const ShareProvider = ({ children }) => {
  const [ share, setShare ] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [parent, setParent] = useState(null);
  const { parentUrl: storeParentUrl, shop, canonicalShop } = useStoreContext();

  // Load the store's beaded catalogue (names, prices, active/inactive) for the
  // embedding store. StoreContext keeps parentUrl up to date (query string,
  // referrer, postMessage), so this re-runs when the parent arrives late.
  // Components re-render through useBeadedPriceConfigVersion() — see
  // beadedPriceConfig.js. An empty API answer falls back to
  // public/data/beaded-demostore-api-data.json.
  useEffect(() => {
    initBeadedPriceConfig({
      parentUrl: parent || storeParentUrl || null,
      shop: shop || null,
      canonicalShop: canonicalShop || null,
    }).catch((error) => {
      console.warn("Unable to load beaded price configuration:", error);
    });
  }, [parent, storeParentUrl, shop, canonicalShop]);

  return (
     <ShareContext.Provider value={{ share, setShare, shareUrl, setShareUrl, parent, setParent }}>
      {children}
    </ShareContext.Provider>
  );
};
