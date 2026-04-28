import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fs, path, os } from "../../../lib/cep/node";
import { csi, evalFile, evalTS } from "../../../lib/utils/bolt";
import ChevronIcon from "../../../assets/icons/chevron.svg";
import "./LayoutsPanel.scss";

// --- CONFIGURAÇÃO DE PERSISTÊNCIA ---
const HOME_DIR = os.homedir();
const CONFIG_FILE_NAME = ".cards-layout-config.json";
const CONFIG_PATH = path.join(HOME_DIR, CONFIG_FILE_NAME);
const THUMBNAIL_MAX_SIDE = 512;
const THUMBNAIL_JPEG_QUALITY = 0.82;
const LAYOUT_ORIGIN_SCHEMA = "cards-gameplay.layout-origin.v1";

// Helpers
const loadConfig = () => {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    }
  } catch (e) { console.error(e); }
  return {};
};

const saveConfig = (data: any) => {
  try {
    const current = loadConfig();
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ ...current, ...data }, null, 2));
  } catch (e) { console.error(e); }
};

const safeTrim = (s: any) => String(s).replace(/^\s+|\s+$/g, "");
const pad3 = (v: any) => {
  const n = parseInt(String(v), 10);
  if (isNaN(n) || n < 0) return "000";
  const s = String(n);
  return s.length >= 3 ? s : ("000" + s).slice(-3);
};

const normalizeLevelFolderNameUI = (levelId: string): string => {
  const raw = safeTrim(levelId);
  const m = raw.match(/^(\d+)(?:[_-](.+))?$/);
  if (!m) return `lvl_${raw.replace(/_/g, "-")}`;
  const num = pad3(m[1]);
  const name = safeTrim(m[2] || "");
  return name ? `lvl_${num}-${name}` : `lvl_${num}`;
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

        ctx.fillStyle = "#171a20";
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

type LevelJsonPath = {
  filePath: string;
  isExactResolution: boolean;
};

type CardsLayoutOriginMetadata = {
  schema?: string;
  levelFolder?: string;
  sourceJson?: string;
  targetJson?: string;
  targetResolution?: string;
  appliedAsFallback?: boolean;
  rootPath?: string;
  levelFolderPath?: string;
};

const normalizePath = (value: string): string => String(value || "").replace(/\\/g, "/");

const getFileNameFromPath = (filePath: string): string => {
  const normalized = normalizePath(filePath);
  const parts = normalized.split("/");
  return parts[parts.length - 1] || normalized;
};

const getLevelLabelFromFolderName = (levelFolder: string): string => {
  return String(levelFolder || "").replace(/^lvl_/, "");
};

const getRootPathFromLevelFolderPath = (levelFolderPath: string): string => {
  const normalized = normalizePath(levelFolderPath);
  const lastSlash = normalized.lastIndexOf("/");
  return lastSlash > -1 ? normalized.substring(0, lastSlash) : "";
};

const isLayoutOriginMetadata = (value: any): value is CardsLayoutOriginMetadata => {
  return !!(
    value &&
    value.schema === LAYOUT_ORIGIN_SCHEMA &&
    typeof value.levelFolder === "string" &&
    value.levelFolder !== ""
  );
};

const getLinkedLevelFolderPath = (origin: CardsLayoutOriginMetadata): string => {
  const levelFolderPath = normalizePath(origin.levelFolderPath || "");
  if (levelFolderPath) return levelFolderPath;

  const rootPath = normalizePath(origin.rootPath || "");
  if (rootPath && origin.levelFolder) return `${rootPath}/${origin.levelFolder}`;

  return "";
};

const parseResolutionString = (value: string): [number, number] | null => {
  const match = String(value || "").match(/(\d{2,5})x(\d{2,5})/i);
  if (!match) return null;

  const width = parseInt(match[1], 10);
  const height = parseInt(match[2], 10);
  if (!width || !height) return null;

  return [width, height];
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

type Props = {
  baseDirDefault?: string;
  title?: string;
  cardProject: string
};

export const LayoutsPanel: React.FC<Props> = ({
  baseDirDefault = "D:/Downloads/cardsLevels",
  title = "Layouts",
  cardProject
}) => {
  const [baseDir, setBaseDir] = useState(baseDirDefault);
  const [persistentSavePath, setPersistentSavePath] = useState<string | null>(null);
  const [levels, setLevels] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [selectedFolder, setSelectedFolder] = useState("");
  const [saveLevelId, setSaveLevelId] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [compResolution, setCompResolution] = useState("");
  const [layoutPreviewSrc, setLayoutPreviewSrc] = useState<string | null>(null);
  const [layoutPreviewPath, setLayoutPreviewPath] = useState("");
  const [thumbnailVersion, setThumbnailVersion] = useState(0);
  const [levelMenuOpen, setLevelMenuOpen] = useState(false);
  const levelInputRef = useRef<HTMLInputElement | null>(null);
  const levelMenuRef = useRef<HTMLDivElement | null>(null);

  // --- INIT ---
  useEffect(() => {
    const config = loadConfig();
    if (config.savePath) {
      setPersistentSavePath(config.savePath);
      setBaseDir(config.savePath);
    }
  }, []);

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
  const refreshLevels = useCallback(() => {
    try {
      if (!fs.existsSync(baseDir)) {
        setLevels([]);
        setSelectedFolder("");
        return;
      }
      const entries = fs.readdirSync(baseDir) as string[];
      const folders = entries.filter((name) => {
        const full = `${baseDir}/${name}`.replace(/\\/g, "/");
        try {
          return fs.statSync(full).isDirectory() && /^lvl_/.test(name);
        } catch { return false; }
      });
      folders.sort();
      setLevels(folders);
    } catch (e) {
      setLevels([]);
    }
  }, [baseDir]);

  useEffect(() => { refreshLevels(); }, [refreshLevels]);

  const filtered = useMemo(() => {
    const q = safeTrim(query).toLowerCase();
    if (!q) return levels;
    return levels.filter((x) => x.toLowerCase().includes(q));
  }, [levels, query]);

  useEffect(() => {
    if (!selectedFolder && filtered.length) setSelectedFolder(filtered[0]);
    else if (selectedFolder && !filtered.includes(selectedFolder)) setSelectedFolder(filtered[0] ?? "");
  }, [filtered, selectedFolder]);

  useEffect(() => {
    const rootPath = (persistentSavePath || baseDir || "").replace(/\\/g, "/");
    const previewPath = getLevelPreviewPath(rootPath, selectedFolder, compResolution);
    const objectUrl = previewPath ? getImageObjectUrl(previewPath) : null;

    setLayoutPreviewSrc(objectUrl);
    setLayoutPreviewPath(previewPath || "");

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [baseDir, persistentSavePath, selectedFolder, compResolution, thumbnailVersion]);

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
    if (!selectedFolder) return alert("Select a level folder first.");

    let rootPath = persistentSavePath || baseDir;
    rootPath = rootPath.replace(/\\/g, "/");

    const levelFolder = `${rootPath}/${selectedFolder}`;

    const resolution = await evalTS("getCompResolution");
    if (!resolution) return alert("No active comp found.");
    setCompResolution(String(resolution));

    const layoutJsonPath = getLevelJsonPath(levelFolder, String(resolution));
    if (!layoutJsonPath) return alert(`No layout JSON found in: ${levelFolder}`);

    try {
      const raw = fs.readFileSync(layoutJsonPath.filePath, "utf-8");
      const layoutData = JSON.parse(raw);
      const targetResolution = String(resolution);
      const applyOptions = {
        autoFitLayout: !layoutJsonPath.isExactResolution,
        layoutOrigin: {
          schema: LAYOUT_ORIGIN_SCHEMA,
          levelFolder: selectedFolder,
          rootPath,
          levelFolderPath: levelFolder,
          sourceJson: getFileNameFromPath(layoutJsonPath.filePath),
          targetJson: `${targetResolution}.json`,
          targetResolution,
          appliedAsFallback: !layoutJsonPath.isExactResolution
        }
      };

      await reloadExtendScript();
      const res = await evalTS("handleApplyCardsLayout", layoutData, cardProject, applyOptions);
      if (res !== "OK" && res !== undefined) alert(`Error applying: ${res}`);

    } catch (e) {
      alert("Error reading JSON file.");
      console.error(e);
    }
  }, [baseDir, cardProject, selectedFolder, persistentSavePath]);


  // -------------------------
  // SAVE
  // -------------------------
  const handleSave = useCallback(async () => {
    await reloadExtendScript();

    let activeLayoutOrigin: CardsLayoutOriginMetadata | null = null;

    try {
      const origin = await evalTS("handleGetActiveCardsLayoutOrigin");
      if (isLayoutOriginMetadata(origin)) activeLayoutOrigin = origin;
    } catch (e) {
      console.error(e);
    }

    const linkedLevelFolder = activeLayoutOrigin ? String(activeLayoutOrigin.levelFolder || "") : "";
    const lvlRaw = linkedLevelFolder ? getLevelLabelFromFolderName(linkedLevelFolder) : safeTrim(saveLevelId);
    if (!lvlRaw) return alert("Type a level ID first (e.g. 001-Boss).");

    const selectTargetRoot = (): string | null => {
      if (!window.cep) {
        alert("CEP API unavailable.");
        return null;
      }
      const result = window.cep.fs.showOpenDialogEx(false, true, "Select Save Folder", baseDir, []);

      if (result.err !== 0 || !result.data || result.data.length === 0) return null;

      let selectedTarget = result.data[0];
      if (!selectedTarget) {
        alert("Operation cancelled.")
        return null
      }
      selectedTarget = normalizePath(selectedTarget);

      saveConfig({ savePath: selectedTarget });
      setPersistentSavePath(selectedTarget);
      setBaseDir(selectedTarget);

      return selectedTarget;
    };

    const levelFolderName = linkedLevelFolder || normalizeLevelFolderNameUI(lvlRaw);
    let levelFolderPath = "";

    // 1. Selecionar Pasta se não houver
    if (activeLayoutOrigin && linkedLevelFolder) {
      levelFolderPath = getLinkedLevelFolderPath(activeLayoutOrigin);

      if (!levelFolderPath) {
        let targetRoot = persistentSavePath ? normalizePath(persistentSavePath) : "";
        if (!targetRoot) {
          const selectedRoot = selectTargetRoot();
          if (!selectedRoot) return;
          targetRoot = selectedRoot;
        }

        levelFolderPath = `${targetRoot}/${levelFolderName}`;
      } else {
        levelFolderPath = normalizePath(levelFolderPath);
        const linkedRootPath = getRootPathFromLevelFolderPath(levelFolderPath);
        if (linkedRootPath && linkedRootPath !== normalizePath(persistentSavePath || baseDir || "")) {
          saveConfig({ savePath: linkedRootPath });
          setPersistentSavePath(linkedRootPath);
          setBaseDir(linkedRootPath);
        }
      }
    } else {
      let targetRoot = persistentSavePath ? normalizePath(persistentSavePath) : "";
      if (!targetRoot) {
        const selectedRoot = selectTargetRoot();
        if (!selectedRoot) return;
        targetRoot = selectedRoot;
      }

      levelFolderPath = `${targetRoot}/${levelFolderName}`;
    }

    // 2. Pegar dados do AE
    const jsonString = await evalTS("handleSaveCardsLayout", lvlRaw);

    let layoutData;
    try {
      layoutData = JSON.parse(jsonString);
    } catch (e) {
      return alert(`Error from AE: ${jsonString}`);
    }

    if (layoutData.error) return alert(`Export Failed: ${layoutData.error}`);

    const fileName = `${layoutData.resolution[0]}x${layoutData.resolution[1]}.json`;
    const finalFilePath = `${levelFolderPath}/${fileName}`;
    const thumbnailPath = `${levelFolderPath}/${fileName.replace(".json", ".jpg")}`;
    const legacyThumbnailPath = `${levelFolderPath}/${fileName.replace(".json", ".png")}`;
    const tempThumbnailPath = `${levelFolderPath}/${fileName.replace(".json", ".preview-temp.png")}`;

    // 4. Cria pasta
    if (!fs.existsSync(levelFolderPath)) {
      try {
        fs.mkdirSync(levelFolderPath, { recursive: true });
      } catch (e) {
        return alert(`Could not create folder: ${levelFolderPath}`);
      }
    }

    // 5. Overwrite
    if (fs.existsSync(finalFilePath)) {
      const actionLabel = activeLayoutOrigin ? "Update linked layout?" : "Overwrite?";
      const overwrite = confirm(`Level: ${levelFolderName.replace("lvl_", "")}\nResolution: ${fileName.replace(".json", "")}\n${actionLabel}`);
      if (!overwrite) return;
    }

    // 6. Salvar
    try {
      fs.writeFileSync(finalFilePath, JSON.stringify(layoutData, null, 2), "utf-8");
      deleteFileIfExists(tempThumbnailPath);

      const thumbnailResult = await evalTS(
        "handleSaveCardsLayoutThumbnail",
        layoutData,
        tempThumbnailPath,
        THUMBNAIL_MAX_SIDE
      );

      if (thumbnailResult && thumbnailResult !== "OK") {
        deleteFileIfExists(tempThumbnailPath);
        alert(`${activeLayoutOrigin ? "Updated" : "Saved"}, but thumbnail export failed:\n${thumbnailResult}`);
      } else {
        try {
          const thumbnailReady = await waitForReadableFile(tempThumbnailPath);
          if (!thumbnailReady) throw new Error("Temporary thumbnail was not created in time.");

          await convertImageToJpeg(
            tempThumbnailPath,
            thumbnailPath,
            THUMBNAIL_MAX_SIDE,
            THUMBNAIL_JPEG_QUALITY
          );
          deleteFileIfExists(tempThumbnailPath);
          deleteFileIfExists(legacyThumbnailPath);
          alert(`${activeLayoutOrigin ? "Updated!" : "Saved!"}\nLevel: ${levelFolderName.replace("lvl_", "")}\nResolution: ${fileName.replace(".json", "")}`);
        } catch (thumbnailError) {
          deleteFileIfExists(tempThumbnailPath);
          alert(`${activeLayoutOrigin ? "Updated" : "Saved"}, but thumbnail conversion failed:\n${thumbnailError}`);
        }
      }

      setCompResolution(`${layoutData.resolution[0]}x${layoutData.resolution[1]}`);
      setSelectedFolder(levelFolderName);
      setQuery("");
      setThumbnailVersion(v => v + 1);
      refreshLevels();
    } catch (e) {
      alert(`Write error: ${e}`);
    }

  }, [baseDir, saveLevelId, persistentSavePath, refreshLevels]);


  // -------------------------
  // UI HANDLERS
  // -------------------------

  const handleChangePath = () => {
    if (!window.cep) return alert("CEP API unavailable.");

    const result = window.cep.fs.showOpenDialogEx(
      false,
      true,
      "Select New Save Folder",
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

  const handleOpenSavePath = () => {
    if (!persistentSavePath) return;
    let cmd = "";
    const p = path.normalize(persistentSavePath);
    if (process.platform === "win32") {
      cmd = `explorer "${p}"`;
    } else {
      cmd = `open "${p}"`;
    }
    require("child_process").exec(cmd);
  };

  const handleOpenLayoutPreview = useCallback(async () => {
    if (!layoutPreviewPath) return;

    const result = await evalTS("handleOpenLayoutPreview", layoutPreviewPath);
    if (result && result !== "OK") alert(String(result));
  }, [layoutPreviewPath]);

  const selectedLevelLabel = selectedFolder ? selectedFolder.replace("lvl_", "") : "";

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

  return (
    <section className="panel-section layouts-section">
      <div className="layouts-section-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span className="section-label">{title}</span>
        <button
          className="layouts-btn-ghost"
          title={"Open Folder Path Setup"}
          onClick={() => {
            const next = !settingsOpen;
            setSettingsOpen(next);
            if (next) refreshLevels();
          }}>⚙</button>
      </div>

      {settingsOpen && (
        <div className="layouts-settings">
          <div className="field-row" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>

            <span
              className="field-label"
              style={{ color: '#61dafb', marginBottom: 0, cursor: 'help' }}
              title={persistentSavePath || "Path not set"}
            >
              Folder Path
            </span>

            <div className="save-target-row">
              {/* BOTÃO OPEN:
                  Fica desabilitado (disabled) se persistentSavePath for null/vazio.
              */}
              <button
                className={"btn-open-folder"}
                onClick={handleOpenSavePath}
                style={{ flex: 1, marginRight: "5px" }}
                disabled={!persistentSavePath || !safeTrim(persistentSavePath)}
              >
                Open
              </button>

              {/* BOTÃO CHANGE/SET:
                  Sempre habilitado para permitir definir o path.
              */}
              <button
                className="btn-change"
                onClick={handleChangePath}
                style={{ flex: 1 }}
              >
                {persistentSavePath ? "Change" : "Set"}
              </button>
            </div>

          </div>
        </div>
      )}

      <div className="layouts-grid">
        <div className="layouts-card">
          <div className="layouts-card-header"><span className="layouts-card-title">Apply</span></div>
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
          <div className="layouts-apply-row">
            <div
              className="layouts-combobox"
              onMouseLeave={() => {
                if (levelMenuOpen) setLevelMenuOpen(false);
                if (levelInputRef.current) levelInputRef.current.blur();
              }}
            >
              <div className={`layouts-combobox-control ${levelMenuOpen ? "is-open" : ""}`}>
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
                  {filtered.length ? filtered.map(l => (
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
                      {l.replace("lvl_", "")}
                    </button>
                  )) : (
                    <div className="layouts-combobox-empty">None</div>
                  )}
                </div>
              )}
            </div>
            <button className="layouts-btn-primary" onClick={handleApply} disabled={!selectedFolder}>Apply</button>
          </div>
        </div>
        <div className="layouts-card">
          <div className="layouts-card-header"><span className="layouts-card-title">Save</span></div>
          <input className="field-input" value={saveLevelId} onChange={e => setSaveLevelId(e.target.value)} placeholder="Ex: 001-Boss" />
          <div className="button-row layouts-actions">
            <button onClick={handleSave}>
              {persistentSavePath ? "Save Layout" : "Save Layout (Select Folder)"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
