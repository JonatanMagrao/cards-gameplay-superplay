import { fs } from "../lib/cep/node";
import { evalTS } from "../lib/utils/bolt";
import {
  type CardsGameplayConfig,
  loadCardsGameplayConfig as loadCardsGameplayConfigFile,
  saveCardsGameplayConfigPatch as saveCardsGameplayConfigPatchFile
} from "../lib/utils/cardsConfig";

export { CONFIG_FILE_NAME } from "../lib/utils/cardsConfig";
const SHARED_ASSETS_FOLDER_NAME = "Creative_Marketing_Assets";
const SHARED_ASSETS_FOLDER_ALIASES = [SHARED_ASSETS_FOLDER_NAME, `${SHARED_ASSETS_FOLDER_NAME} `];

export const DEFAULT_ASSETS_RELATIVE_PATH = `${SHARED_ASSETS_FOLDER_NAME}/GENERAL-ASSETS/Plugins/Cards Gameplay/assets`;
export const DEFAULT_LEVELS_RELATIVE_PATH = DEFAULT_ASSETS_RELATIVE_PATH.replace(/\/assets$/, "/levels");
export const DEFAULT_TUTORIALS_RELATIVE_PATH = DEFAULT_ASSETS_RELATIVE_PATH.replace(/\/assets$/, "/video-tutorials");
export const DEFAULT_EXTENSION_RELEASES_RELATIVE_PATH = DEFAULT_ASSETS_RELATIVE_PATH.replace(/\/assets$/, "/extension-releases");

export type { CardsGameplayConfig } from "../lib/utils/cardsConfig";

export type AssetPathBundle = {
  assetEntryPoint: string;
  assetRoot: string;
  cardProject: string;
  cardsControlPresetPath: string;
  cardsPresetPath: string;
  progressBarPresetPath: string;
  expressionLibPath: string;
  sfxFolderPath: string;
  cardsDeckPath: string;
  coinsVfxFolderPath: string;
  coinIconPath: string;
};

export type AssetValidationReason =
  | "missing-entry"
  | "filesystem-unavailable"
  | "root-missing"
  | "missing-items";

export type AssetValidationResult = {
  ok: boolean;
  reason?: AssetValidationReason;
  assetEntryPoint: string;
  assetRoot: string;
  missingFolders: string[];
  missingFiles: string[];
  paths: AssetPathBundle | null;
  message?: string;
};

const requiredFolders = [
  "presets",
  "expressions",
  "progress-bar",
  "cards-deck",
  "cards-deck/Club_Deck",
  "cards-deck/Diamond_Deck",
  "cards-deck/Heart_Deck",
  "cards-deck/Spade_Deck",
  "coins-vfx",
  "sfx",
  "ui-assets",
];

const cardsJumpPresetRelativePath = "presets/cards_gameplay_jump.ffx";

const baseRequiredFiles = [
  "disney_solitaire_cards.aepx",
  "presets/cards-gameplay-control.ffx",
  cardsJumpPresetRelativePath,
  "presets/cards_gameplay_progressbar.ffx",
  "expressions/superplay-expression-lib.jsx",
  "progress-bar/bluebar.png",
  "progress-bar/frame_progress-bar.png",
  "progress-bar/progress-bar-bubble.png",
  "progress-bar/star_progress-bar.png",
  "cards-deck/card_back.png",
  "cards-deck/alpha.png",
  "cards-deck/plus_card.png",
  "cards-deck/wild_card.png",
  "ui-assets/disney_coin.png",
  "coins-vfx/coin_plus-02.mov",
  "coins-vfx/coin_plus-04.mov",
  "coins-vfx/coin_plus-06.mov",
  "coins-vfx/coin_plus-08.mov",
  "coins-vfx/coin_plus-10.mov",
  "coins-vfx/coin_plus-15.mov",
  "coins-vfx/coin_plus-20.mov",
  "coins-vfx/coin_plus-25.mov",
  "sfx/flip-stock_sfx_01.wav",
  "sfx/jump_sfx_01.wav",
  "sfx/jump_sfx_02.wav",
  "sfx/jump_sfx_03.wav",
  "sfx/jump_sfx_04.wav",
  "sfx/jump_sfx_05.wav",
  "sfx/jump_sfx_06.wav",
  "sfx/jump_sfx_07.wav",
  "sfx/jump_sfx_08.wav",
  "sfx/jump_sfx_09.wav",
  "sfx/jump_sfx_10.wav",
  "sfx/jump_sfx_11.wav",
  "sfx/jump_sfx_12.wav",
  "sfx/jump_sfx_13.wav",
  "sfx/jump_sfx_14.wav",
];

const cardDecks = [
  { folder: "Club_Deck", suffix: "Club" },
  { folder: "Diamond_Deck", suffix: "Diamond" },
  { folder: "Heart_Deck", suffix: "Heart" },
  { folder: "Spade_Deck", suffix: "Spade" },
];

const cardRanks = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "A", "J", "K", "Q"];

export const normalizeAssetPath = (value: string): string => {
  return String(value || "")
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/\/$/g, "");
};

export const joinAssetPath = (...parts: string[]): string => {
  let output = "";

  for (let i = 0; i < parts.length; i++) {
    const part = normalizeAssetPath(parts[i]);
    if (!part) continue;

    if (!output) {
      output = part;
      continue;
    }

    output = `${output}/${part.replace(/^\/+/g, "")}`;
  }

  return output;
};

const isExistingDirectory = (folderPath: string): boolean => {
  try {
    return fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory();
  } catch (_) {
    return false;
  }
};

const getSharedAssetRelativePathCandidates = (relativePath: string): string[] => {
  const normalizedRelativePath = normalizeAssetPath(relativePath);
  const suffix = normalizedRelativePath === SHARED_ASSETS_FOLDER_NAME
    ? ""
    : normalizedRelativePath.replace(`${SHARED_ASSETS_FOLDER_NAME}/`, "");

  return SHARED_ASSETS_FOLDER_ALIASES.map(folderName => joinAssetPath(folderName, suffix));
};

const resolveSharedAssetPath = (assetEntryPoint: string, relativePath: string): string => {
  const candidates = getSharedAssetRelativePathCandidates(relativePath)
    .map(candidate => joinAssetPath(assetEntryPoint, candidate));

  return candidates.find(candidate => isExistingDirectory(candidate)) || candidates[0] || "";
};

export const loadCardsGameplayConfig = (): CardsGameplayConfig => {
  return loadCardsGameplayConfigFile();
};

export const saveCardsGameplayConfigPatch = (data: CardsGameplayConfig): void => {
  saveCardsGameplayConfigPatchFile(data);
};

export const getSavedAssetEntryPoint = (): string => {
  const config = loadCardsGameplayConfig();
  return normalizeAssetPath(config.assetEntryPoint || "");
};

export const getAssetRootPath = (assetEntryPoint: string): string => {
  const normalizedEntryPoint = normalizeAssetPath(assetEntryPoint);
  return normalizedEntryPoint
    ? resolveSharedAssetPath(normalizedEntryPoint, DEFAULT_ASSETS_RELATIVE_PATH)
    : "";
};

export const getDefaultLevelsPath = (assetEntryPoint: string): string => {
  const normalizedEntryPoint = normalizeAssetPath(assetEntryPoint);
  return normalizedEntryPoint
    ? resolveSharedAssetPath(normalizedEntryPoint, DEFAULT_LEVELS_RELATIVE_PATH)
    : "";
};

export const getDefaultTutorialsPath = (assetEntryPoint: string): string => {
  const normalizedEntryPoint = normalizeAssetPath(assetEntryPoint);
  return normalizedEntryPoint
    ? resolveSharedAssetPath(normalizedEntryPoint, DEFAULT_TUTORIALS_RELATIVE_PATH)
    : "";
};

export const getDefaultExtensionReleasesPath = (assetEntryPoint: string): string => {
  const normalizedEntryPoint = normalizeAssetPath(assetEntryPoint);
  return normalizedEntryPoint
    ? resolveSharedAssetPath(normalizedEntryPoint, DEFAULT_EXTENSION_RELEASES_RELATIVE_PATH)
    : "";
};

export const getAssetPaths = (assetEntryPoint: string): AssetPathBundle => {
  const normalizedEntryPoint = normalizeAssetPath(assetEntryPoint);
  const assetRoot = getAssetRootPath(normalizedEntryPoint);
  const fromRoot = (relativePath: string): string => assetRoot ? joinAssetPath(assetRoot, relativePath) : "";

  return {
    assetEntryPoint: normalizedEntryPoint,
    assetRoot,
    cardProject: fromRoot("disney_solitaire_cards.aepx"),
    cardsControlPresetPath: fromRoot("presets/cards-gameplay-control.ffx"),
    cardsPresetPath: fromRoot(cardsJumpPresetRelativePath),
    progressBarPresetPath: fromRoot("presets/cards_gameplay_progressbar.ffx"),
    expressionLibPath: fromRoot("expressions/superplay-expression-lib.jsx"),
    sfxFolderPath: fromRoot("sfx"),
    cardsDeckPath: fromRoot("cards-deck"),
    coinsVfxFolderPath: fromRoot("coins-vfx"),
    coinIconPath: fromRoot("ui-assets/disney_coin.png"),
  };
};

export const getCoinVfxPath = (paths: AssetPathBundle, coinValue: string): string => {
  return joinAssetPath(paths.coinsVfxFolderPath, `coin_plus-${coinValue}.mov`);
};

export const getRequiredAssetFolders = (): string[] => requiredFolders.slice();

export const getRequiredAssetFiles = (): string[] => {
  const files = baseRequiredFiles.slice();

  for (let i = 0; i < cardDecks.length; i++) {
    const deck = cardDecks[i];

    for (let j = 0; j < cardRanks.length; j++) {
      const rank = cardRanks[j];
      files.push(`cards-deck/${deck.folder}/DS-Cards_${rank}_${deck.suffix}.png`);
    }
  }

  return files;
};

const hasFilesystemAccess = (): boolean => {
  return !!(
    fs &&
    typeof fs.existsSync === "function" &&
    typeof fs.statSync === "function" &&
    typeof fs.readFileSync === "function" &&
    typeof fs.writeFileSync === "function"
  );
};

const isExistingFile = (filePath: string): boolean => {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch (_) {
    return false;
  }
};

const formatConfiguredEntryPoint = (assetEntryPoint: string): string => {
  return assetEntryPoint || "(not configured)";
};

export const getMissingAssetEntryPointMessage = (): string => {
  return [
    "Assets path is not configured.",
    "",
    "Open Settings and choose the shared drive entry point before using this action.",
    "",
    "Expected relative path:",
    DEFAULT_ASSETS_RELATIVE_PATH,
  ].join("\n");
};

const getFilesystemUnavailableMessage = (): string => {
  return "CEP filesystem API is unavailable. Assets cannot be validated in this environment.";
};

export const getMissingAssetRootMessage = (assetEntryPoint: string, assetRoot: string): string => {
  return [
    "Assets folder was not found.",
    "",
    "Configured entry point:",
    formatConfiguredEntryPoint(assetEntryPoint),
    "",
    "Expected assets folder:",
    assetRoot,
  ].join("\n");
};

export const getMissingAssetItemsMessage = (
  assetEntryPoint: string,
  assetRoot: string,
  missingFolders: string[],
  missingFiles: string[]
): string => {
  const missingItems = [
    ...missingFolders.map(folderPath => `${folderPath}/`),
    ...missingFiles,
  ];

  return [
    "Assets validation failed.",
    "",
    "Missing required items:",
    ...missingItems.map(itemPath => `- ${itemPath}`),
    "",
    "Configured entry point:",
    formatConfiguredEntryPoint(assetEntryPoint),
    "",
    "Expected assets folder:",
    assetRoot,
  ].join("\n");
};

export const validateAssetEntryPoint = (assetEntryPoint: string): AssetValidationResult => {
  const normalizedEntryPoint = normalizeAssetPath(assetEntryPoint);
  const assetRoot = getAssetRootPath(normalizedEntryPoint);
  const paths = normalizedEntryPoint ? getAssetPaths(normalizedEntryPoint) : null;

  if (!normalizedEntryPoint) {
    return {
      ok: false,
      reason: "missing-entry",
      assetEntryPoint: normalizedEntryPoint,
      assetRoot,
      missingFolders: [],
      missingFiles: [],
      paths,
      message: getMissingAssetEntryPointMessage(),
    };
  }

  if (!hasFilesystemAccess()) {
    return {
      ok: false,
      reason: "filesystem-unavailable",
      assetEntryPoint: normalizedEntryPoint,
      assetRoot,
      missingFolders: [],
      missingFiles: [],
      paths,
      message: getFilesystemUnavailableMessage(),
    };
  }

  if (!isExistingDirectory(assetRoot)) {
    return {
      ok: false,
      reason: "root-missing",
      assetEntryPoint: normalizedEntryPoint,
      assetRoot,
      missingFolders: [],
      missingFiles: [],
      paths,
      message: getMissingAssetRootMessage(normalizedEntryPoint, assetRoot),
    };
  }

  const missingFolders = getRequiredAssetFolders()
    .filter(folderPath => !isExistingDirectory(joinAssetPath(assetRoot, folderPath)));
  const missingFiles = getRequiredAssetFiles()
    .filter(filePath => !isExistingFile(joinAssetPath(assetRoot, filePath)));

  if (missingFolders.length || missingFiles.length) {
    return {
      ok: false,
      reason: "missing-items",
      assetEntryPoint: normalizedEntryPoint,
      assetRoot,
      missingFolders,
      missingFiles,
      paths,
      message: getMissingAssetItemsMessage(normalizedEntryPoint, assetRoot, missingFolders, missingFiles),
    };
  }

  return {
    ok: true,
    assetEntryPoint: normalizedEntryPoint,
    assetRoot,
    missingFolders: [],
    missingFiles: [],
    paths,
  };
};

export const showHostAssetAlert = async (message: string): Promise<void> => {
  const text = String(message || "");

  try {
    await evalTS("handleShowAlert", text);
  } catch (_) {
    if (typeof window !== "undefined") window.alert(text);
  }
};

export const ensureAssetsReadyOrAlert = async (assetEntryPoint: string): Promise<AssetPathBundle | null> => {
  const validation = validateAssetEntryPoint(assetEntryPoint);

  if (validation.ok && validation.paths) return validation.paths;

  await showHostAssetAlert(validation.message || "Assets validation failed.");
  return null;
};
