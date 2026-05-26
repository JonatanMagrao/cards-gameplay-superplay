import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { child_process, fs, path, os } from "../../../lib/cep/node";
import { csi, evalFile, evalTS } from "../../../lib/utils/bolt";
import ChevronIcon from "../../../assets/icons/chevron.svg";
import CachedIcon from "../../../assets/icons/cached.svg";
import {
  LayoutIndexEntry,
  parseTags,
  setLayoutFavorite
} from "./layoutIndex";
import {
  clearLayoutCache,
  getLayoutCacheRootPath,
  readLayoutCacheEntries,
  syncLayoutCacheFromRemote,
  syncSingleLayoutToCache
} from "./layoutCache";
import {
  ensureAssetsReadyOrAlert,
  getAssetRootPath,
  getDefaultLevelsPath,
  getDefaultTutorialsPath,
  loadCardsGameplayConfig,
  normalizeAssetPath,
  saveCardsGameplayConfigPatch,
  validateAssetEntryPoint
} from "../../assetPaths";
import "./LayoutsPanel.scss";

// --- CONFIGURAÇÃO DE PERSISTÊNCIA ---
const HOME_DIR = os.homedir();
const FLYOUT_REFRESH_EVENT = "cards-gameplay.refreshFlyoutMenu";
const THUMBNAIL_MAX_SIDE = 512;
const THUMBNAIL_JPEG_QUALITY = 0.82;
const LAYOUT_ORIGIN_SCHEMA = "cards-gameplay.layout-origin.v1";
const CANONICAL_LAYOUT_JSON_NAME = "layout.json";
const CANONICAL_THUMBNAIL_NAME = "thumbnail.jpg";
const LEGACY_RESOLUTION_ASSET_RE = /^\d{2,5}x\d{2,5}\.(json|jpe?g|png)$/i;
const LEVEL_NAME_PATTERN = /^\d{3}-\d{3}_[A-Za-z0-9_]+$/;
const LEVEL_NAME_FORMAT_HINT = "Use the format 000-000_Name, for example: 018-011_NewWorld.";

// Helpers
const loadConfig = loadCardsGameplayConfig;
const saveConfig = saveCardsGameplayConfigPatch;

const refreshFlyoutMenu = () => {
  try {
    window.dispatchEvent(new Event(FLYOUT_REFRESH_EVENT));
  } catch (e) {
    console.error(e);
  }
};

const safeTrim = (s: any) => String(s).replace(/^\s+|\s+$/g, "");

const normalizeLevelFolderNameUI = (levelId: string): string => {
  return `lvl_${safeTrim(levelId)}`;
};

const isValidLevelName = (levelName: string): boolean => {
  return LEVEL_NAME_PATTERN.test(safeTrim(levelName));
};

const getImageObjectUrl = (imagePath: string): string | null => {
  if (!imagePath || !fs.existsSync(imagePath)) return null;

  try {
    const mimeType = /\.jpe?g$/i.test(imagePath) ? "image/jpeg" : "image/png";
    const buffer = fs.readFileSync(imagePath) as Buffer;
    const uint8Array = new Uint8Array(buffer);
    const blob = new Blob([uint8Array], { type: mimeType });
    return URL.createObjectURL(blob);
  } catch (e) {
    console.error(e);
    return null;
  }
};

const deleteFileIfExists = (filePath: string) => {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (e) {
    console.error(e);
  }
};

const deleteFolderIfEmpty = (folderPath: string) => {
  try {
    if (!folderPath || !fs.existsSync(folderPath)) return;
    const entries = fs.readdirSync(folderPath) as string[];
    if (entries.length === 0) fs.rmdirSync(folderPath);
  } catch (e) {
    console.error(e);
  }
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const waitForReadableFile = async (filePath: string, timeoutMs: number = 5000): Promise<boolean> => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      if (filePath && fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        if (stat && stat.size > 0) return true;
      }
    } catch (_) { }

    await sleep(150);
  }

  return false;
};

const convertImageToJpeg = (
  sourcePath: string,
  targetPath: string,
  maxSide: number,
  quality: number
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const sourceUrl = getImageObjectUrl(sourcePath);
    if (!sourceUrl) {
      reject(new Error("Could not load thumbnail source."));
      return;
    }

    const img = new Image();

    img.onload = () => {
      try {
        const largestSide = Math.max(img.width, img.height);
        const scale = largestSide > maxSide ? maxSide / largestSide : 1;
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));

        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not create thumbnail canvas.");

        ctx.fillStyle = "#838383";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, "");
        fs.writeFileSync(targetPath, Buffer.from(base64, "base64"));
        URL.revokeObjectURL(sourceUrl);
        resolve();
      } catch (e) {
        URL.revokeObjectURL(sourceUrl);
        reject(e);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(sourceUrl);
      reject(new Error("Could not decode thumbnail source."));
    };

    img.src = sourceUrl;
  });
};

const getLevelPreviewPath = (rootPath: string, levelFolder: string, preferredResolution: string): string | null => {
  if (!rootPath || !levelFolder) return null;

  const levelFolderPath = `${rootPath.replace(/\\/g, "/")}/${levelFolder}`;
  if (!fs.existsSync(levelFolderPath)) return null;

  const canonicalPreviewPaths = [
    `${levelFolderPath}/${CANONICAL_THUMBNAIL_NAME}`,
    `${levelFolderPath}/thumbnail.jpeg`,
    `${levelFolderPath}/thumbnail.png`,
  ];

  for (let i = 0; i < canonicalPreviewPaths.length; i++) {
    if (fs.existsSync(canonicalPreviewPaths[i])) return canonicalPreviewPaths[i];
  }

  if (preferredResolution) {
    const preferredJpgPath = `${levelFolderPath}/${preferredResolution}.jpg`;
    const preferredJpegPath = `${levelFolderPath}/${preferredResolution}.jpeg`;
    const preferredPngPath = `${levelFolderPath}/${preferredResolution}.png`;

    if (fs.existsSync(preferredJpgPath)) return preferredJpgPath;
    if (fs.existsSync(preferredJpegPath)) return preferredJpegPath;
    if (fs.existsSync(preferredPngPath)) return preferredPngPath;
  }

  try {
    const entries = fs.readdirSync(levelFolderPath) as string[];
    entries.sort();

    for (let i = 0; i < entries.length; i++) {
      const entryName = entries[i];
      if (/\.jpe?g$/i.test(entryName)) return `${levelFolderPath}/${entryName}`;
    }

    for (let i = 0; i < entries.length; i++) {
      const entryName = entries[i];
      if (/\.png$/i.test(entryName)) return `${levelFolderPath}/${entryName}`;
    }
  } catch (e) {
    console.error(e);
  }

  return null;
};

const applyLayoutEntries = (
  entries: LayoutIndexEntry[],
  setLayoutEntries: React.Dispatch<React.SetStateAction<LayoutIndexEntry[]>>,
  setLevels: React.Dispatch<React.SetStateAction<string[]>>
) => {
  setLayoutEntries(entries);
  setLevels(entries.map(entry => entry.folder));
};

type LevelJsonPath = {
  filePath: string;
  isExactResolution: boolean;
};

type CardsLayoutOriginMetadata = {
  schema?: string;
  levelFolder?: string;
};

type SaveLayoutDialogResult = {
  cancelled?: boolean;
  name?: string;
  tags?: string;
  description?: string;
  title?: string;
};

type ExistingLayoutMetadata = {
  name: string;
  description: string;
  tags: string[];
};

const getErrorMessage = (error: any): string => {
  return String(error && error.message ? error.message : error || "");
};

const isMetadataOnlySaveFallbackError = (error: any): boolean => {
  const message = getErrorMessage(error);
  return message.indexOf("No active composition found.") >= 0
    || message.indexOf("No card layers found (TABLEAU/TARGET/STOCK).") >= 0;
};

const normalizePath = (value: string): string => String(value || "").replace(/\\/g, "/");

const getFileNameFromPath = (filePath: string): string => {
  const normalized = normalizePath(filePath);
  const parts = normalized.split("/");
  return parts[parts.length - 1] || normalized;
};

const createTempSiblingPath = (targetPath: string, suffix: string): string => {
  const folderPath = normalizePath(path.dirname(targetPath));
  const fileName = getFileNameFromPath(targetPath);
  const unique = `${Date.now()}-${Math.round(Math.random() * 1000000)}`;
  return normalizePath(path.join(folderPath, `.${fileName}.${unique}.${suffix}`));
};

const replaceFileWithTemp = (tempPath: string, targetPath: string): void => {
  if (!tempPath || !targetPath) return;

  try {
    fs.renameSync(tempPath, targetPath);
  } catch (e) {
    if (!fs.existsSync(targetPath)) throw e;
    fs.unlinkSync(targetPath);
    fs.renameSync(tempPath, targetPath);
  }
};

const deleteLegacyResolutionAssets = (levelFolderPath: string): void => {
  try {
    if (!levelFolderPath || !fs.existsSync(levelFolderPath)) return;

    const entries = fs.readdirSync(levelFolderPath) as string[];
    for (let i = 0; i < entries.length; i++) {
      const entryName = entries[i];
      if (!LEGACY_RESOLUTION_ASSET_RE.test(entryName)) continue;

      const filePath = normalizePath(path.join(levelFolderPath, entryName));
      try {
        if (fs.statSync(filePath).isFile()) fs.unlinkSync(filePath);
      } catch (e) {
        console.error(e);
      }
    }
  } catch (e) {
    console.error(e);
  }
};

const getLevelLabelFromFolderName = (levelFolder: string): string => {
  return String(levelFolder || "").replace(/^lvl_/, "");
};

const isLayoutOriginMetadata = (value: any): value is CardsLayoutOriginMetadata => {
  return !!(
    value &&
    value.schema === LAYOUT_ORIGIN_SCHEMA &&
    typeof value.levelFolder === "string" &&
    value.levelFolder !== ""
  );
};

const parseResolutionString = (value: string): [number, number] | null => {
  const match = String(value || "").match(/(\d{2,5})x(\d{2,5})/i);
  if (!match) return null;

  const width = parseInt(match[1], 10);
  const height = parseInt(match[2], 10);
  if (!width || !height) return null;

  return [width, height];
};

const getLayoutResolutionString = (layoutData: any): string => {
  if (!layoutData || !layoutData.resolution || layoutData.resolution.length < 2) return "";
  return `${layoutData.resolution[0]}x${layoutData.resolution[1]}`;
};

const getResolutionFallbackScore = (candidate: string, preferred: string): number => {
  const candidateSize = parseResolutionString(candidate);
  const preferredSize = parseResolutionString(preferred);

  if (!candidateSize || !preferredSize) return Number.MAX_VALUE;

  const candidateRatio = candidateSize[0] / candidateSize[1];
  const preferredRatio = preferredSize[0] / preferredSize[1];
  const ratioDistance = Math.abs(candidateRatio - preferredRatio) * 1000000;
  const areaDistance = Math.abs((candidateSize[0] * candidateSize[1]) - (preferredSize[0] * preferredSize[1]));

  return ratioDistance + areaDistance;
};

const getLevelJsonPath = (levelFolderPath: string, preferredResolution: string): LevelJsonPath | null => {
  if (!levelFolderPath || !fs.existsSync(levelFolderPath)) return null;

  const canonicalJsonPath = normalizePath(path.join(levelFolderPath, CANONICAL_LAYOUT_JSON_NAME));
  if (fs.existsSync(canonicalJsonPath)) {
    return { filePath: canonicalJsonPath, isExactResolution: false };
  }

  if (preferredResolution) {
    const exactPath = `${levelFolderPath}/${preferredResolution}.json`;
    if (fs.existsSync(exactPath)) {
      return { filePath: exactPath, isExactResolution: true };
    }
  }

  try {
    const entries = fs.readdirSync(levelFolderPath) as string[];
    const jsonFiles: string[] = [];

    for (let i = 0; i < entries.length; i++) {
      const entryName = entries[i];
      if (/\.json$/i.test(entryName)) jsonFiles.push(entryName);
    }

    if (!jsonFiles.length) return null;
    jsonFiles.sort();

    let selectedFile = jsonFiles[0];
    let selectedScore = getResolutionFallbackScore(selectedFile, preferredResolution);

    for (let i = 1; i < jsonFiles.length; i++) {
      const score = getResolutionFallbackScore(jsonFiles[i], preferredResolution);
      if (score < selectedScore) {
        selectedFile = jsonFiles[i];
        selectedScore = score;
      }
    }

    return {
      filePath: `${levelFolderPath}/${selectedFile}`,
      isExactResolution: false
    };
  } catch (e) {
    console.error(e);
  }

  return null;
};

const reloadExtendScript = async () => {
  if (!window.cep) return;

  const extRoot = csi.getSystemPath("extension").replace(/\\/g, "/");
  const jsxSrc = `${extRoot}/jsx/index.js`;
  const jsxBinSrc = `${extRoot}/jsx/index.jsxbin`;

  if (fs.existsSync(jsxSrc)) {
    await evalFile(jsxSrc);
  } else if (fs.existsSync(jsxBinSrc)) {
    await evalFile(jsxBinSrc);
  }
};

const showHostAlert = async (message: any) => {
  const text = String(message || "");
  try {
    await reloadExtendScript();
    await evalTS("handleShowAlert", text);
  } catch (e) {
    window.alert(text);
  }
};

const showHostConfirm = async (message: any): Promise<boolean> => {
  const text = String(message || "");
  try {
    await reloadExtendScript();
    return await evalTS("handleShowConfirm", text);
  } catch (e) {
    return window.confirm(text);
  }
};

type Props = {
  baseDirDefault?: string;
  assetEntryPoint: string;
  onAssetEntryPointChange: (assetEntryPoint: string) => void;
  onSettingsClose?: () => void;
  settingsOpen?: boolean;
  showContent?: boolean;
};

export const LayoutsPanel: React.FC<Props> = ({
  baseDirDefault = "D:/Downloads/cardsLevels",
  assetEntryPoint,
  onAssetEntryPointChange,
  onSettingsClose,
  settingsOpen = false,
  showContent = true
}) => {
  const [baseDir, setBaseDir] = useState(baseDirDefault);
  const [persistentSavePath, setPersistentSavePath] = useState<string | null>(null);
  const [persistentTutorialsPath, setPersistentTutorialsPath] = useState<string | null>(null);
  const [customCachePath, setCustomCachePath] = useState("");
  const [trimCoveredCards, setTrimCoveredCards] = useState(true);
  const [levels, setLevels] = useState<string[]>([]);
  const [layoutEntries, setLayoutEntries] = useState<LayoutIndexEntry[]>([]);
  const [query, setQuery] = useState("");
  const [selectedFolder, setSelectedFolder] = useState("");
  const [compResolution, setCompResolution] = useState("");
  const [layoutPreviewSrc, setLayoutPreviewSrc] = useState<string | null>(null);
  const [layoutPreviewPath, setLayoutPreviewPath] = useState("");
  const [thumbnailVersion, setThumbnailVersion] = useState(0);
  const [isCacheRefreshing, setIsCacheRefreshing] = useState(false);
  const [cacheRefreshProgress, setCacheRefreshProgress] = useState(0);
  const [levelMenuOpen, setLevelMenuOpen] = useState(false);
  const levelInputRef = useRef<HTMLInputElement | null>(null);
  const levelMenuRef = useRef<HTMLDivElement | null>(null);
  const cacheRefreshInFlightRef = useRef(false);
  const remoteRootPath = useMemo(() => normalizePath(persistentSavePath || baseDir || ""), [baseDir, persistentSavePath]);
  const cacheRootPath = useMemo(() => getLayoutCacheRootPath(remoteRootPath, customCachePath), [customCachePath, remoteRootPath]);
  const assetRootPath = useMemo(() => getAssetRootPath(assetEntryPoint), [assetEntryPoint]);
  const defaultTutorialsPath = useMemo(() => getDefaultTutorialsPath(assetEntryPoint), [assetEntryPoint]);
  const tutorialsRootPath = useMemo(
    () => normalizePath(persistentTutorialsPath || defaultTutorialsPath || ""),
    [defaultTutorialsPath, persistentTutorialsPath]
  );

  // --- INIT ---
  useEffect(() => {
    const config = loadConfig();
    const defaultLevelsPath = normalizePath(baseDirDefault || "");

    setPersistentSavePath(null);
    setBaseDir(defaultLevelsPath || baseDirDefault);

    if (config.cachePath) setCustomCachePath(normalizePath(config.cachePath));
    setPersistentTutorialsPath(null);
    if (typeof config.trimCoveredCards === "boolean") setTrimCoveredCards(config.trimCoveredCards);
  }, [baseDirDefault]);

  useEffect(() => {
    let isMounted = true;

    evalTS("getCompResolution").then((resolution) => {
      if (isMounted && resolution) setCompResolution(String(resolution));
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // --- REFRESH ---
  const refreshLevels = useCallback(async (): Promise<LayoutIndexEntry[]> => {
    try {
      if (!cacheRootPath || !fs.existsSync(cacheRootPath)) {
        setLevels([]);
        setLayoutEntries([]);
        setSelectedFolder("");
        return [];
      }

      const entries = await readLayoutCacheEntries(remoteRootPath, customCachePath);
      applyLayoutEntries(entries, setLayoutEntries, setLevels);
      if (!entries.length) setSelectedFolder("");
      return entries;
    } catch (e) {
      console.error(e);
      setLevels([]);
      setLayoutEntries([]);
      return [];
    }
  }, [cacheRootPath, customCachePath, remoteRootPath]);

  const syncCacheFromRemote = useCallback(async (showErrors: boolean = true): Promise<LayoutIndexEntry[]> => {
    if (cacheRefreshInFlightRef.current) return [];

    try {
      if (!remoteRootPath || !fs.existsSync(remoteRootPath)) {
        if (showErrors) await showHostAlert("Select a levels folder before refreshing the local cache.");
        return [];
      }

      cacheRefreshInFlightRef.current = true;
      setCacheRefreshProgress(0);
      setIsCacheRefreshing(true);
      await sleep(40);
      const result = await syncLayoutCacheFromRemote(remoteRootPath, customCachePath, {
        onProgress: progress => {
          const total = Math.max(1, progress.totalFolders);
          setCacheRefreshProgress(Math.round((progress.completedFolders / total) * 100));
        }
      });
      setCacheRefreshProgress(100);
      applyLayoutEntries(result.entries, setLayoutEntries, setLevels);
      if (!result.entries.length) setSelectedFolder("");
      setThumbnailVersion(v => v + 1);
      await sleep(180);
      return result.entries;
    } catch (e) {
      console.error(e);
      if (showErrors) await showHostAlert(`Could not refresh local layouts cache: ${e}`);
      return [];
    } finally {
      cacheRefreshInFlightRef.current = false;
      setIsCacheRefreshing(false);
      setCacheRefreshProgress(0);
    }
  }, [customCachePath, remoteRootPath]);

  useEffect(() => {
    let isMounted = true;

    refreshLevels().then(entries => {
      if (!isMounted || entries.length || !remoteRootPath) return;

      try {
        if (fs.existsSync(remoteRootPath)) syncCacheFromRemote(false);
      } catch (_) { }
    });

    return () => {
      isMounted = false;
    };
  }, [refreshLevels, remoteRootPath, syncCacheFromRemote]);

  useEffect(() => {
    if (settingsOpen) refreshLevels();
  }, [refreshLevels, settingsOpen]);

  useEffect(() => {
    if (!settingsOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && onSettingsClose) onSettingsClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSettingsClose, settingsOpen]);

  const filtered = useMemo(() => {
    const q = safeTrim(query).toLowerCase();
    if (!q) return levels;

    const tokens = q.split(/[\s,]+/).filter(Boolean);

    return levels.filter((folder) => {
      const entry = layoutEntries.find(item => item.folder === folder);
      const searchable = [
        folder,
        folder.replace(/^lvl_/, ""),
        entry ? entry.name : "",
        entry ? entry.description : "",
        entry ? entry.sourceResolution : "",
        entry ? entry.tags.join(" ") : "",
      ].join(" ").toLowerCase();

      for (let i = 0; i < tokens.length; i++) {
        if (searchable.indexOf(tokens[i]) < 0) return false;
      }

      return true;
    });
  }, [layoutEntries, levels, query]);

  const selectedLayoutEntry = useMemo(() => {
    for (let i = 0; i < layoutEntries.length; i++) {
      if (layoutEntries[i].folder === selectedFolder) return layoutEntries[i];
    }
    return null;
  }, [layoutEntries, selectedFolder]);

  useEffect(() => {
    if (!selectedFolder && filtered.length) setSelectedFolder(filtered[0]);
    else if (selectedFolder && !filtered.includes(selectedFolder)) setSelectedFolder(filtered[0] ?? "");
  }, [filtered, selectedFolder]);

  useEffect(() => {
    const indexedPreviewPath = selectedLayoutEntry && selectedLayoutEntry.thumbnailPath && fs.existsSync(selectedLayoutEntry.thumbnailPath)
      ? selectedLayoutEntry.thumbnailPath
      : "";
    const previewPath = indexedPreviewPath || getLevelPreviewPath(cacheRootPath || remoteRootPath, selectedFolder, compResolution);
    const objectUrl = previewPath ? getImageObjectUrl(previewPath) : null;

    setLayoutPreviewSrc(objectUrl);
    setLayoutPreviewPath(previewPath || "");

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [cacheRootPath, remoteRootPath, selectedFolder, selectedLayoutEntry, compResolution, thumbnailVersion]);

  useEffect(() => {
    const menu = levelMenuRef.current;
    if (!levelMenuOpen || !menu || !selectedFolder) return;

    const buttons = menu.getElementsByTagName("button");
    for (let i = 0; i < buttons.length; i++) {
      const button = buttons[i];
      if (button.getAttribute("data-folder") === selectedFolder) {
        button.scrollIntoView({ block: "nearest" });
        break;
      }
    }
  }, [filtered, levelMenuOpen, selectedFolder]);


  // -------------------------
  // APPLY
  // -------------------------
  const handleApply = useCallback(async () => {
    if (!selectedFolder) {
      await showHostAlert("Select a level folder first.");
      return;
    }

    const resolution = await evalTS("getCompResolution");
    if (!resolution) {
      await showHostAlert("No active comp found.");
      return;
    }
    setCompResolution(String(resolution));

    let activeLayoutOrigin: CardsLayoutOriginMetadata | null = null;
    try {
      await reloadExtendScript();
      const origin = await evalTS("handleGetActiveCardsLayoutOrigin");
      if (isLayoutOriginMetadata(origin)) activeLayoutOrigin = origin;
    } catch (e) {
      console.error(e);
    }

    if (activeLayoutOrigin && activeLayoutOrigin.levelFolder && activeLayoutOrigin.levelFolder !== selectedFolder) {
      const currentLevelLabel = getLevelLabelFromFolderName(activeLayoutOrigin.levelFolder);
      const selectedLevelLabel = selectedLayoutEntry
        ? selectedLayoutEntry.name || selectedLayoutEntry.label || getLevelLabelFromFolderName(selectedFolder)
        : getLevelLabelFromFolderName(selectedFolder);
      const replaceCurrentLevel = await showHostConfirm(
        `The active comp already has level "${currentLevelLabel}" applied.\nApply "${selectedLevelLabel}" instead?`
      );

      if (!replaceCurrentLevel) return;
    }

    const readyAssets = await ensureAssetsReadyOrAlert(assetEntryPoint);
    if (!readyAssets) return;

    const remoteRoot = remoteRootPath;
    const cachedLevelFolder = cacheRootPath ? `${cacheRootPath}/${selectedFolder}` : "";
    const remoteLevelFolder = remoteRoot ? `${remoteRoot}/${selectedFolder}` : "";

    const indexedJsonPath = selectedLayoutEntry && selectedLayoutEntry.jsonPath && fs.existsSync(selectedLayoutEntry.jsonPath)
      ? selectedLayoutEntry.jsonPath
      : "";
    const cachedFallbackJsonPath = getLevelJsonPath(cachedLevelFolder, String(resolution));
    const remoteFallbackJsonPath = (cachedFallbackJsonPath || indexedJsonPath) ? null : getLevelJsonPath(remoteLevelFolder, String(resolution));
    const layoutJsonFilePath = (cachedFallbackJsonPath ? cachedFallbackJsonPath.filePath : "")
      || indexedJsonPath
      || (remoteFallbackJsonPath ? remoteFallbackJsonPath.filePath : "");

    if (!layoutJsonFilePath) {
      await showHostAlert(`No layout JSON found for: ${selectedFolder}`);
      return;
    }

    try {
      const raw = fs.readFileSync(layoutJsonFilePath, "utf-8");
      const layoutData = JSON.parse(raw);
      const targetResolution = String(resolution);
      const sourceResolution = layoutData && layoutData.resolution
        ? `${layoutData.resolution[0]}x${layoutData.resolution[1]}`
        : "";
      const isExactResolution = sourceResolution === targetResolution;
      const applyOptions = {
        autoFitLayout: !isExactResolution,
        controlPresetPath: readyAssets.cardsControlPresetPath,
        layoutOrigin: {
          schema: LAYOUT_ORIGIN_SCHEMA,
          levelFolder: selectedFolder
        }
      };

      await reloadExtendScript();
      const res = await evalTS("handleApplyCardsLayout", layoutData, readyAssets.cardProject, applyOptions);
      if (res !== "OK" && res !== undefined) await showHostAlert(`Error applying: ${res}`);

    } catch (e) {
      await showHostAlert("Error reading JSON file.");
      console.error(e);
    }
  }, [assetEntryPoint, cacheRootPath, remoteRootPath, selectedFolder, selectedLayoutEntry]);

  const selectTargetRoot = useCallback(async (dialogTitle: string): Promise<string | null> => {
    if (!window.cep) {
      await showHostAlert("CEP API unavailable.");
      return null;
    }

    const result = window.cep.fs.showOpenDialogEx(false, true, dialogTitle, baseDir, []);
    if (result.err !== 0 || !result.data || result.data.length === 0) return null;

    const selectedTarget = normalizePath(result.data[0] || "");
    if (!selectedTarget) return null;

    saveConfig({ savePath: selectedTarget });
    setPersistentSavePath(selectedTarget);
    setBaseDir(selectedTarget);

    return selectedTarget;
  }, [baseDir]);

  const getTargetRoot = useCallback(async (dialogTitle: string): Promise<string | null> => {
    const targetRoot = remoteRootPath ? normalizePath(remoteRootPath) : "";
    return targetRoot || await selectTargetRoot(dialogTitle);
  }, [remoteRootPath, selectTargetRoot]);

  const getActiveLayoutOrigin = useCallback(async (): Promise<CardsLayoutOriginMetadata | null> => {
    try {
      const origin = await evalTS("handleGetActiveCardsLayoutOrigin");
      return isLayoutOriginMetadata(origin) ? origin : null;
    } catch (e) {
      console.error(e);
      return null;
    }
  }, []);

  const readActiveLayoutData = useCallback(async (levelName: string): Promise<any> => {
    const jsonString = await evalTS("handleSaveCardsLayout", levelName || "New Layout");

    let layoutData: any;
    try {
      layoutData = JSON.parse(jsonString);
    } catch (e) {
      throw new Error(`Error from AE: ${jsonString}`);
    }

    if (layoutData.error) throw new Error(`Export failed: ${layoutData.error}`);
    if (!layoutData.resolution || layoutData.resolution.length < 2) throw new Error("Export failed: invalid layout resolution.");

    return layoutData;
  }, []);

  const createTemporaryThumbnail = useCallback(async (rootPathInput: string, layoutData: any): Promise<string> => {
    const rootPath = normalizePath(rootPathInput);
    const tempFolderPath = normalizePath(path.join(rootPath, ".cards-layout-temp"));
    if (!fs.existsSync(tempFolderPath)) fs.mkdirSync(tempFolderPath, { recursive: true });

    const tempThumbnailPath = normalizePath(path.join(tempFolderPath, `layout-preview-${Date.now()}.png`));
    deleteFileIfExists(tempThumbnailPath);

    const thumbnailResult = await evalTS(
      "handleSaveCardsLayoutThumbnail",
      layoutData,
      tempThumbnailPath,
      THUMBNAIL_MAX_SIDE
    );

    if (thumbnailResult && thumbnailResult !== "OK") {
      deleteFileIfExists(tempThumbnailPath);
      throw new Error(String(thumbnailResult));
    }

    const thumbnailReady = await waitForReadableFile(tempThumbnailPath);
    if (!thumbnailReady) {
      deleteFileIfExists(tempThumbnailPath);
      throw new Error("Temporary thumbnail was not created in time.");
    }

    return tempThumbnailPath;
  }, []);

  const cleanupTemporaryThumbnail = useCallback((tempThumbnailPath: string) => {
    if (!tempThumbnailPath) return;
    const tempFolderPath = normalizePath(path.dirname(tempThumbnailPath));
    deleteFileIfExists(tempThumbnailPath);
    deleteFolderIfEmpty(tempFolderPath);
  }, []);

  const getExistingLevelJsonPath = useCallback((levelFolderPath: string): string => {
    const normalizedFolderPath = normalizePath(levelFolderPath);
    const canonicalJsonPath = normalizePath(path.join(normalizedFolderPath, CANONICAL_LAYOUT_JSON_NAME));
    if (canonicalJsonPath && fs.existsSync(canonicalJsonPath)) return canonicalJsonPath;

    const fallbackJsonPath = getLevelJsonPath(normalizedFolderPath, compResolution);
    return fallbackJsonPath ? fallbackJsonPath.filePath : "";
  }, [compResolution]);

  const getExistingLayoutMetadata = useCallback((levelFolderPath: string, fallbackEntry: LayoutIndexEntry | null): ExistingLayoutMetadata => {
    const metadata = {
      name: fallbackEntry ? fallbackEntry.name : "",
      description: fallbackEntry ? fallbackEntry.description : "",
      tags: fallbackEntry ? fallbackEntry.tags : [] as string[],
    };

    const candidatePaths = [
      getExistingLevelJsonPath(levelFolderPath),
      fallbackEntry ? fallbackEntry.jsonPath : "",
    ];

    for (let i = 0; i < candidatePaths.length; i++) {
      const candidatePath = candidatePaths[i];
      if (!candidatePath || !fs.existsSync(candidatePath)) continue;

      try {
        const raw = fs.readFileSync(candidatePath, "utf-8");
        const data = JSON.parse(raw);
        return {
          name: String(data.level || metadata.name || ""),
          description: String(data.description || metadata.description || ""),
          tags: parseTags(data.tags && data.tags.length ? data.tags : metadata.tags),
        };
      } catch (_) { }
    }

    return metadata;
  }, [getExistingLevelJsonPath]);

  const writeCanonicalLayout = useCallback(async (
    rootPathInput: string,
    levelFolderName: string,
    layoutData: any,
    tempThumbnailPath: string,
    metadata: { name: string; tags: string[]; description: string },
    confirmOverwrite: boolean
  ): Promise<boolean> => {
    const rootPath = normalizePath(rootPathInput);
    const levelFolderPath = normalizePath(path.join(rootPath, levelFolderName));
    const jsonPath = normalizePath(path.join(levelFolderPath, CANONICAL_LAYOUT_JSON_NAME));
    const thumbnailPath = normalizePath(path.join(levelFolderPath, CANONICAL_THUMBNAIL_NAME));

    const folderExists = fs.existsSync(levelFolderPath);

    if (confirmOverwrite && folderExists) {
      const overwrite = await showHostConfirm(`Level "${getLevelLabelFromFolderName(levelFolderName)}" already exists.\nDo you want to replace it?`);
      if (!overwrite) return false;
    }

    if (!folderExists) fs.mkdirSync(levelFolderPath, { recursive: true });

    const tags = parseTags(metadata.tags);
    const layoutToSave = {
      ...layoutData,
      level: metadata.name || getLevelLabelFromFolderName(levelFolderName),
      description: metadata.description || "",
      tags,
    };

    const tempCanonicalThumbnailPath = createTempSiblingPath(thumbnailPath, "jpg");
    const tempCanonicalJsonPath = createTempSiblingPath(jsonPath, "json");

    try {
      await convertImageToJpeg(
        tempThumbnailPath,
        tempCanonicalThumbnailPath,
        THUMBNAIL_MAX_SIDE,
        THUMBNAIL_JPEG_QUALITY
      );

      fs.writeFileSync(tempCanonicalJsonPath, JSON.stringify(layoutToSave, null, 2), "utf-8");
      replaceFileWithTemp(tempCanonicalThumbnailPath, thumbnailPath);
      replaceFileWithTemp(tempCanonicalJsonPath, jsonPath);
      deleteLegacyResolutionAssets(levelFolderPath);
    } catch (e) {
      deleteFileIfExists(tempCanonicalThumbnailPath);
      deleteFileIfExists(tempCanonicalJsonPath);
      throw e;
    }

    try {
      const cacheResult = await syncSingleLayoutToCache(rootPath, levelFolderName, customCachePath);
      applyLayoutEntries(cacheResult.entries, setLayoutEntries, setLevels);
    } catch (cacheError) {
      console.error(cacheError);
      await refreshLevels();
    }

    setCompResolution(getLayoutResolutionString(layoutToSave));
    setSelectedFolder(levelFolderName);
    setQuery("");
    setThumbnailVersion(v => v + 1);

    return true;
  }, [customCachePath, refreshLevels]);

  const updateSelectedLayoutMetadata = useCallback(async (rootPathInput: string): Promise<boolean> => {
    const rootPath = normalizePath(rootPathInput);
    const levelFolderName = String(selectedFolder || "");

    if (!levelFolderName) {
      await showHostAlert("Select a level first.");
      return false;
    }

    const levelFolderPath = normalizePath(path.join(rootPath, levelFolderName));
    if (!rootPath || !fs.existsSync(levelFolderPath)) {
      await showHostAlert(`Selected level was not found in the Levels Path:\n${levelFolderName}`);
      return false;
    }

    const jsonPath = getExistingLevelJsonPath(levelFolderPath);
    if (!jsonPath || !fs.existsSync(jsonPath)) {
      await showHostAlert(`No layout JSON found for: ${levelFolderName}`);
      return false;
    }

    const metadata = getExistingLayoutMetadata(levelFolderPath, selectedLayoutEntry);
    const cachedPreviewPath = selectedLayoutEntry && selectedLayoutEntry.thumbnailPath && fs.existsSync(selectedLayoutEntry.thumbnailPath)
      ? selectedLayoutEntry.thumbnailPath
      : "";
    const previewPath = layoutPreviewPath && fs.existsSync(layoutPreviewPath)
      ? layoutPreviewPath
      : cachedPreviewPath
        || getLevelPreviewPath(cacheRootPath, levelFolderName, compResolution)
        || getLevelPreviewPath(rootPath, levelFolderName, compResolution)
        || "";

    const dialogResult = await evalTS("handleShowSaveLayoutDialog", previewPath, {
      title: "Update Layout Info",
      name: metadata.name || getLevelLabelFromFolderName(levelFolderName),
      tags: metadata.tags.join(", "),
      description: metadata.description,
      allowMissingPreview: true
    }) as SaveLayoutDialogResult & { error?: string };

    if (dialogResult && dialogResult.error) {
      await showHostAlert(dialogResult.error);
      return false;
    }

    if (!dialogResult || dialogResult.cancelled) return false;

    const levelName = safeTrim(dialogResult.name);
    if (!levelName) {
      await showHostAlert("Type a level name first.");
      return false;
    }

    if (!isValidLevelName(levelName)) {
      await showHostAlert(`Invalid level name.\n${LEVEL_NAME_FORMAT_HINT}`);
      return false;
    }

    let layoutData: any;
    try {
      layoutData = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
    } catch (e) {
      await showHostAlert(`Could not read layout JSON: ${e}`);
      return false;
    }

    const layoutToSave = {
      ...layoutData,
      level: levelName,
      description: String(dialogResult.description || ""),
      tags: parseTags(dialogResult.tags),
    };

    fs.writeFileSync(jsonPath, JSON.stringify(layoutToSave, null, 2), "utf-8");

    try {
      const cacheResult = await syncSingleLayoutToCache(rootPath, levelFolderName, customCachePath);
      applyLayoutEntries(cacheResult.entries, setLayoutEntries, setLevels);
    } catch (cacheError) {
      console.error(cacheError);
      await refreshLevels();
    }

    setSelectedFolder(levelFolderName);
    setQuery("");
    setThumbnailVersion(v => v + 1);
    await showHostAlert(`Updated!\nLevel: ${getLevelLabelFromFolderName(levelFolderName)}`);
    return true;
  }, [
    cacheRootPath,
    compResolution,
    customCachePath,
    getExistingLayoutMetadata,
    getExistingLevelJsonPath,
    layoutPreviewPath,
    refreshLevels,
    selectedFolder,
    selectedLayoutEntry
  ]);

  const handleSave = useCallback(async () => {
    let tempThumbnailPath = "";

    try {
      await reloadExtendScript();
      const activeCompResolution = await evalTS("getCompResolution");
      const rootPath = await getTargetRoot("Select Levels Folder");
      if (!rootPath) return;

      if (!activeCompResolution) {
        await updateSelectedLayoutMetadata(rootPath);
        return;
      }

      const activeLayoutOrigin = await getActiveLayoutOrigin();
      const selectedLevelFolderName = String(selectedFolder || "");
      const activeLevelFolderName = activeLayoutOrigin ? String(activeLayoutOrigin.levelFolder || "") : "";

      if (activeLevelFolderName && selectedLevelFolderName && activeLevelFolderName !== selectedLevelFolderName) {
        const activeLevelLabel = getLevelLabelFromFolderName(activeLevelFolderName);
        const selectedLevelLabel = selectedLayoutEntry
          ? selectedLayoutEntry.name || selectedLayoutEntry.label || getLevelLabelFromFolderName(selectedLevelFolderName)
          : getLevelLabelFromFolderName(selectedLevelFolderName);
        const saveActiveLevel = await showHostConfirm(
          `The active comp is linked to "${activeLevelLabel}", but the selected layout is "${selectedLevelLabel}".\nSave "${activeLevelLabel}" instead?`
        );

        if (!saveActiveLevel) return;
      }

      const initialLevelFolderName = activeLevelFolderName;
      const initialEntry = initialLevelFolderName
        ? layoutEntries.find(entry => entry.folder === initialLevelFolderName) || null
        : null;
      const initialLevelFolderPath = initialLevelFolderName
        ? normalizePath(path.join(rootPath, initialLevelFolderName))
        : "";
      const initialMetadata = initialLevelFolderPath && fs.existsSync(initialLevelFolderPath)
        ? getExistingLayoutMetadata(initialLevelFolderPath, initialEntry)
        : { name: "", description: "", tags: [] };
      const initialDefaults: ExistingLayoutMetadata = {
        name: initialMetadata.name || (initialLevelFolderName ? getLevelLabelFromFolderName(initialLevelFolderName) : ""),
        description: initialMetadata.description || "",
        tags: initialMetadata.tags || []
      };

      let layoutData: any;
      try {
        layoutData = await readActiveLayoutData(initialDefaults.name || "New Layout");
      } catch (e) {
        if (isMetadataOnlySaveFallbackError(e)) {
          await updateSelectedLayoutMetadata(rootPath);
          return;
        }

        throw e;
      }

      tempThumbnailPath = await createTemporaryThumbnail(getLayoutCacheRootPath(rootPath, customCachePath) || rootPath, layoutData);

      let dialogDefaults = initialDefaults;
      let loadedExistingFolderName = initialLevelFolderName && fs.existsSync(initialLevelFolderPath) ? initialLevelFolderName : "";
      let loadedExistingDefaultName = dialogDefaults.name;
      let finalDialogResult: SaveLayoutDialogResult | null = null;
      let finalLevelFolderName = "";
      let finalLevelExists = false;

      while (true) {
        const dialogResult = await evalTS("handleShowSaveLayoutDialog", tempThumbnailPath, {
          title: "Save Layout",
          name: dialogDefaults.name,
          tags: dialogDefaults.tags.join(", "),
          description: dialogDefaults.description
        }) as SaveLayoutDialogResult & { error?: string };

        if (dialogResult && dialogResult.error) {
          await showHostAlert(dialogResult.error);
          cleanupTemporaryThumbnail(tempThumbnailPath);
          return;
        }

        if (!dialogResult || dialogResult.cancelled) {
          cleanupTemporaryThumbnail(tempThumbnailPath);
          return;
        }

        const levelName = safeTrim(dialogResult.name);
        if (!levelName) {
          cleanupTemporaryThumbnail(tempThumbnailPath);
          await showHostAlert("Type a level name first.");
          return;
        }

        if (!isValidLevelName(levelName)) {
          await showHostAlert(`Invalid level name.\n${LEVEL_NAME_FORMAT_HINT}`);
          dialogDefaults = {
            name: levelName,
            description: String(dialogResult.description || ""),
            tags: parseTags(dialogResult.tags)
          };
          continue;
        }

        const targetFolderName = loadedExistingFolderName && levelName === loadedExistingDefaultName
          ? loadedExistingFolderName
          : normalizeLevelFolderNameUI(levelName);
        const targetFolderPath = normalizePath(path.join(rootPath, targetFolderName));
        const targetExists = fs.existsSync(targetFolderPath);

        if (targetExists && targetFolderName !== loadedExistingFolderName) {
          const existingEntry = layoutEntries.find(entry => entry.folder === targetFolderName) || null;
          const existingMetadata = getExistingLayoutMetadata(targetFolderPath, existingEntry);

          loadedExistingFolderName = targetFolderName;
          dialogDefaults = {
            name: existingMetadata.name || levelName,
            description: existingMetadata.description || "",
            tags: existingMetadata.tags || []
          };
          loadedExistingDefaultName = dialogDefaults.name;
          continue;
        }

        finalDialogResult = dialogResult;
        finalLevelFolderName = targetFolderName;
        finalLevelExists = targetExists;
        break;
      }

      if (!finalDialogResult || !finalLevelFolderName) {
        cleanupTemporaryThumbnail(tempThumbnailPath);
        return;
      }

      const saved = await writeCanonicalLayout(
        rootPath,
        finalLevelFolderName,
        layoutData,
        tempThumbnailPath,
        {
          name: safeTrim(finalDialogResult.name),
          tags: parseTags(finalDialogResult.tags),
          description: String(finalDialogResult.description || "")
        },
        finalLevelExists
      );

      cleanupTemporaryThumbnail(tempThumbnailPath);
      if (saved) await showHostAlert(`Saved!\nLevel: ${getLevelLabelFromFolderName(finalLevelFolderName)}\nResolution: ${getLayoutResolutionString(layoutData)}`);
    } catch (e) {
      cleanupTemporaryThumbnail(tempThumbnailPath);
      await showHostAlert(`Save failed: ${e}`);
    }
  }, [
    cleanupTemporaryThumbnail,
    createTemporaryThumbnail,
    customCachePath,
    getActiveLayoutOrigin,
    getExistingLayoutMetadata,
    getTargetRoot,
    layoutEntries,
    readActiveLayoutData,
    selectedFolder,
    selectedLayoutEntry,
    updateSelectedLayoutMetadata,
    writeCanonicalLayout
  ]);

  const handleToggleFavorite = useCallback(async () => {
    if (!selectedLayoutEntry || !selectedFolder) return;

    try {
      if (!cacheRootPath || !fs.existsSync(cacheRootPath)) return;
      await setLayoutFavorite(cacheRootPath, selectedFolder, !selectedLayoutEntry.favorite);
      refreshLevels();
    } catch (e) {
      await showHostAlert(`Could not update favorite: ${e}`);
    }
  }, [cacheRootPath, refreshLevels, selectedFolder, selectedLayoutEntry]);


  // -------------------------
  // UI HANDLERS
  // -------------------------

  const openFolderPath = (folderPath: string, createIfMissing: boolean = false) => {
    const folder = normalizePath(folderPath);
    if (!folder) return;

    try {
      if (!fs.existsSync(folder)) {
        if (!createIfMissing) return;
        fs.mkdirSync(folder, { recursive: true });
      }
    } catch (e) {
      console.error(e);
      return;
    }

    try {
      const normalizedFolder = path.normalize(folder);
      if (process.platform === "win32") {
        child_process.execFile("explorer", [normalizedFolder]);
      } else if (process.platform === "darwin") {
        child_process.execFile("open", [normalizedFolder]);
      } else {
        child_process.execFile("xdg-open", [normalizedFolder]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleChangePath = async () => {
    if (!window.cep) {
      await showHostAlert("CEP API unavailable.");
      return;
    }

    const result = window.cep.fs.showOpenDialogEx(
      false,
      true,
      "Select New Levels Folder",
      baseDir,
      []
    );

    if (result.err === 0 && result.data && result.data.length > 0) {
      const newPath = result.data[0].replace(/\\/g, "/");
      saveConfig({ savePath: newPath });
      setPersistentSavePath(newPath);
      setBaseDir(newPath);
    }
  };

  const handleChangeTutorialsPath = async () => {
    if (!window.cep) {
      await showHostAlert("CEP API unavailable.");
      return;
    }

    const result = window.cep.fs.showOpenDialogEx(
      false,
      true,
      "Select Tutorials Folder",
      tutorialsRootPath || assetEntryPoint || HOME_DIR,
      []
    );

    if (result.err === 0 && result.data && result.data.length > 0) {
      const newPath = normalizePath(result.data[0] || "");
      if (!newPath) return;

      saveConfig({ tutorialsPath: newPath });
      setPersistentTutorialsPath(newPath);
      refreshFlyoutMenu();
    }
  };

  const handleChangeCachePath = async () => {
    if (!window.cep) {
      await showHostAlert("CEP API unavailable.");
      return;
    }

    const result = window.cep.fs.showOpenDialogEx(
      false,
      true,
      "Select Cache Folder",
      cacheRootPath || customCachePath || HOME_DIR,
      []
    );

    if (result.err === 0 && result.data && result.data.length > 0) {
      const newPath = normalizePath(result.data[0] || "");
      if (!newPath) return;
      const previousCachePath = normalizePath(cacheRootPath || "");
      const shouldClearPreviousCache = previousCachePath && previousCachePath !== newPath
        ? await showHostConfirm(`Clear previous local cache?\n\n${previousCachePath}`)
        : false;

      saveConfig({ cachePath: newPath });
      setCustomCachePath(newPath);

      let syncedNewCache = false;

      try {
        if (remoteRootPath && fs.existsSync(remoteRootPath)) {
          setCacheRefreshProgress(0);
          setIsCacheRefreshing(true);
          await sleep(40);
          const result = await syncLayoutCacheFromRemote(remoteRootPath, newPath, {
            onProgress: progress => {
              const total = Math.max(1, progress.totalFolders);
              setCacheRefreshProgress(Math.round((progress.completedFolders / total) * 100));
            }
          });
          setCacheRefreshProgress(100);
          applyLayoutEntries(result.entries, setLayoutEntries, setLevels);
          if (!result.entries.length) setSelectedFolder("");
          setThumbnailVersion(v => v + 1);
          syncedNewCache = true;
          await sleep(180);
        }
      } catch (e) {
        console.error(e);
        await showHostAlert(`Could not refresh local layouts cache: ${e}`);
      } finally {
        setIsCacheRefreshing(false);
        setCacheRefreshProgress(0);
      }

      if (shouldClearPreviousCache && syncedNewCache) clearLayoutCache(previousCachePath);
    }
  };

  const handleChangeAssetEntryPoint = async () => {
    if (!window.cep) {
      await showHostAlert("CEP API unavailable.");
      return;
    }

    const result = window.cep.fs.showOpenDialogEx(
      false,
      true,
      "Select Assets Entry Point",
      assetEntryPoint || HOME_DIR,
      []
    );

    if (result.err === 0 && result.data && result.data.length > 0) {
      const newPath = normalizeAssetPath(result.data[0] || "");
      if (!newPath) return;

      saveConfig({ assetEntryPoint: newPath, savePath: "", tutorialsPath: "" });
      onAssetEntryPointChange(newPath);
      setPersistentSavePath(null);
      setBaseDir(getDefaultLevelsPath(newPath));
      setPersistentTutorialsPath(null);
      refreshFlyoutMenu();

      const validation = validateAssetEntryPoint(newPath);
      if (!validation.ok && validation.message) await showHostAlert(validation.message);
    }
  };

  const handleOpenSavePath = () => {
    openFolderPath(remoteRootPath, true);
  };

  const handleOpenAssetsPath = () => {
    openFolderPath(assetRootPath, false);
  };

  const handleOpenAssetEntryPoint = () => {
    openFolderPath(assetEntryPoint, false);
  };

  const handleOpenTutorialsPath = () => {
    openFolderPath(tutorialsRootPath, true);
  };

  const handleOpenCachePath = () => {
    openFolderPath(cacheRootPath, true);
  };

  const handleOpenLayoutPreview = useCallback(async () => {
    if (!layoutPreviewPath) return;

    const result = await evalTS("handleOpenLayoutPreview", layoutPreviewPath);
    if (result && result !== "OK") await showHostAlert(String(result));
  }, [layoutPreviewPath]);

  const handleRefreshLayoutCache = useCallback(() => {
    syncCacheFromRemote(true);
  }, [syncCacheFromRemote]);

  const handleToggleTrimCoveredCards = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.checked;
    setTrimCoveredCards(nextValue);
    saveConfig({ trimCoveredCards: nextValue });
  }, []);

  const selectedLevelLabel = selectedLayoutEntry
    ? (selectedLayoutEntry.name || selectedLayoutEntry.label)
    : (selectedFolder ? selectedFolder.replace("lvl_", "") : "");
  const cacheLineStyle = useMemo(
    () => ({ "--layouts-cache-progress": `${cacheRefreshProgress}%` } as React.CSSProperties),
    [cacheRefreshProgress]
  );
  const assetRootExists = useMemo(() => {
    try {
      return !!assetRootPath && fs.existsSync(assetRootPath);
    } catch (_) {
      return false;
    }
  }, [assetRootPath]);

  const moveSelectedLevel = useCallback((offset: number) => {
    if (!filtered.length || offset === 0) return;

    let currentIndex = -1;
    for (let i = 0; i < filtered.length; i++) {
      if (filtered[i] === selectedFolder) {
        currentIndex = i;
        break;
      }
    }

    const lastIndex = filtered.length - 1;
    const nextIndex = currentIndex < 0
      ? 0
      : Math.max(0, Math.min(lastIndex, currentIndex + offset));

    setLevelMenuOpen(true);
    setSelectedFolder(filtered[nextIndex]);
  }, [filtered, selectedFolder]);

  const handleLevelComboboxKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setLevelMenuOpen(false);
      setQuery("");
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      setLevelMenuOpen(false);
      setQuery("");
      return;
    }

    if (!filtered.length) return;

    let currentIndex = -1;
    for (let i = 0; i < filtered.length; i++) {
      if (filtered[i] === selectedFolder) {
        currentIndex = i;
        break;
      }
    }

    let nextIndex = currentIndex;
    const lastIndex = filtered.length - 1;

    if (event.key === "ArrowDown") {
      if (!levelMenuOpen) nextIndex = currentIndex < 0 ? 0 : currentIndex;
      else nextIndex = currentIndex < 0 ? 0 : Math.min(lastIndex, currentIndex + 1);
    } else if (event.key === "ArrowUp") {
      if (!levelMenuOpen) nextIndex = currentIndex < 0 ? 0 : currentIndex;
      else nextIndex = currentIndex < 0 ? 0 : Math.max(0, currentIndex - 1);
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = lastIndex;
    } else if (event.key === "PageDown") {
      nextIndex = currentIndex < 0 ? 0 : Math.min(lastIndex, currentIndex + 5);
    } else if (event.key === "PageUp") {
      nextIndex = currentIndex < 0 ? 0 : Math.max(0, currentIndex - 5);
    } else {
      return;
    }

    event.preventDefault();
    setLevelMenuOpen(true);
    setSelectedFolder(filtered[nextIndex]);
  }, [filtered, levelMenuOpen, selectedFolder]);

  const handleLevelMenuWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (!filtered.length || event.deltaY === 0) return;

    event.preventDefault();
    moveSelectedLevel(event.deltaY > 0 ? 1 : -1);
  }, [filtered.length, moveSelectedLevel]);

  const selectLevelFromMenu = useCallback((folder: string, closeMenu: boolean) => {
    setSelectedFolder(folder);
    if (closeMenu) {
      setQuery("");
      setLevelMenuOpen(false);
    }
  }, []);

  if (!settingsOpen && !showContent) return null;

  return (
    <section className="panel-section layouts-section">
      {settingsOpen && (
        <div
          className="layouts-settings-backdrop"
          onMouseDown={event => {
            if (event.target === event.currentTarget && onSettingsClose) onSettingsClose();
          }}
        >
          <div className="layouts-settings-modal" role="dialog" aria-modal="true" aria-label="Layout settings">
            <div className="layouts-settings-modal-header">
              <span>Settings</span>
                    <button
                type="button"
                className="layouts-settings-close"
                onClick={onSettingsClose}
                aria-label="Close settings"
                title="Close"
              >
                {"\u00d7"}
              </button>
            </div>
            <div className="layouts-settings">
              <div className="layouts-settings-section">
                <div className="layouts-settings-section-title">Storage</div>
                <div className="layouts-settings-row">
                  <span
                    className="layouts-settings-label"
                    title={assetEntryPoint || "Path not set"}
                  >
                    Entry Point
                  </span>

                  <div className="layouts-settings-actions">
                    <button
                      className="btn-open-folder"
                      onClick={handleOpenAssetEntryPoint}
                      disabled={!assetEntryPoint}
                    >
                      Open
                    </button>

                    <button
                      className="btn-change"
                      onClick={handleChangeAssetEntryPoint}
                    >
                      {assetEntryPoint ? "Change" : "Set"}
                    </button>
                  </div>
                </div>

                <div className="layouts-settings-row layouts-settings-derived-row">
                  <span
                    className="layouts-settings-label"
                    title={assetRootPath || "Derived from Entry Point"}
                  >
                    Assets Path
                  </span>

                  <div className="layouts-settings-actions">
                    <button
                      className="btn-open-folder"
                      onClick={handleOpenAssetsPath}
                      disabled={!assetRootExists}
                    >
                      Open
                    </button>
                  </div>
                </div>

                <div className="layouts-settings-row layouts-settings-derived-row">
                  <span
                    className="layouts-settings-label"
                    title={remoteRootPath || "Derived from Entry Point"}
                  >
                    Levels Path
                  </span>

                  <div className="layouts-settings-actions">
                    <button
                      className="btn-open-folder"
                      onClick={handleOpenSavePath}
                      disabled={!remoteRootPath || !safeTrim(remoteRootPath)}
                    >
                      Open
                    </button>
                  </div>
                </div>

                <div className="layouts-settings-row layouts-settings-derived-row">
                  <span
                    className="layouts-settings-label"
                    title={tutorialsRootPath || "Derived from Entry Point"}
                  >
                    Tutorials Path
                  </span>

                  <div className="layouts-settings-actions">
                    <button
                      className="btn-open-folder"
                      onClick={handleOpenTutorialsPath}
                      disabled={!tutorialsRootPath || !safeTrim(tutorialsRootPath)}
                    >
                      Open
                    </button>
                  </div>
                </div>

                <div className="layouts-settings-row">
                  <span
                    className="layouts-settings-label"
                    title={cacheRootPath || "Path not set"}
                  >
                    Cache Path
                  </span>

                  <div className="layouts-settings-actions">
                    <button
                      className="btn-open-folder"
                      onClick={handleOpenCachePath}
                      disabled={!cacheRootPath || !safeTrim(cacheRootPath)}
                    >
                      Open
                    </button>

                    <button
                      className="btn-change"
                      onClick={handleChangeCachePath}
                    >
                      Change
                    </button>
                  </div>
                </div>

              </div>

              <div className="layouts-settings-section">
                <div className="layouts-settings-section-title">Timeline</div>
                <label className="layouts-settings-row layouts-settings-check-row" title="Reserved preference. Timeline trimming will be implemented later.">
                  <span className="layouts-settings-label">Trim Covered Cards</span>
                  <span className="layouts-settings-check-control">
                    <input
                      type="checkbox"
                      checked={trimCoveredCards}
                      onChange={handleToggleTrimCoveredCards}
                    />
                    <span className="layouts-settings-check-box" aria-hidden="true" />
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {showContent && (
      <div className="layouts-grid">
        <div className={`layouts-card ${isCacheRefreshing ? "is-cache-refreshing" : ""} ${levelMenuOpen ? "is-menu-open" : ""}`}>
          <div className="layouts-card-header">
            <span className="layouts-card-title layouts-resolution-title">
              {selectedLayoutEntry ? selectedLayoutEntry.sourceResolution : ""}
            </span>
                    <button
              type="button"
              className={`layouts-btn-ghost layouts-cache-button ${isCacheRefreshing ? "is-refreshing" : ""}`}
              onClick={handleRefreshLayoutCache}
              disabled={isCacheRefreshing || !remoteRootPath}
              title="Refresh local layouts cache"
              aria-label="Refresh local layouts cache"
            >
              <img src={CachedIcon} alt="" />
            </button>
            <button
              type="button"
              className={`layouts-btn-ghost layouts-favorite-button ${selectedLayoutEntry && selectedLayoutEntry.favorite ? "is-active" : ""}`}
              onClick={handleToggleFavorite}
              disabled={!selectedLayoutEntry}
              title={selectedLayoutEntry && selectedLayoutEntry.favorite ? "Remove favorite" : "Add favorite"}
              aria-label={selectedLayoutEntry && selectedLayoutEntry.favorite ? "Remove favorite" : "Add favorite"}
            >
              <span aria-hidden="true">{selectedLayoutEntry && selectedLayoutEntry.favorite ? "★" : "☆"}</span>
            </button>
          </div>
          <div className="layouts-cache-line" style={cacheLineStyle} aria-hidden="true">
            <span />
          </div>
          <div
            className={`layouts-preview ${layoutPreviewSrc ? "is-clickable" : ""}`}
            onClick={layoutPreviewSrc ? handleOpenLayoutPreview : undefined}
            title={layoutPreviewSrc ? "Open preview" : undefined}
          >
            {layoutPreviewSrc ? (
              <img src={layoutPreviewSrc} alt="Selected layout preview" />
            ) : (
              <span>No preview</span>
            )}
          </div>
          <div className="layouts-info">
            <div
              className={`layouts-description ${selectedLayoutEntry && selectedLayoutEntry.description ? "" : "is-empty"}`}
              title={selectedLayoutEntry ? selectedLayoutEntry.description : ""}
            >
              {selectedLayoutEntry && selectedLayoutEntry.description ? selectedLayoutEntry.description : "No description"}
            </div>
            <div className="layouts-tags">
              {selectedLayoutEntry && selectedLayoutEntry.tags.map(tag => (
                <span className="layouts-tag" key={tag}>{tag}</span>
              ))}
            </div>
          </div>
          <div className="layouts-apply-row">
            <div
              className="layouts-combobox"
              onMouseLeave={() => {
                if (levelMenuOpen) setLevelMenuOpen(false);
                if (levelInputRef.current) levelInputRef.current.blur();
              }}
            >
              <div className={`layouts-combobox-control ${levelMenuOpen ? "is-open" : ""}`}>
                <span
                  className={`layouts-level-star ${selectedLayoutEntry && selectedLayoutEntry.favorite ? "is-active" : ""}`}
                  aria-hidden="true"
                >
                  {"\u2605"}
                </span>
                <input
                  ref={levelInputRef}
                  className="layouts-combobox-input"
                  value={query}
                  onChange={e => {
                    setQuery(e.target.value);
                    setLevelMenuOpen(true);
                  }}
                  onMouseDown={() => setLevelMenuOpen(true)}
                  onFocus={() => setLevelMenuOpen(true)}
                  onBlur={() => {
                    setTimeout(() => setLevelMenuOpen(false), 120);
                  }}
                  onKeyDown={handleLevelComboboxKeyDown}
                  placeholder={selectedLevelLabel || "Search..."}
                />
                <button
                  type="button"
                  className="layouts-combobox-toggle"
                  title="Show layouts"
                  onMouseDown={event => {
                    event.preventDefault();
                    const nextOpen = !levelMenuOpen;
                    setLevelMenuOpen(nextOpen);
                    if (levelInputRef.current) {
                      if (nextOpen) levelInputRef.current.focus();
                      else levelInputRef.current.blur();
                    }
                  }}
                >
                  <img className="layouts-combobox-toggle-icon" src={ChevronIcon} alt="" />
                </button>
              </div>

              {levelMenuOpen && (
                <div
                  ref={levelMenuRef}
                  className="layouts-combobox-menu"
                  role="listbox"
                  aria-label="Layouts"
                  onWheel={handleLevelMenuWheel}
                >
                  {filtered.length ? filtered.map(l => {
                    const entry = layoutEntries.find(item => item.folder === l);
                    return (
                      <button
                        key={l}
                        type="button"
                        className={`layouts-combobox-option ${selectedFolder === l ? "is-selected" : ""}`}
                        role="option"
                        aria-selected={selectedFolder === l}
                        data-folder={l}
                        onMouseDown={event => {
                          event.preventDefault();
                          selectLevelFromMenu(l, true);
                        }}
                      >
                        <span
                          className={`layouts-level-star ${entry && entry.favorite ? "is-active" : ""}`}
                          aria-hidden="true"
                        >
                          {"\u2605"}
                        </span>
                        <span className="layouts-option-label">{entry?.name || l.replace("lvl_", "")}</span>
                      </button>
                    );
                  }) : (
                    <div className="layouts-combobox-empty">None</div>
                  )}
                </div>
              )}
            </div>
            <button className="layouts-btn-primary" onClick={handleApply} disabled={!selectedFolder}>Apply</button>
          </div>
        </div>
        <div className="layouts-card layouts-save-card">
          <div className="button-row layouts-actions layouts-save-actions">
            <button onClick={handleSave}>
              Save
            </button>
          </div>
        </div>
      </div>
      )}
    </section>
  );
};
