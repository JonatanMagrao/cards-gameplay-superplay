import { getActiveComp, forEachLayer, getItemByName } from "./aeft-utils";
import { expPos, expRot } from "../utils/expressions";
import {
  importFilesAndCompsForCards,
  setTargetLayer,
  cardsEffectExist,
  getTargetLayer,
  setCardType,
  getDeepestZ
} from "./cards-utils"
import {
  deselectAllSelectedLayers,
  selectAllSelectedLayers,
  getKeyIndexAtTime,
  frameDuration,
  getLayerProp
} from "./jonatan-utils";

const cardsFolderName = "Disney Solitaire Cards"
const actionLabelColor = 9
const anticipationLabelColor = 2

export const handleSetTargetLayer = () => { setTargetLayer() }
export const handleSetStockLayer = () => { setCardType("stock", 2) }
export const handleSetTableauLayer = () => { setCardType("tableau", 9) }

const getKeyProps = (layerProp: any, labelColor: number) => {

  const keysProps = []

  for (let i = 1; i <= layerProp.numKeys; i++) {
    const posKeyLabel = layerProp.keyLabel(i);
    if (posKeyLabel == labelColor) {
      keysProps.push({
        keyIndex: i,
        keyLabel: posKeyLabel,
        keyValue: layerProp.keyValue(i)
      })
    }
  }

  return keysProps
}
const applyExpPos = (thisComp: CompItem, camada: Layer, targetLayer: Layer) => {

  camada.threeDLayer = true
  const posPropPath = ["ADBE Transform Group", "ADBE Position"]

  const posProp = getLayerProp(camada, posPropPath)
  const targetPosProp = getLayerProp(targetLayer, posPropPath)
  const startPos = posProp.value
  const targetEndPos = targetPosProp.valueAtTime(targetLayer.outPoint, false)


  const lastZPos = getDeepestZ()
  const zAdjust = .005
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
  const scaleProp = getLayerProp(camada, ["ADBE Transform Group", "ADBE Scale"])
  const layerScale = scaleProp.value
  const pressScaleEffect = []

  for (let i of layerScale) {
    pressScaleEffect.push(i * .8)
  }

  const keyframeTiming = [
    thisComp.time,
    thisComp.time + frameDuration(4),
    thisComp.time + frameDuration(8)
  ]

  scaleProp.setValueAtTime(keyframeTiming[0], layerScale);
  scaleProp.setValueAtTime(keyframeTiming[1], pressScaleEffect)
  scaleProp.setValueAtTime(keyframeTiming[2], layerScale)

  for (let time of keyframeTiming) {
    const keyIdx = getKeyIndexAtTime(scaleProp, time)
    scaleProp.setLabelAtKey(keyIdx!, actionLabelColor)
  }

  let easeIn = new KeyframeEase(0, 16);
  let easeOut = new KeyframeEase(0, 100);

  scaleProp.setTemporalEaseAtKey(1, [easeIn, easeIn, easeIn], [easeOut, easeOut, easeOut])

  easeIn = new KeyframeEase(0, 33);
  easeOut = new KeyframeEase(0, 33);

  scaleProp.setTemporalEaseAtKey(2, [easeIn, easeIn, easeIn], [easeOut, easeOut, easeOut])

  easeIn = new KeyframeEase(0, 100);
  easeOut = new KeyframeEase(0, 16);

  scaleProp.setTemporalEaseAtKey(3, [easeIn, easeIn, easeIn], [easeOut, easeOut, easeOut])
}

const applyRotation = (thisComp: CompItem, camada: Layer) => {
  const rotationProp = camada.property("Rotation")
  const layerRotation = rotationProp.value

  const keyframeTiming = [
    thisComp.time + frameDuration(4),
    thisComp.time + frameDuration(24)
  ]

  rotationProp.setValueAtTime(keyframeTiming[0], layerRotation)
  rotationProp.setValueAtTime(keyframeTiming[1], 0)
  rotationProp.expression = expRot

  for (let time of keyframeTiming) {
    const keyIdx = getKeyIndexAtTime(rotationProp, time)
    rotationProp.setLabelAtKey(keyIdx!, actionLabelColor)
  }

}

export const applyJump = (presetPath: string) => {

  const targetLayer = getTargetLayer() as Layer

  if (!targetLayer) {
    alert("Please, set a target layer before applying the jump animation.")
    return
  }

  app.beginUndoGroup("Apply Jump Animation")

  const thisComp = getActiveComp();

  try {
    forEachLayer(thisComp, (camada) => {
      if (camada.selected) {
        if (!cardsEffectExist(camada)) camada.applyPreset(new File(presetPath))
        applyExpPos(thisComp, camada, targetLayer)
        applyJumpEffect(thisComp, camada)
        applyRotation(thisComp, camada)
        camada.marker.setValueAtTime(thisComp.time, new MarkerValue("Jump"));
      }
    })
  } catch (e) {
    alert(`Error at line ${e.line}\nMessage: ${e.message}\nOn file: aeft.ts`)
  }
  app.endUndoGroup()
}


export const applyFlipCard = () => {

  app.beginUndoGroup("Apply Flip Card Animation")

  const thisComp = getActiveComp();

  forEachLayer(thisComp, camada => {
    if (camada.selected) {
      const essentialProperties = camada
        .property("ADBE Layer Overrides")
        .property("Flip Card")

      essentialProperties.setValueAtTime(thisComp.time, 0)
      essentialProperties.setValueAtTime(thisComp.time + frameDuration(15), 100)

      const keyTime1 = getKeyIndexAtTime(essentialProperties, thisComp.time)
      const keyTime2 = getKeyIndexAtTime(essentialProperties, thisComp.time + frameDuration(15))

      essentialProperties.setLabelAtKey(keyTime1, anticipationLabelColor)
      essentialProperties.setLabelAtKey(keyTime2, anticipationLabelColor)

      camada.marker.setValueAtTime(thisComp.time, new MarkerValue("Flip"));
    }
  })

  app.endUndoGroup()
}

export const turnCards = () => {
  const thisComp = getActiveComp()
  forEachLayer(thisComp, camada => {
    if (camada.selected) {
      const essentialProperties = camada
        .property("ADBE Layer Overrides")
        .property("Flip Card")

      const currentValue = essentialProperties.value
      essentialProperties.setValue(currentValue === 0 ? 100 : 0)
    }
  })
}


export const changeCard = (deckName: string, card: number, cardName: string) => {
  const thisComp = getActiveComp();
  const thisProject = app.project;
  const cardsSet = getItemByName(thisProject, cardsFolderName)
  const camadas = thisComp.selectedLayers

  // deseleciona as camadas selecionadas para utilizar o replaceSource em cada uma delas
  deselectAllSelectedLayers(camadas)

  for (let k = 0; k < camadas.length; k++) {
    const camada = camadas[k]

    for (let i = 1; i <= cardsSet.numItems; i++) {
      const cardItem = cardsSet.items[i]
      if (cardItem.name === deckName) {
        camada.replaceSource(cardItem, false)
        camada.property("Essential Properties").property("Card Option").setValue(card)
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


export const flipStockCards = () => {

  app.beginUndoGroup("Fliping cards")

  const thisComp = getActiveComp();
  const targetLayer = getTargetLayer()

  const firstSelectedLayer = thisComp.selectedLayers[0];

  const layerPos = firstSelectedLayer.property("Position")
  const numKeys = layerPos.numKeys;
  let currentKey = numKeys < 1 ? 0 : numKeys
  const layerFlip = firstSelectedLayer.property("Essential Properties").property("Flip Card")
  const currentPos = layerPos.value;
  const lastZPos = getDeepestZ()
  const zAdjust = .005

  const keyTime1 = thisComp.time;
  const keyTime2 = keyTime1 + frameDuration(6)
  const keyTime3 = keyTime2 + frameDuration(5)

  const keytimingPos = [keyTime1, keyTime2, keyTime3]
  firstSelectedLayer.marker.setValueAtTime(keyTime1, new MarkerValue("Flip"));

  layerPos.setValueAtTime(keytimingPos[0], currentPos)

  currentPos[0] += 117.3
  currentPos[1] -= 29
  currentPos[2] = lastZPos - zAdjust
  layerPos.setValueAtTime(keytimingPos[1], currentPos)

  currentPos[0] = targetLayer.property("Position").value[0]
  currentPos[1] += 29
  layerPos.setValueAtTime(keytimingPos[2], currentPos)

  let easeIn = new KeyframeEase(0, 75);
  let easeOut = new KeyframeEase(0, 75);
  currentKey += 1
  layerPos.setTemporalEaseAtKey(currentKey, [easeIn], [easeOut])

  easeIn = new KeyframeEase(2640, 1.16);
  easeOut = new KeyframeEase(2640, 16);
  currentKey += 1
  layerPos.setTemporalEaseAtKey(currentKey, [easeIn], [easeOut])

  easeIn = new KeyframeEase(0, 75);
  easeOut = new KeyframeEase(0, 75);
  currentKey += 1
  layerPos.setTemporalEaseAtKey(currentKey, [easeIn], [easeOut])

  const keytimingFlip = [keyTime1 + frameDuration(2), keyTime1 + frameDuration(17)]

  layerFlip.setValueAtTime(keytimingFlip[0], 0)
  layerFlip.setValueAtTime(keytimingFlip[1], 100)

  for (let time of keytimingPos) {
    const keyIdx = getKeyIndexAtTime(layerPos, time)
    layerPos.setLabelAtKey(keyIdx!, actionLabelColor)
  }

  for (let time of keytimingFlip) {
    const keyIdx = getKeyIndexAtTime(layerFlip, time)
    layerFlip.setLabelAtKey(keyIdx!, actionLabelColor)
  }

  let incrementLayer = 3

  forEachLayer(thisComp, camada => {

    if (camada.selected && camada.index !== firstSelectedLayer.index) {
      const thisKeyTime = keyTime1 + frameDuration(1) * incrementLayer
      const layerPos = camada.property("Position")
      const layerPosValue = layerPos.value

      layerPos.setValueAtTime(thisKeyTime, layerPosValue)

      layerPosValue[0] += 21.6
      layerPos.setValueAtTime(thisKeyTime + frameDuration(11), layerPosValue)

      const easeIn = new KeyframeEase(0, 75);
      const easeOut = new KeyframeEase(0, 75);

      const keyIndex1 = getKeyIndexAtTime(layerPos, thisKeyTime)
      const keyIndex2 = getKeyIndexAtTime(layerPos, thisKeyTime + frameDuration(11))

      layerPos.setTemporalEaseAtKey(keyIndex1, [easeIn], [easeOut])
      layerPos.setTemporalEaseAtKey(keyIndex2, [easeIn], [easeOut])

      layerPos.setLabelAtKey(keyIndex1, anticipationLabelColor)
      layerPos.setLabelAtKey(keyIndex2, anticipationLabelColor)

      incrementLayer += 1

    }

  })

  app.endUndoGroup()

}

export const duplicateCards = (numCopies: number, adjustPos: number[]) => {

  const thisComp = getActiveComp();
  const camada = thisComp.selectedLayers[0]

  const mainPos = camada
    .property("ADBE Transform Group")
    .property("ADBE Position")
    .value;

  let lastDuplicated = camada

  app.beginUndoGroup("Duplicate Cards")

  for (var i = 0; i < numCopies; i++) {
    const duplicated = camada.duplicate()
    mainPos[0] += adjustPos[0]
    mainPos[1] += adjustPos[1]
    duplicated
      .property("ADBE Transform Group")
      .property("ADBE Position")
      .setValue(mainPos)

    duplicated.moveAfter(lastDuplicated)
    lastDuplicated = duplicated
  }

  app.endUndoGroup()
}

export const handleImportFilesAndComps = (filePath: string) => {
  importFilesAndCompsForCards(filePath, cardsFolderName)
}

