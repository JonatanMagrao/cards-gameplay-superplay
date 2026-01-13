// game-levels-utils.ts
//
// Cards Levels — Apply + Export (Bolt-CEP / ExtendScript TS)
//
// What this module does:
// 1) APPLY: reads a layout JSON for the active comp resolution and creates card layers.
// 2) EXPORT: scans tagged card layers in the active comp and saves a layout JSON.
//
// Folder convention:
//   {baseDir}/level_{NNN-Name}/{WIDTH}x{HEIGHT}.json
//
// Where:
// - NNN is always 3 digits (1 => 001, 10 => 010, 100 => 100)
// - Name is whatever the user provides (no PascalCase enforcement here)
// - We keep "level_" prefix with underscore, as requested
//
// Notes:
// - This targets ExtendScript (After Effects) via Bolt-CEP.
// - AE typings vary a lot across toolchains; a few `as any` casts are intentional.
//
// Suggested filename:
// - If this is strictly for card layouts: "cards-levels-utils.ts"
// - If it will grow to other game level utilities: keep "game-levels-utils.ts"

import { readJsonFile } from "./aeft-utils-jonatan";
import { findProjectItemByName, getActiveComp } from "./aeft-utils";

// ===========================
// Types
// ===========================
type Vec2 = [number, number];
type Vec3 = [number, number, number];
type Scale2 = [number, number];
type Scale3 = [number, number, number];

export type CardLayout = {
  deckName: string;
  position: Vec2 | Vec3; // AE Position can be 2D or 3D
  scale: Scale2 | Scale3; // AE Scale usually 2D, but can be 3D
  rotation: number; // Z rotation in degrees
  name: string;
  label: number; // AE label index
  card: number; // value for your "Card Option" override
};

export type CardsLayoutJson = {
  level: string;
  resolution: [number, number];
  cards: CardLayout[];
};

// ===========================
// Deck cache (Project lookup optimization)
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
// Shared helpers
// ===========================
type NumArray = number[];

/**
 * Pads a number to 3 digits:
 * - 1   -> "001"
 * - 10  -> "010"
 * - 100 -> "100"
 */
export const padLevelNumber3 = (value: number | string): string => {
  const n = parseInt(String(value), 10);
  if (isNaN(n) || n < 0) return "000";
  const s = String(n);
  return s.length >= 3 ? s : ("000" + s).slice(-3);
};

/**
 * Normalizes a levelId to the folder format:
 *   level_{NNN-Name}
 *
 * Accepted inputs:
 * - "1_SomethingSpecial" -> "level_001-SomethingSpecial"
 * - "1-SomethingSpecial" -> "level_001-SomethingSpecial"
 * - "001-SomethingSpecial" -> "level_001-SomethingSpecial"
 * - "10" -> "level_010"
 *
 * Notes:
 * - We only replace the FIRST separator between number and name.
 * - We do not enforce PascalCase or modify name casing.
 */
export const normalizeLevelFolderName = (levelId: string): string => {
  const raw = safeTrim(levelId);

  // Match:
  //   1
  //   1_Something
  //   1-Something
  //   001_Something
  //   001-Something
  const m = raw.match(/^(\d+)(?:[_-](.+))?$/);
  if (!m) {
    // Fallback: keep as-is, but still prefix "level_"
    // (If user passes something unexpected, don't break everything.)
    return `level_${raw.replace(/_/g, "-")}`;
  }

  const numPart = padLevelNumber3(m[1]);
  const namePart = safeTrim(m[2] ?? "");

  // If there is no name part, return "level_XXX"
  if (!namePart) return `level_${numPart}`;

  // Enforce hyphen separator between number and name
  return `level_${numPart}-${namePart}`;
};

export const roundToDecimals = (value: number | NumArray, decimals: number = 3): number | NumArray => {
  const factor = Math.pow(10, decimals);

  if (value instanceof Array) {
    const rounded: number[] = [];
    for (let i = 0; i < value.length; i++) {
      rounded.push(Math.round(value[i] * factor) / factor);
    }
    return rounded;
  }

  return Math.round(value * factor) / factor;
};

export const buildResolutionFileName = (comp: CompItem): string => {
  return `${comp.width}x${comp.height}`;
};

/**
 * Builds the full JSON path for a given baseDir/levelId and comp resolution:
 *   {baseDir}/{levelFolder}/{WIDTH}x{HEIGHT}.json
 *
 * levelFolder is always normalized to: level_{NNN-Name}
 */
export const buildLayoutJsonPath = (baseDir: string, levelId: string, comp: CompItem): string => {
  const levelFolder = normalizeLevelFolderName(levelId);
  const resolutionName = buildResolutionFileName(comp);
  return `${baseDir}/${levelFolder}/${resolutionName}.json`;
};

// ===========================
// APPLY (Import) — Reads JSON and creates layers
// ===========================

/**
 * Creates card layers inside the given composition based on a layout array.
 * - Each layout item must contain a "deckName" that matches a Project panel item exactly.
 * - Applies Position/Scale/Rotation, name/label, and your custom override "Card Option".
 */
export const createCardLayersFromLayout = (cardsLayout: CardLayout[], comp: CompItem): void => {
  app.beginUndoGroup("Cards Layout Apply");

  let previousLayer: AVLayer | null = null;

  for (let i = 0; i < cardsLayout.length; i++) {
    const cardLayout = cardsLayout[i];

    if (!cardLayout.deckName) {
      alert(`Missing 'deckName' for card index ${i}.\nPlease re-export the layout JSON.`);
      break;
    }

    const deckItem = getDeckItem(cardLayout.deckName);
    if (!deckItem) {
      alert(
        `Deck item was not found in the Project panel:\n${cardLayout.deckName}\n\n` +
          `Import/rename the deck item or fix 'deckName' in the JSON.`
      );
      break;
    }

    const cardLayer = comp.layers.add(deckItem) as AVLayer;

    // Transforms
    (cardLayer.property("Position") as Property).setValue(cardLayout.position as unknown as number[]);
    (cardLayer.property("Scale") as Property).setValue(cardLayout.scale as unknown as number[]);
    (cardLayer.property("Rotation") as Property).setValue(cardLayout.rotation);

    // Naming / label
    cardLayer.name = cardLayout.name;
    cardLayer.label = cardLayout.label;

    // Custom override: "Card Option"
    // Cast to any because AE typings vary between toolchains.
    const overrides = cardLayer.property("ADBE Layer Overrides") as unknown as PropertyGroup;
    const cardOption = (overrides as any).property("Card Option") as Property;
    cardOption.setValue(cardLayout.card);

    // 3D
    cardLayer.threeDLayer = true;

    // Keep stacking order (each new card after the previous one)
    if (previousLayer) cardLayer.moveAfter(previousLayer);
    previousLayer = cardLayer;
  }

  app.endUndoGroup();
};

/**
 * Loads and applies a layout JSON for the active composition resolution.
 * It will look for:
 *   {baseDir}/level_{NNN-Name}/{WIDTH}x{HEIGHT}.json
 */
export const applyCardsLayoutFromJson = (baseDir: string, levelId: string): void => {
  const comp = getActiveComp?.() as CompItem | null;

  if (!comp) {
    alert("No active composition found.\n\nPlease open/select a composition and try again.");
    return;
  }

  const jsonPath = buildLayoutJsonPath(baseDir, levelId, comp);

  const layoutJson = readJsonFile(jsonPath) as CardsLayoutJson | null;
  if (!layoutJson) return;

  if (!layoutJson.cards || !(layoutJson.cards instanceof Array)) {
    alert(`Invalid layout JSON: missing 'cards' array.\n\nFile:\n${jsonPath}`);
    return;
  }

  // Resolution sanity check
  if (layoutJson.resolution) {
    const [w, h] = layoutJson.resolution;
    if (w !== comp.width || h !== comp.height) {
      alert(
        `Warning: JSON resolution (${w}x${h}) does not match the active comp (${comp.width}x${comp.height}).\n\n` +
          `The layout will still be applied, but values may not align as expected.`
      );
    }
  }

  resetDeckCache();
  createCardLayersFromLayout(layoutJson.cards, comp);
};

// ===========================
// EXPORT (Save) — Scans layers and writes JSON
// ===========================

/**
 * Checks if a layer name indicates it's a "card layer".
 * Matches: [TABLEAU], [TARGET], or [STOCK] anywhere in the name.
 */
export const isCardLayerByName = (layerName: string): boolean => {
  return /\[(TABLEAU|TARGET|STOCK)\]/.test(layerName);
};

/**
 * Collects card layers from a comp based on name tags.
 */
export const collectCardLayersFromComp = (comp: CompItem): AVLayer[] => {
  const matched: AVLayer[] = [];

  for (let i = 1; i <= comp.numLayers; i++) {
    const layer = comp.layer(i) as AVLayer | null;
    if (!layer) continue;

    if (isCardLayerByName(layer.name)) matched.push(layer);
  }

  return matched;
};

/**
 * Extracts a CardLayout[] from a list of layers.
 * - Position/Scale/Rotation are rounded to reduce noise.
 * - "deckName" is taken from layer.source.name (must exist to re-apply later).
 * - "card" is read from your custom override: Layer Overrides > Card Option
 */
export const extractCardsLayoutFromLayers = (layers: AVLayer[], decimals: number = 3): CardLayout[] => {
  const cardsLayout: CardLayout[] = [];

  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];

    const position = roundToDecimals(
      (layer.property("Position") as Property).value as number[],
      decimals
    ) as number[];

    const scale = roundToDecimals(
      (layer.property("Scale") as Property).value as number[],
      decimals
    ) as number[];

    const rotation = roundToDecimals(
      (layer.property("Rotation") as Property).value as number,
      decimals
    ) as number;

    const layerName = layer.name;
    const layerLabel = layer.label;

    // Card Option override
    let cardFaceIndex = 0;
    try {
      const overrides = layer.property("ADBE Layer Overrides") as unknown as PropertyGroup;
      const cardOption = (overrides as any).property("Card Option") as Property;
      cardFaceIndex = Number(cardOption.value) || 0;
    } catch (_) {
      // Keep default 0 if override is missing.
      cardFaceIndex = 0;
    }

    // Deck source (Project item name)
    const src = (layer as any).source as ProjectItem | undefined;
    const deckName = src ? src.name : "";

    cardsLayout.push({
      name: layerName,
      label: layerLabel,
      deckName,
      card: cardFaceIndex,
      position: position as any,
      scale: scale as any,
      rotation,
    });
  }

  return cardsLayout;
};

// ---------- File system (ExtendScript) ----------

/**
 * Ensures that the output folder exists:
 *   {baseDir}/level_{NNN-Name}
 */
export const ensureLevelOutputFolder = (baseDir: string, levelId: string): Folder | null => {
  const levelFolderName = normalizeLevelFolderName(levelId);
  const levelFolder = new Folder(`${baseDir}/${levelFolderName}`);

  if (!levelFolder.exists) {
    const created = levelFolder.create();
    if (!created) {
      alert(`Could not create output folder:\n${levelFolder.fsName}`);
      return null;
    }
  }

  return levelFolder;
};

export const writeLayoutJsonFile = (
  baseDir: string,
  levelId: string,
  fileNameNoExt: string,
  jsonData: CardsLayoutJson
): File | null => {
  const levelFolder = ensureLevelOutputFolder(baseDir, levelId);
  if (!levelFolder) return null;

  const outputFile = new File(`${levelFolder.fsName}/${fileNameNoExt}.json`);
  const contents = JSON.stringify(jsonData, null, 2);

  if (outputFile.exists) {
    const levelFolderName = normalizeLevelFolderName(levelId);

    const overwrite = confirm(
      `A layout file already exists for this resolution:\n\n` +
        `Game Level: ${levelFolderName.replace("level_","")}\nResolution: ${fileNameNoExt}\n\n` +
        `Do you want to overwrite it?`
    );

    if (!overwrite) {
      try {
        ($ as any).debug?.(`Save canceled by user: ${levelFolderName} / ${fileNameNoExt}`);
      } catch (_) {}
      return null;
    }
  }

  if (!outputFile.open("w")) {
    alert(`Could not write file:\n${outputFile.error}`);
    return null;
  }

  outputFile.write(contents);
  outputFile.close();

  // ✅ RIGHT PLACE: only after writing + closing succeeded
  alert(`Layout saved successfully:\n${levelId}`);

  try {
    ($ as any).debug?.(`Layout saved:\n${levelId}`);
  } catch (_) {}

  return outputFile;
};

export type SaveLayoutResult =
  | { ok: true; code: "OK"; filePath: string }
  | { ok: false; code: "CANCEL_OVERWRITE" }
  | { ok: false; code: "ERROR"; message: string };


/**
 * Exports the active comp layout to JSON.
 * It will save into:
 *   {baseDir}/level_{NNN-Name}/{WIDTH}x{HEIGHT}.json
 */
export const exportCardsLayoutToJson = (baseDir: string, levelId: string, decimals: number = 3): File | null => {
  const comp = getActiveComp?.() as CompItem | null;

  if (!comp) {
    alert("No active composition found.\n\nPlease open/select a composition and try again.");
    return null;
  }

  const cardLayers = collectCardLayersFromComp(comp);

  if (cardLayers.length < 1) {
    alert(
      "No card layers were found in the active comp.\n\n" +
        "Expected layer names containing one of these tags:\n" +
        "[TABLEAU], [TARGET], or [STOCK]"
    );
    return null;
  }

  const layoutJson: CardsLayoutJson = {
    level: String(levelId),
    resolution: [comp.width, comp.height],
    cards: extractCardsLayoutFromLayers(cardLayers, decimals),
  };

  const fileName = buildResolutionFileName(comp);
  return writeLayoutJsonFile(baseDir, levelId, fileName, layoutJson);
};

export const safeTrim = (s: any): string => String(s).replace(/^\s+|\s+$/g, "");
