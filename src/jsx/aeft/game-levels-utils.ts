import { captureCompState, findAvItemByName, getActiveComp, restoreCompState } from "./aeft-utils";
import { getLayerMarkersMetadata, getLayerProp, getPropertyBaseValueAtTime } from "./aeft-utils-jonatan";
import { ensureCardsControlsLayer, keyLabel, posPropPath, scalePropPath, zRotPropPath } from "./actions";
import { buildMarkerComment, parseMarkerComment } from "./markers";

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
  description?: string;
  tags?: string[];
  resolution: [number, number];
  cards: CardLayout[];
};

export type ApplyCardsLayoutOptions = {
  autoFitLayout?: boolean;
  layoutOrigin?: CardsLayoutOriginMetadata;
  controlPresetPath?: string;
};

export type CardsLayoutOriginMetadata = {
  schema: string;
  levelFolder: string;
  sourceJson: string;
  targetJson: string;
  targetResolution: string;
  appliedAsFallback: boolean;
  rootPath?: string;
  levelFolderPath?: string;
};

type LayoutBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

const toFiniteNumber = (value: any, fallback = 0): number => {
  const numberValue = Number(value);
  return isNaN(numberValue) ? fallback : numberValue;
};

const LAYOUT_ORIGIN_SCHEMA = "cards-gameplay.layout-origin.v1";
const LAYOUT_ORIGIN_MARKER_TIME = 0;
const LAYOUT_ORIGIN_MARKER_LABEL = keyLabel.orange;
const CARD_LAYER_NAME_PATTERN = /\[(TABLEAU|TARGET|STOCK)\]/;
const LEGACY_LAYOUT_TRANSFORM_CONTROL_LAYER_NAME = "Layout Transform Control";
const THUMBNAIL_BACKGROUND_LAYER_NAME = "__Cards_Layout_Thumbnail_Background__";
const THUMBNAIL_BACKGROUND_COLOR: [number, number, number] = [131 / 255, 131 / 255, 131 / 255];

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

const getPositionForImport = (
  position: [number, number] | [number, number, number]
): [number, number, number] => {
  const zValue = position.length > 2 && typeof position[2] === "number" ? position[2] : 0;

  return [position[0], position[1], zValue];
};

const cloneNumberTuple = (values: number[] | undefined, fallback: number[]): number[] => {
  const cloned: number[] = [];
  const source = values || fallback;

  for (let i = 0; i < source.length; i++) {
    cloned.push(toFiniteNumber(source[i], fallback[Math.min(i, fallback.length - 1)] || 0));
  }

  return cloned;
};

const cloneMarkers = (markers: [number, number, string][] | undefined): [number, number, string][] => {
  const cloned: [number, number, string][] = [];
  if (!markers) return cloned;

  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i];
    if (!marker || marker.length !== 3) continue;
    cloned.push([
      toFiniteNumber(marker[0], 0),
      toFiniteNumber(marker[1], 0),
      String(marker[2] || "")
    ]);
  }

  return cloned;
};

const cloneCardLayout = (cardLayout: CardLayout): CardLayout => {
  return {
    deckName: cardLayout.deckName,
    position: cloneNumberTuple(cardLayout.position as number[], [0, 0]) as any,
    scale: cloneNumberTuple(cardLayout.scale as number[], [100, 100]) as any,
    rotation: toFiniteNumber(cardLayout.rotation, 0),
    name: cardLayout.name,
    isTurned: !!cardLayout.isTurned,
    label: toFiniteNumber(cardLayout.label, 0),
    card: toFiniteNumber(cardLayout.card, 0),
    markers: cloneMarkers(cardLayout.markers)
  };
};

const cloneCardsLayout = (cardsLayout: CardLayout[]): CardLayout[] => {
  const cloned: CardLayout[] = [];
  for (let i = 0; i < cardsLayout.length; i++) cloned.push(cloneCardLayout(cardsLayout[i]));
  return cloned;
};

const isCardsGameplayCardLayerName = (layerName: string): boolean => {
  return CARD_LAYER_NAME_PATTERN.test(String(layerName || ""));
};

const isCardsGameplayImportedLayoutLayerName = (layerName: string): boolean => {
  const normalizedLayerName = String(layerName || "");
  return isCardsGameplayCardLayerName(normalizedLayerName)
    || normalizedLayerName === LEGACY_LAYOUT_TRANSFORM_CONTROL_LAYER_NAME;
};

const stripLevelFolderPrefix = (levelFolder: string): string => {
  return String(levelFolder || "").replace(/^lvl_/, "");
};

const isCardsLayoutOriginMetadata = (value: any): boolean => {
  return !!(value
    && value.schema === LAYOUT_ORIGIN_SCHEMA
    && typeof value.levelFolder === "string"
    && value.levelFolder !== "");
};

const normalizeCardsLayoutOriginMetadata = (origin: CardsLayoutOriginMetadata): CardsLayoutOriginMetadata => {
  return {
    schema: LAYOUT_ORIGIN_SCHEMA,
    levelFolder: String(origin.levelFolder || ""),
    sourceJson: String(origin.sourceJson || ""),
    targetJson: String(origin.targetJson || ""),
    targetResolution: String(origin.targetResolution || ""),
    appliedAsFallback: !!origin.appliedAsFallback,
    rootPath: origin.rootPath ? String(origin.rootPath) : "",
    levelFolderPath: origin.levelFolderPath ? String(origin.levelFolderPath) : ""
  };
};

const getCompMarkerProperty = (comp: CompItem): Property | null => {
  try {
    const markerProperty = (comp as any).markerProperty as Property;
    if (markerProperty) return markerProperty;
  } catch (_) { }

  try {
    const markerProperty = (comp as any).property("ADBE Marker") as Property;
    if (markerProperty) return markerProperty;
  } catch (_) { }

  return null;
};

const parseCardsLayoutOriginMarkerComment = (comment: string): CardsLayoutOriginMetadata | null => {
  const parsedComment = parseMarkerComment(comment || "");
  if (!parsedComment.data) return null;

  try {
    const parsedData = JSON.parse(parsedComment.data);
    if (!isCardsLayoutOriginMetadata(parsedData)) return null;
    return normalizeCardsLayoutOriginMetadata(parsedData as CardsLayoutOriginMetadata);
  } catch (_) { }

  return null;
};

const getCardsLayoutOriginFromComp = (comp: CompItem): CardsLayoutOriginMetadata | null => {
  const markerProperty = getCompMarkerProperty(comp) as any;
  if (!markerProperty) return null;

  let fallbackOrigin: CardsLayoutOriginMetadata | null = null;

  for (let i = 1; i <= markerProperty.numKeys; i++) {
    const markerValue = markerProperty.keyValue(i) as MarkerValue;
    const origin = parseCardsLayoutOriginMarkerComment(markerValue.comment);
    if (!origin) continue;

    if (Math.abs(markerProperty.keyTime(i) - LAYOUT_ORIGIN_MARKER_TIME) < 0.0001) {
      return origin;
    }

    if (!fallbackOrigin) fallbackOrigin = origin;
  }

  return fallbackOrigin;
};

const writeCardsLayoutOriginMarker = (comp: CompItem, origin: CardsLayoutOriginMetadata | undefined): void => {
  if (!origin || !origin.levelFolder) return;

  try {
    const markerProperty = getCompMarkerProperty(comp) as any;
    if (!markerProperty) return;

    for (let i = markerProperty.numKeys; i >= 1; i--) {
      const markerValue = markerProperty.keyValue(i) as MarkerValue;
      if (parseCardsLayoutOriginMarkerComment(markerValue.comment)) {
        markerProperty.removeKey(i);
      }
    }

    const normalizedOrigin = normalizeCardsLayoutOriginMetadata(origin);
    const title = "Layout: " + stripLevelFolderPrefix(normalizedOrigin.levelFolder);
    const markerValue = new MarkerValue(buildMarkerComment(title, JSON.stringify(normalizedOrigin)));
    markerValue.label = LAYOUT_ORIGIN_MARKER_LABEL;

    markerProperty.setValueAtTime(LAYOUT_ORIGIN_MARKER_TIME, markerValue);
  } catch (_) { }
};

const expandBounds = (bounds: LayoutBounds | null, cardBounds: LayoutBounds): LayoutBounds => {
  if (!bounds) {
    return {
      minX: cardBounds.minX,
      minY: cardBounds.minY,
      maxX: cardBounds.maxX,
      maxY: cardBounds.maxY
    };
  }

  return {
    minX: Math.min(bounds.minX, cardBounds.minX),
    minY: Math.min(bounds.minY, cardBounds.minY),
    maxX: Math.max(bounds.maxX, cardBounds.maxX),
    maxY: Math.max(bounds.maxY, cardBounds.maxY)
  };
};

const getCardLayoutBounds = (cardLayout: CardLayout): LayoutBounds | null => {
  if (!cardLayout.deckName) return null;

  const deckItem = getDeckItem(cardLayout.deckName);
  if (!deckItem) return null;

  const itemWidth = toFiniteNumber((deckItem as any).width, 0);
  const itemHeight = toFiniteNumber((deckItem as any).height, 0);
  if (itemWidth <= 0 || itemHeight <= 0) return null;

  const position = cardLayout.position as number[];
  const scale = cardLayout.scale as number[];
  const x = toFiniteNumber(position && position.length > 0 ? position[0] : 0, 0);
  const y = toFiniteNumber(position && position.length > 1 ? position[1] : 0, 0);
  const scaleX = Math.abs(toFiniteNumber(scale && scale.length > 0 ? scale[0] : 100, 100)) / 100;
  const scaleY = Math.abs(toFiniteNumber(scale && scale.length > 1 ? scale[1] : 100, 100)) / 100;
  const width = itemWidth * scaleX;
  const height = itemHeight * scaleY;
  const rotation = toFiniteNumber(cardLayout.rotation, 0) * Math.PI / 180;
  const cos = Math.abs(Math.cos(rotation));
  const sin = Math.abs(Math.sin(rotation));
  const rotatedWidth = (width * cos) + (height * sin);
  const rotatedHeight = (width * sin) + (height * cos);
  const halfWidth = rotatedWidth / 2;
  const halfHeight = rotatedHeight / 2;

  return {
    minX: x - halfWidth,
    minY: y - halfHeight,
    maxX: x + halfWidth,
    maxY: y + halfHeight
  };
};

const getCardsLayoutBounds = (cardsLayout: CardLayout[]): LayoutBounds | null => {
  let bounds: LayoutBounds | null = null;

  for (let i = 0; i < cardsLayout.length; i++) {
    const cardBounds = getCardLayoutBounds(cardsLayout[i]);
    if (cardBounds) bounds = expandBounds(bounds, cardBounds);
  }

  return bounds;
};

const transformCardLayoutToFit = (
  cardLayout: CardLayout,
  layoutCenterX: number,
  layoutCenterY: number,
  targetCenterX: number,
  targetCenterY: number,
  fitScale: number
): CardLayout => {
  const transformed = cloneCardLayout(cardLayout);
  const position = cardLayout.position as number[];
  const scale = cardLayout.scale as number[];
  const x = toFiniteNumber(position && position.length > 0 ? position[0] : 0, 0);
  const y = toFiniteNumber(position && position.length > 1 ? position[1] : 0, 0);
  const z = position && position.length > 2 ? toFiniteNumber(position[2], 0) : 0;
  const transformedScale: number[] = [];

  transformed.position = [
    targetCenterX + ((x - layoutCenterX) * fitScale),
    targetCenterY + ((y - layoutCenterY) * fitScale),
    z
  ];

  for (let i = 0; i < scale.length; i++) {
    const fallback = i < 2 ? 100 : scale[i];
    transformedScale.push(i < 2
      ? toFiniteNumber(scale[i], fallback) * fitScale
      : toFiniteNumber(scale[i], fallback)
    );
  }

  if (transformedScale.length === 0) {
    transformedScale.push(100 * fitScale);
    transformedScale.push(100 * fitScale);
  } else if (transformedScale.length === 1) {
    transformedScale.push(100 * fitScale);
  }

  transformed.scale = transformedScale as any;

  return transformed;
};

const fitCardsLayoutToComp = (
  cardsLayout: CardLayout[],
  comp: CompItem,
  sourceResolution?: [number, number]
): CardLayout[] => {
  const sourceWidth = sourceResolution ? toFiniteNumber(sourceResolution[0], 0) : 0;
  const sourceHeight = sourceResolution ? toFiniteNumber(sourceResolution[1], 0) : 0;
  const targetCenterX = comp.width / 2;
  const targetCenterY = comp.height / 2;

  if (sourceWidth > 0 && sourceHeight > 0) {
    const fitScale = Math.min(comp.width / sourceWidth, comp.height / sourceHeight);

    if (isNaN(fitScale) || fitScale <= 0) return cloneCardsLayout(cardsLayout);

    const fittedByFrame: CardLayout[] = [];
    for (let i = 0; i < cardsLayout.length; i++) {
      fittedByFrame.push(transformCardLayoutToFit(
        cardsLayout[i],
        sourceWidth / 2,
        sourceHeight / 2,
        targetCenterX,
        targetCenterY,
        fitScale
      ));
    }

    return fittedByFrame;
  }

  const bounds = getCardsLayoutBounds(cardsLayout);
  if (!bounds) return cloneCardsLayout(cardsLayout);

  const layoutWidth = Math.max(bounds.maxX - bounds.minX, 1);
  const layoutHeight = Math.max(bounds.maxY - bounds.minY, 1);
  const widthScale = comp.width / layoutWidth;
  const heightScale = comp.height / layoutHeight;
  const fitScale = Math.min(widthScale, heightScale);

  if (isNaN(fitScale) || fitScale <= 0) return cloneCardsLayout(cardsLayout);

  const layoutCenterX = bounds.minX + (layoutWidth / 2);
  const layoutCenterY = bounds.minY + (layoutHeight / 2);
  const fitted: CardLayout[] = [];

  for (let i = 0; i < cardsLayout.length; i++) {
    fitted.push(transformCardLayoutToFit(
      cardsLayout[i],
      layoutCenterX,
      layoutCenterY,
      targetCenterX,
      targetCenterY,
      fitScale
    ));
  }

  return fitted;
};

const removeCardsLayoutLayersFromComp = (comp: CompItem): void => {
  for (let i = comp.numLayers; i >= 1; i--) {
    const layer = comp.layer(i) as AVLayer | null;
    if (!layer || !isCardsGameplayImportedLayoutLayerName(layer.name)) continue;

    try {
      layer.remove();
    } catch (_) { }
  }
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
    cardLayer.parent = null;

    // Transforms
    const posValue = getLayerProp(cardLayer, posPropPath)
    const scaleValue = getLayerProp(cardLayer, scalePropPath)
    const rotValue = getLayerProp(cardLayer, zRotPropPath)

    posValue.setValue(getPositionForImport(cardLayout.position))
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

export const applyCardsLayoutFromObject = (layoutJson: CardsLayoutJson, options?: ApplyCardsLayoutOptions): string => {
  const comp = getActiveComp?.() as CompItem | null;

  if (!comp) return "No active composition found.";
  if (!layoutJson.cards) return "Invalid JSON: missing 'cards' array.";
  const autoFitLayout = !!(options && options.autoFitLayout);

  // Warn when the saved layout resolution differs from the active comp.
  if (layoutJson.resolution && !autoFitLayout) {
    const [w, h] = layoutJson.resolution;
    if (w !== comp.width || h !== comp.height) {
      alert(`Warning: Layout resolution (${w}x${h}) differs from Comp (${comp.width}x${comp.height}).`);
    }
  }

  const compSnapshot = captureCompState(comp);

  try {
    resetDeckCache();
    if (getCardsLayoutOriginFromComp(comp)) {
      removeCardsLayoutLayersFromComp(comp);
    }

    const cardsLayout = autoFitLayout
      ? fitCardsLayoutToComp(layoutJson.cards, comp, layoutJson.resolution)
      : layoutJson.cards;

    createCardLayersFromLayout(cardsLayout, comp);
    ensureCardsControlsLayer(comp, options ? options.controlPresetPath : undefined);
    writeCardsLayoutOriginMarker(comp, options ? options.layoutOrigin : undefined);
  } finally {
    restoreCompState(comp, compSnapshot);
  }

  return "OK";
};

export const getActiveCardsLayoutOrigin = (): CardsLayoutOriginMetadata | null => {
  const comp = getActiveComp?.() as CompItem | null;
  if (!comp) return null;

  return getCardsLayoutOriginFromComp(comp);
};

export const isCardLayerByName = (layerName: string): boolean => {
  return isCardsGameplayCardLayerName(layerName);
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
      sourceComp.bgColor = THUMBNAIL_BACKGROUND_COLOR;
      outputComp.bgColor = THUMBNAIL_BACKGROUND_COLOR;
    } catch (_) { }

    const backgroundLayer = sourceComp.layers.addSolid(
      THUMBNAIL_BACKGROUND_COLOR,
      THUMBNAIL_BACKGROUND_LAYER_NAME,
      compWidth,
      compHeight,
      compPixelAspect,
      compDuration
    ) as AVLayer;
    backgroundLayer.moveToEnd();
    backgroundLayer.locked = true;

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
