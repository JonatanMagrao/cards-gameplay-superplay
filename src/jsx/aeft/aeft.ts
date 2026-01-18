import { getTargetLayer, importFilesAndCompsForCards, } from "./cards-utils"
import {
  applyJumpOnSelectedlayers,
  applyFlipCardOnSelectedlayers,
  setTargetLayer,
  setCardType,
  turnCards,
  duplicateCards,
  changeCard,
  flipStockCards,
  zRotPropPath,
  posPropPath,
  scalePropPath,
  flipCardEssPropPath,
  markerPropPath,
  keyLabel,
  jumpPos,
  jumpScale,
  jumpRotation,
  flipCard
} from "./actions";
import { getActiveComp, forEachLayer } from "./aeft-utils";
import { getLayerProp, distributeLayers } from "./aeft-utils-jonatan";
import { applyCardsLayoutFromJson, exportCardsLayoutToJson } from "./game-levels-utils";

const cardsFolderName = "Disney Solitaire Cards"
const precompRenderer = "ADBE Calder"

export const handleApplyCardsLayout = (baseDir: string, levelName: string) => {

  try{
    const thisComp = getActiveComp()
    if (thisComp.renderer !== precompRenderer) {
      thisComp.renderer = precompRenderer
    }
  }catch(e){
    alert(e)
  }

  app.beginUndoGroup("Apply Cards Layout")
  try {
    applyCardsLayoutFromJson(baseDir, levelName)
  } catch (e) {
    alert(e)
  } finally {
    app.endUndoGroup()
  }
}

export const handleSaveCardsLayout = (baseDir: string, levelName: string) => {
  try {
    exportCardsLayoutToJson(baseDir, levelName)
  } catch (e) {
    alert(e)
  }
}

export const handleSetTargetLayer = () => {
  app.beginUndoGroup("Set Target Layer")
  try {
    setTargetLayer()
  } catch (e) {
    alert(e)
  } finally {
    app.endUndoGroup()
  }
}

export const handleSetStockLayer = () => {
  app.beginUndoGroup("Set Stock Layer")
  try {
    setCardType("stock", 2)
  } catch (e) {
    alert(e)
  } finally {
    app.endUndoGroup()
  }
}

export const handleSetTableauLayer = () => {
  app.beginUndoGroup("Set Tableau Layer")
  try {
    setCardType("TABLEAU", 9)
  } catch (e) {
    alert(e)
  } finally {
    app.endUndoGroup()
  }
}

export const handleApplyJump = (presetPath: string) => {
  const thisComp = getActiveComp()
  if(thisComp.renderer !== precompRenderer){
    thisComp.renderer = precompRenderer
  }

  app.beginUndoGroup("Apply Jump")
  try {
    applyJumpOnSelectedlayers(presetPath)
  } catch (e) {
    alert(e)
  } finally {
    app.endUndoGroup()
  }
}

export const handleFlipStockCards = () => {
  app.beginUndoGroup("Flip Stock Cards")
  try {
    flipStockCards()
  } catch (e) {
    alert(e)
  } finally {
    app.endUndoGroup()
  }
}

export const handleFlipCards = () => {
  app.beginUndoGroup("Flip Cards")
  try {
    applyFlipCardOnSelectedlayers()
  } catch (e) {
    alert(e)
  } finally {
    app.endUndoGroup()
  }
}

export const handleTurnCards = () => {
  app.beginUndoGroup("Turn Cards")
  try {
    turnCards()
  } catch (e) {
    alert(e)
  } finally {
    app.endUndoGroup()
  }
}

export const handleDuplicateCards = (numCopies: number, adjustPos: number[]) => {
  app.beginUndoGroup("Duplicate Cards")
  try {
    duplicateCards(numCopies, adjustPos)
  } catch (e) {
    alert(e)
  } finally {
    app.endUndoGroup()
  }
}

export const handleDistributeLayers = (xStep: number, yStep: number, reverse: boolean) => {
  app.beginUndoGroup("Distribute Layers")
  try {
    distributeLayers(xStep, yStep, reverse)
  } catch (e) {
    alert(e)
  } finally {
    app.endUndoGroup()
  }
}

export const getCompSize = () => {
  const { width, height } = getActiveComp();
  return [width, height]
}

export const handleImportFilesAndComps = (filePath: string) => {
  importFilesAndCompsForCards(filePath, cardsFolderName)
}

export const handleChangeCard = (deckName: string, card: number, cardName: string) => {
  app.beginUndoGroup("Update Cards")
  changeCard(deckName, card, cardName)
  app.endUndoGroup()
}

const findCardLayers = () => {
  const thisComp = getActiveComp()
  const cardsList: Layer[] = []

  forEachLayer(thisComp, camada => {
    const tagsList = ["TARGET", "STOCK", "TABLEAU"]
    const pattern = tagsList.join("|")
    const tagPattern = new RegExp(`\\[(${pattern})\\]`, "g")
    if (tagPattern.exec(camada.name)) {
      cardsList.push(camada)
    }
  })

  return cardsList

  // todo função para escalonar os keyframes das camadas abaixo da camada de stock flip (todas abaixo)

}

export const resetCardsAnimation = () => {

  const cardsList: Layer[] = findCardLayers()

  app.beginUndoGroup("Reset Cards Animation")
  for (let layer of cardsList) {
    var zPosProp = getLayerProp(layer, zRotPropPath)
    var posProp = getLayerProp(layer, posPropPath)
    var scaleProp = getLayerProp(layer, scalePropPath)
    var flipCardProp = getLayerProp(layer, flipCardEssPropPath)

    // posProp.expression = ""
    // zPosProp.expression = ""
    posProp.expressionEnabled = false
    zPosProp.expressionEnabled = false
    removePropKeyByLabel(posProp, 9)
    removePropKeyByLabel(posProp, 2)
    removePropKeyByLabel(scaleProp, 9)
    removePropKeyByLabel(flipCardProp, 2)
    removePropKeyByLabel(zPosProp, 9)
    removePropKeyByLabel(flipCardProp, 9)
  }
  app.endUndoGroup()

}

const getPropKeys = (layerProp: Property) => {
  const keyData = {
    camada: layerProp.propertyGroup(layerProp.propertyDepth),
    propName: layerProp.name,
    keys: []
  }
  for (let i = 1; i <= layerProp.numKeys; i++) {
    const keyTime = layerProp.keyTime(i)
    const keyIndex = layerProp.nearestKeyIndex(keyTime)
    const keyLabel = layerProp.keyLabel(i)
    const keyValue = layerProp.keyValue(i)
    keyData.keys.push({ keyIndex, keyTime, keyValue, keyLabel })
  }

  return keyData
}

const removePropKeyByLabel = (prop: Property, labelColor: number) => {
  const keyData = getPropKeys(prop)
  for (let i = keyData.keys.length - 1; i >= 0; i--) {
    const { keyIndex, keyLabel } = keyData.keys[i];
    if (keyLabel === labelColor) {
      prop.removeKey(keyIndex);
    }
  }
}

export const restoreCardsAnimation = () => {
  const thisComp = getActiveComp()
  const cardsLayers = findCardLayers()

  // função para recuperar todos os marcadores
  const markers = []

  for (let i = 0; i < cardsLayers.length; i++) {
    const camada = cardsLayers[i]
    const layerMarker = camada.property(markerPropPath) as Property

    // only layers cards that have markers
    if (layerMarker.numKeys > 0) {
      markers.push(...getLayerMarkersData(layerMarker))
    }

  }
  // retorna todos os dados de marcadores

  const greenJumpMarkers = filterLayerMarkersByLabelAndComment(markers, keyLabel.green, "Jump")
  const yellowFlipMarkers = filterLayerMarkersByLabelAndComment(markers, keyLabel.yellow, "Flip")
  const yellowFlipStockMarkers = filterLayerMarkersByLabelAndComment(markers, keyLabel.yellow, "Flip Stock")

  const cardsMarkers = [...greenJumpMarkers, ...yellowFlipMarkers, ...yellowFlipStockMarkers]
  cardsMarkers.sort((a, b) => a.markerTime - b.markerTime)

  // aqui vem a aplicação
  const targetLayer = getTargetLayer() as Layer
  app.beginUndoGroup("teste")
  for (let card of cardsMarkers) {
    if (card.comment === "Jump") {
      jumpPos(card.markerTime, card.layer, targetLayer)
      jumpScale(card.markerTime, card.layer)
      jumpRotation(card.markerTime, card.layer)
    } else if (card.comment === "Flip") {
      flipCard(card.markerTime, card.layer)
    } else if (card.comment === "Flip Stock") {
      thisComp.time = card.markerTime
      flipStockCards(card.layer)
    }
  }
  app.endUndoGroup()

}

const filterLayerMarkersByLabelAndComment = (markerData: any, markerLabel: number, markerComment: string) => {
  const filteredMarkers = []
  for (let marker of markerData) {
    if (marker.label === markerLabel && marker.comment === markerComment) {
      filteredMarkers.push(marker)
    }
  }
  return filteredMarkers
}

const getLayerMarkersData = (prop: Property) => {
  const markerData = []

  const layer = prop.propertyGroup(prop.propertyDepth)
  for (let k = 1; k <= prop.numKeys; k++) {
    const markerValue = prop.keyValue(k)
    const { comment, label } = markerValue
    const markerTime = prop.keyTime(k)
    const markersData = { layer, markerTime, comment, label }
    markerData.push(markersData)
  }

  return markerData

}


