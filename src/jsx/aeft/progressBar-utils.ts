import { captureCompState, findCompItemByName, requireActiveComp, restoreCompState } from "./aeft-utils";
import { getLayerProp, setExpressionSafely } from "./aeft-utils-jonatan";
import { posPropPath, scalePropPath, anchorPropPath, textPropPath, progressBarEPPath, progressCardsControlsSliders, warnCardsControlsFallbacks } from "./actions";
import { expProgressBar } from "../utils/expressions";
import { keyLabel } from "./actions";

const progressBarFxMatchName = "Pseudo/cards_gameplay_progressbar"

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

const progressBarText = (thisComp: CompItem, parentLayer: Layer) => {
  const textLayer = thisComp.layers.addText("Progress Percentage")
  textLayer.guideLayer = true;
  textLayer.parent = parentLayer
  textLayer.label = keyLabel.orange
  textLayer.locked = true
  textLayer.shy = true
  thisComp.hideShyLayers = true

  const textScale = getLayerProp(textLayer, scalePropPath);
  textScale.setValue([35, 35])

  return textLayer

}

export const addProgressBar = (presetPath: string) => {
  const thisComp = requireActiveComp("Add Progress Bar");

  if (!thisComp) return;

  warnCardsControlsFallbacks(thisComp, progressCardsControlsSliders);

  const compRes = `${thisComp.width}x${thisComp.height}`

  const progressBar = findCompItemByName("Progress_Bar", false) as CompItem
  if (!progressBar) {
    alert('Project item "Progress_Bar" was not found.\nPlease import the card project assets before adding the progress bar.')
    return
  }

  const compSnapshot = captureCompState(thisComp)

  try {
    progressBar.label = keyLabel.orange
    const progressBarLayer = thisComp.layers.add(progressBar)
    const barPos = getLayerProp(progressBarLayer, posPropPath);
    const barScale = getLayerProp(progressBarLayer, scalePropPath);

    progressBarLayer.applyPreset(new File(presetPath))

    const textLayer = progressBarText(thisComp, progressBarLayer)
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
