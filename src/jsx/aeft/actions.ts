import { alertError } from "./errors"
import { expFlipCard, expPos, expRot, expScale, expStockFlip, expStockPos } from "../utils/expressions"
import { captureCompState, findAvItemByName, findCompItemByName, findFolderItemByName, findFootageItemByName, getActiveComp, forEachLayer, requireActiveComp, restoreCompState } from "./aeft-utils"
import {
  getTargetLayer,
  targetExist,
  namedMarkerExists,
  findCardLayers,
  removePropertyKeyframesByLabel,
  filterLayerMarkersByLabelAndComment,
  getMarkerCommentTitle,
  getLayerCardTag
} from "./cards-utils"
import {
  getLayerProp,
  addMarkerToLayer,
  selectAllSelectedLayers,
  deselectAllSelectedLayers,
  forEachSelectedLayer,
  fxExistsByMatchName,
  LayerMarkerMeta,
  getLayerMarkersMetadata,
  setExpressionSafely,
} from "./aeft-utils-jonatan"
import { buildMarkerComment, parseMarkerComment } from "./markers"


export const keyLabel = {
  red: 1,
  yellow: 2,
  acqua: 3,
  pink: 4,
  lavander: 5,
  peach: 6,
  seaFoam: 7,
  blue: 8,
  green: 9,
  purple: 10,
  orange: 11,
  brown: 12,
  fuschia: 13,
  cyan: 14,
  sandstone: 15,
  darkGreen: 16
} as const

const cardFxMatchName = "Pseudo/cards_gameplay_superplay"
export const cardsControlFxMatchName = "Pseudo/cards_gameplay_control"
export const cardsControlPresetFileName = "cards-gameplay-control.ffx"
const fxPrecompName = "FX Precomp"
const legacySfxPrecompName = "SFX Precomp"
const cardsAssetsFolderName = "Disney Solitaire Cards"
const plusCardSourceName = "Plus_Card"
const expressionLibName = "superplay-expression-lib.jsx"
const cardsControlsLayerName = "Cards Controls"
const cardsControlFxDisplayName = "Cards Gameplay Control"
const cardsGroupControlLayerName = "Cards Group Control"
const cardsLayoutOriginSchema = "cards-gameplay.layout-origin.v1"
const coinVfxLayerNamePrefix = "Coin VFX"
const defaultCoinValueSequence = ["02", "04", "06", "08", "10", "15", "20", "25"]
const jumpSfxFilePrefix = "jump_sfx_"
const jumpSfxFileExtension = ".wav"
const jumpSfxMaxScanCount = 99
const flipStockSfxFileName = "flip-stock_sfx_01.wav"
const markerTimeTolerance = 0.0001

type CardsControlSlider = {
  name: string;
  expected: string;
}

const cardsControlsSliders: CardsControlSlider[] = [
  { name: "Global Z Step", expected: "0.05" },
  { name: "Stock Spacing X", expected: "inferred from current stock spacing" },
  { name: "Stock Arc Height", expected: "29" },
  { name: "Stock Move Mid Frames", expected: "6" },
  { name: "Stock Move End Frames", expected: "11" },
  { name: "Stock Shift Delay Frames", expected: "2" },
  { name: "Stock Shift Duration Frames", expected: "11" },
  { name: "Stock Flip Start Frames", expected: "2" },
  { name: "Stock Flip End Frames", expected: "17" },
] 

const jumpCardsControlsSliders: string[] = ["Global Z Step"]
const stockCardsControlsSliders: string[] = [
  "Global Z Step",
  "Stock Spacing X",
  "Stock Arc Height",
  "Stock Move Mid Frames",
  "Stock Move End Frames",
  "Stock Shift Delay Frames",
  "Stock Shift Duration Frames",
  "Stock Flip Start Frames",
  "Stock Flip End Frames",
]

const actionLabelColor = keyLabel.green
const anticipationLabelColor = keyLabel.yellow

const transformGroupMatchName = "ADBE Transform Group"
const essentialPropertiesMatchName = "ADBE Layer Overrides"
const layerEffect = "ADBE Effect Parade"

export const markerPropPath = "ADBE Marker"
export const posPropPath = [transformGroupMatchName, "ADBE Position"] as const
export const zRotPropPath = [transformGroupMatchName, "ADBE Rotate Z"] as const
export const scalePropPath = [transformGroupMatchName, "ADBE Scale"] as const
export const anchorPropPath = [transformGroupMatchName, "ADBE Anchor Point"] as const

export const flipCardEssPropPath = [essentialPropertiesMatchName, "Flip Card"] as const
export const cardOptionEPPath = [essentialPropertiesMatchName, "Card Option"] as const
export const progressBarEPPath = [essentialPropertiesMatchName, "Bar Control"] as const

export const textPropPath = ["ADBE Text Properties", "ADBE Text Document"] as const

export const superplayCardEffect = [layerEffect, cardFxMatchName]


//================================= TABLEAU JUMP ACTIONS

const removeCardTagsFromLayerName = (layerName: string): string => {
  let cleanName = String(layerName || "");
  const tagsList = ["TARGET", "STOCK", "TABLEAU"];

  for (let i = 0; i < tagsList.length; i++) {
    const tagName = tagsList[i];
    const tagPattern = new RegExp("\\s*\\[" + tagName + "\\]");
    cleanName = cleanName.replace(tagPattern, "");
  }

  return cleanName;
}

const syncFxPrecompSettings = (fxPrecomp: CompItem, parentComp: CompItem) => {
  try { (fxPrecomp as any).width = parentComp.width; } catch (_) { }
  try { (fxPrecomp as any).height = parentComp.height; } catch (_) { }
  try { fxPrecomp.pixelAspect = parentComp.pixelAspect; } catch (_) { }
  try { fxPrecomp.duration = parentComp.duration; } catch (_) { }
  try { fxPrecomp.frameRate = parentComp.frameRate; } catch (_) { }
}

const moveProjectItemToFolderIfExists = (projectItem: any, folderName: string): void => {
  if (!projectItem) return;

  try {
    const folder = findFolderItemByName(folderName, false);
    if (folder && projectItem.parentFolder !== folder) projectItem.parentFolder = folder;
  } catch (_) { }
}

const ensureFxPrecomp = (parentComp?: CompItem): CompItem => {
  const thisComp = parentComp || getActiveComp() as CompItem;
  let fxPrecomp = findCompItemByName(fxPrecompName, false) as CompItem

  if (!fxPrecomp) {
    fxPrecomp = findCompItemByName(legacySfxPrecompName, false) as CompItem
    if (fxPrecomp) fxPrecomp.name = fxPrecompName;
  }

  if (!fxPrecomp) {
    const { width, height, pixelAspect, duration, frameRate } = thisComp
    //@ts-ignore
    fxPrecomp = app.project.items.addComp(fxPrecompName, width, height, pixelAspect, duration, frameRate);
  } else {
    syncFxPrecompSettings(fxPrecomp, thisComp);
  }

  moveProjectItemToFolderIfExists(fxPrecomp, cardsAssetsFolderName);

  return fxPrecomp
}

const findPrecompBySourceName = (comp: CompItem, sourceName: string): AVLayer | null => {
  for (let i = 1; i <= comp.numLayers; i++) {
    const layer = comp.layer(i) as AVLayer;
    const src = (layer as any).source as any;

    if (src && src.name === sourceName) {
      return layer;
    }
  }
  return null;
};

const findPrecompBySourceItem = (comp: CompItem, sourceItem: CompItem): AVLayer | null => {
  for (let i = 1; i <= comp.numLayers; i++) {
    const layer = comp.layer(i) as AVLayer;
    const src = (layer as any).source as any;

    if (src && src === sourceItem) {
      return layer;
    }
  }
  return null;
};

const textContains = (textValue: string, searchValue: string): boolean => {
  const text = String(textValue || "");
  const search = String(searchValue || "");
  if (search.length === 0) return true;
  if (search.length > text.length) return false;

  for (let i = 0; i <= text.length - search.length; i++) {
    let matches = true;

    for (let j = 0; j < search.length; j++) {
      if (text.charAt(i + j) !== search.charAt(j)) {
        matches = false;
        break;
      }
    }

    if (matches) return true;
  }

  return false;
}

const getFileNameFromPath = (filePath: string): string => {
  const pathText = String(filePath || "");
  let lastSeparatorIndex = -1;

  for (let i = 0; i < pathText.length; i++) {
    const char = pathText.charAt(i);
    if (char === "/" || char === "\\") lastSeparatorIndex = i;
  }

  return pathText.substring(lastSeparatorIndex + 1);
}

const getFolderPathFromFilePath = (filePath: string | undefined): string => {
  const pathText = String(filePath || "");
  let lastSeparatorIndex = -1;

  for (let i = 0; i < pathText.length; i++) {
    const char = pathText.charAt(i);
    if (char === "/" || char === "\\") lastSeparatorIndex = i;
  }

  return lastSeparatorIndex < 0 ? "" : pathText.substring(0, lastSeparatorIndex);
}

const joinPath = (folderPath: string | undefined, fileName: string): string => {
  const folder = String(folderPath || "");
  if (folder === "") return fileName;

  const lastChar = folder.charAt(folder.length - 1);
  return lastChar === "/" || lastChar === "\\"
    ? `${folder}${fileName}`
    : `${folder}/${fileName}`;
}

const getNumberedSfxFileName = (prefix: string, fileNumber: number): string => {
  const numberText = fileNumber < 10
    ? `0${fileNumber}`
    : String(fileNumber);

  return `${prefix}${numberText}${jumpSfxFileExtension}`;
}

const normalizeCoinValue = (coinValue: string | undefined): string => {
  const valueText = String(coinValue || "").replace(/^\s+|\s+$/g, "");
  if (valueText === "") return "";

  const match = valueText.match(/\d+/);
  const digits = match ? match[0] : valueText;
  const parsed = parseInt(digits, 10);

  if (!isNaN(parsed) && parsed > 0 && parsed < 10 && digits.length === 1) {
    return `0${parsed}`;
  }

  return digits;
}

const getCoinValueFromFilePath = (coinFilePath: string | undefined): string => {
  const fileName = getFileNameFromPath(String(coinFilePath || ""));
  const match = fileName.match(/coin_plus-([^\.]+)\.mov$/i);

  return match ? normalizeCoinValue(match[1]) : "";
}

const addUniqueNormalizedCoinValue = (coinValues: string[], coinValue: string | undefined): void => {
  const normalizedCoinValue = normalizeCoinValue(coinValue);
  if (normalizedCoinValue === "") return;

  for (let i = 0; i < coinValues.length; i++) {
    if (coinValues[i] === normalizedCoinValue) return;
  }

  coinValues.push(normalizedCoinValue);
}

const getDefaultCoinValueSequence = (): string[] => {
  const values: string[] = [];

  for (let i = 0; i < defaultCoinValueSequence.length; i++) {
    values.push(defaultCoinValueSequence[i]);
  }

  return values;
}

const getCoinValueSequence = (baseCoinFilePath: string | undefined): string[] => {
  const coinFolderPath = getFolderPathFromFilePath(baseCoinFilePath);
  const values: string[] = [];

  if (coinFolderPath !== "") {
    try {
      const coinFolder = new Folder(coinFolderPath);
      if (coinFolder.exists) {
        const coinFiles = coinFolder.getFiles("coin_plus-*.mov");

        for (let i = 0; i < coinFiles.length; i++) {
          const coinFile = coinFiles[i];
          const coinFileName = coinFile instanceof File
            ? coinFile.name
            : getFileNameFromPath(String(coinFile));
          const match = coinFileName.match(/coin_plus-([^\.]+)\.mov$/i);

          if (match) addUniqueNormalizedCoinValue(values, match[1]);
        }
      }
    } catch (_) { }
  }

  if (values.length === 0) return getDefaultCoinValueSequence();

  values.sort((a, b) => {
    const aNumber = parseInt(a, 10);
    const bNumber = parseInt(b, 10);

    if (!isNaN(aNumber) && !isNaN(bNumber) && aNumber !== bNumber) {
      return aNumber - bNumber;
    }

    return a < b ? -1 : a > b ? 1 : 0;
  });

  return values;
}

const getCoinValueForSequence = (
  baseCoinFilePath: string | undefined,
  sequenceIndex: number,
  fallbackCoinValue?: string
): string => {
  const coinValues = getCoinValueSequence(baseCoinFilePath);
  const safeSequenceIndex = sequenceIndex < 1 ? 1 : Math.floor(sequenceIndex);

  if (coinValues.length > 0) {
    const wrappedIndex = ((safeSequenceIndex - 1) % coinValues.length);
    return coinValues[wrappedIndex];
  }

  return normalizeCoinValue(fallbackCoinValue) || getCoinValueFromFilePath(baseCoinFilePath);
}

const getCoinFilePathForValue = (baseCoinFilePath: string | undefined, coinValue: string | undefined): string | undefined => {
  const normalizedCoinValue = normalizeCoinValue(coinValue);
  if (normalizedCoinValue === "") return baseCoinFilePath;

  const coinFolderPath = getFolderPathFromFilePath(baseCoinFilePath);
  if (coinFolderPath === "") return baseCoinFilePath;

  return joinPath(coinFolderPath, `coin_plus-${normalizedCoinValue}.mov`);
}

const getJumpSfxVariationCount = (sfxFolderPath?: string): number => {
  const folderPath = String(sfxFolderPath || "");
  if (folderPath === "") return 1;

  let variationCount = 0;

  for (let i = 1; i <= jumpSfxMaxScanCount; i++) {
    const fileName = getNumberedSfxFileName(jumpSfxFilePrefix, i);
    const sfxFile = new File(joinPath(folderPath, fileName));

    if (!sfxFile.exists) break;
    variationCount = i;
  }

  return variationCount > 0 ? variationCount : 1;
}

const getJumpSfxFileNameForSequence = (sfxFolderPath: string | undefined, sequenceIndex: number): string => {
  const variationCount = getJumpSfxVariationCount(sfxFolderPath);
  const safeSequenceIndex = sequenceIndex < 1 ? 1 : Math.floor(sequenceIndex);
  const wrappedIndex = ((safeSequenceIndex - 1) % variationCount) + 1;

  return getNumberedSfxFileName(jumpSfxFilePrefix, wrappedIndex);
}

const ensureFootageItem = (filePath: string, missingLabel: string): FootageItem | null => {
  const itemName = getFileNameFromPath(filePath);
  const existingItem = findFootageItemByName(itemName, false);

  if (existingItem && existingItem instanceof FootageItem) return existingItem;

  const file = new File(filePath);
  if (!file.exists) {
    alert(`${missingLabel} file not found:\n${filePath}`);
    return null;
  }

  const importOptions = new ImportOptions(file);
  const importedItem = app.project.importFile(importOptions) as FootageItem;
  importedItem.name = itemName;

  return importedItem;
}

const footageItemUsesFile = (item: FootageItem, file: File): boolean => {
  try {
    const itemFile = (item as any).file as File;
    return !!(itemFile && itemFile.fsName === file.fsName);
  } catch (_) { }

  return false;
}

const ensureFxPrecompLayer = (comp: CompItem): AVLayer => {
  const fxPrecomp = ensureFxPrecomp(comp);
  let fxPrecompRef = findPrecompBySourceItem(comp, fxPrecomp);

  if (!fxPrecompRef) fxPrecompRef = findPrecompBySourceName(comp, fxPrecompName);
  if (!fxPrecompRef) fxPrecompRef = findPrecompBySourceName(comp, legacySfxPrecompName);

  if (!fxPrecompRef) {
    fxPrecompRef = comp.layers.add(fxPrecomp) as AVLayer;
  }

  fxPrecompRef.locked = false;
  fxPrecompRef.name = fxPrecompName;
  fxPrecompRef.label = keyLabel.brown;
  fxPrecompRef.enabled = true;
  fxPrecompRef.guideLayer = false;
  fxPrecompRef.shy = false;
  fxPrecompRef.selected = false;
  fxPrecompRef.startTime = 0;
  try { fxPrecompRef.threeDLayer = false; } catch (_) { }
  fxPrecompRef.locked = true;

  return fxPrecompRef;
}

const applySfx = (comp: CompItem, sfxTime: number, sfxFilePath: string, labelColor: number) => {
  const fxPrecompRef = ensureFxPrecompLayer(comp);

  const sfxFile = ensureFootageItem(sfxFilePath, "SFX");
  if (!sfxFile) {
    return;
  }

  const sfxLayerItem = (fxPrecompRef.source as CompItem).layers.add(sfxFile)
  sfxLayerItem.startTime = sfxTime
  sfxLayerItem.label = labelColor
  sfxLayerItem.name = getFileNameFromPath(sfxFilePath)

};

const clearCompLayers = (comp: CompItem | null) => {
  if (!comp) return;

  for (let i = comp.numLayers; i > 0; i--) {
    comp.layer(i).remove();
  }
};

const clearFxPrecompLayers = () => {
  const fxPrecomp = findCompItemByName(fxPrecompName, false) as CompItem;
  const legacySfxPrecomp = findCompItemByName(legacySfxPrecompName, false) as CompItem;

  clearCompLayers(fxPrecomp);
  if (legacySfxPrecomp && legacySfxPrecomp !== fxPrecomp) clearCompLayers(legacySfxPrecomp);
};

const getLayerSourceName = (layer: Layer): string => {
  try {
    const source = (layer as any).source as any;
    return source && source.name ? source.name : "";
  } catch (_) {
    return "";
  }
}

const isCoinVfxLayer = (layer: Layer): boolean => {
  return textContains(layer.name, coinVfxLayerNamePrefix) || textContains(getLayerSourceName(layer), "coin_plus-");
}

const clearCoinVfxLayers = (comp: CompItem) => {
  for (let i = comp.numLayers; i >= 1; i--) {
    const layer = comp.layer(i);
    if (isCoinVfxLayer(layer)) layer.remove();
  }
}

const getMarkerActionName = (marker: LayerMarkerMeta): string => {
  return marker.title || getMarkerCommentTitle(marker.comment);
}

const parseMarkerCommentDataObject = (comment: string): any => {
  const parsedComment = parseMarkerComment(comment || "");
  if (!parsedComment.data) return {};

  try {
    const parsedData = JSON.parse(parsedComment.data) as any;
    if (parsedData && typeof parsedData === "object") return parsedData;
  } catch (_) { }

  return {};
}

const formatMarkerData = (data: any): string => {
  return (JSON as any).stringify(data || {}, null, 2);
}

const compareLayerMarkersByTime = (a: LayerMarkerMeta, b: LayerMarkerMeta): number => {
  const timeDiff = a.time - b.time;
  if (Math.abs(timeDiff) > markerTimeTolerance) return timeDiff;

  return a.layer.index - b.layer.index;
}

const getActionSequenceMarkers = (): LayerMarkerMeta[] => {
  const cardsLayers = findCardLayers();
  const sequenceMarkers: LayerMarkerMeta[] = [];

  for (let i = 0; i < cardsLayers.length; i++) {
    const layerMarkers = getLayerMarkersMetadata(cardsLayers[i]);

    for (let j = 0; j < layerMarkers.length; j++) {
      const marker = layerMarkers[j];
      const markerAction = getMarkerActionName(marker);

      if (markerAction === "Jump" || markerAction === "Flip Stock") {
        sequenceMarkers.push(marker);
      }
    }
  }

  sequenceMarkers.sort(compareLayerMarkersByTime);

  return sequenceMarkers;
}

const getLayerMarkerKeyIndexAtTimeAndAction = (layer: Layer, markerTime: number, markerAction: string): number | null => {
  const markerProp = layer.property(markerPropPath) as Property;
  if (!markerProp || markerProp.numKeys < 1) return null;

  for (let i = 1; i <= markerProp.numKeys; i++) {
    const keyTime = markerProp.keyTime(i);
    if (Math.abs(keyTime - markerTime) > markerTimeTolerance) continue;

    const markerValue = markerProp.keyValue(i) as MarkerValue;
    if (getMarkerCommentTitle(markerValue.comment) === markerAction) return i;
  }

  return null;
}

const writeActionOrderToMarker = (marker: LayerMarkerMeta, actionOrder: number): void => {
  const markerAction = getMarkerActionName(marker);
  const markerProp = marker.layer.property(markerPropPath) as Property;
  if (!markerProp) return;

  const markerIndex = getLayerMarkerKeyIndexAtTimeAndAction(marker.layer, marker.time, markerAction);
  if (markerIndex === null) return;

  const markerValue = markerProp.keyValue(markerIndex) as MarkerValue;
  const markerData = parseMarkerCommentDataObject(markerValue.comment);
  markerData.actionOrder = actionOrder;
  markerValue.comment = buildMarkerComment(markerAction, formatMarkerData(markerData));

  markerProp.setValueAtKey(markerIndex, markerValue);
}

const writeMarkerDataToMarker = (marker: LayerMarkerMeta, dataPatch: any): any => {
  const markerAction = getMarkerActionName(marker);
  const markerProp = marker.layer.property(markerPropPath) as Property;
  if (!markerProp) return parseMarkerCommentDataObject(marker.comment);

  const markerIndex = getLayerMarkerKeyIndexAtTimeAndAction(marker.layer, marker.time, markerAction);
  if (markerIndex === null) return parseMarkerCommentDataObject(marker.comment);

  const markerValue = markerProp.keyValue(markerIndex) as MarkerValue;
  const markerData = parseMarkerCommentDataObject(markerValue.comment);

  for (const key in dataPatch) {
    markerData[key] = dataPatch[key];
  }

  markerValue.comment = buildMarkerComment(markerAction, formatMarkerData(markerData));
  markerProp.setValueAtKey(markerIndex, markerValue);
  marker.comment = markerValue.comment;

  return markerData;
}

const stampActionMarkerOrders = (): void => {
  const actionMarkers = getActionSequenceMarkers();

  for (let i = 0; i < actionMarkers.length; i++) {
    writeActionOrderToMarker(actionMarkers[i], i + 1);
  }
}

const getNextJumpSfxSequenceIndexAtTime = (time: number): number => {
  const sequenceMarkers = getActionSequenceMarkers();
  let sequenceIndex = 1;

  for (let i = 0; i < sequenceMarkers.length; i++) {
    const marker = sequenceMarkers[i];
    if (marker.time > time + markerTimeTolerance) break;

    const markerAction = getMarkerActionName(marker);

    if (markerAction === "Flip Stock") {
      sequenceIndex = 1;
    } else if (markerAction === "Jump") {
      sequenceIndex++;
    }
  }

  return sequenceIndex;
}

const applyJumpSfx = (comp: CompItem, sfxTime: number, sfxFolderPath: string | undefined, sequenceIndex: number) => {
  const jumpSfxFileName = getJumpSfxFileNameForSequence(sfxFolderPath, sequenceIndex);
  applySfx(comp, sfxTime, joinPath(sfxFolderPath, jumpSfxFileName), keyLabel.green);
}

const getJumpMarkerData = (
  coinFilePath: string | undefined,
  coinValue: string | undefined,
  sequenceIndex: number
): any => {
  const markerCoinValue = getCoinValueForSequence(coinFilePath, sequenceIndex, coinValue);

  const data: any = {};

  if (markerCoinValue !== "") data.coinValue = markerCoinValue;

  return data;
}

const ensureJumpMarkerPlaybackData = (
  marker: LayerMarkerMeta,
  coinFilePath: string | undefined,
  fallbackSequenceIndex: number
): any => {
  const markerData = parseMarkerCommentDataObject(marker.comment);
  const existingCoinValue = normalizeCoinValue(markerData.coinValue);
  const expectedCoinValue = getCoinValueForSequence(coinFilePath, fallbackSequenceIndex);
  const resolvedCoinValue = expectedCoinValue || existingCoinValue;
  const dataPatch: any = {};
  let shouldWrite = false;

  if (resolvedCoinValue !== "" && existingCoinValue !== resolvedCoinValue) {
    dataPatch.coinValue = resolvedCoinValue;
    shouldWrite = true;
  }

  if (shouldWrite) writeMarkerDataToMarker(marker, dataPatch);

  markerData.coinValue = resolvedCoinValue;

  return markerData;
}

const cardFxDisplayName = "Cards Gameplay Superplay"
const trimBounceThresholdPx = 0.5
const trimMinSettleFrames = 2
const trimDefaultSettleFrames = 10
const trimMaxSettleFrames = 24
const trimStockSettleFrames = 2

const clampNumber = (value: number, minValue: number, maxValue: number): number => {
  return Math.min(maxValue, Math.max(minValue, value))
}

const getCardEffectProp = (layer: Layer, propName: string): Property | null => {
  const cardEffect = getEffectByNameOrMatchName(layer, cardFxDisplayName, cardFxMatchName)
  if (!cardEffect) return null

  try {
    const prop = cardEffect.property(propName) as Property
    if (prop) return prop
  } catch (_) { }

  return null
}

const getCardEffectNumber = (layer: Layer, propName: string, fallback: number): number => {
  const prop = getCardEffectProp(layer, propName)
  if (!prop) return fallback

  try {
    return toNumber(prop.value, fallback)
  } catch (_) {
    return fallback
  }
}

const getBounceSettleSeconds = (comp: CompItem, layer: Layer): number => {
  const frameDuration = comp.frameDuration
  const minSettle = frameDuration * trimMinSettleFrames
  const maxSettle = frameDuration * trimMaxSettleFrames
  const defaultSettle = frameDuration * trimDefaultSettleFrames
  const amplitude = Math.abs(getCardEffectNumber(layer, "Bounce Amplitude", 0))

  if (amplitude <= 0.0001) return minSettle

  const frequency = Math.abs(getCardEffectNumber(layer, "Bounce Frequency", 0))
  const decay = Math.abs(getCardEffectNumber(layer, "Bounce Decay", 0))
  let settleSeconds = defaultSettle

  if (decay > 0.0001) {
    settleSeconds = Math.log(Math.max(amplitude, trimBounceThresholdPx) / trimBounceThresholdPx) / decay
  }

  if (frequency > 0.0001) {
    settleSeconds = Math.max(settleSeconds, 1 / frequency)
  }

  if (!isFinite(settleSeconds) || settleSeconds < 0) settleSeconds = defaultSettle
  return clampNumber(settleSeconds, minSettle, maxSettle)
}

const getJumpCoveredTrimTime = (comp: CompItem, layer: Layer, jumpTime: number): number => {
  const jumpDurationFrames = Math.max(0, getCardEffectNumber(layer, "Jump Duration", 0))
  const jumpDurationSeconds = jumpDurationFrames * comp.frameDuration
  const trimTime = jumpTime + jumpDurationSeconds + getBounceSettleSeconds(comp, layer)

  return clampNumber(trimTime, 0, comp.duration)
}

const getCardsControlNumber = (comp: CompItem, propName: string, fallback: number): number => {
  const control = getCardsControlProp(comp, propName)
  if (!control) return fallback

  try {
    return toNumber(control.prop.value, fallback)
  } catch (_) {
    return fallback
  }
}

const getFlipStockCoveredTrimTime = (comp: CompItem, flipTime: number): number => {
  const moveEndFrames = Math.max(0, getCardsControlNumber(comp, "Stock Move End Frames", 11))
  const flipEndFrames = Math.max(0, getCardsControlNumber(comp, "Stock Flip End Frames", 17))
  const endFrames = Math.max(moveEndFrames, flipEndFrames) + trimStockSettleFrames
  const trimTime = flipTime + (endFrames * comp.frameDuration)

  return clampNumber(trimTime, 0, comp.duration)
}

const getCoveredTrimTimeForAction = (comp: CompItem, marker: LayerMarkerMeta): number | null => {
  const cardAction = getMarkerActionName(marker)

  if (cardAction === "Jump") return getJumpCoveredTrimTime(comp, marker.layer, marker.time)
  if (cardAction === "Flip Stock") return getFlipStockCoveredTrimTime(comp, marker.time)

  return null
}

const setLayerOutPointSafely = (layer: Layer, comp: CompItem, outPoint: number) => {
  if (!layer) return

  const minOutPoint = layer.inPoint + comp.frameDuration
  const safeOutPoint = clampNumber(Math.max(outPoint, minOutPoint), minOutPoint, comp.duration)
  const wasLocked = layer.locked

  try {
    layer.locked = false
    layer.outPoint = safeOutPoint
  } catch (e) {
    $.writeln(`[Cards Gameplay] Could not trim layer "${layer.name}": ${e}`)
  } finally {
    try { layer.locked = wasLocked } catch (_) { }
  }
}

const resetCardLayerOutPoints = (comp: CompItem, cardLayers?: Layer[]) => {
  const layers = cardLayers || findCardLayers()

  for (let i = 0; i < layers.length; i++) {
    setLayerOutPointSafely(layers[i], comp, comp.duration)
  }
}

const getOrderedCoveringActionMarkersFromLayers = (cardLayers: Layer[]): LayerMarkerMeta[] => {
  const actionMarkers: LayerMarkerMeta[] = []

  for (let i = 0; i < cardLayers.length; i++) {
    const layerMarkers = getLayerMarkersMetadata(cardLayers[i])

    for (let j = 0; j < layerMarkers.length; j++) {
      const marker = layerMarkers[j]
      const markerAction = getMarkerActionName(marker)
      if (markerAction === "Jump" || markerAction === "Flip Stock") actionMarkers.push(marker)
    }
  }

  actionMarkers.sort(compareLayerMarkersByTime)
  return actionMarkers
}

const recalculateCoveredCardTrims = (comp: CompItem, trimCoveredCards: boolean) => {
  const cardLayers = findCardLayers()

  resetCardLayerOutPoints(comp, cardLayers)
  if (!trimCoveredCards) return

  const targetLayer = getTargetLayer() as Layer
  if (!targetLayer) return

  const actionMarkers = getOrderedCoveringActionMarkersFromLayers(cardLayers)
  let previousLayer: Layer | null = targetLayer

  for (let i = 0; i < actionMarkers.length; i++) {
    const marker = actionMarkers[i]
    const coveringLayer = marker.layer
    const trimTime = getCoveredTrimTimeForAction(comp, marker)

    if (previousLayer && coveringLayer && previousLayer !== coveringLayer && trimTime !== null) {
      setLayerOutPointSafely(previousLayer, comp, trimTime)
    }

    previousLayer = coveringLayer
  }
}

const getLayerVisualCompPositionAtTime = (comp: CompItem, layer: Layer, time: number): [number, number, number] => {
  const posProp = getLayerProp(layer, posPropPath) as Property;
  const posValue = posProp.valueAtTime(time, false) as number[];
  const localPosition: [number, number, number] = [
    toNumber(posValue[0]),
    toNumber(posValue[1]),
    toNumber(posValue.length > 2 ? posValue[2] : 0),
  ];

  const originalTime = comp.time;

  try {
    comp.time = time;

    const avLayer = layer as AVLayer;
    if (!avLayer || typeof avLayer.sourcePointToComp !== "function") return localPosition;

    const anchorProp = getLayerProp(layer, anchorPropPath) as Property;
    const anchorValue = anchorProp.value as number[];
    const compPoint = avLayer.sourcePointToComp([
      toNumber(anchorValue[0]),
      toNumber(anchorValue[1]),
    ]);

    return [
      toNumber(compPoint[0], localPosition[0]),
      toNumber(compPoint[1], localPosition[1]),
      localPosition[2],
    ];
  } catch (_) {
    return localPosition;
  } finally {
    try {
      comp.time = originalTime;
    } catch (_) { }
  }
}

const markersRequireTarget = (markers: LayerMarkerMeta[]): boolean => {
  for (let i = 0; i < markers.length; i++) {
    const cardAction = getMarkerActionName(markers[i]);
    if (cardAction === "Jump" || cardAction === "Flip Stock") return true;
  }

  return false;
}

export const jumpPos = (camada: Layer) => {
  const posProp = getLayerProp(camada, posPropPath)
  setExpressionSafely(posProp, expPos)
}

export const jumpScale = (camada: Layer) => {
  const scaleProp = getLayerProp(camada, scalePropPath)
  setExpressionSafely(scaleProp, expScale)
}

export const jumpRotation = (camada: Layer) => {
  const rotationProp = getLayerProp(camada, zRotPropPath)
  setExpressionSafely(rotationProp, expRot)
}

export const setJumpTargetLayer = (camada: Layer, targetLayer: Layer) => {

  camada
    .property("ADBE Effect Parade")
    .property(cardFxMatchName)
    .property("Target Layer")
    //@ts-ignore
    .setValue(targetLayer.index)
}

const applyCoin = (camada: Layer, coinFilePath: string | undefined, coinTime: number) => {
  if (!coinFilePath) return;

  const thisComp = getActiveComp()
  const importedItem = ensureFootageItem(coinFilePath, "Coin VFX") as AVItem
  if (!importedItem) return;

  const fxPrecompRef = ensureFxPrecompLayer(thisComp);
  const fxPrecomp = fxPrecompRef.source as CompItem;
  const coinLayer = fxPrecomp.layers.add(importedItem)

  const camadaPosValue = getLayerVisualCompPositionAtTime(thisComp, camada, coinTime)
  const coinLayerPos = getLayerProp(coinLayer, posPropPath)

  coinLayer.name = `${coinVfxLayerNamePrefix} - ${camada.name}`
  coinLayer.startTime = coinTime
  coinLayer.label = keyLabel.fuschia
  coinLayer.threeDLayer = false
  coinLayerPos.setValue([camadaPosValue[0], camadaPosValue[1]])

}

const getJumpMarkerForLayer = (layer: Layer): LayerMarkerMeta | null => {
  const layerMarkers = getLayerMarkersMetadata(layer);

  for (let i = 0; i < layerMarkers.length; i++) {
    if (getMarkerActionName(layerMarkers[i]) === "Jump") return layerMarkers[i];
  }

  return null;
}

const removeCoinVfxForLayer = (cardLayer: Layer): void => {
  const expectedLayerName = `${coinVfxLayerNamePrefix} - ${cardLayer.name}`;
  const fxCompNames = [fxPrecompName, legacySfxPrecompName];

  for (let c = 0; c < fxCompNames.length; c++) {
    const fxPrecomp = findCompItemByName(fxCompNames[c], false) as CompItem;
    if (!fxPrecomp) continue;

    for (let i = fxPrecomp.numLayers; i >= 1; i--) {
      const layer = fxPrecomp.layer(i);
      if (layer.name === expectedLayerName) layer.remove();
    }
  }
}

export const updateSelectedJumpCoinValue = (coinFilePath: string, coinValue: string) => {
  const thisComp = requireActiveComp("Update Jump Coin");
  if (!thisComp) return;

  if (!thisComp.selectedLayers || thisComp.selectedLayers.length !== 1) {
    alert("Select exactly one Tableau card with a Jump marker.");
    return;
  }

  const selectedLayer = thisComp.selectedLayers[0];
  if (getLayerCardTag(selectedLayer.name) !== "TABLEAU") {
    alert("Select one Tableau card.");
    return;
  }

  const jumpMarker = getJumpMarkerForLayer(selectedLayer);
  if (!jumpMarker) {
    alert('Selected Tableau card does not have a "Jump" marker.');
    return;
  }

  const normalizedCoinValue = normalizeCoinValue(coinValue);
  if (normalizedCoinValue === "") {
    alert("Invalid coin value.");
    return;
  }

  const targetCoinFilePath = getCoinFilePathForValue(coinFilePath, normalizedCoinValue);
  if (!targetCoinFilePath || !ensureFootageItem(targetCoinFilePath, "Coin VFX")) return;

  const compSnapshot = captureCompState(thisComp);

  try {
    writeMarkerDataToMarker(jumpMarker, { coinValue: normalizedCoinValue });
    removeCoinVfxForLayer(selectedLayer);
    applyCoin(selectedLayer, targetCoinFilePath, jumpMarker.time);
  } catch (e) {
    alertError(e, 209, "updateSelectedJumpCoinValue", "actions.ts")
  } finally {
    restoreCompState(thisComp, compSnapshot)
  }
}

export const applyJumpOnSelectedlayers = (
  presetPath: string,
  coinFilePath: string,
  sfxFolderPath?: string,
  controlPresetPath?: string,
  trimCoveredCards: boolean = false,
  coinValue?: string
) => {

  const thisComp = requireActiveComp("Apply Jump");
  if (!thisComp) return;

  const targetLayer = getTargetLayer() as Layer
  const thisTime = thisComp.time

  if (!targetLayer) {
    alert('Please set a target layer before applying the "Jump" action.')
    return
  }

  const compSnapshot = captureCompState(thisComp)

  try {
    ensureCardsControlsLayer(thisComp, controlPresetPath)
    warnCardsControlsFallbacks(thisComp, jumpCardsControlsSliders)
    let jumpSfxSequenceIndex = getNextJumpSfxSequenceIndexAtTime(thisTime)
    const selectedLayers: Layer[] = []

    for (let i = 0; i < thisComp.selectedLayers.length; i++) {
      selectedLayers.push(thisComp.selectedLayers[i])
    }

    for (let i = 0; i < selectedLayers.length; i++) {
      const camada = selectedLayers[i]

      if (!fxExistsByMatchName(camada, cardFxMatchName)) camada.applyPreset(new File(presetPath))
      if (namedMarkerExists(camada, "Jump")) {
        alert([
          'This card already has a "Jump" marker:',
          camada.name,
          "",
          'Each card layer can only have one "Jump" marker.',
        ].join("\n"))
        continue
      }

      //@ts-ignore
      camada.threeDLayer = true

      const jumpMarkerData = getJumpMarkerData(coinFilePath, coinValue, jumpSfxSequenceIndex)
      const jumpCoinFilePath = getCoinFilePathForValue(coinFilePath, jumpMarkerData.coinValue)
      applyCoin(camada, jumpCoinFilePath, thisTime)

      jumpPos(camada)
      jumpScale(camada)
      jumpRotation(camada)

      addMarkerToLayer(camada, thisTime, {
        title: "Jump",
        label: keyLabel.green,
        data: formatMarkerData(jumpMarkerData),
      })
      setJumpTargetLayer(camada, targetLayer)

      applyJumpSfx(thisComp, thisTime, sfxFolderPath, jumpSfxSequenceIndex)
      jumpSfxSequenceIndex++
    }

    stampActionMarkerOrders()
    recalculateCoveredCardTrims(thisComp, trimCoveredCards === true)

  } catch (e) {
    alertError(e, 208, "applyJumpOnSelectedlayers", "actions.ts")
  } finally {
    ensureCardsControlsLayer(thisComp, controlPresetPath)
    restoreCompState(thisComp, compSnapshot)
  }
}

// ============================== STOCK CARD ACTIONS

const ensureExpressionLibProjectItem = (expressionLibPath?: string): FootageItem | null => {
  const existingItem = findFootageItemByName(expressionLibName, false);

  if (existingItem) {
    if (expressionLibPath) {
      try {
        const libFile = new File(expressionLibPath);
        if (libFile.exists && !footageItemUsesFile(existingItem, libFile)) {
          (existingItem as any).replace(libFile);
          existingItem.name = expressionLibName;
        }
      } catch (_) { }
    }

    return existingItem;
  }

  if (!expressionLibPath) return null;

  const libFile = new File(expressionLibPath);
  if (!libFile.exists) {
    alert(`Expression library not found:\n${expressionLibPath}`);
    return null;
  }

  const importOptions = new ImportOptions(libFile);
  const importedItem = app.project.importFile(importOptions) as FootageItem;
  importedItem.name = expressionLibName;

  return importedItem;
}

type RestoreActionRequirements = {
  hasJump: boolean;
  hasFlipStock: boolean;
  coinValues: string[];
}

const addUniqueCoinValue = (coinValues: string[], coinValue: string | undefined): void => {
  const normalizedCoinValue = normalizeCoinValue(coinValue);
  if (normalizedCoinValue === "") return;

  for (let i = 0; i < coinValues.length; i++) {
    if (coinValues[i] === normalizedCoinValue) return;
  }

  coinValues.push(normalizedCoinValue);
}

const getMarkerCoinValue = (marker: LayerMarkerMeta): string => {
  const markerData = parseMarkerCommentDataObject(marker.comment);
  return normalizeCoinValue(markerData.coinValue);
}

const getRestoreActionRequirements = (coinFilePath?: string): RestoreActionRequirements => {
  const requirements: RestoreActionRequirements = {
    hasJump: false,
    hasFlipStock: false,
    coinValues: [],
  };

  const thisComp = requireActiveComp("Prepare Restore Assets", false);
  if (!thisComp) return requirements;

  const actionMarkers = getActionSequenceMarkers();
  let jumpSequenceIndex = 1;

  for (let i = 0; i < actionMarkers.length; i++) {
    const marker = actionMarkers[i];
    const markerAction = getMarkerActionName(marker);

    if (markerAction === "Jump") {
      const markerCoinValue = getMarkerCoinValue(marker);
      const resolvedCoinValue = getCoinValueForSequence(coinFilePath, jumpSequenceIndex) || markerCoinValue;

      requirements.hasJump = true;
      addUniqueCoinValue(requirements.coinValues, resolvedCoinValue);
      jumpSequenceIndex++;
    }

    if (markerAction === "Flip Stock") {
      requirements.hasFlipStock = true;
      jumpSequenceIndex = 1;
    }
  }

  return requirements;
}

const prepareJumpSfxItems = (sfxFolderPath?: string): boolean => {
  const variationCount = getJumpSfxVariationCount(sfxFolderPath);
  let ready = true;

  for (let i = 1; i <= variationCount; i++) {
    const fileName = getNumberedSfxFileName(jumpSfxFilePrefix, i);
    if (!ensureFootageItem(joinPath(sfxFolderPath, fileName), "SFX")) ready = false;
  }

  return ready;
}

const prepareFlipStockSfxItem = (sfxFolderPath?: string): boolean => {
  return !!ensureFootageItem(joinPath(sfxFolderPath, flipStockSfxFileName), "SFX");
}

export const prepareRestoreCardsAnimationAssets = (
  expressionLibPath?: string,
  coinFilePath?: string,
  sfxFolderPath?: string
): boolean => {
  const thisComp = requireActiveComp("Prepare Restore Assets", false);
  if (!thisComp) return true;

  const requirements = getRestoreActionRequirements(coinFilePath);
  let ready = true;

  if (requirements.hasJump || requirements.hasFlipStock) {
    ensureFxPrecomp(thisComp);
  }

  if (requirements.hasJump) {
    if (coinFilePath && requirements.coinValues.length > 0) {
      for (let i = 0; i < requirements.coinValues.length; i++) {
        const markerCoinFilePath = getCoinFilePathForValue(coinFilePath, requirements.coinValues[i]);
        if (markerCoinFilePath && !ensureFootageItem(markerCoinFilePath, "Coin VFX")) ready = false;
      }
    } else if (coinFilePath && !ensureFootageItem(coinFilePath, "Coin VFX")) {
      ready = false;
    }

    if (!prepareJumpSfxItems(sfxFolderPath)) ready = false;
  }

  if (requirements.hasFlipStock) {
    if (!ensureExpressionLibProjectItem(expressionLibPath)) ready = false;
    if (!prepareFlipStockSfxItem(sfxFolderPath)) ready = false;
  }

  return ready;
}

const ensureExpressionLibLayer = (comp: CompItem, expressionLibPath?: string): AVLayer | null => {
  const libItem = ensureExpressionLibProjectItem(expressionLibPath);
  if (!libItem) return null;

  let libLayer = findPrecompBySourceName(comp, expressionLibName);

  if (!libLayer) {
    libLayer = comp.layers.add(libItem) as AVLayer;
  }

  const wasLocked = libLayer.locked;
  libLayer.locked = false;
  libLayer.name = expressionLibName;
  libLayer.enabled = false;
  libLayer.guideLayer = true;
  libLayer.shy = true;
  libLayer.selected = false;
  libLayer.startTime = 0;
  libLayer.locked = wasLocked || true;
  comp.hideShyLayers = true;

  return libLayer;
}

let lastCardsControlsFallbackWarning = "";

const findLayerByNameInComp = (comp: CompItem, layerName: string): Layer | null => {
  for (let i = 1; i <= comp.numLayers; i++) {
    const layer = comp.layer(i);
    if (layer && layer.name === layerName) return layer;
  }

  return null;
}

const getEffectByNameOrMatchName = (
  layer: Layer,
  effectName: string,
  effectMatchName?: string
): PropertyGroup | null => {
  const effects = layer.property(layerEffect) as PropertyGroup;
  if (!effects) return null;

  if (effectMatchName) {
    try {
      const effect = effects.property(effectMatchName) as PropertyGroup;
      if (effect) return effect;
    } catch (_) { }
  }

  try {
    const effect = effects.property(effectName) as PropertyGroup;
    if (effect) return effect;
  } catch (_) { }

  for (let i = 1; i <= effects.numProperties; i++) {
    const effect = effects.property(i) as PropertyGroup;
    if (!effect) continue;
    if (effect.name === effectName || (effectMatchName && effect.matchName === effectMatchName)) {
      return effect;
    }
  }

  return null;
}

const getCardsControlEffect = (layer: Layer): PropertyGroup | null => {
  return getEffectByNameOrMatchName(layer, cardsControlFxDisplayName, cardsControlFxMatchName);
}

const getCardsControlEffectProp = (layer: Layer, propName: string): Property | null => {
  const controlEffect = getCardsControlEffect(layer);
  if (!controlEffect) return null;

  try {
    const prop = controlEffect.property(propName) as Property;
    if (prop) return prop;
  } catch (_) { }

  return null;
}

const getCardsControlProp = (comp: CompItem, propName: string): { layer: Layer, prop: Property } | null => {
  const controlsLayer = findLayerByNameInComp(comp, cardsControlsLayerName);
  if (!controlsLayer) return null;

  const pseudoProp = getCardsControlEffectProp(controlsLayer, propName);
  if (pseudoProp) return { layer: controlsLayer, prop: pseudoProp };

  return null;
}

const hasCardsControlProp = (layer: Layer, propName: string): boolean => {
  return getCardsControlEffectProp(layer, propName) !== null;
}

const applyCardsControlPreset = (layer: Layer, presetPath?: string): void => {
  if (!presetPath) return;

  try {
    const presetFile = new File(String(presetPath || ""));
    if (!presetFile.exists) return;

    layer.applyPreset(presetFile);
  } catch (_) { }
}

const ensureCardsControlEffect = (layer: Layer, presetPath?: string): void => {
  if (getCardsControlEffect(layer)) return;

  applyCardsControlPreset(layer, presetPath);
  if (getCardsControlEffect(layer)) return;

  try {
    const effects = layer.property(layerEffect) as PropertyGroup;
    if (effects) effects.addProperty(cardsControlFxMatchName);
  } catch (_) { }
}

export const ensureCardsControlsLayer = (comp: CompItem, presetPath?: string): AVLayer | null => {
  let controlsLayer = findLayerByNameInComp(comp, cardsControlsLayerName) as AVLayer | null;

  if (!controlsLayer) {
    controlsLayer = comp.layers.addNull() as AVLayer;
  }

  controlsLayer.locked = false;

  try {
    controlsLayer.name = cardsControlsLayerName;
    controlsLayer.label = keyLabel.cyan;
    controlsLayer.guideLayer = true;
    controlsLayer.shy = false;
    controlsLayer.enabled = true;
    controlsLayer.threeDLayer = false;
    ensureCardsControlEffect(controlsLayer, presetPath);
    controlsLayer.name = cardsControlsLayerName;
    controlsLayer.selected = false;
  } finally {
    controlsLayer.locked = false;
  }

  return controlsLayer;
}

const collectCardLayersFromComp = (comp: CompItem): AVLayer[] => {
  const cardsLayers: AVLayer[] = [];

  for (let i = 1; i <= comp.numLayers; i++) {
    const layer = comp.layer(i) as AVLayer;
    if (layer && getLayerCardTag(layer.name) !== null) cardsLayers.push(layer);
  }

  return cardsLayers;
}

const getCardsGroupControlLayer = (comp: CompItem): AVLayer | null => {
  return findLayerByNameInComp(comp, cardsGroupControlLayerName) as AVLayer | null;
}

const ensureCardsGroupControlLayer = (comp: CompItem): AVLayer => {
  let groupLayer = getCardsGroupControlLayer(comp);
  const shouldInitializeTransform = !groupLayer;

  if (!groupLayer) {
    groupLayer = comp.layers.addNull() as AVLayer;
  }

  groupLayer.locked = false;
  groupLayer.name = cardsGroupControlLayerName;
  groupLayer.label = keyLabel.blue;
  groupLayer.guideLayer = true;
  groupLayer.shy = false;
  groupLayer.enabled = true;
  groupLayer.threeDLayer = true;

  if (shouldInitializeTransform) {
    try {
      getLayerProp(groupLayer, posPropPath).setValue([comp.width / 2, comp.height / 2, 0]);
      getLayerProp(groupLayer, scalePropPath).setValue([100, 100, 100]);
      getLayerProp(groupLayer, zRotPropPath).setValue(0);
    } catch (_) { }
  }

  groupLayer.moveToBeginning();
  groupLayer.selected = false;
  return groupLayer;
}

const setLayerParentSafely = (layer: AVLayer, parentLayer: AVLayer | null): void => {
  const wasLocked = layer.locked;
  layer.locked = false;

  try {
    layer.parent = parentLayer;
  } catch (_) { }

  layer.locked = wasLocked;
}

const removeLayerSafely = (layer: Layer | null): void => {
  if (!layer) return;

  try {
    layer.locked = false;
  } catch (_) { }

  try {
    layer.remove();
  } catch (_) { }
}

const removeCompLayersByPredicate = (comp: CompItem, predicate: (layer: Layer) => boolean): void => {
  for (let i = comp.numLayers; i >= 1; i--) {
    const layer = comp.layer(i);
    if (predicate(layer)) removeLayerSafely(layer);
  }
}

const removeLayerByName = (comp: CompItem, layerName: string): void => {
  removeCompLayersByPredicate(comp, layer => layer.name === layerName);
}

const removeLayersByNameOrSourceName = (comp: CompItem, layerName: string): void => {
  removeCompLayersByPredicate(comp, layer => {
    return layer.name === layerName || getLayerSourceName(layer) === layerName;
  });
}

const getCompMarkerProperty = (comp: CompItem): Property | null => {
  try {
    const markerProperty = (comp as any).markerProperty as Property;
    if (markerProperty) return markerProperty;
  } catch (_) { }

  try {
    const markerProperty = (comp as any).property("ADBE Marker") as Property;
    if (markerProperty) return markerProperty;
  } catch (_) { }

  return null;
}

const isCardsLayoutOriginMarkerComment = (comment: string): boolean => {
  const parsedComment = parseMarkerComment(comment || "");
  if (!parsedComment.data) return false;

  try {
    const parsedData = JSON.parse(parsedComment.data) as any;
    return !!(parsedData && parsedData.schema === cardsLayoutOriginSchema);
  } catch (_) { }

  return false;
}

const clearCardsLayoutOriginMarkers = (comp: CompItem): void => {
  const markerProperty = getCompMarkerProperty(comp) as any;
  if (!markerProperty) return;

  for (let i = markerProperty.numKeys; i >= 1; i--) {
    const markerValue = markerProperty.keyValue(i) as MarkerValue;
    if (isCardsLayoutOriginMarkerComment(markerValue.comment)) {
      markerProperty.removeKey(i);
    }
  }
}

export const groupCardsToControl = () => {
  const thisComp = requireActiveComp("Group Cards");
  if (!thisComp) return;

  const cardsLayers = collectCardLayersFromComp(thisComp);
  if (cardsLayers.length === 0) {
    alert("No card layers found in the active composition.");
    return;
  }

  const compSnapshot = captureCompState(thisComp);

  try {
    const groupLayer = ensureCardsGroupControlLayer(thisComp);

    for (let i = 0; i < cardsLayers.length; i++) {
      const cardLayer = cardsLayers[i];
      if (cardLayer === groupLayer || cardLayer.parent === groupLayer) continue;
      setLayerParentSafely(cardLayer, groupLayer);
    }

    groupLayer.moveToBeginning();
  } finally {
    restoreCompState(thisComp, compSnapshot);
  }
}

export const clearCardsLevel = () => {
  const thisComp = requireActiveComp("Clear Level");
  if (!thisComp) return;

  if (!confirm("Clear all cards and gameplay control layers from this composition?")) {
    return;
  }

  const compSnapshot = captureCompState(thisComp);

  try {
    const cardsLayers = collectCardLayersFromComp(thisComp);
    for (let i = cardsLayers.length - 1; i >= 0; i--) {
      removeLayerSafely(cardsLayers[i]);
    }

    removeLayerByName(thisComp, cardsGroupControlLayerName);
    removeLayerByName(thisComp, cardsControlsLayerName);
    removeLayersByNameOrSourceName(thisComp, expressionLibName);
    removeLayersByNameOrSourceName(thisComp, fxPrecompName);
    removeLayersByNameOrSourceName(thisComp, legacySfxPrecompName);
    clearCoinVfxLayers(thisComp);
    clearFxPrecompLayers();
    clearCardsLayoutOriginMarkers(thisComp);
  } finally {
    restoreCompState(thisComp, compSnapshot);
  }
}

const toNumber = (value: any, fallback = 0): number => {
  const numberValue = Number(value);
  return isNaN(numberValue) ? fallback : numberValue;
}

const layerNameHasTag = (layer: Layer | null, tag: string): boolean => {
  if (!layer || !layer.name) return false;

  const text = String(layer.name || "");
  if (tag.length === 0) return true;
  if (tag.length > text.length) return false;

  for (let i = 0; i <= text.length - tag.length; i++) {
    let matches = true;

    for (let j = 0; j < tag.length; j++) {
      if (text.charAt(i + j) !== tag.charAt(j)) {
        matches = false;
        break;
      }
    }

    if (matches) return true;
  }

  return false;
}

const isStockLayer = (layer: Layer | null): boolean => {
  return layerNameHasTag(layer, "[STOCK]");
}

const getLayerPositionAtTime = (layer: Layer, time: number, preExpression = false): [number, number, number] => {
  const posProp = getLayerProp(layer, posPropPath) as Property;
  const posValue = posProp.valueAtTime(time, preExpression) as number[];

  return [
    toNumber(posValue[0]),
    toNumber(posValue[1]),
    toNumber(posValue.length > 2 ? posValue[2] : 0),
  ];
}

const getStockLayers = (comp: CompItem): Layer[] => {
  const stockLayers: Layer[] = [];

  for (let i = 1; i <= comp.numLayers; i++) {
    const layer = comp.layer(i);
    if (isStockLayer(layer)) stockLayers.push(layer);
  }

  return stockLayers;
}

const getNextStockLayer = (comp: CompItem, baseLayer: Layer): Layer | null => {
  for (let i = baseLayer.index + 1; i <= comp.numLayers; i++) {
    const layer = comp.layer(i);
    if (isStockLayer(layer)) return layer;
  }

  return null;
}

const inferStockSpacingXFromLayer = (comp: CompItem, baseLayer: Layer, sampleTime = comp.time): number | null => {
  const nextStockLayer = getNextStockLayer(comp, baseLayer);
  if (!nextStockLayer) return null;

  const basePos = getLayerPositionAtTime(baseLayer, sampleTime, true);
  const nextPos = getLayerPositionAtTime(nextStockLayer, sampleTime, true);
  const spacingX = basePos[0] - nextPos[0];

  return Math.abs(spacingX) > 0.0001 ? spacingX : null;
}

const inferStockSpacingX = (comp: CompItem, sampleTime = comp.time): number | null => {
  const stockLayers = getStockLayers(comp);

  for (let i = 0; i < stockLayers.length - 1; i++) {
    const currentPos = getLayerPositionAtTime(stockLayers[i], sampleTime, true);
    const nextPos = getLayerPositionAtTime(stockLayers[i + 1], sampleTime, true);
    const spacingX = currentPos[0] - nextPos[0];

    if (Math.abs(spacingX) > 0.0001) return spacingX;
  }

  return null;
}

const ensureStockSpacingX = (comp: CompItem, sampleTime = comp.time, stockLayerToFlip?: Layer) => {
  const control = getCardsControlProp(comp, "Stock Spacing X");
  if (!control) return;

  const currentValue = toNumber(control.prop.value, 0);
  if (Math.abs(currentValue) > 0.0001) return;

  const inferredSpacingX = stockLayerToFlip
    ? inferStockSpacingXFromLayer(comp, stockLayerToFlip, sampleTime) || inferStockSpacingX(comp, sampleTime)
    : inferStockSpacingX(comp, sampleTime);

  if (inferredSpacingX === null) {
    $.writeln("[Cards Gameplay] Stock Spacing X could not be inferred.");
    return;
  }

  const wasLocked = control.layer.locked;
  control.layer.locked = false;

  try {
    control.prop.setValue(inferredSpacingX);
    $.writeln(`[Cards Gameplay] Stock Spacing X inferred: ${inferredSpacingX}`);
  } catch (err) {
    $.writeln(`[Cards Gameplay] Could not set Stock Spacing X: ${err}`);
  }

  control.layer.locked = wasLocked;
}

const stringListContains = (items: string[], target: string): boolean => {
  for (let i = 0; i < items.length; i++) {
    if (items[i] === target) return true;
  }

  return false;
}

export const warnCardsControlsFallbacks = (comp: CompItem, sliderNames: string[]) => {
  const requestedSliders: CardsControlSlider[] = [];
  for (let i = 0; i < cardsControlsSliders.length; i++) {
    const slider = cardsControlsSliders[i];
    if (stringListContains(sliderNames, slider.name)) requestedSliders.push(slider);
  }

  const controlsLayer = findLayerByNameInComp(comp, cardsControlsLayerName);
  const missingSliders: CardsControlSlider[] = [];

  for (let i = 0; i < requestedSliders.length; i++) {
    const slider = requestedSliders[i];
    if (!controlsLayer || !hasCardsControlProp(controlsLayer, slider.name)) {
      missingSliders.push(slider);
    }
  }

  if (missingSliders.length === 0) return;

  const missingSliderNames: string[] = [];
  const missingSliderLines: string[] = [];

  for (let i = 0; i < missingSliders.length; i++) {
    const slider = missingSliders[i];
    missingSliderNames.push(slider.name);
    missingSliderLines.push(`- ${slider.name}: ${slider.expected}`);
  }

  const signature = `${comp.name}|${controlsLayer ? "controls-layer" : "no-controls-layer"}|${missingSliderNames.join("|")}`;
  if (signature === lastCardsControlsFallbackWarning) return;

  lastCardsControlsFallbackWarning = signature;

  const layerMessage = controlsLayer
    ? `Missing control(s) on "${cardsControlsLayerName}" / "${cardsControlFxDisplayName}".`
    : `Layer "${cardsControlsLayerName}" was not found.`;

  alert([
    "[Cards Gameplay Warning]",
    layerMessage,
    "Please add or repair these pseudo effect controls:",
    missingSliderLines.join("\n"),
  ].join("\n"));
}

const applyStockExpressions = (
  comp: CompItem,
  expressionLibPath?: string,
  stockLayerToFlip?: Layer,
  controlPresetPath?: string
) => {
  ensureCardsControlsLayer(comp, controlPresetPath);
  ensureExpressionLibLayer(comp, expressionLibPath);
  ensureStockSpacingX(comp, comp.time, stockLayerToFlip);
  warnCardsControlsFallbacks(comp, stockCardsControlsSliders);

  for (let i = 1; i <= comp.numLayers; i++) {
    const layer = comp.layer(i) as AVLayer;
    if (!isStockLayer(layer)) continue;

    layer.threeDLayer = true;

    const layerPos = getLayerProp(layer, posPropPath);
    setExpressionSafely(layerPos, expStockPos);

    try {
      const layerFlip = getLayerProp(layer, flipCardEssPropPath);
      setExpressionSafely(layerFlip, expStockFlip);
    } catch (_) { }
  }
}

const getLayerMarkerKeyIndexByComment = (layer: Layer, markerComment: string): number | null => {
  const markerProp = layer.property(markerPropPath) as Property;
  if (!markerProp || markerProp.numKeys < 1) return null;

  const targetComment = String(markerComment || "").toLowerCase();

  for (let i = 1; i <= markerProp.numKeys; i++) {
    const markerValue = markerProp.keyValue(i) as MarkerValue;
    const comment = getMarkerCommentTitle(markerValue.comment).toLowerCase();

    if (comment === targetComment) return i;
  }

  return null;
}

export const flipStockCards = (
  stockLayerToFlip?: Layer,
  expressionLibPath?: string,
  sfxFolderPath?: string,
  controlPresetPath?: string,
  trimCoveredCards: boolean = false
) => {

  // main consts
  const thisComp = requireActiveComp("Flip Stock");
  if (!thisComp) return;

  const targetLayer = getTargetLayer()

  if (!targetLayer) {
    alert('Please set a target layer before applying the "Flip Stock" action.')
    return
  }

  let firstSelectedLayer = null

  if (stockLayerToFlip) {
    firstSelectedLayer = stockLayerToFlip
  } else {
    if (!thisComp || !thisComp.selectedLayers || thisComp.selectedLayers.length === 0) {
      alert("Please select the Stock Card");
      return
    } else {
      firstSelectedLayer = thisComp.selectedLayers[0];
    }
  }

  const keyTimePos1 = thisComp.time;
  const flipStockMarkerKeyIndex = getLayerMarkerKeyIndexByComment(firstSelectedLayer, "Flip Stock");
  const markerTime = flipStockMarkerKeyIndex === null
    ? keyTimePos1
    : (firstSelectedLayer.property(markerPropPath) as Property).keyTime(flipStockMarkerKeyIndex);

  const compSnapshot = captureCompState(thisComp)

  try {
    addMarkerToLayer(firstSelectedLayer, markerTime, {
      title: "Flip Stock",
      label: 2,
    })

    stampActionMarkerOrders()
    applyStockExpressions(thisComp, expressionLibPath, firstSelectedLayer, controlPresetPath)

    applySfx(thisComp, markerTime, joinPath(sfxFolderPath, flipStockSfxFileName), keyLabel.yellow)

    if (!stockLayerToFlip) recalculateCoveredCardTrims(thisComp, trimCoveredCards === true)
  } finally {
    ensureCardsControlsLayer(thisComp, controlPresetPath)
    restoreCompState(thisComp, compSnapshot)
  }
}

// ============================== CARDS MODIFIERS

export const setTargetLayer = () => {

  const thisComp = requireActiveComp("Set Target");
  if (!thisComp) return;

  const targetLayer = thisComp.selectedLayers[0] as unknown as AVLayer

  if (!targetLayer) {
    alert("Please select one layer to be the target.")
    return
  };

  if (targetExist()) {
    alert("There is already a target layer in this composition.")
    return
  }

  try {
    targetLayer.threeDLayer = true
    targetLayer.label = 1

    targetLayer.name = removeCardTagsFromLayerName(targetLayer.name)
    targetLayer.name = `${targetLayer.name} [TARGET]`
  } catch (e) {
    alertError(e, 341, "setTargetLayer", "actions.ts")
  }

}

export const setCardType = (cardTypeName: string, layerLabel: number) => {

  const thisComp = requireActiveComp("Set Card Type");
  if (!thisComp) return;

  try {
    forEachSelectedLayer(thisComp, camada => {

      const layer = camada as unknown as AVLayer
      layer.threeDLayer = true
      layer.label = layerLabel

      layer.name = removeCardTagsFromLayerName(layer.name)
      layer.name = `${layer.name} [${cardTypeName.toUpperCase()}]`

    })
  } catch (e) {
    alertError(e, 365, "setCardType", "actions.ts")
  }

}

export const applyFlipCardOnSelectedlayers = () => {

  const thisComp = requireActiveComp("Flip Cards");
  if (!thisComp) return;

  forEachLayer(thisComp, camada => {
    if (camada.selected) {

      addMarkerToLayer(camada, thisComp.time, { title: "Flip", label: 2 })
      flipCard(thisComp.time, camada)

    }
  })

}

export const flipCard = (_time: number, layer: Layer) => {
  const essentialProperties = getLayerProp(layer, flipCardEssPropPath)
  essentialProperties.expression = ""
  removePropertyKeyframesByLabel(essentialProperties, actionLabelColor)
  removePropertyKeyframesByLabel(essentialProperties, anticipationLabelColor)
  setExpressionSafely(essentialProperties, expFlipCard)
}

export const turnCards = () => {
  const thisComp = requireActiveComp("Turn Cards");
  if (!thisComp) return;

  forEachLayer(thisComp, camada => {
    if (camada.selected) {
      const essentialProperties = getLayerProp(camada, flipCardEssPropPath)
      const currentValue = essentialProperties.value
      essentialProperties.setValue(currentValue === 0 ? 100 : 0)
    }
  })
}

export const duplicateCards = (numCopies: number, adjustPos: number[], controlPresetPath?: string) => {

  const thisComp = requireActiveComp("Duplicate Cards");
  if (!thisComp) return;

  const camada = thisComp.selectedLayers[0]
  if (!camada) {
    alert("Please select one card layer before duplicating.")
    return
  }

  const mainPos = getLayerProp(camada, posPropPath).value

  let lastDuplicated = camada

  for (var i = 0; i < numCopies; i++) {
    const duplicated = camada.duplicate()
    mainPos[0] += adjustPos[0]
    mainPos[1] += adjustPos[1]

    getLayerProp(duplicated, posPropPath).setValue(mainPos)

    duplicated.moveAfter(lastDuplicated)
    lastDuplicated = duplicated
    lastDuplicated.selected = true
  }

  ensureCardsControlsLayer(thisComp, controlPresetPath)
}

export const changeCard = (deckName: string, card: number, cardName: string) => {
  const thisComp = requireActiveComp("Change Card");
  if (!thisComp) return;

  const isPlusCard = card === 15;
  if (!isPlusCard && (card < 1 || card > 14)) {
    alert(`Card option "${card}" is invalid. Please choose a card from 1 to 14, or Plus.`);
    return
  }

  const sourceName = isPlusCard ? plusCardSourceName : deckName;
  const cardsSet = findAvItemByName(sourceName, false)
  if (!cardsSet) {
    alert(`Project item "${sourceName}" was not found.`)
    return
  }

  const camadas = thisComp.selectedLayers
  const compSnapshot = captureCompState(thisComp)

  try {
    // Temporarily deselect selected layers so replaceSource can run cleanly on each one.
    deselectAllSelectedLayers(camadas)

    for (let k = 0; k < camadas.length; k++) {
      const camada = camadas[k] as any

      camada.replaceSource(cardsSet, false)
      if (isPlusCard) {
        camada.label = keyLabel.purple
      } else {
        const cardOption = getLayerProp(camada, cardOptionEPPath)
        cardOption.setValue(card)
      }

      const existingZoneTag = getLayerCardTag(camada.name);

      camada.name = existingZoneTag ? `${cardName} [${existingZoneTag}]` : cardName;

    }

    // Keep legacy behavior inside the action; the comp snapshot restores the final selection.
    selectAllSelectedLayers(camadas)
  } finally {
    restoreCompState(thisComp, compSnapshot)
  }

}

export const addCardToPrecomp = (deckName: string, card: number, cardName: string, controlPresetPath?: string) => {

  try {
    const thisComp = requireActiveComp("Add Card")
    if (!thisComp) return

    if (card === 15) {
      const plusCardSource = findAvItemByName(plusCardSourceName, false)
      if (!plusCardSource) {
        alert(`Project item "${plusCardSourceName}" was not found.`)
        return
      }

      const plusLayer = thisComp.layers.add(plusCardSource)
      plusLayer.name = cardName
      plusLayer.label = keyLabel.purple
      ensureCardsControlsLayer(thisComp, controlPresetPath)

      return
    }

    const deck = findAvItemByName(deckName, false)

    if (!deck) {
      alert(`Project item "${deckName}" was not found.`)
      return
    }

    const cardLayer = thisComp.layers.add(deck)
    cardLayer.name = cardName
    const cardOption = getLayerProp(cardLayer, cardOptionEPPath)
    cardOption.setValue(card)
    ensureCardsControlsLayer(thisComp, controlPresetPath)

  } catch (e) {
    alertError(e, 558, "AddCardToPrecomp", "actions.ts")
  }
}

export const resetCardsAnimation = (presetMatchName: string) => {
  // Outer try protects against global failures, such as findCardLayers throwing.
  try {
    const thisComp = requireActiveComp("Reset Cards Animation")
    if (!thisComp) return

    const compSnapshot = captureCompState(thisComp)

    try {
      const selectedLayers = thisComp.selectedLayers

      const cardsList: Layer[] = selectedLayers.length > 0
        ? thisComp.selectedLayers
        : findCardLayers()

      resetCardLayerOutPoints(thisComp, cardsList)

      for (let i = 0; i < cardsList.length; i++) {
        const layer = cardsList[i]
        try {
          const zPosProp = getLayerProp(layer, zRotPropPath)
          const posProp = getLayerProp(layer, posPropPath)
          const scaleProp = getLayerProp(layer, scalePropPath)

          posProp.expression = ""
          zPosProp.expression = ""
          scaleProp.expression = ""

          removePropertyKeyframesByLabel(posProp, actionLabelColor)
          removePropertyKeyframesByLabel(posProp, anticipationLabelColor)
          removePropertyKeyframesByLabel(zPosProp, actionLabelColor)
          removePropertyKeyframesByLabel(scaleProp, actionLabelColor)

          try {
            const flipCardProp = getLayerProp(layer, flipCardEssPropPath)
            flipCardProp.expression = ""
            removePropertyKeyframesByLabel(flipCardProp, actionLabelColor)
            removePropertyKeyframesByLabel(flipCardProp, anticipationLabelColor)
          } catch (_) { }

        } catch (e) {
          $.writeln("Could not access layer properties: " + layer.name)
        }

      }

      clearFxPrecompLayers()
      clearCoinVfxLayers(thisComp)
    } finally {
      restoreCompState(thisComp, compSnapshot)
    }

  } catch (e) {
    alertError(e, 591, "resetCardsAnimation", "actions.ts")
  }
}

export const restoreCardsAnimation = (
  presetPath: string,
  presetMatchName: string,
  expressionLibPath?: string,
  coinFilePath?: string,
  sfxFolderPath?: string,
  controlPresetPath?: string,
  trimCoveredCards: boolean = false
) => {

  const thisComp = requireActiveComp("Restore Cards Animation")
  if (!thisComp) return

  const cardsLayers = findCardLayers()

  const markers: LayerMarkerMeta[] = []

  for (let i = 0; i < cardsLayers.length; i++) {
    const camada = cardsLayers[i]
    const layerMarkers: LayerMarkerMeta[] = getLayerMarkersMetadata(camada)

    // only layers cards that have markers
    if (layerMarkers.length > 0) {
      for (let j = 0; j < layerMarkers.length; j++) {
        markers.push(layerMarkers[j])
      }
    }

  }
  const greenJumpMarkers = filterLayerMarkersByLabelAndComment(markers, keyLabel.green, "Jump")
  const yellowFlipMarkers = filterLayerMarkersByLabelAndComment(markers, keyLabel.yellow, "Flip")
  const yellowFlipStockMarkers = filterLayerMarkersByLabelAndComment(markers, keyLabel.yellow, "Flip Stock")

  const cardsMarkers: LayerMarkerMeta[] = []

  for (let i = 0; i < greenJumpMarkers.length; i++) {
    cardsMarkers.push(greenJumpMarkers[i])
  }

  for (let i = 0; i < yellowFlipMarkers.length; i++) {
    cardsMarkers.push(yellowFlipMarkers[i])
  }

  for (let i = 0; i < yellowFlipStockMarkers.length; i++) {
    cardsMarkers.push(yellowFlipStockMarkers[i])
  }

  cardsMarkers.sort(compareLayerMarkersByTime)

  const targetLayer = getTargetLayer() as Layer
  const compSnapshot = captureCompState(thisComp)

  if (markersRequireTarget(cardsMarkers) && !targetLayer) {
    alert('Please set a target layer before restoring "Jump" or "Flip Stock" actions.')
    return
  }

  try {
    ensureCardsControlsLayer(thisComp, controlPresetPath)
    stampActionMarkerOrders()
    clearFxPrecompLayers()
    clearCoinVfxLayers(thisComp)
    recalculateCoveredCardTrims(thisComp, false)

    thisComp.time = 0

  for (let i = 0; i < cardsMarkers.length; i++) {
    const cardAction = getMarkerActionName(cardsMarkers[i])
    if (cardAction === "Flip Stock") {
      ensureStockSpacingX(thisComp, 0, cardsMarkers[i].layer)
      break
    }
  }

  const cardMarkerLayers: Layer[] = []
  for (let i = 0; i < cardsMarkers.length; i++) {
    cardMarkerLayers.push(cardsMarkers[i].layer)
  }

  deselectAllSelectedLayers(cardMarkerLayers)

  let jumpSfxSequenceIndex = 1

  for (let i = 0; i < cardsMarkers.length; i++) {
    const card = cardsMarkers[i]
    const cardAction = getMarkerActionName(card)

    if (cardAction === "Jump") {
      const jumpMarkerData = ensureJumpMarkerPlaybackData(card, coinFilePath, jumpSfxSequenceIndex)
      const savedCoinFilePath = getCoinFilePathForValue(coinFilePath, jumpMarkerData.coinValue)

      card.layer.selected = true

      if (!fxExistsByMatchName(card.layer, presetMatchName)) card.layer.applyPreset(new File(presetPath))
      jumpPos(card.layer)
      jumpScale(card.layer)
      jumpRotation(card.layer)
      setJumpTargetLayer(card.layer, targetLayer)
      applyCoin(card.layer, savedCoinFilePath, card.time)
      applyJumpSfx(thisComp, card.time, sfxFolderPath, jumpSfxSequenceIndex)
      jumpSfxSequenceIndex++

      card.layer.selected = false

    } else if (cardAction === "Flip") {
      flipCard(card.time, card.layer)
    } else if (cardAction === "Flip Stock") {
      thisComp.time = card.time
      flipStockCards(card.layer, expressionLibPath, sfxFolderPath, controlPresetPath)
      jumpSfxSequenceIndex = 1
    }
  }

  recalculateCoveredCardTrims(thisComp, trimCoveredCards === true)

  } finally {
    ensureCardsControlsLayer(thisComp, controlPresetPath)
    restoreCompState(thisComp, compSnapshot)
  }

}

