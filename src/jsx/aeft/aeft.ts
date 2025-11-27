import { getActiveComp, forEachLayer, getItemByName } from "./aeft-utils";
import { expPos, expRot } from "../utils/expressions";
import {
  importFilesAndCompsForCards,
  setTargetLayer,
  cardsEffectExist,
  getTargetLayer,
  setCardType,
  getDeepestZ,
  setKeyframeToLayer
} from "./cards-utils"
import {
  deselectAllSelectedLayers,
  selectAllSelectedLayers,
  getKeyIndexAtTime,
  frameDuration,
  getLayerProp,
  addMarkerToLayer
} from "./aeft-utils-jonatan";

const keyLabel = {
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

const cardsFolderName = "Disney Solitaire Cards"
const actionLabelColor = keyLabel.green
const anticipationLabelColor = keyLabel.yellow
const zAdjust = .005

const transformGroupMatchName = "ADBE Transform Group"
const essentialPropertiesMatchName = "ADBE Layer Overrides"

const posPropPath = [transformGroupMatchName, "ADBE Position"] as const
const zRotPropPath = [transformGroupMatchName, "ADBE Rotate Z"] as const
const scalePropPath = [transformGroupMatchName, "ADBE Scale"] as const
const flipCardEPPath = [essentialPropertiesMatchName, "Flip Card"] as const
const cardOptionEPPath = [essentialPropertiesMatchName, "Card Option"] as const

export const handleSetTargetLayer = () => setTargetLayer()
export const handleSetStockLayer = () => setCardType("stock", 2)
export const handleSetTableauLayer = () => setCardType("tableau", 9)

const applyExpPos = (thisComp: CompItem, camada: Layer, targetLayer: Layer) => {

  const myLayer = camada as unknown as AVLayer
  myLayer.threeDLayer = true

  const posProp = getLayerProp(myLayer, posPropPath)
  const targetPosProp = getLayerProp(targetLayer, posPropPath)
  const startPos = posProp.value
  const targetEndPos = targetPosProp.valueAtTime(targetLayer.outPoint, false)
  const lastZPos = getDeepestZ()

  targetEndPos[2] = lastZPos - zAdjust

  const keyframeTiming = [
    thisComp.time + frameDuration(4),
    thisComp.time + frameDuration(24)
  ]

  posProp.setValueAtTime(keyframeTiming[0], startPos)
  posProp.setValueAtTime(keyframeTiming[1], targetEndPos)

  for (let time of keyframeTiming) {
    const keyIdx = getKeyIndexAtTime(posProp, time)
    posProp.setLabelAtKey(keyIdx!, actionLabelColor)
    posProp.setInterpolationTypeAtKey(
      keyIdx,
      KeyframeInterpolationType.LINEAR, // IN
      KeyframeInterpolationType.LINEAR  // OUT
    );
  }

  posProp.expression = expPos
}

const applyJumpEffect = (thisComp: CompItem, camada: Layer) => {

  const scaleProp = getLayerProp(camada, scalePropPath)
  const layerScale = scaleProp.value
  const pressScaleEffect = []

  for (let i of layerScale) {
    pressScaleEffect.push(i * .8)
  }

  const firstKeyTime = thisComp.time
  const secondKeyTime = firstKeyTime + frameDuration(4)
  const thirdKeyTime = secondKeyTime + frameDuration(4)

  setKeyframeToLayer(scaleProp, firstKeyTime, layerScale, actionLabelColor, { ease: true, easeIn: 16, easeOut: 100 })
  setKeyframeToLayer(scaleProp, secondKeyTime, pressScaleEffect, actionLabelColor, { ease: true, easeIn: 33.3333, easeOut: 33.3333 })
  setKeyframeToLayer(scaleProp, thirdKeyTime, layerScale, actionLabelColor, { ease: true, easeIn: 100, easeOut: 16 })

}

const applyRotation = (thisComp: CompItem, camada: Layer) => {

  const rotationProp = getLayerProp(camada, zRotPropPath)
  const layerRotation = rotationProp.value

  const firstKeyTime = thisComp.time + frameDuration(4)
  const secondkeyTime = thisComp.time + frameDuration(24)

  setKeyframeToLayer(rotationProp, firstKeyTime, layerRotation, actionLabelColor)
  setKeyframeToLayer(rotationProp, secondkeyTime, 0, actionLabelColor)

  rotationProp.expression = expRot

}

export const applyJump = (presetPath: string) => {

  const targetLayer = getTargetLayer() as Layer
  const thisComp = getActiveComp();
  const thisTime = thisComp.time

  if (!targetLayer) {
    alert("Please, set a target layer before applying the jump animation.")
    return
  }

  app.beginUndoGroup("Apply Jump Animation")


  try {
    forEachLayer(thisComp, (camada) => {
      if (camada.selected) {
        if (!cardsEffectExist(camada)) camada.applyPreset(new File(presetPath))
        applyExpPos(thisComp, camada, targetLayer)
        applyJumpEffect(thisComp, camada)
        applyRotation(thisComp, camada)
        addMarkerToLayer(camada, thisTime, { title: "Jump", label: 9 })
      }
    })
  } catch (e) {
    const error = e as any
    alert(`Error at line ${error.line}\nMessage: ${error.message}\nOn file: aeft.ts`)
  }
  app.endUndoGroup()
}


export const applyFlipCard = () => {

  app.beginUndoGroup("Apply Flip Card Animation")

  const thisComp = getActiveComp();

  forEachLayer(thisComp, camada => {
    if (camada.selected) {

      const essentialProperties = getLayerProp(camada, flipCardEPPath) as any
      const firstKeyTime = thisComp.time
      const secondKeyTime = firstKeyTime + frameDuration(15)

      setKeyframeToLayer(essentialProperties, firstKeyTime, 0, anticipationLabelColor)
      setKeyframeToLayer(essentialProperties, secondKeyTime, 100, anticipationLabelColor)

      addMarkerToLayer(camada, thisComp.time, { title: "Flip", label: 2 })

    }
  })

  app.endUndoGroup()
}

export const turnCards = () => {
  const thisComp = getActiveComp()
  forEachLayer(thisComp, camada => {
    if (camada.selected) {
      const essentialProperties = getLayerProp(camada, flipCardEPPath)
      const currentValue = essentialProperties.value
      essentialProperties.setValue(currentValue === 0 ? 100 : 0)
    }
  })
}


export const changeCard = (deckName: string, card: number, cardName: string) => {
  const thisComp = getActiveComp();
  const thisProject = app.project as any;
  const cardsSet = getItemByName(thisProject, cardsFolderName) as any
  const camadas = thisComp.selectedLayers

  // deseleciona as camadas selecionadas para utilizar o replaceSource em cada uma delas
  deselectAllSelectedLayers(camadas)

  for (let k = 0; k < camadas.length; k++) {
    const camada = camadas[k] as any

    for (let i = 1; i <= cardsSet?.numItems; i++) {
      const cardItem = cardsSet?.items[i]
      if (cardItem.name === deckName) {
        camada.replaceSource(cardItem, false)
        const cardOption = getLayerProp(camada, cardOptionEPPath)
        cardOption.setValue(card)
        const targetRegExp = new RegExp("\\[TARGET\\]", "g")
        const stockRegExp = new RegExp("\\[STOCK\\]", "g")
        const tableauRegExp = new RegExp("\\[TABLEAU\\]", "g")
        if (targetRegExp.test(camada.name)) {
          camada.name = `${cardName} [TARGET]`
        } else if (stockRegExp.test(camada.name)) {
          camada.name = `${cardName} [STOCK]`
        } else if (tableauRegExp.test(camada.name)) {
          camada.name = `${cardName} [TABLEAU]`
        } else {
          camada.name = cardName
        }
      }
    }
  }

  // deseleciona as camadas selecionadas para utilizar o replaceSource em cada uma delas
  selectAllSelectedLayers(camadas)

}

const moveNextCards = (keyTimePos1: number, ignoreLayerIndex: number, distanceXPosLayers: number) => {

  const thisComp = getActiveComp()
  let incrementKeyframeDistance = 3

  forEachLayer(thisComp, camada => {

    if (camada.selected && camada.index !== ignoreLayerIndex) {

      const startKeyTime = keyTimePos1 + frameDuration(1) * incrementKeyframeDistance
      const endKeyTime = startKeyTime + frameDuration(11)

      const layerPos = getLayerProp(camada, posPropPath)
      const layerPosValue = layerPos.value

      setKeyframeToLayer(layerPos, startKeyTime, layerPosValue, anticipationLabelColor, { ease: true, easeIn: 75, easeOut: 75 })

      layerPosValue[0] += distanceXPosLayers
      setKeyframeToLayer(layerPos, endKeyTime, layerPosValue, anticipationLabelColor, { ease: true, easeIn: 75, easeOut: 75 })

      incrementKeyframeDistance += 1

    }

  })
}


export const flipStockCards = () => {

  app.beginUndoGroup("Fliping cards")

  // main consts
  const thisComp = getActiveComp();
  const targetLayer = getTargetLayer()

  if(thisComp.selectedLayers.length < 2) {
    alert("Please, select at least two layers")
    return
  }

  const firstSelectedLayer = thisComp.selectedLayers[0];
  const secondSelectedLayer = thisComp.selectedLayers[1]

  // property consts
  const flipCardPos = getLayerProp(firstSelectedLayer, posPropPath)
  const layerFlip = getLayerProp(firstSelectedLayer, flipCardEPPath)
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
  setKeyframeToLayer(flipCardPos, keyTimePos1, currentPos, actionLabelColor, { ease: true, easeIn: 75, easeOut: 75 })

  // SECOND POSITION KEYFRAME
  const posSecondKey = [...currentPos]
  posSecondKey[0] += 117.3
  posSecondKey[1] -= 29
  posSecondKey[2] = lastZPos - zAdjust
  setKeyframeToLayer(flipCardPos, keyTimePos2, posSecondKey, actionLabelColor, { ease: true, speedIn: 2640, speedOut: 2640, easeIn: 1.16, easeOut: 16 })

  // THIRD POSITION KEYFRAME
  const posThirdkey = [...posSecondKey]
  posThirdkey[0] = getLayerProp(targetLayer, posPropPath).value[0]
  posThirdkey[1] += 29
  setKeyframeToLayer(flipCardPos, keyTimePos3, posThirdkey, actionLabelColor, { ease: true, easeIn: 75, easeOut: 75 })

  // ESSENTIAL PROPERTIES FLIP KEYFRAMES
  // if it is turned to front, only ignore and follow as is
  if(layerFlip.value !== 100){
    setKeyframeToLayer(layerFlip, keyFlip1, 0, actionLabelColor)
    setKeyframeToLayer(layerFlip, keyFlip2, 100, actionLabelColor)
  }

  const firstLayerXPosValue = getLayerProp(firstSelectedLayer, posPropPath).value[0]
  const secondLayerXPosValue = getLayerProp(secondSelectedLayer, posPropPath).value[0]

  const distanceXPosLayers = firstLayerXPosValue - secondLayerXPosValue
  const ignoreLayerIndex = firstSelectedLayer.index

  moveNextCards(keyTimePos1, ignoreLayerIndex, distanceXPosLayers)

  app.endUndoGroup()

}

export const duplicateCards = (numCopies: number, adjustPos: number[]) => {

  const thisComp = getActiveComp();
  const camada = thisComp.selectedLayers[0]
  const mainPos = getLayerProp(camada, posPropPath).value

  let lastDuplicated = camada

  app.beginUndoGroup("Duplicate Cards")

  for (var i = 0; i < numCopies; i++) {
    const duplicated = camada.duplicate()
    mainPos[0] += adjustPos[0]
    mainPos[1] += adjustPos[1]

    getLayerProp(duplicated, posPropPath).setValue(mainPos)

    duplicated.moveAfter(lastDuplicated)
    lastDuplicated = duplicated
  }

  app.endUndoGroup()
}

export const handleImportFilesAndComps = (filePath: string) => {
  importFilesAndCompsForCards(filePath, cardsFolderName)
}
