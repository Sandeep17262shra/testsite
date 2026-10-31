import React, {
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BEADS,
  BEAD_CHARMS,
  BEAD_COLLECTIONS,
  BEAD_GRID_SIZE_FILTERS,
  BEAD_JEWELRY_CATEGORIES,
  BEAD_LENGTHS,
  BEAD_LENGTH_OPTIONS,
  CLASSIC_SEPARATORS,
  DEFAULT_METALIC_BEAD_SIZE_ID,
  DEFAULT_METALIC_SIZE_FILTER,
  getMetalicBeadPickerGridItems,
  HIDDEN_NEW_SPACER_KEYS,
  METALIC_BEADS,
  METALIC_BEAD_SIZE_FILTERS,
  METALIC_BEAD_SIZES,
  getBeadPickerGridItems,
  getBeadStyleLabel,
  isBeadSizeSupported,
  SEPARATORS,
  UI_HIDDEN_BEAD_STYLE_IDS,
  UI_HIDDEN_CUSTOMIZE_TAB_IDS,
  VISIBLE_BEAD_CUSTOMIZE_TABS,
  VISIBLE_BEAD_STYLES,
  isCharmCustomizationEnabled,
  isSpacerCustomizationEnabled,
  resolveBeadStyle,
  resolvePatternAsset,
  THREAD_COLORS,
} from "../assets";
import { isJewelryShellActive, requestJewelryCategory } from "@/lib/jewelry-shell/jewelryCategoryBus";
import { getFooterSummaryTaxLabel } from "@/lib/jewelry-shell/summaryTaxLabel";
import { useBeedsContext } from "../contexts/BeedsContext";
import { usePreviewFocus } from "../contexts/PreviewFocusContext";
import { View360Context } from "../contexts/View360Context";
import { unlockBeadsAudio } from "../beadsSounds";
import { buildBeadPreviewLabel, buildPatternCustomizeSummaryLines } from "../pricing";
import { ShareContext } from "../contexts/ShareContext";
import { Base64 } from "js-base64";
import { renderOptionBoxLabel } from "@/lib/ring-configurator/theme3OptionLabels";
import { useJewelryText } from "@/lib/ring-configurator/useJewelryText";
import { useStorefrontControls } from "@/lib/ring-configurator/contexts/StoreContext";
import {
  BEAD_TAB_KEYS,
  formatCountedLabel,
} from "@/lib/ring-configurator/jewelryUiTranslations";

function serializeBeadsCartItems(items = []) {
  return items.map((item) => ({
    type: item.type,
    assetKey: item.assetKey,
    ...(item.sizeId ? { sizeId: item.sizeId } : {}),
    ...(Number.isFinite(item.ringGap) ? { ringGap: item.ringGap } : {}),
    ...(item.id ? { id: item.id } : {}),
  }));
}

const customizeTabsShownInUi = VISIBLE_BEAD_CUSTOMIZE_TABS;

function CardOption({ active, label, image, onClick, disabled = false }) {
  return (
    <button
      type="button"
      className={`gb-card-option ${active ? "active" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {image && <img src={image} alt={label || ""} />}
      {label && <span className="theme3-option-box-label">{label}</span>}
    </button>
  );
}

function TextOption({ active, label, onClick, disabled = false, children }) {
  const content = children != null ? children : label;
  return (
    <button
      type="button"
      className={`gb-text-option ${active ? "active" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {content != null ? renderOptionBoxLabel(content) : null}
    </button>
  );
}

function BeadPickerCard({
  asset,
  active,
  disabled,
  sizeLabel,
  onClick,
  showPrice = true,
  showSizeInLabel = false,
}) {
  const cardLabel =
    showSizeInLabel && sizeLabel ? `${asset.name} · ${sizeLabel}` : asset.name;

  return (
    <button
      type="button"
      className={`beads-grid-card ${active ? "active" : ""} ${disabled ? "is-disabled" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="beads-grid-card__image-wrap">
        {asset.topViewLabel ? (
          <span className="beads-grid-card__model-token" aria-hidden="true">
            {asset.topViewLabel}
          </span>
        ) : asset.texture ? (
          <span
            className="beads-grid-card__bead-icon"
            style={{ "--bead-texture": `url("${asset.texture}")` }}
            aria-hidden="true"
          >
            <span className="beads-grid-card__bead-hole" />
          </span>
        ) : (
          <img
            src={asset.image}
            alt={cardLabel}
            draggable={false}
            decoding="async"
            loading="eager"
          />
        )}
      </span>
      <span className="beads-grid-card__label theme3-option-box-label">{cardLabel}</span>
      {showPrice && (
        <span className="beads-grid-card__meta theme3-option-box-price">
          {sizeLabel && !showSizeInLabel ? `${sizeLabel} · ` : ""}${asset.price || 8}
        </span>
      )}
    </button>
  );
}

function OptionRow({ title, children, className }) {
  const trackRef = useRef(null);
  const dragStateRef = useRef(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;

    const handlePointerMove = (event) => {
      const state = dragStateRef.current;
      if (!state || event.pointerId !== state.pointerId) return;

      const deltaX = event.clientX - state.startX;
      if (!state.moved && Math.abs(deltaX) > 4) {
        state.moved = true;
        suppressClickRef.current = true;
        track.classList.add("is-dragging");
        track.style.scrollBehavior = "auto";
      }
      if (state.moved) {
        track.scrollLeft = state.startScrollLeft - deltaX;
      }
    };

    const endDrag = (event) => {
      const state = dragStateRef.current;
      if (!state) return;
      if (event && event.pointerId !== undefined && event.pointerId !== state.pointerId) return;
      track.classList.remove("is-dragging");
      track.style.scrollBehavior = "";
      dragStateRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, []);

  const handleTrackPointerDown = (event) => {
    const track = trackRef.current;
    if (!track || (event.pointerType === "mouse" && event.button !== 0)) return;
    if (event.target.closest("button, a, input, select, textarea")) return;
    if (track.scrollWidth <= track.clientWidth + 2) return;

    suppressClickRef.current = false;
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: track.scrollLeft,
      moved: false,
    };
  };

  const handleTrackClickCapture = (event) => {
    if (suppressClickRef.current) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  return (
    <section className={`gb-option-row${className ? ` ${className}` : ""}`}>
      {title && (
        <div className="gb-option-title beads-gb-option-title">
          <span className="theme3-section-heading">{title}</span>
        </div>
      )}
      <div className="gb-option-slider">
        <div className="gb-option-track-wrap">
          <div
            className="gb-option-track"
            ref={trackRef}
            onPointerDown={handleTrackPointerDown}
            onClickCapture={handleTrackClickCapture}
          >
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

function StylePreviewThumb({ styleId }) {
  const previewSvg = resolveBeadStyle(styleId)?.previewSvg;

  if (!previewSvg) {
    return null;
  }

  return (
    <img
      src={previewSvg}
      alt=""
      className="beads-style-card__thumb-img"
      aria-hidden="true"
      draggable={false}
    />
  );
}

const BeedsControls = forwardRef(function BeedsControls({ activeSection = "jewelry", onSectionChange }, ref) {
  const t = useJewelryText("beaded");
  const storefrontControls = useStorefrontControls();
  const beadStyleLabel = (id) =>
    id === "empty" ? t("beaded.style.custom") : getBeadStyleLabel(id);
  const beadLengthLabel = (length) => length.label;
  const {
    jewelryCategory,
    setJewelryCategory,
    styleId,
    selectStyleId,
    lengthId,
    selectLengthId,
    customizeTab,
    setCustomizeTab,
    collectionId,
    setCollectionId,
    sizeId,
    setSizeId,
    selectedBeadKey,
    setSelectedBeadKey,
    selectedSeparatorKey,
    setSelectedSeparatorKey,
    selectedCharmKey,
    setSelectedCharmKey,
    selectedBead,
    isManualMode,
    isCustomizeEnabled,
    canAddMore,
    canAddBead,
    canReplaceCustomizeSlotAt,
    canApplyBeadSizeToAllPresetSlots,
    canChangePresetBeadSize,
    applyPresetBeadSizeChange,
    canAddSpacer,
    canAddCharm,
    addManualItem,
    addPresetSlotItem,
    addBraceletCharm,
    flyInAnimation,
    flyInSourceRectRef,
    removeManualItemAt,
    removePresetSlotAt,
    reorderManualItems,
    reorderPresetSlotItems,
    updateManualItemSizeAt,
    replaceCustomizeSlotAt,
    applyBeadToAllPresetBeadSlots,
    clearManualItems,
    manualItems,
    presetSlotItems,
    customizeSlotItems,
    activeSlotIndex,
    setActiveSlotIndex,
    selectSlotIndex,
    pattern,
    jewelryPrice,
    customizePrice,
    totalPrice,
    displayLengthLabel,
    setShowResetPopup,
    threadColorId,
    setThreadColorId,
    selectedThreadColor,
    threadColors,
  } = useBeedsContext();
  const { requestPreviewFocus, clearPreviewFocus } = usePreviewFocus();
  const { view360 } = useContext(View360Context);
  const { shareUrl, setShareUrl, parent } = useContext(ShareContext);

  const sectionRefs = {
    jewelry: useRef(null),
    customize: useRef(null),
  };
  const scrollContainerRef = useRef(null);
  const headerRef = useRef(null);
  const footerRef = useRef(null);
  const beadSlotRefs = useRef([]);
  const slotRowRef = useRef(null);
  const suppressBeadClickRef = useRef(false);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
  /** Same shape as bracelet charm drag: pointer offset, reset to 0 on each swap. */
  const [slotDrag, setSlotDrag] = useState(null);
  const [gridSizeFilter, setGridSizeFilter] = useState("all");
  /** Size for new beads from the picker — only set when user picks a Size (mm) filter, not on bead card click. */
  const [pickerBeadSizeId, setPickerBeadSizeId] = useState(null);
  /** Size filter for the Metalic Beads tab — "all", "8mm", or "10mm". */
  const [metalicSizeFilter, setMetalicSizeFilter] = useState(DEFAULT_METALIC_SIZE_FILTER);
  /** Size selected in the Metalic Beads picker (8mm or 10mm). */
  const [metalicBeadSizeId, setMetalicBeadSizeId] = useState(DEFAULT_METALIC_BEAD_SIZE_ID);
  const [addedToCart, setAddedToCart] = useState(false);
  const [pendingCartPayload, setPendingCartPayload] = useState(null);

  useImperativeHandle(ref, () => ({
    scrollToSection(sectionId) {
      const sectionNode = sectionRefs[sectionId]?.current;
      const container = scrollContainerRef.current;
      if (sectionNode && container) {
        const sectionTop = sectionNode.offsetTop;
        container.scrollTo({ top: sectionTop - 10, behavior: "smooth" });
      }
    },
  }));

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return undefined;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const customizeTop = sectionRefs.customize.current?.offsetTop ?? Number.MAX_SAFE_INTEGER;
      const nextSection = scrollTop >= customizeTop - 80 ? "customize" : "jewelry";
      if (nextSection !== activeSection) {
        onSectionChange?.(nextSection);
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => container.removeEventListener("scroll", handleScroll);
  }, [activeSection, onSectionChange]);

  useEffect(() => {
    if (!isSummaryExpanded) return undefined;

    const handleClickOutside = (event) => {
      const header = headerRef.current;
      const footer = footerRef.current;
      const isInsideHeader = header && header.contains(event.target);
      const isInsideFooter = footer && footer.contains(event.target);
      if (!isInsideHeader && !isInsideFooter) {
        setIsSummaryExpanded(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isSummaryExpanded]);

  const handleSummaryArrowClick = () => {
    setIsSummaryExpanded((prev) => !prev);
  };

  const scrollToSectionId = useCallback(
    (sectionId) => {
      const sectionNode = sectionRefs[sectionId]?.current;
      const container = scrollContainerRef.current;
      if (sectionNode && container) {
        container.scrollTo({ top: sectionNode.offsetTop - 10, behavior: "smooth" });
      }
      onSectionChange?.(sectionId);
    },
    [onSectionChange]
  );

  const resolveStorefrontUrl = useCallback(() => {
    const resolvedParentUrl =
      parent ||
      (typeof window !== "undefined" && window.__parentConfig?.parentUrl) ||
      (typeof window !== "undefined" && window.self !== window.top ? document.referrer : "");

    if (!resolvedParentUrl) {
      return null;
    }
    try {
      return new URL(resolvedParentUrl);
    } catch {
      return null;
    }
  }, [parent]);

  const addToCart = useCallback(() => {
    if (addedToCart) {
      return;
    }
    setAddedToCart(true);

    let media = null;
    try {
      const canvas =
        document.querySelector(".theme3-preview-pane canvas") || document.querySelector("canvas");
      if (canvas) {
        media = canvas.toDataURL("image/png");
      }
    } catch (error) {
      console.warn("Canvas snapshot failed", error);
    }

    const styleLabel = beadStyleLabel(styleId);
    const title = buildBeadPreviewLabel(pattern, {
      styleLabel,
      displayLengthLabel,
      pieceLabels: {
        bead: t("beaded.preview.bead"),
        beads: t("beaded.tab.beads"),
        spacer: t("beaded.preview.spacer"),
        spacers: t("beaded.tab.spacers"),
        charm: t("beaded.preview.charm"),
        charms: t("beaded.tab.charms"),
      },
    });
    const slotItems = isManualMode ? manualItems : presetSlotItems;

    const config = {
      type: "beads",
      flow: "BEADS",
      styleId,
      lengthId,
      threadColorId,
      sizeId,
      slotItems: serializeBeadsCartItems(slotItems),
      jewelryPrice,
      customizePrice,
      totalPrice,
    };

    let encoded;
    try {
      encoded = Base64.encode(JSON.stringify(config));
    } catch (error) {
      console.error("Failed to encode bead bracelet config:", error);
      setAddedToCart(false);
      return;
    }

    const storefrontUrl = resolveStorefrontUrl();
    const url = storefrontUrl || new URL(window.location.href);
    url.search = "";
    url.searchParams.set("config", encoded);
    const finalUrl = url.toString();

    setPendingCartPayload({
      type: "ADD_TO_CART",
      quantity: 1,
      Title: title || t("category.beadBracelet"),
      Price: totalPrice,
      Category: t("category.beadBracelet"),
      Style: styleLabel,
      Length: displayLengthLabel,
      ThreadColor: selectedThreadColor?.label || "Black",
      BeadSize: sizeId,
      Media: media,
    });
    setShareUrl(finalUrl);
  }, [
    addedToCart,
    customizePrice,
    displayLengthLabel,
    isManualMode,
    jewelryPrice,
    lengthId,
    threadColorId,
    selectedThreadColor,
    manualItems,
    pattern,
    presetSlotItems,
    resolveStorefrontUrl,
    setShareUrl,
    sizeId,
    styleId,
    t,
    totalPrice,
  ]);

  useEffect(() => {
    if (!pendingCartPayload || !shareUrl) {
      return;
    }

    let previewUrl = shareUrl;
    try {
      const shareConfigUrl = new URL(shareUrl);
      const storefrontUrl = resolveStorefrontUrl();
      const url = storefrontUrl || shareConfigUrl;
      url.search = "";
      const encodedConfig = shareConfigUrl.searchParams.get("config");
      if (encodedConfig) {
        url.searchParams.set("config", encodedConfig);
      }
      url.searchParams.set("preview", "model-only");
      previewUrl = url.toString();
    } catch (error) {
      console.warn("Failed to append preview parameter to share URL", error);
    }

    window.parent.postMessage({ ...pendingCartPayload, ModelPreviewUrl: previewUrl }, "*");
    try {
      navigator.clipboard.writeText(shareUrl);
    } catch {
      // Clipboard is optional for the parent cart handler.
    }
    setPendingCartPayload(null);
  }, [pendingCartPayload, resolveStorefrontUrl, shareUrl]);

  const footerCtaLabel = addedToCart
    ? t("beaded.cart.addingToCart")
    : view360 || activeSection !== "jewelry"
      ? t("beaded.cart.addToCart")
      : t("beaded.cart.chooseBeads");
  const footerCtaDisabled = addedToCart;

  const handleFooterContinue = () => {
    if (view360 || activeSection !== "jewelry") {
      addToCart();
      return;
    }
    scrollToSectionId("customize");
  };

  useEffect(() => {
    if (!view360) {
      return;
    }
    setActiveSlotIndex(null);
    setSlotDrag(null);
  }, [view360]);

  const filteredBeads = useMemo(() => {
    if (collectionId === "all") {
      return BEADS;
    }
    return BEADS.filter((bead) => bead.collection === collectionId);
  }, [collectionId]);

  const beadGridItems = useMemo(() => {
    if (customizeTab !== "beads") {
      return [];
    }
    return getBeadPickerGridItems(filteredBeads, gridSizeFilter);
  }, [customizeTab, filteredBeads, gridSizeFilter]);

  const metalicGridItems = useMemo(() => {
    if (customizeTab !== "metalic-beads") {
      return [];
    }
    return getMetalicBeadPickerGridItems(metalicSizeFilter);
  }, [customizeTab, metalicSizeFilter]);

  const visibleAssets =
    customizeTab === "spacers"
      ? CLASSIC_SEPARATORS
      : customizeTab === "charms"
        ? BEAD_CHARMS
        : [];

  const selectedAssetKey =
    customizeTab === "spacers"
      ? selectedSeparatorKey
      : customizeTab === "charms"
        ? selectedCharmKey
        : selectedBeadKey;

  const activeBeadSizeId = useMemo(() => {
    if (
      activeSlotIndex !== null &&
      customizeSlotItems[activeSlotIndex]?.type === "bead"
    ) {
      return customizeSlotItems[activeSlotIndex].sizeId || sizeId;
    }
    if (pickerBeadSizeId) {
      return pickerBeadSizeId;
    }
    if (gridSizeFilter !== "all") {
      return `${gridSizeFilter}mm`;
    }
    return sizeId;
  }, [activeSlotIndex, customizeSlotItems, pickerBeadSizeId, gridSizeFilter, sizeId]);

  const getFlyInSourceRect = (event) => {
    const root = event?.currentTarget;
    if (!root?.getBoundingClientRect) {
      return null;
    }
    const visual =
      root.querySelector?.(".beads-grid-card__image-wrap img, img") ?? root;
    if (visual?.getBoundingClientRect) {
      return visual.getBoundingClientRect();
    }
    return root.getBoundingClientRect();
  };

  const activeSlotItem =
    activeSlotIndex !== null && activeSlotIndex < customizeSlotItems.length
      ? customizeSlotItems[activeSlotIndex]
      : null;

  const requestFocusForCustomizeSlot = useCallback(
    (index) => {
      if (index == null || index < 0 || index >= customizeSlotItems.length) {
        return;
      }
      const slot = customizeSlotItems[index];
      if (!slot?.id) {
        return;
      }
      requestPreviewFocus({ itemId: slot.id, patternIndex: index });
    },
    [customizeSlotItems, requestPreviewFocus]
  );

  const requestFocusForPickerContext = useCallback(() => {
    if (activeSlotIndex != null) {
      requestFocusForCustomizeSlot(activeSlotIndex);
      return;
    }
    const focusType =
      customizeTab === "spacers" || customizeTab === "metalic-beads" ? "spacer" : customizeTab === "charms" ? "charm" : "bead";
    const patternIndex = pattern.findIndex((entry) => entry.type === focusType);
    if (patternIndex < 0) {
      return;
    }
    const entry = pattern[patternIndex];
    if (!entry?.id) {
      return;
    }
    requestPreviewFocus({ itemId: entry.id, patternIndex });
  }, [
    activeSlotIndex,
    customizeTab,
    pattern,
    requestFocusForCustomizeSlot,
    requestPreviewFocus,
  ]);

  const handleSlotSelect = (index) => {
    if (activeSlotIndex === index) {
      setActiveSlotIndex(null);
      clearPreviewFocus();
      return;
    }
    selectSlotIndex(index);
    requestFocusForCustomizeSlot(index);
  };

  const getCharmInsertIndex = () =>
    activeSlotIndex !== null ? activeSlotIndex + 1 : undefined;

  const isBeadPickerEntryEnabled = useCallback(
    (assetKey, beadSizeId) => {
      // Enforce per-bead size restrictions first — a new bead only available in
      // 8mm/10mm must always appear disabled for 6mm and 12mm grid cards.
      if (!isBeadSizeSupported(assetKey, beadSizeId)) {
        return false;
      }

      if (activeSlotIndex !== null && activeSlotItem) {
        if (
          activeSlotItem.type === "bead" ||
          activeSlotItem.type === "spacer" ||
          activeSlotItem.type === "charm"
        ) {
          return canReplaceCustomizeSlotAt(activeSlotIndex, {
            type: "bead",
            assetKey,
            beadSizeId,
          });
        }
      }

      if (!isManualMode && customizeSlotItems.some((item) => item.type === "bead")) {
        return canAddBead(beadSizeId, assetKey) || canChangePresetBeadSize(beadSizeId, assetKey);
      }

      return canAddBead(beadSizeId, assetKey);
    },
    [
      activeSlotIndex,
      activeSlotItem,
      canAddBead,
      canChangePresetBeadSize,
      canReplaceCustomizeSlotAt,
      customizeSlotItems,
      isManualMode,
    ]
  );

  const isSpacerPickerEntryEnabled = useCallback(
    (assetKey) => {
      if (activeSlotIndex !== null && activeSlotItem) {
        if (
          activeSlotItem.type === "spacer" ||
          activeSlotItem.type === "bead" ||
          activeSlotItem.type === "charm"
        ) {
          return canReplaceCustomizeSlotAt(activeSlotIndex, { type: "spacer", assetKey });
        }
      }
      if (
        !isManualMode &&
        activeSlotIndex === null &&
        customizeSlotItems.some((item) => item.type === "spacer")
      ) {
        return true;
      }
      return canAddSpacer();
    },
    [
      activeSlotIndex,
      activeSlotItem,
      canAddSpacer,
      canReplaceCustomizeSlotAt,
      customizeSlotItems,
      isManualMode,
    ]
  );

  const handleAssetSelect = (key, event, beadSizeIdOverride) => {
    const sourceRect = getFlyInSourceRect(event);

    if (customizeTab === "spacers") {
      const hasSpacers = customizeSlotItems.some((item) => item.type === "spacer");

      if (
        activeSlotIndex !== null &&
        activeSlotIndex < customizeSlotItems.length &&
        isSpacerPickerEntryEnabled(key)
      ) {
        replaceCustomizeSlotAt(activeSlotIndex, {
          type: "spacer",
          assetKey: key,
          sourceRect,
        });
        // Do not update selectedSeparatorKey here. It is the default used to
        // build a pristine preset, and changing it can regenerate that preset
        // when the two spacer types occupy different amounts of string.
        return;
      }

      // Presets used to apply this choice to every spacer. That made it
      // impossible to combine Classic and catalog spacers. With no explicit
      // slot selected, materialize the preset template and start from its
      // first spacer; the shopper can then select another slot to mix types.
      if (!isManualMode && activeSlotIndex === null) {
        const firstSpacerIndex =
          hasSpacers
            ? customizeSlotItems.findIndex((item) => item.type === "spacer")
            : pattern.findIndex((item) => item.type === "spacer");
        if (
          firstSpacerIndex >= 0 &&
          canReplaceCustomizeSlotAt(firstSpacerIndex, { type: "spacer", assetKey: key })
        ) {
          const replaced = replaceCustomizeSlotAt(firstSpacerIndex, {
            type: "spacer",
            assetKey: key,
            sourceRect,
          });
          if (replaced) {
            setActiveSlotIndex(firstSpacerIndex);
            requestFocusForCustomizeSlot(firstSpacerIndex);
            return;
          }
        }
      }

      requestFocusForPickerContext();
      // Only update the default spacer when this selection creates a new slot.
      setSelectedSeparatorKey(key);
      if (isManualMode) {
        addManualItem("spacer", key, sizeId, { sourceRect });
      } else if (canAddSpacer()) {
        addPresetSlotItem("spacer", key, sizeId, { sourceRect });
      }
      return;
    }

    if (customizeTab === "charms") {
      setSelectedCharmKey(key);
      if (activeSlotIndex !== null && activeSlotItem?.type === "charm") {
        replaceCustomizeSlotAt(activeSlotIndex, { type: "charm", assetKey: key, sourceRect });
        return;
      }
      requestFocusForPickerContext();
      if (canAddCharm()) {
        addBraceletCharm(key, { sourceRect, insertIndex: getCharmInsertIndex() });
      }
      return;
    }

    if (customizeTab === "metalic-beads") {
      // Metalic beads are treated as spacers in the bracelet pattern so they
      // fit naturally between stone beads. The selected size is carried via
      // beadSizeIdOverride (per-card) or falls back to metalicBeadSizeId.
      const resolvedMetalicSizeId = beadSizeIdOverride ?? metalicBeadSizeId;
      const metalicSpacerKey = METALIC_BEADS.find((mb) => mb.key === key)?.spacerKey ?? key;
      const hasSpacers = customizeSlotItems.some((item) => item.type === "spacer");

      if (
        activeSlotIndex !== null &&
        activeSlotIndex < customizeSlotItems.length &&
        isSpacerPickerEntryEnabled(metalicSpacerKey)
      ) {
        replaceCustomizeSlotAt(activeSlotIndex, {
          type: "spacer",
          assetKey: metalicSpacerKey,
          beadSizeId: resolvedMetalicSizeId,
          sourceRect,
        });
        return;
      }

      if (!isManualMode && activeSlotIndex === null) {
        const firstSpacerIndex =
          hasSpacers
            ? customizeSlotItems.findIndex((item) => item.type === "spacer")
            : pattern.findIndex((item) => item.type === "spacer");
        if (
          firstSpacerIndex >= 0 &&
          canReplaceCustomizeSlotAt(firstSpacerIndex, { type: "spacer", assetKey: metalicSpacerKey })
        ) {
          const replaced = replaceCustomizeSlotAt(firstSpacerIndex, {
            type: "spacer",
            assetKey: metalicSpacerKey,
            beadSizeId: resolvedMetalicSizeId,
            sourceRect,
          });
          if (replaced) {
            setActiveSlotIndex(firstSpacerIndex);
            requestFocusForCustomizeSlot(firstSpacerIndex);
            return;
          }
        }
      }

      requestFocusForPickerContext();
      setSelectedSeparatorKey(metalicSpacerKey);
      setMetalicBeadSizeId(resolvedMetalicSizeId);
      if (isManualMode) {
        addManualItem("spacer", metalicSpacerKey, resolvedMetalicSizeId, { sourceRect });
      } else if (canAddSpacer()) {
        addPresetSlotItem("spacer", metalicSpacerKey, resolvedMetalicSizeId, { sourceRect });
      }
      return;
    }

    const beadSizeId =
      beadSizeIdOverride ??
      (gridSizeFilter !== "all" ? `${gridSizeFilter}mm` : activeBeadSizeId);

    // Clamp to a supported size if the current size is unavailable for this bead
    // (e.g. new beads only available in 8mm/10mm, but the filter is 6mm/12mm).
    const resolvedBeadSizeId = isBeadSizeSupported(key, beadSizeId)
      ? beadSizeId
      : (BEADS.find((b) => b.key === key || b.aliases?.includes(key))?.sizes?.[0]?.id ?? beadSizeId);

    if (activeSlotIndex !== null && activeSlotItem) {
      if (
        activeSlotItem.type === "bead" ||
        activeSlotItem.type === "spacer" ||
        activeSlotItem.type === "charm"
      ) {
        if (isBeadPickerEntryEnabled(key, resolvedBeadSizeId)) {
          replaceCustomizeSlotAt(activeSlotIndex, {
            type: "bead",
            assetKey: key,
            beadSizeId: resolvedBeadSizeId,
            sourceRect,
          });
        }
        return;
      }
    }

    requestFocusForPickerContext();
    setSelectedBeadKey(key);
    if (isManualMode) {
      if (gridSizeFilter === "all" && beadSizeIdOverride) {
        setSizeId(resolvedBeadSizeId);
      }
      if (canAddBead(resolvedBeadSizeId, key)) {
        addManualItem("bead", key, resolvedBeadSizeId, { sourceRect });
      }
      return;
    }

    const hasPresetBeads = customizeSlotItems.some((item) => item.type === "bead");
    if (hasPresetBeads) {
      if (canChangePresetBeadSize(resolvedBeadSizeId, key)) {
        applyPresetBeadSizeChange(resolvedBeadSizeId, key);
      }
      return;
    }

    if (resolvedBeadSizeId !== sizeId && activeSlotIndex === null) {
      setSizeId(resolvedBeadSizeId);
      return;
    }

    if (canAddBead(resolvedBeadSizeId, key)) {
      addPresetSlotItem("bead", key, resolvedBeadSizeId, { sourceRect });
    }
  };

  const handleAddSlotClick = (event) => {
    const sourceRect = getFlyInSourceRect(event);

    if (customizeTab === "spacers" && canAddSpacer()) {
      if (isManualMode) {
        addManualItem("spacer", selectedSeparatorKey, sizeId, { sourceRect });
      } else {
        addPresetSlotItem("spacer", selectedSeparatorKey, sizeId, { sourceRect });
      }
      return;
    }

    if (customizeTab === "metalic-beads" && canAddSpacer()) {
      if (isManualMode) {
        addManualItem("spacer", selectedSeparatorKey, metalicBeadSizeId, { sourceRect });
      } else {
        addPresetSlotItem("spacer", selectedSeparatorKey, metalicBeadSizeId, { sourceRect });
      }
      return;
    }

    if (customizeTab === "charms" && canAddCharm()) {
      addBraceletCharm(selectedCharmKey, {
        sourceRect,
        insertIndex: getCharmInsertIndex(),
      });
      return;
    }

    if (canAddBead(activeBeadSizeId)) {
      if (isManualMode) {
        addManualItem("bead", selectedBeadKey, activeBeadSizeId, { sourceRect });
      } else {
        addPresetSlotItem("bead", selectedBeadKey, activeBeadSizeId, { sourceRect });
      }
    }
  };

  const charmsTabEnabled = isCharmCustomizationEnabled(styleId);
  const spacersTabEnabled = isSpacerCustomizationEnabled(styleId);
  const canAddCurrentSelection =
    customizeTab === "spacers"
      ? canAddSpacer()
      : customizeTab === "charms"
        ? canAddCharm()
        : customizeTab === "metalic-beads"
          ? canAddSpacer()
          : canAddBead(activeBeadSizeId);

  const reorderBeads = useCallback(
    (fromIndex, toIndex) => {
      if (fromIndex === toIndex) {
        return false;
      }
      const didReorder = isManualMode
        ? reorderManualItems(fromIndex, toIndex)
        : reorderPresetSlotItems(fromIndex, toIndex);
      if (didReorder) {
        setActiveSlotIndex(toIndex);
      }
      return didReorder;
    },
    [isManualMode, reorderManualItems, reorderPresetSlotItems]
  );

  useEffect(() => {
    beadSlotRefs.current.length = customizeSlotItems.length;
  }, [customizeSlotItems.length]);

  useEffect(() => {
    if (UI_HIDDEN_BEAD_STYLE_IDS.includes(styleId)) {
      selectStyleId("full-bead");
    }
  }, [styleId, selectStyleId]);

  useEffect(() => {
    if (UI_HIDDEN_CUSTOMIZE_TAB_IDS.includes(customizeTab)) {
      setCustomizeTab("beads");
    }
  }, [customizeTab, setCustomizeTab]);

  useEffect(() => {
    if (activeSlotIndex === null) {
      return;
    }
    if (!customizeSlotItems[activeSlotIndex]) {
      setActiveSlotIndex(null);
    } else if (beadSlotRefs.current[activeSlotIndex]) {
      beadSlotRefs.current[activeSlotIndex].scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [activeSlotIndex, customizeSlotItems, setActiveSlotIndex]);

  useEffect(() => {
    if (!spacersTabEnabled && (customizeTab === "spacers" || customizeTab === "metalic-beads")) {
      setCustomizeTab("beads");
    }
  }, [spacersTabEnabled, customizeTab, setCustomizeTab]);

  useLayoutEffect(() => {
    if (!flyInAnimation) {
      return undefined;
    }

    if (flyInAnimation.sourceRect) {
      return undefined;
    }

    let slotIndex = -1;
    if (flyInAnimation.itemId) {
      slotIndex = customizeSlotItems.findIndex((item) => item.id === flyInAnimation.itemId);
    }
    if (slotIndex < 0 && flyInAnimation.slotIndex != null) {
      slotIndex = flyInAnimation.slotIndex;
    }
    if (slotIndex < 0 || slotIndex >= customizeSlotItems.length) {
      return undefined;
    }

    const slot = beadSlotRefs.current[slotIndex];
    if (slot) {
      flyInSourceRectRef.current = slot.getBoundingClientRect();
    }

    return undefined;
  }, [flyInAnimation?.sessionKey, flyInAnimation?.sourceRect, customizeSlotItems, flyInSourceRectRef]);

  // Drag-to-reorder matches bracelet charm slots: follow the pointer, and on a
  // midline cross move the item and zero the offset so it sits in the new slot.
  const handleBeadPointerDown = (event, index) => {
    if (customizeSlotItems.length < 2) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (event.target.closest(".remove-slot-btn")) return;
    event.preventDefault();
    suppressBeadClickRef.current = false;
    unlockBeadsAudio();
    setSlotDrag({
      pointerId: event.pointerId,
      currentIndex: index,
      startX: event.clientX,
      offsetX: 0,
    });
  };

  useEffect(() => {
    if (!slotDrag) return undefined;

    const handlePointerMove = (event) => {
      if (event.pointerId !== slotDrag.pointerId) return;
      const deltaX = event.clientX - slotDrag.startX;

      if (!suppressBeadClickRef.current && Math.abs(deltaX) > 4) {
        suppressBeadClickRef.current = true;
      }

      setSlotDrag((prev) => (prev ? { ...prev, offsetX: deltaX } : prev));

      const slots = beadSlotRefs.current;
      for (let i = 0; i < slots.length; i += 1) {
        const el = slots[i];
        if (!el || i === slotDrag.currentIndex) continue;
        const rect = el.getBoundingClientRect();
        const midX = rect.left + rect.width / 2;
        const crossed =
          (i < slotDrag.currentIndex && event.clientX < midX) ||
          (i > slotDrag.currentIndex && event.clientX > midX);
        if (crossed) {
          reorderBeads(slotDrag.currentIndex, i);
          setSlotDrag((prev) =>
            prev ? { ...prev, currentIndex: i, startX: event.clientX, offsetX: 0 } : prev
          );
          break;
        }
      }
    };

    const endDrag = (event) => {
      if (event.pointerId !== undefined && event.pointerId !== slotDrag.pointerId) return;
      setSlotDrag(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, [slotDrag, reorderBeads]);

  const gridSizeLabel = useMemo(() => {
    if (gridSizeFilter === "all") {
      return activeBeadSizeId;
    }
    return `${gridSizeFilter}mm`;
  }, [gridSizeFilter, activeBeadSizeId]);

  const handleGridSizeFilter = (filterId) => {
    const normalizedFilterId = String(filterId).toLowerCase();
    setGridSizeFilter(normalizedFilterId);
    if (normalizedFilterId === "all") {
      setPickerBeadSizeId(null);
      return;
    }

    const nextSizeId = `${normalizedFilterId}mm`;
    setPickerBeadSizeId(nextSizeId);

    // Only apply the size change when the currently selected bead supports it.
    if (!isManualMode && customizeSlotItems.some((item) => item.type === "bead")) {
      if (isBeadSizeSupported(selectedBeadKey, nextSizeId)) {
        applyPresetBeadSizeChange(nextSizeId, selectedBeadKey);
      }
      return;
    }

    if (activeSlotIndex !== null && customizeSlotItems[activeSlotIndex]?.type === "bead") {
      const slotKey = customizeSlotItems[activeSlotIndex]?.assetKey;
      if (isBeadSizeSupported(slotKey, nextSizeId)) {
        updateManualItemSizeAt(activeSlotIndex, nextSizeId);
      }
      return;
    }

    setSizeId(nextSizeId);
  };

  const styleLabel = beadStyleLabel(styleId);
  const summaryLengthLabel = displayLengthLabel;
  const summaryQtyKeys = {
    beads: "beaded.summary.beadsQty",
    charms: "beaded.summary.charmsQty",
    spacers: "beaded.summary.spacersQty",
  };
  const footerSummaryTaxLabel = getFooterSummaryTaxLabel();
  const lengthOptions = isManualMode ? BEAD_LENGTH_OPTIONS : BEAD_LENGTHS;

  const customizeSummaryLines = useMemo(
    () => buildPatternCustomizeSummaryLines(pattern),
    [pattern]
  );

  const showCustomizeAddSlot =
    customizeTab === "charms" ? canAddCharm() : canAddCurrentSelection;

  const buildSummaryContent = isSummaryExpanded ? (
    <section className="theme3-build-summary order-summary-card" aria-label={t("summary.buildSummary")}>
      <div className="order-summary-section">
        <div className="order-summary-row">
          <span className="order-summary-title theme3-section-heading">{t("beaded.summary.string")}</span>
        </div>
        <div className="order-summary-desc">{t("beaded.summary.threadIncluded")} · {styleLabel} · {selectedThreadColor?.label || "Black"} Thread</div>
        <div className="order-summary-desc">{t("beaded.summary.lengthPrefix")} {summaryLengthLabel}</div>
      </div>
      {customizeSummaryLines.length > 0 && (
        customizeSummaryLines.map((line) => (
          <div key={line.key} className="order-summary-section order-summary-section--nested">
            <div className="order-summary-row">
              <span className="order-summary-title theme3-section-heading">
                {summaryQtyKeys[line.key]
                  ? formatCountedLabel(t(summaryQtyKeys[line.key]), line.count)
                  : line.title}
              </span>
              <span className="order-summary-price theme3-section-heading">${line.price.toLocaleString()}</span>
            </div>
            {line.detail && <div className="order-summary-desc">{line.detail}</div>}
          </div>
        ))
      )}
    </section>
  ) : null;

  return (
    <aside
      className={`theme3-configurator-panel${view360 ? " beads-controls--view-only" : ""}`}
      aria-busy={view360 ? "true" : undefined}
    >
      <div
        className={`beads-panel-edit-body${view360 ? " is-360-disabled" : ""}`}
        aria-hidden={view360 ? "true" : undefined}
      >
        <div className="theme3-panel-scroll theme3-panel-scroll--flush-top" ref={scrollContainerRef}>
        <div className="theme3-option-section" data-theme3-section="jewelry" ref={sectionRefs.jewelry}>
          <header className="theme3-jewelry-section-header">
            <span className="theme3-section-heading">{t("nav.jewelry")}</span>
          </header>
          <div
            className="jewelry-category-row jewelry-category-row--compact"
            role="tablist"
            aria-label={t("nav.jewelryAria")}
          >
            <div className="jewelry-category-row-options">
              {isJewelryShellActive() && (
                <>
                  <button
                    type="button"
                    role="tab"
                    aria-selected="false"
                    className="jewelry-category-btn theme3-option-box-label"
                    onClick={() => requestJewelryCategory("necklace")}
                  >
                    {t("category.necklace")}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected="false"
                    className="jewelry-category-btn theme3-option-box-label"
                    onClick={() => requestJewelryCategory("bracelet")}
                  >
                    {t("category.bracelet")}
                  </button>
                </>
              )}
              {BEAD_JEWELRY_CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  role="tab"
                  aria-selected={jewelryCategory === category.id}
                  className={`jewelry-category-btn theme3-option-box-label${jewelryCategory === category.id ? " active" : ""}`}
                  disabled={category.disabled}
                  onClick={() => setJewelryCategory(category.id)}
                >
                  {category.id === "bead-bracelet" ? t("category.beadBracelet") : category.label}
                </button>
              ))}
            </div>
          </div>

          <OptionRow title={t("option.style")} className="beads-style-row">
            {VISIBLE_BEAD_STYLES.map((style) => (
              <button
                key={style.id}
                type="button"
                className={`gb-card-option beads-style-card ${styleId === style.id ? "active" : ""}`}
                onClick={() => selectStyleId(style.id)}
              >
                <span className="beads-style-card__thumb">
                  <StylePreviewThumb styleId={style.id} />
                </span>
                <span className="theme3-option-box-label">{beadStyleLabel(style.id)}</span>
              </button>
            ))}
          </OptionRow>

          <OptionRow title={t("option.length")}>
            {lengthOptions.map((length) => (
              <TextOption
                key={length.id}
                active={lengthId === length.id}
                onClick={() => selectLengthId(length.id)}
              >
                <span>{beadLengthLabel(length)}</span>
              </TextOption>
            ))}
          </OptionRow>

          <OptionRow title={t("option.threadColor") || "String Color"}>
            {(threadColors || THREAD_COLORS).map((tc) => (
              <button
                key={tc.id}
                type="button"
                className={`gb-text-option gb-thread-color-option ${threadColorId === tc.id ? "active" : ""}`}
                onClick={() => setThreadColorId(tc.id)}
                title={tc.label}
              >
                <span
                  className="gb-thread-color-dot"
                  style={{
                    backgroundColor: tc.color,
                    ...(tc.id === "white" ? { border: "1px solid rgba(0,0,0,0.25)" } : {}),
                  }}
                  aria-hidden="true"
                />
                <span>{tc.label}</span>
              </button>
            ))}
          </OptionRow>
        </div>

        <div
          className="theme3-option-section"
          data-theme3-section="customize"
          ref={sectionRefs.customize}
        >
          {/*
          <header className="theme3-option-section-header">
            <h3 className="theme3-section-heading">{t("section.customize")}</h3>
          </header>

          {activeSlotItem && (
            <p className="beads-slot-replace-hint">
              {activeSlotItem.type === "bead"
                ? t("beaded.slot.replaceBead")
                : activeSlotItem.type === "spacer"
                  ? t("beaded.slot.replaceSpacer")
                  : t("beaded.slot.replaceCharm")}
            </p>
          )}

          <div
            ref={slotRowRef}
            className="selected-charms-row"
            style={{ position: "relative" }}
          >
            {customizeSlotItems.length > 0 || (isManualMode && showCustomizeAddSlot) ? (
              <>
                {showCustomizeAddSlot && (
                  <div
                    className="selected-charm-slot add-slot"
                    title={t("beaded.slot.add")}
                    role="button"
                    tabIndex={0}
                    onClick={handleAddSlotClick}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleAddSlotClick(event);
                      }
                    }}
                  >
                    <span aria-hidden="true">+</span>
                  </div>
                )}

                {customizeSlotItems.map((item, index) => {
                  const asset = resolvePatternAsset(item.type, item.assetKey);
                  const isActive = index === activeSlotIndex;
                  const isDragging = slotDrag?.currentIndex === index;

                  return (
                    <div
                      key={item.id || `slot-${index}`}
                      ref={(el) => {
                        beadSlotRefs.current[index] = el;
                      }}
                      data-slot-id={item.id || `slot-${index}`}
                      className={`selected-charm-slot ${isActive ? "active-slot" : ""} ${isDragging ? "is-dragging-slot" : ""}`}
                      onPointerDown={(event) => handleBeadPointerDown(event, index)}
                      onDragStart={(event) => event.preventDefault()}
                      onClick={() => {
                        if (suppressBeadClickRef.current) {
                          suppressBeadClickRef.current = false;
                          return;
                        }
                        handleSlotSelect(index);
                      }}
                      style={{
                        touchAction: "none",
                        userSelect: "none",
                        WebkitUserSelect: "none",
                        WebkitUserDrag: "none",
                        cursor: isDragging
                          ? "grabbing"
                          : customizeSlotItems.length >= 2
                            ? "grab"
                            : "pointer",
                        ...(isDragging
                          ? { transform: `translateX(${slotDrag.offsetX}px) scale(1.06)`, zIndex: 10, position: "relative" }
                          : { transition: "transform 150ms ease" }),
                      }}
                    >
                      {asset.topViewLabel ? (
                        <span className="beads-slot-model-token" aria-label={`Spacer ${asset.topViewLabel}`}>
                          {asset.topViewLabel}
                        </span>
                      ) : (
                        <img
                          src={asset.image}
                          alt={asset.name}
                          draggable={false}
                          style={{ WebkitUserDrag: "none", pointerEvents: "none" }}
                        />
                      )}
                      {item.type === "bead" && (
                        <span className="beads-slot-size-label">{item.sizeId || sizeId}</span>
                      )}
                      {item.type === "charm" && (
                        <span className="beads-slot-size-label">{t("beaded.preview.charm")}</span>
                      )}
                      <button
                        type="button"
                        className="remove-slot-btn"
                        aria-label={t({
                          bead: "beaded.slot.removeBead",
                          spacer: "beaded.slot.removeSpacer",
                          charm: "beaded.slot.removeCharm",
                        }[item.type] || "") || `Remove ${item.type}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (isManualMode) {
                            removeManualItemAt(index);
                          } else {
                            removePresetSlotAt(index);
                          }
                          setActiveSlotIndex((prev) => {
                            if (prev === null) return null;
                            if (prev === index) return null;
                            if (prev > index) return prev - 1;
                            return prev;
                          });
                        }}
                      >
                        &times;
                      </button>
                    </div>
                  );
                })}


                {isManualMode && manualItems.length > 0 && (
                  <button
                    type="button"
                    className="clear-all-charms-btn"
                    title={t("beaded.slot.removeAll")}
                    aria-label={t("beaded.slot.removeAll")}
                    onClick={() => {
                      clearManualItems();
                      setActiveSlotIndex(null);
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                  </button>
                )}
              </>
            ) : (
              <p className="beads-slot-replace-hint">
                {isManualMode
                  ? t("beaded.slot.emptyManual")
                  : t("beaded.slot.emptyPreset")}
              </p>
            )}
          </div>
*/}
          <OptionRow title={t("option.category")} className="beads-customize-tabs">
            {customizeTabsShownInUi.map((tab) => (
              <TextOption
                key={tab.id}
                active={customizeTab === tab.id}
                label={t(BEAD_TAB_KEYS[tab.id] || "") || tab.label}
                disabled={
                  (tab.id === "spacers" && !spacersTabEnabled) ||
                  (tab.id === "charms" && !charmsTabEnabled) ||
                  (tab.id === "metalic-beads" && !spacersTabEnabled)
                }
                onClick={() => setCustomizeTab(tab.id)}
              />
            ))}
          </OptionRow>

          {(customizeTab === "beads" || customizeTab === "spacers" || customizeTab === "charms" || customizeTab === "metalic-beads") && (
            <div className="beads-customize-picker">
              {customizeTab === "beads" && (
                <div className="beads-picker-filters">
                  <div className="beads-picker-filter beads-picker-filter--type">
                    <span className="beads-picker-filter__label theme3-section-heading">{t("beaded.filter.type")}</span>
                    <div className="beads-picker-type-select-wrap">
                      <select
                        className="beads-picker-type-select theme3-option-box-label"
                        value={collectionId}
                        onChange={(event) => setCollectionId(event.target.value)}
                        aria-label={t("beaded.filter.typeAria")}
                      >
                        {BEAD_COLLECTIONS.map((collection) => (
                          <option key={collection.id} value={collection.id}>
                            {collection.id === "all" ? t("beaded.filter.all") : collection.label}
                          </option>
                        ))}
                      </select>
                      <span className="beads-picker-type-select__chevron" aria-hidden="true">
                        <svg viewBox="0 0 12 8" fill="none">
                          <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    </div>
                  </div>

                  <div className="beads-picker-filter beads-picker-filter--size">
                    <span className="beads-picker-filter__label theme3-section-heading">{t("beaded.filter.size")}</span>
                    <div className="beads-picker-size-options">
                      {BEAD_GRID_SIZE_FILTERS.map((filter) => {
                        const isActive = gridSizeFilter === filter.id;

                        return (
                          <button
                            key={filter.id}
                            type="button"
                            className={`beads-picker-size-btn theme3-option-box-label ${isActive ? "active" : ""}`}
                            onClick={() => handleGridSizeFilter(filter.id)}
                          >
                            {filter.id === "all" ? t("beaded.filter.all") : filter.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {customizeTab === "metalic-beads" && (
                <div className="beads-picker-filters beads-picker-filters--metalic">
                  <div className="beads-picker-filter beads-picker-filter--spacer" aria-hidden="true" />
                  <div className="beads-picker-filter beads-picker-filter--size">
                    <span className="beads-picker-filter__label theme3-section-heading">{t("beaded.filter.size")}</span>
                    <div className="beads-picker-size-options">
                      {METALIC_BEAD_SIZE_FILTERS.map((filter) => {
                        const isActive = metalicSizeFilter === filter.id;

                        return (
                          <button
                            key={filter.id}
                            type="button"
                            className={`beads-picker-size-btn theme3-option-box-label ${isActive ? "active" : ""}`}
                            onClick={() => {
                              const normalizedId = String(filter.id).toLowerCase();
                              setMetalicSizeFilter(normalizedId);
                              if (normalizedId !== "all") {
                                const nextSizeId = normalizedId.endsWith("mm") ? normalizedId : `${normalizedId}mm`;
                                setMetalicBeadSizeId(nextSizeId);
                              }
                            }}
                          >
                            {filter.id === "all" ? t("beaded.filter.all") : filter.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              <div className="beads-asset-grid-section">
                <div
                  className={`beads-asset-grid ${
                    customizeTab === "spacers" || customizeTab === "metalic-beads"
                      ? "beads-asset-grid--spacers"
                      : customizeTab === "charms"
                        ? "beads-asset-grid--charms"
                        : "beads-asset-grid--picker"
                  }`}
                >
                  {customizeTab === "beads"
                    ? beadGridItems.map((entry) => (
                        <BeadPickerCard
                          key={entry.key}
                          asset={entry.asset}
                          active={
                            (activeSlotItem?.type === "bead" &&
                              activeSlotIndex !== null &&
                              customizeSlotItems[activeSlotIndex]?.assetKey === entry.asset.key &&
                              (customizeSlotItems[activeSlotIndex]?.sizeId || sizeId) === entry.sizeId) ||
                            ((activeSlotIndex === null || activeSlotItem?.type !== "bead") &&
                              selectedBeadKey === entry.asset.key &&
                              entry.sizeId === activeBeadSizeId)
                          }
                          disabled={!isBeadPickerEntryEnabled(entry.asset.key, entry.sizeId)}
                          sizeLabel={entry.sizeLabel}
                          showSizeInLabel={entry.showSizeInLabel}
                          showPrice
                          onClick={(event) => handleAssetSelect(entry.asset.key, event, entry.sizeId)}
                        />
                      ))
                    : customizeTab === "metalic-beads"
                      ? metalicGridItems.map((entry) => (
                          <BeadPickerCard
                            key={entry.key}
                            asset={entry.asset}
                            active={
                              (activeSlotIndex !== null &&
                                activeSlotItem?.type === "spacer" &&
                                customizeSlotItems[activeSlotIndex]?.assetKey === entry.asset.spacerKey &&
                                (customizeSlotItems[activeSlotIndex]?.sizeId || metalicBeadSizeId) === entry.sizeId) ||
                              ((activeSlotIndex === null || activeSlotItem?.type !== "spacer") &&
                                selectedSeparatorKey === entry.asset.spacerKey &&
                                entry.sizeId === metalicBeadSizeId)
                            }
                            disabled={!isSpacerPickerEntryEnabled(entry.asset.spacerKey)}
                            sizeLabel={entry.sizeLabel}
                            showSizeInLabel={false}
                            showPrice
                            onClick={(event) => handleAssetSelect(entry.asset.key, event, entry.sizeId)}
                          />
                        ))
                      : visibleAssets.map((asset) => (
                          <BeadPickerCard
                            key={asset.key}
                            asset={asset}
                            active={
                              customizeTab === "charms"
                                ? (activeSlotItem?.type === "charm" &&
                                    activeSlotIndex !== null &&
                                    customizeSlotItems[activeSlotIndex]?.assetKey === asset.key) ||
                                  (activeSlotIndex === null && selectedAssetKey === asset.key)
                                : customizeTab === "spacers"
                                  ? (activeSlotIndex !== null &&
                                      activeSlotItem?.type === "spacer" &&
                                      customizeSlotItems[activeSlotIndex]?.assetKey === asset.key) ||
                                    (activeSlotIndex === null && selectedSeparatorKey === asset.key)
                                  : selectedAssetKey === asset.key
                            }
                            disabled={
                              customizeTab === "charms"
                                ? !canAddCharm() &&
                                  !(activeSlotItem?.type === "charm" && activeSlotIndex !== null)
                                : customizeTab === "spacers"
                                  ? !isSpacerPickerEntryEnabled(asset.key)
                                  : !canAddCurrentSelection
                            }
                            sizeLabel={
                              customizeTab === "spacers" || customizeTab === "charms"
                                ? null
                                : gridSizeLabel
                            }
                            showPrice={
                              customizeTab === "beads" ||
                              customizeTab === "charms" ||
                              customizeTab === "spacers"
                            }
                            onClick={(event) => handleAssetSelect(asset.key, event)}
                          />
                        ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>

      <footer className="theme3-panel-footer" ref={footerRef}>
        <div className="theme3-footer-build-summary">{buildSummaryContent}</div>

        <div className="theme3-footer-main">
          <div className="theme3-summary-info">
            <button
              type="button"
              className="theme3-summary-details-toggle"
              aria-label={isSummaryExpanded ? t("summary.hideDetails") : t("summary.viewDetails")}
              aria-expanded={isSummaryExpanded}
              onClick={handleSummaryArrowClick}
            >
              <span className="theme3-link-text">{isSummaryExpanded ? t("summary.hideDetails") : t("summary.viewDetails")}</span>
              <svg
                className={`theme3-summary-toggle-arrow theme3-link-text${isSummaryExpanded ? " is-expanded" : ""}`}
                xmlns="http://www.w3.org/2000/svg"
                width="8"
                height="5"
                viewBox="0 0 8 5"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M8 4.29102C8 4.40075 7.95549 4.5005 7.86648 4.5803C7.68846 4.7399 7.38804 4.7399 7.21001 4.5803L4.00556 1.70748L0.789986 4.5803C0.611961 4.7399 0.311544 4.7399 0.133519 4.5803C-0.0445063 4.4207 -0.0445063 4.15137 0.133519 3.99177L3.67177 0.819701C3.84979 0.660101 4.15021 0.660101 4.32823 0.819701L7.86648 3.99177C7.95549 4.07157 8 4.1813 8 4.28105V4.29102Z"
                  fill="currentColor"
                />
              </svg>
            </button>

            <div className="theme3-summary-price-row">
              <strong className="theme3-summary-price theme3-section-heading">${totalPrice.toLocaleString()}</strong>
              {footerSummaryTaxLabel ? (
                <span className="theme3-summary-tax-label theme3-body-text">{footerSummaryTaxLabel}</span>
              ) : null}
            </div>
          </div>

          <div className="theme3-footer-actions">
            {(!view360 && activeSection === "jewelry") || storefrontControls.addToCart ? (
            <button
              type="button"
              className="theme3-panel-footer-cta"
              disabled={footerCtaDisabled}
              onClick={handleFooterContinue}
              aria-busy={addedToCart}
            >
              {footerCtaLabel}
            </button>
            ) : null}

            <div className="theme3-footer-secondary-actions">
              <button type="button" className="theme3-panel-action-btn theme3-panel-share-btn">
                {t("action.share")}
              </button>
              {storefrontControls.reset ? (
              <button
                type="button"
                className="theme3-panel-action-btn theme3-panel-reset-btn"
                onClick={() => setShowResetPopup(true)}
                aria-label={t("action.resetBraceletConfiguration")}
              >
                {t("action.reset")}
              </button>
              ) : null}
            </div>
          </div>
        </div>
      </footer>
    </aside>
  );
});

export default BeedsControls;
