import { getActiveComp, forEachLayer, findFolderItemByName } from "./aeft-utils";
import { getLayerProp, getKeyIndexAtTime } from "./aeft-utils-jonatan";
import { getMarkerCommentTitle } from "./markers";

export { getMarkerCommentTitle } from "./markers";

const cardLayerTags: string[] = ["TARGET", "STOCK", "TABLEAU"]

export const layerNameHasTag = (layerName: string, tagName: string): boolean => {
  const tagPattern = new RegExp("\\[" + tagName + "\\]")
  return tagPattern.test(String(layerName || ""))
}

export const getLayerCardTag = (layerName: string): string | null => {
  for (let i = 0; i < cardLayerTags.length; i++) {
    const tagName = cardLayerTags[i]
    if (layerNameHasTag(layerName, tagName)) return tagName
  }

  return null
}

export const importFilesAndCompsForCards = (filePath: string, cardsFolderName: string) => {

  const projectFolder = findFolderItemByName("Disney Solitaire Cards", false)
  if (projectFolder) {
    return
  }

  const projectPath = new File(filePath)
  const importProject = new ImportOptions(projectPath)
  const folder = app.project.importFile(importProject)
  folder.name = cardsFolderName
}

export const targetExist = () => {
  const thisComp = getActiveComp()

  for (let i = 1; i <= thisComp.numLayers; i++) {
    const camada = thisComp.layer(i)
    if (layerNameHasTag(camada.name, "TARGET")) {
      return true
    }
  }

  return false
}

export const getTargetLayer = () => {

  // if (!targetExist()) {
  //   alert("Target Layer don't exist!")
  //   return
  // }

  const thisComp = getActiveComp();
  for (let i = 1; i <= thisComp.numLayers; i++) {
    const layer = thisComp.layer(i);
    if (layerNameHasTag(layer.name, "TARGET")) {
      return layer
    }
  }

}

const getGameCardsLayers = () => {
  const thisComp = getActiveComp()
  const layerCards: Layer[] = []

  forEachLayer(thisComp, camada => {
    if (getLayerCardTag(camada.name) !== null) {
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
  easeOut?: number,
  interpolation?: KeyInterpolation
}

type InterpolationType = "LINEAR" | "BEZIER" | "HOLD"

interface KeyInterpolation {
  intIn?: InterpolationType,
  intOut?: InterpolationType
}

export const setKeyframeToLayer = (
  layerProp: Property,
  tempo: number,
  valor: number | number[],
  label: number = 0,
  easing: EaseValues = {},
  interpolation: KeyInterpolation = {}
) => {

  const {
    ease = false,
    speedIn = 0,
    speedOut = 0,
    easeIn = 33.3333,
    easeOut = 33.3333,
  } = easing

  const {
    intIn = "LINEAR",
    intOut = "LINEAR"
  } = interpolation

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

  } else {

    layerProp.setInterpolationTypeAtKey(
      keyIndex,
      KeyframeInterpolationType[intIn],
      KeyframeInterpolationType[intOut]
    )

  }

  //@ts-ignore
  layerProp.setLabelAtKey(keyIndex, label)
}

export const namedMarkerExists = (layer: Layer, markerComment: string) => {
  if (!layer) return false;

  const markerProp = layer.property("ADBE Marker") as Property;
  if (!markerProp || markerProp.numKeys < 1) return false;

  const target = String(markerComment || "").toLowerCase();

  for (let i = 1; i <= markerProp.numKeys; i++) {
    const mv = markerProp.keyValue(i);
    const comment = getMarkerCommentTitle(mv.comment).toLowerCase();

    if (comment === target) {
      return true;
    }
  }

  return false;
}

export const findCardLayers = () => {
  const thisComp = getActiveComp()
  const cardsList: Layer[] = []

  forEachLayer(thisComp, camada => {
    if (getLayerCardTag(camada.name) !== null) {
      cardsList.push(camada)
    }
  })

  return cardsList

}

export const removePropertyKeyframesByLabel = (prop: Property, labelColor: number) => {
  const keyData: PropertyKeyframesMetadata = getPropertyKeyframesMetadata(prop)
  for (let i = keyData.keys.length - 1; i >= 0; i--) {
    const { keyIndex, keyLabel } = keyData.keys[i];
    if (keyLabel === labelColor) {
      prop.removeKey(keyIndex);
    }
  }
}

export type PropertyKeyframeMeta = {
  keyIndex: number;
  keyTime: number;
  keyValue: any;      // pode variar MUITO (number, array, MarkerValue, Shape, TextDocument...)
  keyLabel: number;
};

export type PropertyKeyframesMetadata = {
  camada: Layer;      // layer do qual a property pertence
  propName: string;
  keys: PropertyKeyframeMeta[];
};

export type AEProperty = Property & {
  keyLabel: (keyIndex: number) => number;
};

export const getPropertyKeyframesMetadata = (layerProp: Property) => {
  const prop = layerProp as AEProperty;

  const keyData = {
    camada: prop.propertyGroup(prop.propertyDepth) as Layer,
    propName: prop.name,
    keys: [] as any[],
  };

  for (let i = 1; i <= prop.numKeys; i++) {
    const keyTime = prop.keyTime(i);
    const keyIndex = prop.nearestKeyIndex(keyTime);
    const keyLabel = prop.keyLabel(i);
    const keyValue = prop.keyValue(i);

    keyData.keys.push({ keyIndex, keyTime, keyValue, keyLabel });
  }

  return keyData;
};

export const filterLayerMarkersByLabelAndComment = (markerData: any, markerLabel: number, markerComment: string) => {
  const filteredMarkers = []
  for (let i = 0; i < markerData.length; i++) {
    const marker = markerData[i]
    const markerTitle = marker.title || getMarkerCommentTitle(marker.comment)

    if (marker.label === markerLabel && markerTitle === markerComment) {
      filteredMarkers.push(marker)
    }
  }
  return filteredMarkers
}
