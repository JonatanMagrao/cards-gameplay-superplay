import { getActiveComp } from "./aeft-utils";
import { alertError } from "./errors";

interface MarkerProps {
  title?: string,
  label?: number,
  duration?: number 
}

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
        alertError("Invalid JSON:\n" + jsonPath + "\n\n" + e.toString());
        return null;
    }
}

export const distributeLayers = (xStep: number, yStep: number, reverse: boolean) => {
  const thisComp = getActiveComp();

  // Validação básica
  if (!thisComp || !(thisComp instanceof CompItem) || thisComp.selectedLayers.length < 2) return;

  // 1. Converter selectedLayers para Array padrão
  const selectedLayers: Layer[] = [];
  
  // CORREÇÃO AQUI: O índice deve ser 'i', não 'i + 1'
  for (let i = 0; i < thisComp.selectedLayers.length; i++) {
    selectedLayers.push(thisComp.selectedLayers[i]);
  }

  // 2. Ordenar por índice baseado no flag 'reverse'
  selectedLayers.sort((a, b) => {
    return reverse ? b.index - a.index : a.index - b.index;
  });

  // 3. A âncora é a primeira camada da lista ordenada (ela não se move)
  const anchorLayer = selectedLayers[0];
  const anchorPos = anchorLayer.transform.position.value as [number, number, number];

  // 4. Loop a partir da segunda camada
  for (let i = 1; i < selectedLayers.length; i++) {
    const layer = selectedLayers[i];

    // Posição = Âncora + (Passo * Índice Relativo)
    const newX = anchorPos[0] + (xStep * i);
    const newY = anchorPos[1] + (yStep * i);
    
    // Mantém Z original
    const currentZ = (layer.transform.position.value as number[])[2];

    layer.transform.position.setValue([newX, newY, currentZ]);
  }

};