import React, { useCallback, useEffect, useMemo, useState } from "react";
import { fs, path, os } from "../../../lib/cep/node";
import { evalTS } from "../../../lib/utils/bolt";
import "./LayoutsPanel.scss";

// --- CONFIGURAÇÃO DE PERSISTÊNCIA ---
const HOME_DIR = os.homedir();
const CONFIG_FILE_NAME = ".cards-layout-config.json";
const CONFIG_PATH = path.join(HOME_DIR, CONFIG_FILE_NAME);

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

  // --- INIT ---
  useEffect(() => {
    const config = loadConfig();
    if (config.savePath) {
      setPersistentSavePath(config.savePath);
      setBaseDir(config.savePath);
    }
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

    const jsonPath = `${levelFolder}/${resolution}.json`;

    if (!fs.existsSync(jsonPath)) {
      return alert(`Layout file not found:\n${jsonPath}`);
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
      const overwrite = confirm(`File exists: ${fileName}\nOverwrite?`);
      if (!overwrite) return;
    }

    // 6. Salvar
    try {
      fs.writeFileSync(finalFilePath, JSON.stringify(layoutData, null, 2), "utf-8");
      alert(`Saved!\nLevel: ${levelFolderName}\nFile: ${fileName}`);
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
