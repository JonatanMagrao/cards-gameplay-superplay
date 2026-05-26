import { captureCompState, findCompItemByName, requireActiveComp, restoreCompState } from "./aeft-utils";
import { getLayerProp, setExpressionSafely } from "./aeft-utils-jonatan";
import { posPropPath, scalePropPath, anchorPropPath, textPropPath, progressBarEPPath } from "./actions";
import { expProgressBar } from "../utils/expressions";
import { keyLabel } from "./actions";

const progressDelayFramesSliderName = "Progress Delay Frames"

type ProgressBarProp = {
  pos: [number, number];
  scale: [number, number];
}

const progressBarProps: Record<string, ProgressBarProp> = {
  "1920x1080": {
    pos: [1629, 92],
    scale: [100, 100]
  },
  "1080x1080": {
    pos: [822, 107],
    scale: [90, 90]
  },
  "1080x1350": {
    pos: [822, 126],
    scale: [90, 90]
  },
  "1080x1920": {
    pos: [823, 158],
    scale: [90, 90]
  },
  "default": {
    pos: [960, 540],
    scale: [100, 100]
  }
}

const setTextLayerFont = (textLayer: Layer) => {
  const textProp = getLayerProp(textLayer, textPropPath) as Property;
  const textDocument = textProp.value as TextDocument;
  const fontCandidates = ["Arial-Black", "Arial Black", "Arial-BlackMT", "ArialMT"];

  try { (textDocument as any).applyFill = true; } catch (_) { }
  try { (textDocument as any).fillColor = [1, 1, 1]; } catch (_) { }
  try { (textDocument as any).applyStroke = false; } catch (_) { }

  for (let i = 0; i < fontCandidates.length; i++) {
    try {
      textDocument.font = fontCandidates[i];
      textProp.setValue(textDocument);
      return;
    } catch (_) { }
  }

  try {
    textProp.setValue(textDocument);
  } catch (_) { }
}

const progressBarText = (thisComp: CompItem, parentLayer: Layer, startTime: number) => {
  const textLayer = thisComp.layers.addText("Progress Percentage")
  textLayer.startTime = startTime
  textLayer.guideLayer = true;
  textLayer.parent = parentLayer
  textLayer.label = keyLabel.orange
  setTextLayerFont(textLayer)
  textLayer.locked = true
  textLayer.shy = true
  thisComp.hideShyLayers = true

  const textScale = getLayerProp(textLayer, scalePropPath);
  textScale.setValue([75,75])

  return textLayer

}

const getProgressBarStartTime = (comp: CompItem): number => {
  if (comp.selectedLayers && comp.selectedLayers.length > 0) {
    return comp.selectedLayers[0].startTime;
  }

  return 0;
}

const getProgressBarReferenceLayer = (comp: CompItem): Layer | null => {
  if (comp.selectedLayers && comp.selectedLayers.length > 0) {
    return comp.selectedLayers[0];
  }

  return null;
}

const getLayerEffectByName = (layer: Layer, effectName: string): PropertyGroup | null => {
  const effects = layer.property("ADBE Effect Parade") as PropertyGroup;
  if (!effects) return null;

  for (let i = 1; i <= effects.numProperties; i++) {
    const effect = effects.property(i) as PropertyGroup;
    if (effect && effect.name === effectName) return effect;
  }

  return null;
}

const ensureSliderControl = (layer: Layer, sliderName: string, defaultValue: number): Property | null => {
  const effects = layer.property("ADBE Effect Parade") as PropertyGroup;
  if (!effects) return null;

  let sliderEffect = getLayerEffectByName(layer, sliderName);

  if (!sliderEffect) {
    sliderEffect = effects.addProperty("ADBE Slider Control") as PropertyGroup;
    sliderEffect.name = sliderName;

    const createdSlider = sliderEffect.property("ADBE Slider Control-0001") as Property;
    if (createdSlider) createdSlider.setValue(defaultValue);

    return createdSlider;
  }

  const slider = sliderEffect.property("ADBE Slider Control-0001") as Property;
  return slider || null;
}

const setProgressBarCompRefLayer = (progressBarLayer: Layer, referenceLayer: Layer | null) => {
  if (!referenceLayer) return;

  try {
    const compRefEffect = getLayerEffectByName(progressBarLayer, "Comp Ref");
    if (!compRefEffect) return;

    const layerProp = compRefEffect.property("Layer") as Property;
    if (layerProp) layerProp.setValue(referenceLayer.index);
  } catch (_) { }
}

export const addProgressBar = (presetPath: string) => {
  const thisComp = requireActiveComp("Add Progress Bar");

  if (!thisComp) return;

  const compRes = `${thisComp.width}x${thisComp.height}`

  const progressBar = findCompItemByName("Progress_Bar", false) as CompItem
  if (!progressBar) {
    alert('Project item "Progress_Bar" was not found.\nPlease import the card project assets before adding the progress bar.')
    return
  }

  const compSnapshot = captureCompState(thisComp)
  const progressStartTime = getProgressBarStartTime(thisComp)
  const progressReferenceLayer = getProgressBarReferenceLayer(thisComp)

  try {
    progressBar.label = keyLabel.orange
    const progressBarLayer = thisComp.layers.add(progressBar)
    progressBarLayer.startTime = progressStartTime
    const barPos = getLayerProp(progressBarLayer, posPropPath);
    const barScale = getLayerProp(progressBarLayer, scalePropPath);

    progressBarLayer.applyPreset(new File(presetPath))
    ensureSliderControl(progressBarLayer, progressDelayFramesSliderName, 5)
    setProgressBarCompRefLayer(progressBarLayer, progressReferenceLayer)

    const textLayer = progressBarText(thisComp, progressBarLayer, progressStartTime)
    const textAnchor = getLayerProp(textLayer, anchorPropPath);
    const textSrcTxt = getLayerProp(textLayer, textPropPath);

    setExpressionSafely(textAnchor, `
      const {left,top,width,height} = sourceRectAtTime();
      [left + width / 2, top + height / 2];
    `)

    setExpressionSafely(textSrcTxt, `
      const percent = thisComp.layer("${progressBarLayer.name}").essentialProperty("Bar Control").value;
      \`\${Math.round(percent)}%\`
    `)

    const currentProps = progressBarProps[compRes] || {
      pos: [thisComp.width / 2, thisComp.height / 2],
      scale: [100, 100]
    };

    barPos.setValue(currentProps.pos);
    barScale.setValue(currentProps.scale);

    setExpressionSafely(getLayerProp(progressBarLayer, progressBarEPPath), expProgressBar);
  } finally {
    restoreCompState(thisComp, compSnapshot)
  }

}
