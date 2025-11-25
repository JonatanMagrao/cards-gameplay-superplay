import { getActiveComp, forEachLayer, getItemByName } from "./aeft-utils";
import { expPos, expRot } from "../utils/expressions";

const cardsFolderName = "Disney Solitaire Cards"

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

const deselectAllSelectedLayers = (selectedLayers: Layer[]) => {
  for (let i = 0; i < selectedLayers.length; i++) {
    selectedLayers[i].selected = false
  }
}

const selectAllSelectedLayers = (selectedLayers: Layer[]) => {
  for (let i = 0; i < selectedLayers.length; i++) {
    selectedLayers[i].selected = true
  }
}

const cardsEffectExist = (camada: Layer) => {
  const effects = camada.property("Effects")
  const numEffects = effects.numProperties;
  for (let i = 1; i <= numEffects; i++) {
    const layerEffect = effects.property(i);
    if (layerEffect.name === "Cards Gameplay SuperPlay") {
      return true
    }
  }
  return false
}

const getTargetLayer = () => {
  const thisComp = getActiveComp();
  for (let i = 1; i <= thisComp.numLayers; i++) {
    const layer = thisComp.layer(i);
    const regExp = new RegExp("TARGET", "g")
    if (layer.name.match(regExp)) {
      return layer
    }
  }

  throw new Error("No layer tagged as 'TARGET' found in the composition.")
}

const getKeyIndexAtTime = (
  prop: Property,
  timing: number,
  toleranceFrames = 1,
): number | null => {
  if (!prop || prop.numKeys === 0) return null;

  const nearestIndex = prop.nearestKeyIndex(timing);
  const keyTime = prop.keyTime(nearestIndex);          // <- importante: keyTime()
  const tolerance = toleranceFrames * frameDuration(1);   // frames -> segundos

  return Math.abs(keyTime - timing) <= tolerance ? nearestIndex : null;
};

const frameDuration = (numKeys: number) => {
  const thisComp = getActiveComp();
  return 1 / thisComp.frameRate * numKeys;
}

const applyExpPos = (thisComp: CompItem, camada: Layer) => {

  camada.threeDLayer = true

  const posProp = camada.property("Position")
  const startPos = posProp.value
  const [layerX, layerY, layerZ] = getTargetLayer()?.property("Position").valueAtTime(camada.outPoint, false)
  const endPos = [layerX, layerY, layerZ - .001]

  const keyframeTiming = [
    thisComp.time + frameDuration(4),
    thisComp.time + frameDuration(24)
  ]

  posProp.setValueAtTime(keyframeTiming[0], startPos)
  posProp.setValueAtTime(keyframeTiming[1], endPos)

  for (let time of keyframeTiming) {
    const keyIdx = getKeyIndexAtTime(posProp, time)
    posProp.setLabelAtKey(keyIdx!, 9)
    posProp.setInterpolationTypeAtKey(
      keyIdx,
      KeyframeInterpolationType.LINEAR, // IN
      KeyframeInterpolationType.LINEAR  // OUT
    );
  }

  posProp.expression = expPos
}

const applyJumpEffect = (thisComp: CompItem, camada: Layer) => {
  const scaleProp = camada.property("Scale")
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
    scaleProp.setLabelAtKey(keyIdx!, 9)
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
    rotationProp.setLabelAtKey(keyIdx!, 9)
  }

}

export const applyJump = (presetPath: string) => {
  
  try {
    getTargetLayer()
  } catch (e) {
    alert(e)
    return
  }

  app.beginUndoGroup("Apply Jump Animation")

  const thisComp = getActiveComp();

  try {
    forEachLayer(thisComp, (camada) => {
      if (camada.selected) {
        if (!cardsEffectExist(camada)) {
          camada.applyPreset(new File(presetPath))
        }
        applyExpPos(thisComp, camada)
        applyJumpEffect(thisComp, camada)
        applyRotation(thisComp, camada)
      }
    })
  } catch (e) {
    alert(e)
  }
  app.endUndoGroup()
}

export const setTargetLayer = () => {

  const thisComp = getActiveComp();
  const camada = thisComp.selectedLayers[0]
  const regExp = new RegExp(`\\[TARGET\\]`, "g")

  if (!camada) alert("Please, select one layer to be the target.");

  camada.label = 1

  if (regExp.test(camada.name)) {
    alert("It's already a target layer.")
    return
  }

  camada.name = `${camada.name} [TARGET]`
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

      essentialProperties.setLabelAtKey(1, 2)
      essentialProperties.setLabelAtKey(2, 2)
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
        camada.name = cardName
      }
    }
  }

  // deseleciona as camadas selecionadas para utilizar o replaceSource em cada uma delas
  selectAllSelectedLayers(camadas)

}

const adjustZPos = (thisComp: CompItem, addCascadeStep: number) => {
  
  app.beginUndoGroup("Adjust Z Position")

  let cascadeStep = 0.001;

  const selectedLayers = thisComp.selectedLayers.reverse();

  for (let i = 0; i < selectedLayers.length; i++) {
    const camada = selectedLayers[i];
    const layerPos = camada.property("Position")

    if (layerPos.numKeys < 2) continue

    const greenKeys = getKeyProps(layerPos, 9)

    if (greenKeys.length < 2) continue

    for (var j = 0; j < greenKeys.length; j++) {

      if (j !== 1) continue // referencia ao segundo keyframe verde

      const greenKey = greenKeys[j];
      const { keyIndex } = greenKey;
      const posValue = layerPos.keyValue(keyIndex)
      posValue[2] -= cascadeStep

      layerPos.setValueAtKey(keyIndex, posValue)

      cascadeStep += addCascadeStep
    }

  }

  app.endUndoGroup();
}


export const handleAdjustZPos = () => {
  adjustZPos(getActiveComp(), 0.001);
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

  const keyTime1 = thisComp.time;
  const keyTime2 = keyTime1 + frameDuration(6)
  const keyTime3 = keyTime2 + frameDuration(5)

  const keytimingPos = [keyTime1, keyTime2, keyTime3]

  layerPos.setValueAtTime(keytimingPos[0], currentPos)

  currentPos[0] += 117.3
  currentPos[1] -= 29
  currentPos[2] -= 0.001
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
    layerPos.setLabelAtKey(keyIdx!, 9)
  }

  for (let time of keytimingFlip) {
    const keyIdx = getKeyIndexAtTime(layerFlip, time)
    layerFlip.setLabelAtKey(keyIdx!, 9)
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

export const importFiles = (filePath: string) => {
  app.beginUndoGroup("Import Project")

  const projectPath = new File(filePath)
  const importProject = new ImportOptions(projectPath)
  const folder = app.project.importFile(importProject)
  folder.name = cardsFolderName

  app.endUndoGroup()
}

