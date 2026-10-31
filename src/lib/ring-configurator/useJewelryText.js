import { useCallback } from "react";
import { useStoreContext } from "./contexts/StoreContext";
import { resolveJewelryString } from "./jewelryUiTranslations";

/** Appearance-page copy shared by necklace, bracelet, and beaded bracelet. */
export function useJewelryText() {
  const { uiTranslations } = useStoreContext();

  return useCallback(
    (key) => resolveJewelryString(uiTranslations, key),
    [uiTranslations]
  );
}
