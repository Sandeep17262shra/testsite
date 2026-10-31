import { useCallback } from "react";
import { useStoreContext } from "./contexts/StoreContext";
import { resolveUiString } from "./uiTranslations";

/** Returns the appearance-page string for `key`, or the built-in English label. */
export function useUiText() {
  const { uiTranslations } = useStoreContext();
  return useCallback(
    (key) => resolveUiString(uiTranslations, key),
    [uiTranslations]
  );
}
