import { captureCompState, findAvItemByName, getActiveComp, restoreCompState } from "./aeft-utils";
import { getLayerMarkersMetadata, getLayerProp, getPropertyBaseValueAtTime } from "./aeft-utils-jonatan";
import { posPropPath, scalePropPath, zRotPropPath } from "./actions";

export type CardLayout = {
  deckName: string;
  position: [number, number] | [number, number, number];
  scale: [number, number] | [number, number, number];
  rotation: number;
  name: string;
  isTurned: boolean;
  label: number;
  card: number;
  markers: [number, number, string][];
};

export type CardsLayoutJson = {
  level: string;
  resolution: [number, number];
  cards: CardLayout[];
};

//@ts-ignore
const _deckItemCache: Record<string, AVItem> = {};

export const resetDeckCache = (): void => {
  for (const k in _deckItemCache) delete _deckItemCache[k];
};

//@ts-ignore
export const getDeckItem = (deckName: string): AVItem | null => {
  const cached = _deckItemCache[deckName];
  if (cached) return cached;

  const deckItem = findAvItemByName(deckName, false);
  if (deckItem) _deckItemCache[deckName] = deckItem;

  return deckItem ?? null;
};

export const roundToDecimals = (
  value: number | number[],
  decimals: number = 3
): number | number[] => {
  const factor = Math.pow(10, decimals);

  // Keep this ExtendScript-safe by avoiding modern array helpers.
  if (value instanceof Array) {
    const rounded: number[] = [];
    for (let i = 0; i < value.length; i++) {
      rounded.push(Math.round(value[i] * factor) / factor);
    }
    return rounded;
  }
  return Math.round(value * factor) / factor;
};

export const createCardLayersFromLayout = (
  cardsLayout: CardLayout[],
  comp: CompItem
): void => {
  let previousLayer: AVLayer | null = null;

  for (let i = 0; i < cardsLayout.length; i++) {
    const cardLayout = cardsLayout[i];

    if (!cardLayout.deckName) continue;
    const deckItem = getDeckItem(cardLayout.deckName);
    if (!deckItem) {
      alert(`Deck not found: ${cardLayout.deckName}`);
      continue;
    }

    const cardLayer = comp.layers.add(deckItem) as AVLayer;

    cardLayer.threeDLayer = true;

    // Transforms
    const posValue = getLayerProp(cardLayer, posPropPath)
    const scaleValue = getLayerProp(cardLayer, scalePropPath)
    const rotValue = getLayerProp(cardLayer, zRotPropPath)

    posValue.setValue(cardLayout.position)
    scaleValue.setValue(cardLayout.scale)
    rotValue.setValue(cardLayout.rotation)

    //   (cardLayer.property("Position") as Property).setValue(cardLayout.position);
    // (cardLayer.property("Scale") as Property).setValue(cardLayout.scale);
    // (cardLayer.property("Rotation") as Property).setValue(cardLayout.rotation);

    // Naming / label
    cardLayer.name = cardLayout.name;
    cardLayer.label = cardLayout.label;
    cardLayer.threeDLayer = true;

    // Markers (import)
    try {
      if (cardLayout.markers && cardLayout.markers.length > 0) {
        const markerProp = cardLayer.property("ADBE Marker") as any;
        if (markerProp) {
          for (let m = 0; m < cardLayout.markers.length; m++) {
            const tuple = cardLayout.markers[m];
            if (!tuple || tuple.length !== 3) continue;

            const markerTime = tuple[0];
            const markerLabel = tuple[1];
            const markerComment = tuple[2];

            const mv = new MarkerValue(markerComment);
            mv.label = markerLabel;

            markerProp.setValueAtTime(markerTime, mv);
          }
        }
      }
    } catch (_) { }

    // Custom overrides
    try {
      const overrides = cardLayer.property("ADBE Layer Overrides") as PropertyGroup;
      if (overrides) {
        const cardOption = overrides.property("Card Option") as Property;
        const cardTurned = overrides.property("Flip Card") as Property;

        if (cardOption) cardOption.setValue(cardLayout.card);
        if (cardTurned) cardTurned.setValue(cardLayout.isTurned ? 0 : 100);
      }
    } catch (e) {
      // Ignore layers without essential property overrides.
    }

    // Stacking
    if (previousLayer) cardLayer.moveAfter(previousLayer);
    previousLayer = cardLayer;
  }
};

export const applyCardsLayoutFromObject = (layoutJson: CardsLayoutJson): string => {
  const comp = getActiveComp?.() as CompItem | null;

  if (!comp) return "No active composition found.";
  if (!layoutJson.cards) return "Invalid JSON: missing 'cards' array.";

  // Warn when the saved layout resolution differs from the active comp.
  if (layoutJson.resolution) {
    const [w, h] = layoutJson.resolution;
    if (w !== comp.width || h !== comp.height) {
      alert(`Warning: Layout resolution (${w}x${h}) differs from Comp (${comp.width}x${comp.height}).`);
    }
  }

  const compSnapshot = captureCompState(comp);

  try {
    resetDeckCache();
    createCardLayersFromLayout(layoutJson.cards, comp);
  } finally {
    restoreCompState(comp, compSnapshot);
  }

  return "OK";
};

export const isCardLayerByName = (layerName: string): boolean => {
  return /\[(TABLEAU|TARGET|STOCK)\]/.test(layerName);
};

export const collectCardLayersFromComp = (comp: CompItem): AVLayer[] => {
  const matched: AVLayer[] = [];
  for (let i = 1; i <= comp.numLayers; i++) {
    const layer = comp.layer(i) as AVLayer | null;
    if (layer && isCardLayerByName(layer.name)) matched.push(layer);
  }
  return matched;
};

export const extractCardsLayoutFromLayers = (layers: AVLayer[], decimals: number = 3, sampleTime: number = 0): CardLayout[] => {
  const cardsLayout: CardLayout[] = [];

  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];

    const positionProp = getLayerProp(layer, posPropPath) as Property;
    const scaleProp = getLayerProp(layer, scalePropPath) as Property;
    const rotationProp = getLayerProp(layer, zRotPropPath) as Property;

    const position = roundToDecimals(getPropertyBaseValueAtTime(positionProp, sampleTime) as number[], decimals) as number[];
    const scale = roundToDecimals(getPropertyBaseValueAtTime(scaleProp, sampleTime) as number[], decimals) as number[];
    const rotation = roundToDecimals(getPropertyBaseValueAtTime(rotationProp, sampleTime) as number, decimals) as number;

    let isTurned = false;
    let cardFaceIndex = 0;

    try {
      const overrides = layer.property("ADBE Layer Overrides") as unknown as PropertyGroup;
      const flipCard = (overrides as any).property("Flip Card") as Property;
      const cardOption = (overrides as any).property("Card Option") as Property;

      if (flipCard) isTurned = Number(getPropertyBaseValueAtTime(flipCard, sampleTime)) === 0;
      if (cardOption) cardFaceIndex = Number(getPropertyBaseValueAtTime(cardOption, sampleTime)) || 0;
    } catch (_) { }

    const markersRaw = getLayerMarkersMetadata(layer) as any[];
    const markers: [number, number, string][] = [];

    if (markersRaw && markersRaw.length > 0) {
      for (let m = 0; m < markersRaw.length; m++) {
        const item = markersRaw[m];
        markers.push([
          Number(item.time) || 0,
          Number(item.label) || 0,
          String(item.comment || "")
        ]);
      }
    }

    //@ts-ignore
    const src = (layer as any).source as ProjectItem | undefined;
    const deckName = src ? src.name : "";

    cardsLayout.push({
      name: layer.name,
      label: layer.label,
      deckName,
      card: cardFaceIndex,
      isTurned,
      position: position as any,
      scale: scale as any,
      rotation,
      markers
    });
  }

  return cardsLayout;
};

export const getActiveCompLayoutData = (levelId: string): string => {
  const comp = getActiveComp?.() as CompItem | null;

  if (!comp) {
    return JSON.stringify({ error: "No active composition found." });
  }

  const cardLayers = collectCardLayersFromComp(comp);

  if (cardLayers.length < 1) {
    return JSON.stringify({ error: "No card layers found (TABLEAU/TARGET/STOCK)." });
  }

  const layoutJson: CardsLayoutJson = {
    level: String(levelId),
    resolution: [comp.width, comp.height],
    cards: extractCardsLayoutFromLayers(cardLayers, 3, comp.time),
  };

  return JSON.stringify(layoutJson);
};

const getThumbnailSize = (sourceWidth: number, sourceHeight: number, maxSide: number): [number, number, number] => {
  const safeMaxSide = Math.max(1, Math.floor(Number(maxSide) || 512));
  const largestSide = Math.max(sourceWidth, sourceHeight);
  const scale = largestSide > safeMaxSide ? safeMaxSide / largestSide : 1;
  const thumbnailWidth = Math.max(1, Math.round(sourceWidth * scale));
  const thumbnailHeight = Math.max(1, Math.round(sourceHeight * scale));

  return [thumbnailWidth, thumbnailHeight, scale];
}

export const saveCardsLayoutThumbnail = (layoutJson: CardsLayoutJson, thumbnailPath: string, maxSide: number = 512): string => {
  if (!layoutJson || !layoutJson.cards) return "Invalid layout data.";
  if (!thumbnailPath) return "Invalid thumbnail path.";

  const activeComp = getActiveComp?.() as CompItem | null;
  const resolution = layoutJson.resolution || [0, 0];
  const compWidth = Number(resolution[0]) || (activeComp ? activeComp.width : 1080);
  const compHeight = Number(resolution[1]) || (activeComp ? activeComp.height : 1080);
  const compPixelAspect = activeComp ? activeComp.pixelAspect : 1;
  const compDuration = activeComp ? activeComp.duration : 1;
  const compFrameRate = activeComp ? activeComp.frameRate : 30;
  const thumbnailFile = new File(thumbnailPath);
  const thumbnailSize = getThumbnailSize(compWidth, compHeight, maxSide);
  const thumbnailWidth = thumbnailSize[0];
  const thumbnailHeight = thumbnailSize[1];
  const thumbnailScale = thumbnailSize[2];
  let sourceComp: CompItem | null = null;
  let outputComp: CompItem | null = null;

  try {
    if (thumbnailFile.parent && !thumbnailFile.parent.exists) {
      return "Thumbnail folder does not exist.";
    }

    sourceComp = app.project.items.addComp(
      "__Cards_Layout_Thumbnail_Source__",
      compWidth,
      compHeight,
      compPixelAspect,
      compDuration,
      compFrameRate
    );

    outputComp = app.project.items.addComp(
      "__Cards_Layout_Thumbnail_Output__",
      thumbnailWidth,
      thumbnailHeight,
      compPixelAspect,
      compDuration,
      compFrameRate
    );

    try {
      if (activeComp) {
        sourceComp.bgColor = activeComp.bgColor;
        outputComp.bgColor = activeComp.bgColor;
      }
    } catch (_) { }

    resetDeckCache();
    createCardLayersFromLayout(layoutJson.cards, sourceComp);
    sourceComp.time = 0;

    const sourceLayer = outputComp.layers.add(sourceComp) as AVLayer;
    const sourceLayerScale = getLayerProp(sourceLayer, scalePropPath);
    const sourceLayerPos = getLayerProp(sourceLayer, posPropPath);

    sourceLayerScale.setValue([thumbnailScale * 100, thumbnailScale * 100]);
    sourceLayerPos.setValue([thumbnailWidth / 2, thumbnailHeight / 2]);

    outputComp.time = 0;
    outputComp.saveFrameToPng(0, thumbnailFile);

    return "OK";
  } catch (e) {
    //@ts-ignore
    return "Thumbnail export failed: " + e.toString();
  } finally {
    if (outputComp) {
      try {
        outputComp.remove();
      } catch (_) { }
    }

    if (sourceComp) {
      try {
        sourceComp.remove();
      } catch (_) { }
    }
  }
};

export const getActiveCompResolution = (): string => {
  const comp = getActiveComp?.() as CompItem | null;
  if (!comp) return "";
  return `${comp.width}x${comp.height}`;
};
