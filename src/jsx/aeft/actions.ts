import { alertError } from "./errors"
import { expPos, expRot, expScale, expStockFlip, expStockPos } from "../utils/expressions"
import { findProjectItemByName, getActiveComp, forEachLayer, getItemByName } from "./aeft-utils"
import {
  setKeyframeToLayer,
  getTargetLayer,
  targetExist,
  namedMarkerExists,
  findCardLayers,
  removePropertyKeyframesByLabel,
  filterLayerMarkersByLabelAndComment,
  getMarkerCommentTitle
} from "./cards-utils"
import {
  frameDuration,
  getLayerProp,
  addMarkerToLayer,
  selectAllSelectedLayers,
  deselectAllSelectedLayers,
  forEachSelectedLayer,
  fxExistsByMatchName,
  LayerMarkerMeta,
  getLayerMarkersMetadata,
  getFootageByName,
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
const sfxPrecompName = "SFX Precomp"
const expressionLibName = "superplay-expression-lib.jsx"
const cardsControlsLayerName = "Cards Controls"

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
  { name: "Progress Delay Frames", fallback: "5" },
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
export const progressCardsControlsSliders: string[] = ["Progress Delay Frames"]

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

const ensureSfxPrecomp = (): CompItem => {
  let sfxPrecomp = getItemByName(sfxPrecompName) as CompItem
  const thisComp = getActiveComp() as CompItem;

  if (!sfxPrecomp) {
    const { pixelAspect, duration, frameRate } = thisComp
    //@ts-ignore
    sfxPrecomp = app.project.items.addComp(sfxPrecompName, 100, 100, pixelAspect, duration, frameRate);
  }

  return sfxPrecomp

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

const applySfx = (comp: CompItem, sfxTime: number, sfxName: string, labelColor: number) => {
  const sfxPrecomp = ensureSfxPrecomp() as CompItem;

  let sfxPrecompRef = findPrecompBySourceName(comp, sfxPrecompName);

  if (!sfxPrecompRef) {
    sfxPrecompRef = comp.layers.add(sfxPrecomp) as AVLayer;
    sfxPrecompRef.label = keyLabel.brown;
    sfxPrecompRef.startTime = 0;
    sfxPrecompRef.selected = false
    sfxPrecompRef.moveToEnd();
    sfxPrecompRef.threeDLayer = true
    sfxPrecompRef.locked = true
  } else {
    sfxPrecompRef.locked = false
    sfxPrecompRef.moveToEnd()
    sfxPrecompRef.locked = true
  }

  const sfxFile = getFootageByName(sfxName);
  if (!sfxFile) {
    alert(`Sound file "${sfxName}" not found in project.`);
    return;
  }

  const sfxLayerItem = sfxPrecompRef.source.layers.add(sfxFile)
  sfxLayerItem.startTime = sfxTime
  sfxLayerItem.label = labelColor

};

const clearSfxPrecompLayers = () => {
  const sfxPrecomp = getItemByName("SFX Precomp") as CompItem;

  if (!sfxPrecomp) return;

  for (let i = sfxPrecomp.numLayers; i > 0; i--) {
    sfxPrecomp.layer(i).remove();
  }
};

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

const applyCoin = (camada: Layer, coinFilePath: string) => {

  const thisComp = getActiveComp()
  const coinFile = new File(coinFilePath)

  if (!coinFile.exists) {
    alert(`Coin file not found:\n${coinFilePath}`)
    return
  }

  const importOptions = new ImportOptions(coinFile)
  const importedItem = app.project.importFile(importOptions) as AVItem
  const coinLayer = thisComp.layers.add(importedItem)

  const camadaPosValue = getLayerProp(camada, posPropPath).valueAtTime(thisComp.time, false)
  const coinLayerPos = getLayerProp(coinLayer, posPropPath)

  coinLayer.startTime = thisComp.time
  coinLayer.threeDLayer = true
  coinLayerPos.setValue(camadaPosValue)

}

export const applyJumpOnSelectedlayers = (presetPath: string, coinFilePath: string) => {

  const targetLayer = getTargetLayer() as Layer
  const thisComp = getActiveComp();
  const thisTime = thisComp.time

  if (!targetLayer) {
    alert('Please, set a target layer before applying the "Jump" action.')
    return
  }

  try {
    warnCardsControlsFallbacks(thisComp, jumpCardsControlsSliders)

    forEachSelectedLayer(thisComp, camada => {

      if (!fxExistsByMatchName(camada, cardFxMatchName)) camada.applyPreset(new File(presetPath))
      if (namedMarkerExists(camada, "Jump")) return

      //@ts-ignore
      camada.threeDLayer = true

      applyCoin(camada, coinFilePath)

      jumpPos(camada)
      jumpScale(camada)
      jumpRotation(camada)

      addMarkerToLayer(camada, thisTime, { title: "Jump", label: keyLabel.green })
      setJumpTargetLayer(camada, targetLayer)

      // applySfx(thisComp, thisTime, "jump_sfx_01.wav", keyLabel.green)
    })

  } catch (e) {
    alertError(e, 208, "applyJumpOnSelectedlayers", "actions.ts")
  }
}

// ============================== STOCK CARD ACTIONS

const ensureExpressionLibProjectItem = (expressionLibPath?: string): FootageItem | null => {
  const existingItem = findProjectItemByName(expressionLibName, false) as FootageItem | null;

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

export const flipStockCards = (stockLayerToFlip?: Layer, expressionLibPath?: string) => {

  // main consts
  const thisComp = getActiveComp();
  const targetLayer = getTargetLayer()

  if (!targetLayer) {
    alert('Please, set a target layer before applying the "Flip Stock" action.')
    return
  }

  let firstSelectedLayer = null

  if (stockLayerToFlip) {
    firstSelectedLayer = stockLayerToFlip
  } else {
    if (!thisComp || !thisComp.selectedLayers || thisComp.selectedLayers.length === 0) {
      alert("Please, select the Stock Card");
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

  addMarkerToLayer(firstSelectedLayer, markerTime, {
    title: "Flip Stock",
    label: 2,
  })

  applyStockExpressions(thisComp, expressionLibPath, firstSelectedLayer)

  // applySfx(thisComp, thisComp.time, "flip-stock_sfx_01.wav", keyLabel.yellow)
}

// ============================== CARDS MODIFIERS

export const setTargetLayer = () => {

  const thisComp = getActiveComp();
  const targetLayer = thisComp.selectedLayers[0] as unknown as AVLayer

  if (!targetLayer) {
    alert("Please, select one layer to be the target.")
    return
  };

  if (targetExist()) {
    alert("There is already a target layer in this composition.")
    return
  }

  try {
    targetLayer.threeDLayer = true
    targetLayer.label = 1

    const tagsList = ["TARGET", "STOCK", "TABLEAU"]
    const pattern = tagsList.join("|")
    const removeOldPattern = new RegExp(`\\s*\\[(${pattern})\\].*`, "g")

    targetLayer.name = targetLayer.name.replace(removeOldPattern, "")
    targetLayer.name = `${targetLayer.name} [TARGET]`
  } catch (e) {
    alertError(e, 341, "setTargetLayer", "actions.ts")
  }

}

export const setCardType = (cardTypeName: string, layerLabel: number) => {

  const thisComp = getActiveComp();
  const tagsList = ["TARGET", "STOCK", "TABLEAU"]
  const pattern = tagsList.join("|")
  const removeOldPattern = new RegExp(`\\s*\\[(${pattern})\\].*`, "g")

  try {
    forEachSelectedLayer(thisComp, camada => {

      const layer = camada as unknown as AVLayer
      layer.threeDLayer = true
      layer.label = layerLabel

      layer.name = layer.name.replace(removeOldPattern, "")
      layer.name = `${layer.name} [${cardTypeName.toUpperCase()}]`

    })
  } catch (e) {
    alertError(e, 365, "setCardType", "actions.ts")
  }

}

export const applyFlipCardOnSelectedlayers = () => {

  const thisComp = getActiveComp();

  forEachLayer(thisComp, camada => {
    if (camada.selected) {

      flipCard(thisComp.time, camada)
      addMarkerToLayer(camada, thisComp.time, { title: "Flip", label: 2 })

    }
  })

}

export const flipCard = (time: number, layer: Layer) => {
  const essentialProperties = getLayerProp(layer, flipCardEssPropPath) as any
  const firstKeyTime = time
  const secondKeyTime = firstKeyTime + frameDuration(15)

  setKeyframeToLayer(essentialProperties, firstKeyTime, 0, anticipationLabelColor)
  setKeyframeToLayer(essentialProperties, secondKeyTime, 100, anticipationLabelColor)
}

export const turnCards = () => {
  const thisComp = getActiveComp()
  forEachLayer(thisComp, camada => {
    if (camada.selected) {
      const essentialProperties = getLayerProp(camada, flipCardEssPropPath)
      const currentValue = essentialProperties.value
      essentialProperties.setValue(currentValue === 0 ? 100 : 0)
    }
  })
}

export const duplicateCards = (numCopies: number, adjustPos: number[]) => {

  const thisComp = getActiveComp();
  const camada = thisComp.selectedLayers[0]
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
  const thisComp = getActiveComp();

  const cardsSet = getItemByName(deckName) as any
  const camadas = thisComp.selectedLayers

  // deseleciona as camadas selecionadas para utilizar o replaceSource em cada uma delas
  deselectAllSelectedLayers(camadas)

  for (let k = 0; k < camadas.length; k++) {
    const camada = camadas[k] as any

    camada.replaceSource(cardsSet, false)
    const cardOption = getLayerProp(camada, cardOptionEPPath)
    cardOption.setValue(card)

    const tagsList = ["TARGET", "STOCK", "TABLEAU"]
    const pattern = tagsList.join("|")
    const tagPattern = new RegExp(`\\[(${pattern})\\]`, "g")

    const zoneMatch = tagPattern.exec(camada.name);
    const existingZoneTag = zoneMatch ? zoneMatch[1] : null;

    camada.name = existingZoneTag ? `${cardName} [${existingZoneTag}]` : cardName;

  }

  // reseleciona as camadas selecionadas para utilizar o replaceSource em cada uma delas
  selectAllSelectedLayers(camadas)

}

export const addCardToPrecomp = (deckName: string, card: number, cardName: string) => {

  try {
    const thisComp = getActiveComp()

    if (!thisComp) {
      alert("No active composition found.\nPlease open a composition to add the card.");
      return
    }

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
  // 1. O Try Externo protege contra falhas globais (ex: findCardLayers quebra)
  try {
    const thisComp = app.project.activeItem as CompItem
    const selectedLayers = thisComp.selectedLayers

    const cardsList: Layer[] = selectedLayers.length > 0
      ? thisComp.selectedLayers
      : findCardLayers()

    for (let layer of cardsList) {
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
        $.writeln("Erro ao acessar propriedades da layer: " + layer.name)
      }

    }

    // clearSfxPrecompLayers()

  } catch (e) {
    alertError(e, 591, "resetCardsAnimation", "actions.ts")
  }
}

export const restoreCardsAnimation = (presetPath: string, presetMatchName: string, expressionLibPath?: string) => {

  // clearSfxPrecompLayers()

  const thisComp = getActiveComp()
  const cardsLayers = findCardLayers()

  const markers: LayerMarkerMeta[] = []

  for (let i = 0; i < cardsLayers.length; i++) {
    const camada = cardsLayers[i]
    const layerMarkers: LayerMarkerMeta[] = getLayerMarkersMetadata(camada)

    // only layers cards that have markers
    if (layerMarkers.length > 0) {
      markers.push(...layerMarkers)
    }

  }
  // retorna todos os dados de marcadores

  const greenJumpMarkers = filterLayerMarkersByLabelAndComment(markers, keyLabel.green, "Jump")
  const yellowFlipMarkers = filterLayerMarkersByLabelAndComment(markers, keyLabel.yellow, "Flip")
  const yellowFlipStockMarkers = filterLayerMarkersByLabelAndComment(markers, keyLabel.yellow, "Flip Stock")

  const cardsMarkers = [...greenJumpMarkers, ...yellowFlipMarkers, ...yellowFlipStockMarkers]
  cardsMarkers.sort((a, b) => a.time - b.time)

  // aqui vem a aplicação
  const targetLayer = getTargetLayer() as Layer
  const currentTime = thisComp.time
  thisComp.time = 0

  for (let i = 0; i < cardsMarkers.length; i++) {
    const cardAction = cardsMarkers[i].title || getMarkerCommentTitle(cardsMarkers[i].comment)
    if (cardAction === "Flip Stock") {
      ensureStockSpacingX(thisComp, 0, cardsMarkers[i].layer)
      break
    }
  }

  deselectAllSelectedLayers(cardsMarkers)

  for (let card of cardsMarkers) {
    const cardAction = card.title || getMarkerCommentTitle(card.comment)

    if (cardAction === "Jump") {

      card.layer.selected = true

      if (!fxExistsByMatchName(card.layer, presetMatchName)) card.layer.applyPreset(new File(presetPath))
      jumpPos(card.layer)
      jumpScale(card.layer)
      jumpRotation(card.layer)
      setJumpTargetLayer(card.layer, targetLayer)

      card.layer.selected = false

      // applySfx(thisComp, card.time, "jump_sfx_01.wav", keyLabel.green)

    } else if (cardAction === "Flip") {
      flipCard(card.time, card.layer)
    } else if (cardAction === "Flip Stock") {
      thisComp.time = card.time
      flipStockCards(card.layer, expressionLibPath)
    }
  }

  thisComp.time = currentTime

}

