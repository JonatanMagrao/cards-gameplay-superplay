import { findProjectItemByName, getActiveComp } from "./aeft-utils";
import { getLayerMarkersMetadata } from "./aeft-utils-jonatan";

// ===========================
// Types
// ===========================
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

// ===========================
// Deck cache
// ===========================
const _deckItemCache: Record<string, ProjectItem> = {};

export const resetDeckCache = (): void => {
  for (const k in _deckItemCache) delete _deckItemCache[k];
};

export const getDeckItem = (deckName: string): ProjectItem | null => {
  const cached = _deckItemCache[deckName];
  if (cached) return cached;

  const deckItem = findProjectItemByName(deckName);
  if (deckItem) _deckItemCache[deckName] = deckItem;

  return deckItem ?? null;
};

// ===========================
// Shared helpers (CORRIGIDO PARA ES3)
// ===========================
export const roundToDecimals = (
  value: number | number[],
  decimals: number = 3
): number | number[] => {
  const factor = Math.pow(10, decimals);

  // CORREÇÃO AQUI: Removemos .map() e Array.isArray()
  if (value instanceof Array) {
    const rounded: number[] = [];
    for (let i = 0; i < value.length; i++) {
      rounded.push(Math.round(value[i] * factor) / factor);
    }
    return rounded;
  }
  return Math.round(value * factor) / factor;
};

// ===========================
// APPLY (Import)
// ===========================
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

    // Transforms
    (cardLayer.property("Position") as Property).setValue(cardLayout.position);
    (cardLayer.property("Scale") as Property).setValue(cardLayout.scale);
    (cardLayer.property("Rotation") as Property).setValue(cardLayout.rotation);

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
    } catch (_) {}

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
      // Ignora se não tiver override
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

  // Opcional: checar resolução
  if (layoutJson.resolution) {
    const [w, h] = layoutJson.resolution;
    if (w !== comp.width || h !== comp.height) {
      alert(`Warning: Layout resolution (${w}x${h}) differs from Comp (${comp.width}x${comp.height}).`);
    }
  }

  resetDeckCache();
  createCardLayersFromLayout(layoutJson.cards, comp);
  return "OK";
};

// ===========================
// EXPORT (Save)
// ===========================
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

export const extractCardsLayoutFromLayers = (layers: AVLayer[], decimals: number = 3): CardLayout[] => {
  const cardsLayout: CardLayout[] = [];

  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];

    const position = roundToDecimals((layer.property("Position") as Property).value as number[], decimals) as number[];
    const scale = roundToDecimals((layer.property("Scale") as Property).value as number[], decimals) as number[];
    const rotation = roundToDecimals((layer.property("Rotation") as Property).value as number, decimals) as number;

    let isTurned = false;
    let cardFaceIndex = 0;

    try {
      const overrides = layer.property("ADBE Layer Overrides") as unknown as PropertyGroup;
      const flipCard = (overrides as any).property("Flip Card") as Property;
      const cardOption = (overrides as any).property("Card Option") as Property;

      if (flipCard) isTurned = flipCard.value === 0;
      if (cardOption) cardFaceIndex = Number(cardOption.value) || 0;
    } catch (_) {}

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
    cards: extractCardsLayoutFromLayers(cardLayers, 3),
  };

  return JSON.stringify(layoutJson);
};

export const getActiveCompResolution = (): string => {
  const comp = getActiveComp?.() as CompItem | null;
  if (!comp) return "";
  return `${comp.width}x${comp.height}`;
};
