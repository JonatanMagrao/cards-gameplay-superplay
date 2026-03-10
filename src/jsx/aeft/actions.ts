import { raise, alertError } from "./errors"
import { expPos, expRot, expScale } from "../utils/expressions"
import { getActiveComp, forEachLayer, getItemByName } from "./aeft-utils"
import {
  getDeepestZ,
  setKeyframeToLayer,
  getTargetLayer,
  targetExist,
  namedMarkerExists,
  findCardLayers,
  removePropertyKeyframesByLabel,
  filterLayerMarkersByLabelAndComment
} from "./cards-utils"
import {
  frameDuration,
  getLayerProp,
  addMarkerToLayer,
  selectAllSelectedLayers,
  deselectAllSelectedLayers,
  forEachSelectedLayer,
  fxExistsByMatchName,
  removeFxByMatchName,
  LayerMarkerMeta,
  getLayerMarkersMetadata,
  getFootageByName,
  deselectAllLayer,
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

const actionLabelColor = keyLabel.green
const anticipationLabelColor = keyLabel.yellow
const zAdjust = .1

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
  posProp.expression = expPos
}

export const jumpScale = (camada: Layer) => {
  const scaleProp = getLayerProp(camada, scalePropPath)
  scaleProp.expression = expScale
}

export const jumpRotation = (camada: Layer) => {
  const rotationProp = getLayerProp(camada, zRotPropPath)
  rotationProp.expression = expRot
}

export const setJumpTargetLayer = (camada: Layer, targetLayer: Layer) => {

  camada
    .property("ADBE Effect Parade")
    .property(cardFxMatchName)
    .property("Target Layer")
    //@ts-ignore
    .setValue(targetLayer.index)
}

export const applyJumpOnSelectedlayers = (presetPath: string) => {

  const targetLayer = getTargetLayer() as Layer
  const thisComp = getActiveComp();
  const thisTime = thisComp.time

  if (!targetLayer) {
    alert('Please, set a target layer before applying the "Jump" action.')
    return
  }

  try {

    forEachSelectedLayer(thisComp, camada => {

      if (!fxExistsByMatchName(camada, cardFxMatchName)) camada.applyPreset(new File(presetPath))
      if (namedMarkerExists(camada, "Jump")) return

      //@ts-ignore
      camada.threeDLayer = true

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

const moveNextCards = (keyTimePos1: number, nextLayers: Layer[], distanceXPosLayers: number) => {

  let incrementKeyframeDistance = 3

  for (let nextLayer of nextLayers) {
    const startKeyTime = keyTimePos1 + frameDuration(1) * incrementKeyframeDistance
    const endKeyTime = startKeyTime + frameDuration(11)

    const layerPos = getLayerProp(nextLayer, posPropPath)
    const layerPosValue = layerPos.value

    setKeyframeToLayer(layerPos, startKeyTime, layerPosValue, anticipationLabelColor, { ease: true, easeIn: 75, easeOut: 75 })

    layerPosValue[0] += distanceXPosLayers
    setKeyframeToLayer(layerPos, endKeyTime, layerPosValue, anticipationLabelColor, { ease: true, easeIn: 75, easeOut: 75 })

    incrementKeyframeDistance += 1
  }

}

const getAllStockLayers = (comp: CompItem) => {
  const matches: Layer[] = [];
  if (!comp || !(comp instanceof CompItem)) return matches;

  for (let i = 1; i <= comp.numLayers; i++) {
    const layer = comp.layer(i);
    if (!layer) continue;

    if (layer.name && layer.name.indexOf("[STOCK]") !== -1 && layer.label === anticipationLabelColor) {
      matches.push(layer);
    }
  }

  return matches;
}

const getAllStockLayersBelow = (comp: CompItem, layerRef: Layer) => {
  const matches: Layer[] = [];
  if (!comp || !(comp instanceof CompItem)) return matches;

  for (let i = 1; i <= comp.numLayers; i++) {
    const layer = comp.layer(i);
    if (!layer) continue;

    if (layer.name && layer.name.indexOf("[STOCK]") !== -1 && layer.label === anticipationLabelColor && layer.index > layerRef.index) {
      matches.push(layer);
    }
  }

  return matches;
}

const getNextStockCard = (comp: CompItem, baseLayer: Layer, labelColor: Number): Layer | null => {
  if (!comp || !(comp instanceof CompItem)) return null;
  if (!baseLayer || typeof baseLayer.index !== "number") return null;

  var nextIndex = baseLayer.index + 1;
  if (nextIndex < 1 || nextIndex > comp.numLayers) return null;

  var nextLayer = comp.layer(nextIndex);
  if (!nextLayer) return null;

  if (!nextLayer.name || nextLayer.name.indexOf("[STOCK]") === -1) return null;
  if (typeof labelColor === "number" && nextLayer.label !== labelColor) return null;

  return nextLayer;
}

export const flipStockCards = (stockLayerToFlip?: Layer) => {

  // main consts
  const thisComp = getActiveComp();
  const targetLayer = getTargetLayer()

  if (!targetLayer) {
    alert('Please, set a target layer before applying the "Flip Stock" action.')
    return
  }

  const jumpHeight = 29
  // const stockLayers = getAllStockLayers(thisComp)

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

  // property consts
  const flipCardPos = getLayerProp(firstSelectedLayer, posPropPath)
  const targetLayerPos = getLayerProp(targetLayer, posPropPath).value
  const layerFlip = getLayerProp(firstSelectedLayer, flipCardEssPropPath)
  const currentPos = flipCardPos.value;
  const lastZPos = getDeepestZ()

  // key timing consts
  const keyTimePos1 = thisComp.time;
  const keyTimePos2 = keyTimePos1 + frameDuration(6)
  const keyTimePos3 = keyTimePos2 + frameDuration(5)
  const keyFlip1 = keyTimePos1 + frameDuration(2)
  const keyFlip2 = keyTimePos1 + frameDuration(17)

  //actions

  addMarkerToLayer(firstSelectedLayer, keyTimePos1, { title: "Flip Stock", label: 2 })

  // FIRST POSITION KEYFRAME
  setKeyframeToLayer(
    flipCardPos,
    keyTimePos1,
    currentPos,
    actionLabelColor,
    { ease: true, easeIn: 75, easeOut: 75 }
  )

  const diffXPos = targetLayerPos[0] > currentPos[0]
    ? targetLayerPos[0] - currentPos[0]
    : currentPos[0] - targetLayerPos[0]

  // SECOND POSITION KEYFRAME
  const posSecondKey = [...currentPos]
  posSecondKey[0] += diffXPos / 2
  posSecondKey[1] -= jumpHeight
  posSecondKey[2] = lastZPos - zAdjust
  setKeyframeToLayer(
    flipCardPos,
    keyTimePos2,
    posSecondKey,
    actionLabelColor,
    { ease: true, speedIn: 2640, speedOut: 2640, easeIn: 1.16, easeOut: 16 }
  )

  // THIRD POSITION KEYFRAME
  const posThirdkey = [...posSecondKey]
  posThirdkey[0] = getLayerProp(targetLayer, posPropPath).value[0]
  posThirdkey[1] = currentPos[1]
  setKeyframeToLayer(
    flipCardPos,
    keyTimePos3,
    posThirdkey,
    actionLabelColor,
    { ease: true, easeIn: 75, easeOut: 75 }
  )

  // ESSENTIAL PROPERTIES FLIP KEYFRAMES
  // if it is turned to front, only ignore and follow as is
  if (layerFlip.value !== 100) {
    setKeyframeToLayer(layerFlip, keyFlip1, 0, actionLabelColor)
    setKeyframeToLayer(layerFlip, keyFlip2, 100, actionLabelColor)
  }

  // applySfx(thisComp, thisComp.time, "flip-stock_sfx_01.wav", keyLabel.yellow)
  const nextLayer = getNextStockCard(thisComp, firstSelectedLayer, anticipationLabelColor)

  if (nextLayer) {
    const stockLayersBelow = getAllStockLayersBelow(thisComp, firstSelectedLayer)
    const firstLayerXPosValue = getLayerProp(firstSelectedLayer, posPropPath).value[0]
    const secondLayerXPosValue = getLayerProp(nextLayer, posPropPath).value[0]
    const distanceXPosLayers = firstLayerXPosValue - secondLayerXPosValue

    moveNextCards(keyTimePos1, stockLayersBelow, distanceXPosLayers)
  }


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

      } catch (e) {
        $.writeln("Erro ao acessar propriedades da layer: " + layer.name)
      }

    }

    // clearSfxPrecompLayers()

  } catch (e) {
    alertError(e, 591, "resetCardsAnimation", "actions.ts")
  }
}

export const restoreCardsAnimation = (presetPath: string, presetMatchName: string) => {

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

  deselectAllSelectedLayers(cardsMarkers)

  for (let card of cardsMarkers) {
    if (card.comment === "Jump") {

      card.layer.selected = true

      if (!fxExistsByMatchName(card.layer, presetMatchName)) card.layer.applyPreset(new File(presetPath))
      jumpPos(card.layer)
      jumpScale(card.layer)
      jumpRotation(card.layer)      
      setJumpTargetLayer(card.layer,targetLayer)

      card.layer.selected = false

      // applySfx(thisComp, card.time, "jump_sfx_01.wav", keyLabel.green)

    } else if (card.comment === "Flip") {
      flipCard(card.time, card.layer)
    } else if (card.comment === "Flip Stock") {
      thisComp.time = card.time
      flipStockCards(card.layer)
    }
  }

  thisComp.time = currentTime

}

