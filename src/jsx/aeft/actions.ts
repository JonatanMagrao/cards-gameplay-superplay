import { alertError } from "./errors"
import { expFlipCard, expPos, expRot, expScale, expStockFlip, expStockPos } from "../utils/expressions"
import { captureCompState, findCompItemByName, findFootageItemByName, getActiveComp, forEachLayer, getItemByName, requireActiveComp, restoreCompState } from "./aeft-utils"
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
const fxPrecompName = "FX Precomp"
const legacySfxPrecompName = "SFX Precomp"
const expressionLibName = "superplay-expression-lib.jsx"
const cardsControlsLayerName = "Cards Controls"
const coinVfxLayerNamePrefix = "Coin VFX"
const jumpSfxFilePrefix = "jump_sfx_"
const jumpSfxFileExtension = ".wav"
const jumpSfxMaxScanCount = 99
const flipStockSfxFileName = "flip-stock_sfx_01.wav"
const markerTimeTolerance = 0.0001

type CardsControlSlider = {
  name: string;
  fallback: string;
}

const cardsControlsSliders: CardsControlSlider[] = [
  { name: "Global Z Step", fallback: "0.05" },
  { name: "Stock Spacing X", fallback: "inferred from current stock spacing" },
  { name: "Stock Arc Height", fallback: "29" },
  { name: "Stock Move Mid Frames", fallback: "6" },
  { name: "Stock Move End Frames", fallback: "11" },
  { name: "Stock Shift Delay Frames", fallback: "2" },
  { name: "Stock Shift Duration Frames", fallback: "11" },
  { name: "Stock Flip Start Frames", fallback: "2" },
  { name: "Stock Flip End Frames", fallback: "17" },
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
  fxPrecompRef.moveToBeginning();
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

const compareLayerMarkersByTime = (a: LayerMarkerMeta, b: LayerMarkerMeta): number => {
  const timeDiff = a.time - b.time;
  if (Math.abs(timeDiff) > markerTimeTolerance) return timeDiff;

  return a.layer.index - b.layer.index;
}

const getJumpSfxSequenceMarkers = (): LayerMarkerMeta[] => {
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

const getNextJumpSfxSequenceIndexAtTime = (time: number): number => {
  const sequenceMarkers = getJumpSfxSequenceMarkers();
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

export const applyJumpOnSelectedlayers = (presetPath: string, coinFilePath: string, sfxFolderPath?: string) => {

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
    warnCardsControlsFallbacks(thisComp, jumpCardsControlsSliders)
    let jumpSfxSequenceIndex = getNextJumpSfxSequenceIndexAtTime(thisTime)
    const selectedLayers: Layer[] = []

    for (let i = 0; i < thisComp.selectedLayers.length; i++) {
      selectedLayers.push(thisComp.selectedLayers[i])
    }

    for (let i = 0; i < selectedLayers.length; i++) {
      const camada = selectedLayers[i]

      if (!fxExistsByMatchName(camada, cardFxMatchName)) camada.applyPreset(new File(presetPath))
      if (namedMarkerExists(camada, "Jump")) continue

      //@ts-ignore
      camada.threeDLayer = true

      applyCoin(camada, coinFilePath, thisTime)

      jumpPos(camada)
      jumpScale(camada)
      jumpRotation(camada)

      addMarkerToLayer(camada, thisTime, { title: "Jump", label: keyLabel.green })
      setJumpTargetLayer(camada, targetLayer)

      applyJumpSfx(thisComp, thisTime, sfxFolderPath, jumpSfxSequenceIndex)
      jumpSfxSequenceIndex++
    }

  } catch (e) {
    alertError(e, 208, "applyJumpOnSelectedlayers", "actions.ts")
  } finally {
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
        if (libFile.exists) {
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
  libLayer.moveToEnd();
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

const hasSliderControl = (layer: Layer, sliderName: string): boolean => {
  return getSliderControlProp(layer, sliderName) !== null;
}

const getSliderControlProp = (layer: Layer, sliderName: string): Property | null => {
  const effects = layer.property(layerEffect) as PropertyGroup;
  if (!effects) return null;

  const effect = effects.property(sliderName) as PropertyGroup;
  if (!effect) return null;

  try {
    const sliderProp = effect.property("Slider") as Property;
    if (sliderProp) return sliderProp;
  } catch (_) {
  }

  try {
    const sliderProp = effect.property("ADBE Slider Control-0001") as Property;
    if (sliderProp) return sliderProp;
  } catch (_) {
  }

  return null;
}

const getCardsControlSliderProp = (comp: CompItem, sliderName: string): { layer: Layer, prop: Property } | null => {
  const controlsLayer = findLayerByNameInComp(comp, cardsControlsLayerName);
  if (!controlsLayer) return null;

  const sliderProp = getSliderControlProp(controlsLayer, sliderName);
  if (!sliderProp) return null;

  return { layer: controlsLayer, prop: sliderProp };
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
  const slider = getCardsControlSliderProp(comp, "Stock Spacing X");
  if (!slider) return;

  const currentValue = toNumber(slider.prop.value, 0);
  if (Math.abs(currentValue) > 0.0001) return;

  const inferredSpacingX = stockLayerToFlip
    ? inferStockSpacingXFromLayer(comp, stockLayerToFlip, sampleTime) || inferStockSpacingX(comp, sampleTime)
    : inferStockSpacingX(comp, sampleTime);

  if (inferredSpacingX === null) {
    $.writeln("[Cards Gameplay] Stock Spacing X could not be inferred.");
    return;
  }

  const wasLocked = slider.layer.locked;
  slider.layer.locked = false;

  try {
    slider.prop.setValue(inferredSpacingX);
    $.writeln(`[Cards Gameplay] Stock Spacing X inferred: ${inferredSpacingX}`);
  } catch (err) {
    $.writeln(`[Cards Gameplay] Could not set Stock Spacing X: ${err}`);
  }

  slider.layer.locked = wasLocked;
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
    if (!controlsLayer || !hasSliderControl(controlsLayer, slider.name)) {
      missingSliders.push(slider);
    }
  }

  if (missingSliders.length === 0) return;

  const missingSliderNames: string[] = [];
  const missingSliderLines: string[] = [];

  for (let i = 0; i < missingSliders.length; i++) {
    const slider = missingSliders[i];
    missingSliderNames.push(slider.name);
    missingSliderLines.push(`- ${slider.name}: ${slider.fallback}`);
  }

  const signature = `${comp.name}|${controlsLayer ? "controls-layer" : "no-controls-layer"}|${missingSliderNames.join("|")}`;
  if (signature === lastCardsControlsFallbackWarning) return;

  lastCardsControlsFallbackWarning = signature;

  const layerMessage = controlsLayer
    ? `Missing slider(s) on "${cardsControlsLayerName}".`
    : `Layer "${cardsControlsLayerName}" was not found.`;

  alert([
    "[Cards Gameplay Warning]",
    layerMessage,
    "Expressions will keep working with fallback values:",
    missingSliderLines.join("\n"),
  ].join("\n"));
}

const applyStockExpressions = (comp: CompItem, expressionLibPath?: string, stockLayerToFlip?: Layer) => {
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

export const flipStockCards = (stockLayerToFlip?: Layer, expressionLibPath?: string, sfxFolderPath?: string) => {

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

    applyStockExpressions(thisComp, expressionLibPath, firstSelectedLayer)

    applySfx(thisComp, markerTime, joinPath(sfxFolderPath, flipStockSfxFileName), keyLabel.yellow)
  } finally {
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

export const duplicateCards = (numCopies: number, adjustPos: number[]) => {

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

}

export const changeCard = (deckName: string, card: number, cardName: string) => {
  const thisComp = requireActiveComp("Change Card");
  if (!thisComp) return;

  const cardsSet = getItemByName(deckName) as any
  if (!cardsSet) {
    alert(`Project item "${deckName}" was not found.`)
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
      const cardOption = getLayerProp(camada, cardOptionEPPath)
      cardOption.setValue(card)

      const existingZoneTag = getLayerCardTag(camada.name);

      camada.name = existingZoneTag ? `${cardName} [${existingZoneTag}]` : cardName;

    }

    // Keep legacy behavior inside the action; the comp snapshot restores the final selection.
    selectAllSelectedLayers(camadas)
  } finally {
    restoreCompState(thisComp, compSnapshot)
  }

}

export const addCardToPrecomp = (deckName: string, card: number, cardName: string) => {

  try {
    const thisComp = requireActiveComp("Add Card")
    if (!thisComp) return

    if (card === 15) {
      const plusCardSource = getItemByName("Plus_Card") as CompItem
      thisComp.layers.add(plusCardSource)
      thisComp.layer("Plus_Card").label = keyLabel.purple

      return
    }

    const deck = getItemByName(deckName)

    if (!deck) {
      alert(`Item "${deck}" not found on project!`)
      return
    }

    const cardLayer = thisComp.layers.add(deck)
    cardLayer.name = cardName
    const cardOption = getLayerProp(cardLayer, cardOptionEPPath)
    cardOption.setValue(card)

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
  sfxFolderPath?: string
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
    clearFxPrecompLayers()
    clearCoinVfxLayers(thisComp)

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

      card.layer.selected = true

      if (!fxExistsByMatchName(card.layer, presetMatchName)) card.layer.applyPreset(new File(presetPath))
      jumpPos(card.layer)
      jumpScale(card.layer)
      jumpRotation(card.layer)
      setJumpTargetLayer(card.layer, targetLayer)
      applyCoin(card.layer, coinFilePath, card.time)
      applyJumpSfx(thisComp, card.time, sfxFolderPath, jumpSfxSequenceIndex)
      jumpSfxSequenceIndex++

      card.layer.selected = false

    } else if (cardAction === "Flip") {
      flipCard(card.time, card.layer)
    } else if (cardAction === "Flip Stock") {
      thisComp.time = card.time
      flipStockCards(card.layer, expressionLibPath, sfxFolderPath)
      jumpSfxSequenceIndex = 1
    }
  }

  } finally {
    restoreCompState(thisComp, compSnapshot)
  }

}

