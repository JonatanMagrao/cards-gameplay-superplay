import { getActiveComp } from "./aeft-utils";

export const deselectAllSelectedLayers = (selectedLayers: Layer[]) => {
  for (let i = 0; i < selectedLayers.length; i++) {
    selectedLayers[i].selected = false
  }
}

export const selectAllSelectedLayers = (selectedLayers: Layer[]) => {
  for (let i = 0; i < selectedLayers.length; i++) {
    selectedLayers[i].selected = true
  }
}

export const getKeyIndexAtTime = (
  prop: Property,
  timing: number,
  toleranceFrames = 1,
): number | null => {
  if (!prop || prop.numKeys === 0) return null;

  const nearestIndex = prop.nearestKeyIndex(timing);
  const keyTime = prop.keyTime(nearestIndex);
  const tolerance = toleranceFrames * frameDuration(1);

  return Math.abs(keyTime - timing) <= tolerance ? nearestIndex : null;
};

export const frameDuration = (numKeys: number) => {
  const thisComp = getActiveComp();
  return 1 / thisComp.frameRate * numKeys;
}

export const getLayerProp = (camada: any, properties: string[]) => {
  let myLayerProps = camada
  for (let i = 0; i < properties.length; i++) {
    const prop = properties[i]
    myLayerProps = myLayerProps.property(prop)
  }
  return myLayerProps
}

interface MarkerProps {
  title?: string,
  label?: number,
  duration?: number 
}

export const addMarkerToLayer = (myLayer: Layer, markerTime: number, markerProps: MarkerProps) => {

  const { markerName, markerLabel, markerDuration } = {
    markerName: markerProps.title || "",
    markerLabel: markerProps.label || 0,
    markerDuration: markerProps.duration || 0
  }

  const myMarker = new MarkerValue(markerName)
  myMarker.label = markerLabel
  myMarker.duration = markerDuration
  const markerProp = myLayer.property("ADBE Marker") as Property
  markerProp.setValueAtTime(markerTime, myMarker)

}