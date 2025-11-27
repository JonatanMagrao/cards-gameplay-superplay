import { getActiveComp, forEachLayer } from "./aeft-utils";
import { getLayerProp, getKeyIndexAtTime } from "./aeft-utils-jonatan";

export const setTargetLayer = () => {

  const thisComp = getActiveComp();
  const targetLayer = thisComp.selectedLayers[0] as unknown as AVLayer

  if (!targetLayer) alert("Please, select one layer to be the target.");

  const targetRegExp = new RegExp(`\\[TARGET\\]`, "g")
  const stockRegExp = new RegExp(`\\[STOCK\\]`, "g")

  if (targetRegExp.test(targetLayer.name)) {
    alert("It's already a target layer.")
    return
  }

  for (let i = 1; i <= thisComp.numLayers; i++) {
    const layer = thisComp.layer(i)
    if (targetRegExp.test(layer.name)) {
      alert("There is already a target layer in this composition.")
      return
    }
  }

  app.beginUndoGroup("Set Target Layer")

  targetLayer.threeDLayer = true
  targetLayer.label = 1

  if (stockRegExp.test(targetLayer.name)) {
    targetLayer.name = targetLayer.name.replace(stockRegExp, "[TARGET]")
    return
  }

  targetLayer.name = `${targetLayer.name} [TARGET]`

  app.endUndoGroup()
}

export const setCardType = (cardTypeName: string, layerLabel: number) => {

  app.beginUndoGroup(`Set ${cardTypeName} Layers`)

  const thisComp = getActiveComp();

  forEachLayer(thisComp, camada => {
    if (camada.selected) {

      const targetRegExp = new RegExp(`\\[TARGET\\]`, "g")
      const stockRegExp = new RegExp(`\\[STOCK\\]`, "g")
      const tableauRegExp = new RegExp(`\\[TABLEAU\\]`, "g")
      const cardType = new RegExp(`\\[${cardTypeName.toUpperCase()}\\]`, "g")

      if (!camada) alert("Please, select the layers to be the ${cardTypeName} Cards");

      //@ts-ignore
      camada.threeDLayer = true
      camada.label = layerLabel

      if (targetRegExp.test(camada.name)) {
        camada.name = `${camada.name.replace(targetRegExp, "")} [${cardTypeName.toUpperCase()}]`
      } else if (stockRegExp.test(camada.name)) {
        camada.name = `${camada.name.replace(stockRegExp, "")} [${cardTypeName.toUpperCase()}]`
      } else if (tableauRegExp.test(camada.name)) {
        camada.name = `${camada.name.replace(tableauRegExp, "")} [${cardTypeName.toUpperCase()}]`
      }

      if (!cardType.test(camada.name)) {
        camada.name = `${camada.name} [${cardTypeName.toUpperCase()}]`
      }

    }
  })

  app.endUndoGroup()
}

export const importFilesAndCompsForCards = (filePath: string, cardsFolderName: string) => {
  const projectPath = new File(filePath)
  const importProject = new ImportOptions(projectPath)
  const folder = app.project.importFile(importProject)
  folder.name = cardsFolderName
}

export const getTargetLayer = () => {
  const thisComp = getActiveComp();
  for (let i = 1; i <= thisComp.numLayers; i++) {
    const layer = thisComp.layer(i);
    const regExp = new RegExp("TARGET", "g")
    if (layer.name.match(regExp)) {
      return layer
    }
  }
  return null
}

export const cardsEffectExist = (camada: Layer) => {
  const effects = camada.property("ADBE Effect Parade") as unknown as PropertyGroup
  const numEffects = effects.numProperties;

  for (let i = 1; i <= numEffects; i++) {
    const layerEffect = effects.property(i);
    if (layerEffect.name === "Cards Gameplay SuperPlay") {
      return true
    }
  }

  return false
}


const getGameCardsLayers = () => {
  const thisComp = getActiveComp()
  const layerCards: Layer[] = []

  forEachLayer(thisComp, camada => {
    const targetRegExp = new RegExp("\\[TARGET\\]", "g")
    const stockRegExp = new RegExp("\\[STOCK\\]", "g")
    const tableauRegExp = new RegExp("\\[TABLEAU\\]", "g")

    const isTarget = targetRegExp.test(camada.name)
    const isStock = stockRegExp.test(camada.name)
    const isTableau = tableauRegExp.test(camada.name)

    if (isTarget || isStock || isTableau) {
      layerCards.push(camada)
    }
  })

  return layerCards
}

export const getDeepestZ = () => {
  let zValue = null
  const cards = getGameCardsLayers()
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]
    const posPropPath = ["ADBE Transform Group", "ADBE Position"]
    const posProp = getLayerProp(card, posPropPath) as Property
    const zPosValue = posProp.valueAtTime(card.outPoint, false)[2]

    if (!zValue) {
      zValue = zPosValue
      continue
    }

    if (zPosValue < zValue) {
      zValue = zPosValue
    }
  }

  return Math.round(zValue * 1000) / 1000
}

interface EaseValues {
  ease?: boolean,
  speedIn?: number,
  speedOut?: number,
  easeIn?: number
  easeOut?: number
}

export const setKeyframeToLayer = (
  layerProp: Property,
  tempo: number,
  valor: number | number[],
  label: number = 0,
  easing: EaseValues = {}
) => {

  const {
    ease = false,
    speedIn = 0,
    speedOut = 0,
    easeIn = 33.3333,
    easeOut = 33.3333
  } = easing

  layerProp.setValueAtTime(tempo, valor)
  const keyIndex = getKeyIndexAtTime(layerProp, tempo) as number

  if (ease) {
    const keyframeEaseIn = new KeyframeEase(speedIn, easeIn)
    const keyframeEaseOut = new KeyframeEase(speedOut, easeOut)
    //todo quando for fazer pra mim, adaptar com os PropertyValueTypes
    if (layerProp.matchName === "ADBE Scale") {
      layerProp.setTemporalEaseAtKey(
        keyIndex,
        [keyframeEaseIn, keyframeEaseIn, keyframeEaseIn],
        [keyframeEaseOut, keyframeEaseOut, keyframeEaseOut]
      )
    } else {
      layerProp.setTemporalEaseAtKey(
        keyIndex,
        [keyframeEaseIn],
        [keyframeEaseOut]
      )
    }
  }

  //@ts-ignore
  layerProp.setLabelAtKey(keyIndex, label)
}

