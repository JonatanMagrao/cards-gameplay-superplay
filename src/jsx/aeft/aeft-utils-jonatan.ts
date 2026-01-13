import { getActiveComp } from "./aeft-utils";

export const forEachSelectedLayer = (
  comp: CompItem,
  callback: (layer: Layer, layerIndexInComp: number) => void
) => {
  for (let i = 1; i <= comp.numLayers; i++) {
    const layer = comp.layer(i);
    if (layer.selected) callback(layer, i);
  }
};

export const mapSelectedLayers = <T>(
  comp: CompItem,
  callback: (layer: Layer, layerIndexInComp: number, selectedIndex: number) => T
): T[] => {
  const out: T[] = [];
  let s = 0;

  for (let i = 1; i <= comp.numLayers; i++) {
    const layer = comp.layer(i);
    if (!layer.selected) continue;

    out.push(callback(layer, i, s));
    s++;
  }

  return out;
};

export const filterSelectedLayers = (
  comp: CompItem,
  predicate: (layer: Layer, layerIndexInComp: number, selectedIndex: number) => boolean
): Layer[] => {
  const out: Layer[] = [];
  let s = 0;

  for (let i = 1; i <= comp.numLayers; i++) {
    const layer = comp.layer(i);
    if (!layer.selected) continue;

    if (predicate(layer, i, s)) out.push(layer);
    s++;
  }

  return out;
};


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

export const readJsonFile = (jsonPath:string) => {
    const fileRef = new File(jsonPath);

    if (!fileRef.exists) {
        alert("JSON file not found:\n" + jsonPath);
        return null;
    }
    if (!fileRef.open("r")) {
        alert("Could not open JSON file:\n" + fileRef.error);
        return null;
    }

    const fileContent = fileRef.read();
    fileRef.close();

    try {
        return JSON.parse(fileContent);
    } catch (e) {
        alert("Invalid JSON:\n" + jsonPath + "\n\n" + e.toString());
        return null;
    }
}