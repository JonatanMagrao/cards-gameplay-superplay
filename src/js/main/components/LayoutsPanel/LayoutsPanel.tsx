import React, { useCallback, useEffect, useMemo, useState } from "react";
import { fs, path, os } from "../../../lib/cep/node";
import { evalTS } from "../../../lib/utils/bolt";
import "./LayoutsPanel.scss";

// --- CONFIGURAÇÃO DE PERSISTÊNCIA ---
const HOME_DIR = os.homedir();
const CONFIG_FILE_NAME = ".cards-layout-config.json";
const CONFIG_PATH = path.join(HOME_DIR, CONFIG_FILE_NAME);
const THUMBNAIL_MAX_SIDE = 512;
const THUMBNAIL_JPEG_QUALITY = 0.82;

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
  const [thumbnailVersion, setThumbnailVersion] = useState(0);

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

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [baseDir, persistentSavePath, selectedFolder, compResolution, thumbnailVersion]);


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

    const jsonPath = `${levelFolder}/${resolution}.json`;

    if (!fs.existsSync(jsonPath)) {
      return alert(`Layout Resolution not found: ${jsonPath.match(/\d{2,4}x\d{2,4}/gi)}`);
    }

    try {
      const raw = fs.readFileSync(jsonPath, "utf-8");
      const layoutData = JSON.parse(raw);

      const res = await evalTS("handleApplyCardsLayout", layoutData, cardProject);
      if (res !== "OK" && res !== undefined) alert(`Error applying: ${res}`);

    } catch (e) {
      alert("Error reading JSON file.");
      console.error(e);
    }
  }, [baseDir, selectedFolder, persistentSavePath]);


  // -------------------------
  // SAVE
  // -------------------------
  const handleSave = useCallback(async () => {
    const lvlRaw = safeTrim(saveLevelId);
    if (!lvlRaw) return alert("Type a level ID first (e.g. 001-Boss).");

    let targetFolder = persistentSavePath;

    // 1. Selecionar Pasta se não houver
    if (!targetFolder) {
      if (!window.cep) return alert("CEP API unavailable.");
      const result = window.cep.fs.showOpenDialogEx(false, true, "Select Save Folder", baseDir, []);

      if (result.err !== 0 || !result.data || result.data.length === 0) return;

      targetFolder = result.data[0];
      if (!targetFolder) {
        alert("Operation cancelled.")
        return
      }
      targetFolder = targetFolder.replace(/\\/g, "/");

      saveConfig({ savePath: targetFolder });
      setPersistentSavePath(targetFolder);
      setBaseDir(targetFolder);
    } else {
      targetFolder = targetFolder!.replace(/\\/g, "/");
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

    // 3. Montar caminhos
    const levelFolderName = normalizeLevelFolderNameUI(lvlRaw);
    const levelFolderPath = `${targetFolder}/${levelFolderName}`;
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
      const overwrite = confirm(`Level: ${levelFolderName.replace("lvl_", "")}\nResolution: ${fileName.replace(".json", "")}\nOverwrite?`);
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
        alert(`Saved, but thumbnail export failed:\n${thumbnailResult}`);
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
          alert(`Saved!\nLevel: ${levelFolderName.replace("lvl_", "")}\nResolution: ${fileName.replace(".json", "")}`);
        } catch (thumbnailError) {
          deleteFileIfExists(tempThumbnailPath);
          alert(`Saved, but thumbnail conversion failed:\n${thumbnailError}`);
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
          <div className="layouts-preview">
            {layoutPreviewSrc ? (
              <img src={layoutPreviewSrc} alt="Selected layout preview" />
            ) : (
              <span>No preview</span>
            )}
          </div>
          <div className="layouts-apply-row">
            <input className="field-input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search..." />
            <select className="field-input" value={selectedFolder} onChange={e => setSelectedFolder(e.target.value)}>
              {filtered.length ? filtered.map(l => <option key={l} value={l}>{l.replace("lvl_", "")}</option>) : <option value="">None</option>}
            </select>
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
