/**
 * Ring UI copy from appearance-page `translations.strings`.
 * Missing keys, or a response with no translations block, keep the built-in English.
 */

export const DEFAULT_UI_STRINGS = Object.freeze({
  "shell.shareTitle": "Jewelith Ring Configuration",
  "shell.demoOnlyBadge": "Demo Only",
  "nav.section.stone": "Stone",
  "nav.section.head": "Head",
  "nav.section.shank": "Shank",
  "guide.feature.chooseDiamond": "Choose Diamond",
  "guide.meta.buildSummary": "Build Summary",
  "guide.meta.metalPurity": "Metal & Purity",
  "guide.meta.cutClarity": "Cut / Clarity",
  "ringType.engagement": "Engagement",
  "ringType.wedding": "Wedding",
  "ringType.ariaLabel": "Ring Type",
  "option.ring": "Ring",
  "option.band": "BAND",
  "option.bandCoverage": "Band Coverage",
  "option.bandWidth": "Band Width",
  "option.metal": "Metal",
  "option.purity": "Purity",
  "option.matchingBand": "Matching Band",
  "option.biMetal": "Bi-metal",
  "option.shape": "Shape",
  "option.secondShape": "Second Shape",
  "option.carat": "Carat",
  "option.sideStone": "Side Stone",
  "option.sideStoneColor": "Side Stone Color",
  "option.category": "Category",
  "option.coloredDiamond": "Colored Diamond",
  "option.intensity": "Intensity",
  "option.gemstone": "Gemstone",
  "option.quality": "Quality",
  "option.ringStyleAndDesign": "Ring Style & Design",
  "option.setting": "Setting",
  "option.ringMetal": "Ring Metal",
  "option.ringSize": "Ring Size",
  "bandCoverage.half": "1/2",
  "bandCoverage.threeQuarters": "3/4",
  "bandCoverage.full": "Full",
  "stone.category.colorlessLab": "Colorless Lab Grown",
  "stone.category.colorlessNatural": "Colorless Natural",
  "stone.category.coloredLab": "Colored Lab Grown",
  "stone.category.gemstones": "Gemstones",
  "stone.quality.standard": "Standard",
  "stone.quality.premium": "Premium",
  "stone.quality.highEnd": "High-End",
  "matchingBand.plain": "Plain",
  "matchingBand.channel": "Channel",
  "matchingBand.pave": "Pave",
  "engraving.title": "Engraving",
  "engraving.unavailableNote": "This band style doesn't have a plain inner surface, so engraving is unavailable for it.",
  "engraving.placeholder": "Enter up to 15 characters",
  "engraving.fontStyleLegend": "Font style",
  "engraving.symbolsLegend": "Insert symbols",
  "engraving.font.roman": "Roman",
  "engraving.font.script": "Script",
  "engraving.font.italics": "Italics",
  "engraving.clearAria": "Clear engraving",
  "engraving.none": "None",
  "sizes.sizeGuideLink": "Size Guide",
  "sizes.diameterMm": "mm",
  "summary.ring": "Ring",
  "summary.band": "Band",
  "summary.stone": "Stone",
  "summary.stone1": "Stone 1",
  "summary.stone2": "Stone 2",
  "summary.sizePrefix": "Size:",
  "summary.engravingPrefix": "Engraving:",
  "summary.viewDetails": "View details",
  "summary.hideDetails": "Hide details",
  "summary.buildSummary": "Build Summary",
  "cart.addToCart": "Add To Cart",
  "cart.addingToCart": "Adding To Cart...",
  "action.share": "Share",
  "action.shareConfiguration": "Share configuration",
  "action.shareCopied": "URL Copied",
  "action.reset": "Reset",
  "action.resetConfiguration": "Reset ring configuration",
  "action.changeView": "Change view",
  "action.close": "Close",
  "reset.title": "Reset Ring?",
  "reset.body": "This will clear all your custom selections.",
  "reset.confirm": "Confirm Reset",
  "preview.ringConfigurator": "RING CONFIGURATOR",
  "preview.summary": "SUMMARY",
});

const STONE_CATEGORY_KEYS = Object.freeze({
  "Colorless Lab Grown": "stone.category.colorlessLab",
  "Colorless Natural": "stone.category.colorlessNatural",
  "Colored Lab Grown": "stone.category.coloredLab",
  Gemstones: "stone.category.gemstones",
});

const QUALITY_KEYS = Object.freeze({
  Standard: "stone.quality.standard",
  Premium: "stone.quality.premium",
  "High-End": "stone.quality.highEnd",
});

const MATCHING_BAND_KEYS = Object.freeze({
  PLAIN: "matchingBand.plain",
  CHANNEL: "matchingBand.channel",
  "PLATE-PRONG": "matchingBand.pave",
});

const ENGRAVING_FONT_KEYS = Object.freeze({
  "Times New Roman": "engraving.font.roman",
  "Dancing Script": "engraving.font.script",
  "Segoe UI": "engraving.font.italics",
});

export const GUIDE_LABEL_KEYS = Object.freeze({
  "center-stone-shape": "nav.section.stone",
  "side-stone-shape": "option.sideStone",
  "stone-type": "option.category",
  "target-carat": "option.carat",
  "cut-clarity": "guide.meta.cutClarity",
  "colored-diamond": "option.coloredDiamond",
  gemstone: "option.gemstone",
  "setting-head": "nav.section.head",
  "bi-metal": "option.biMetal",
  band: "nav.section.shank",
  "ring-size": "option.ringSize",
  "metal-purity": "guide.meta.metalPurity",
  engraving: "engraving.title",
  "build-summary": "guide.meta.buildSummary",
  "choose-diamond": "guide.feature.chooseDiamond",
});

export function extractTranslationBlock(block) {
  if (!block || typeof block !== "object") return null;

  const source = block.strings;
  if (!source || typeof source !== "object") return null;

  const strings = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "string" && value.trim()) strings[key] = value;
  }

  if (!Object.keys(strings).length) return null;

  return {
    languageCode: typeof block.languageCode === "string" ? block.languageCode.trim() : "",
    strings,
  };
}

export function extractUiTranslations(response) {
  return extractTranslationBlock(response?.translations);
}

export function hasApiUiString(translations, key) {
  const value = translations?.strings?.[key];
  return typeof value === "string" && value.trim().length > 0;
}

export function resolveUiString(translations, key) {
  if (hasApiUiString(translations, key)) return translations.strings[key];
  return DEFAULT_UI_STRINGS[key] ?? "";
}

export function stoneCategoryKey(label) {
  return STONE_CATEGORY_KEYS[label] || "";
}

export function qualityKey(quality) {
  return QUALITY_KEYS[quality] || "";
}

export function matchingBandKey(style) {
  return MATCHING_BAND_KEYS[style] || "";
}

export function engravingFontKey(fontValue) {
  return ENGRAVING_FONT_KEYS[fontValue] || "";
}
