import { getActiveComp } from "./aeft-utils"
import { getLayerProp } from "./jonatan-utils";

const getLastKeyValue = (camada: Layer, properties: string[]) => {
  const propValue = getLayerProp(camada, properties)
  const lastKey = propValue.numKeys
  const lastKeyValue = propValue.keyValue(lastKey)
  return lastKeyValue
}

export const moveLayerAboveLastLayer = () => {

  const thisComp = getActiveComp()
  const camada = thisComp.selectedLayers[0]

  if (camada.index > 1) {
    // lb = Layer Before
    // cl = current Layer
    const propertyList = ["ADBE Transform Group", "ADBE Position"]
    const lb = thisComp.layer(camada.index - 1)
    const stockRegExp = new RegExp("\\[STOCK\\]", "g")

    if (!stockRegExp.test(lb.name)) return;
    if (getLayerProp(lb, propertyList).numKeys < 1) {
      alert("propriedade da camada não tem keyframes")
      return
    };

    const lbLastKeyValue = getLastKeyValue(lb, propertyList)
    const lbZPos = lbLastKeyValue[2]

    const clProp = getLayerProp(camada, propertyList)
    const clLastKey = clProp.numKeys;
    const clLastKeyValue = getLastKeyValue(camada, propertyList)
    clLastKeyValue[2] = lbZPos - 0.001

    clProp.setValueAtKey(clLastKey, clLastKeyValue)

  }

}






