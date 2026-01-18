import { raise, alertError } from "./errors"
import { expPos, expRot } from "../utils/expressions"
import { getActiveComp, forEachLayer, getItemByName } from "./aeft-utils"
import { getDeepestZ, setKeyframeToLayer, getTargetLayer, cardsEffectExist, targetExist } from "./cards-utils"
import {
  frameDuration,
  getLayerProp,
  addMarkerToLayer,
  selectAllSelectedLayers,
  deselectAllSelectedLayers,
  forEachSelectedLayer
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

const actionLabelColor = keyLabel.green
const anticipationLabelColor = keyLabel.yellow
const zAdjust = .01

const transformGroupMatchName = "ADBE Transform Group"
const essentialPropertiesMatchName = "ADBE Layer Overrides"

export const markerPropPath = "ADBE Marker"
export const posPropPath = [transformGroupMatchName, "ADBE Position"] as const
export const zRotPropPath = [transformGroupMatchName, "ADBE Rotate Z"] as const
export const scalePropPath = [transformGroupMatchName, "ADBE Scale"] as const
export const flipCardEssPropPath = [essentialPropertiesMatchName, "Flip Card"] as const
export const cardOptionEPPath = [essentialPropertiesMatchName, "Card Option"] as const


//================================= TABLEAU JUMP ACTIONS

export const jumpPos = (time: number, camada: Layer, targetLayer: Layer) => {

  const myLayer = camada as unknown as AVLayer
  myLayer.threeDLayer = true

  const posProp = getLayerProp(myLayer, posPropPath)
  const targetPosProp = getLayerProp(targetLayer, posPropPath)
  const startPos = posProp.value
  const targetEndPos = targetPosProp.valueAtTime(targetLayer.outPoint, false)
  const lastZPos = getDeepestZ()

  targetEndPos[2] = lastZPos - zAdjust

  const keyTime1 = time + frameDuration(4)
  const keyTime2 = time + frameDuration(24)

  setKeyframeToLayer(posProp, keyTime1, startPos, actionLabelColor)
  setKeyframeToLayer(posProp, keyTime2, targetEndPos, actionLabelColor)

  posProp.expression = expPos

}

export const jumpScale = (time: number, camada: Layer) => {

  const scaleProp = getLayerProp(camada, scalePropPath)
  const layerScale = scaleProp.value
  const pressScaleEffect = []

  for (let i of layerScale) {
    pressScaleEffect.push(i * .8)
  }

  const firstKeyTime = time
  const secondKeyTime = firstKeyTime + frameDuration(4)
  const thirdKeyTime = secondKeyTime + frameDuration(4)

  setKeyframeToLayer(scaleProp, firstKeyTime, layerScale, actionLabelColor, { ease: true, easeIn: 16, easeOut: 100 })
  setKeyframeToLayer(scaleProp, secondKeyTime, pressScaleEffect, actionLabelColor, { ease: true, easeIn: 33.3333, easeOut: 33.3333 })
  setKeyframeToLayer(scaleProp, thirdKeyTime, layerScale, actionLabelColor, { ease: true, easeIn: 100, easeOut: 16 })

}

export const jumpRotation = (time: number, camada: Layer) => {

  const rotationProp = getLayerProp(camada, zRotPropPath)
  const layerRotation = rotationProp.value

  const firstKeyTime = time + frameDuration(4)
  const secondkeyTime = time + frameDuration(24)

  setKeyframeToLayer(rotationProp, firstKeyTime, layerRotation, actionLabelColor)
  setKeyframeToLayer(rotationProp, secondkeyTime, 0, actionLabelColor)

  rotationProp.expression = expRot

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
      if (!cardsEffectExist(camada)) camada.applyPreset(new File(presetPath))
      jumpPos(thisTime, camada, targetLayer)
      jumpScale(thisTime, camada)
      jumpRotation(thisTime, camada)
      addMarkerToLayer(camada, thisTime, { title: "Jump", label: 9 })
    })

  } catch (e) {
    alertError(e, 132, "applyJumpOnSelectedlayers", "actions.ts")
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
  const stockLayers = getAllStockLayers(thisComp)

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
    alertError(e, 479, "AddCardToPrecomp", "actions.ts")
  } 
}