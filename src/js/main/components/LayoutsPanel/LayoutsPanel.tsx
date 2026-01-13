import React, { useCallback, useEffect, useMemo, useState } from "react";
import { fs, path } from "../../../lib/cep/node";
import { evalTS } from "../../../lib/utils/bolt";

const safeTrim = (s: any) => String(s).replace(/^\s+|\s+$/g, "");

const pad3 = (v: any): string => {
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
  if (!name) return `lvl_${num}`;
  return `lvl_${num}-${name}`;
};

const stripLevelPrefix = (folder: string) => folder.replace(/^lvl_/, "");

type Props = {
  baseDirDefault?: string;
  title?: string;
};

export const LayoutsPanel: React.FC<Props> = ({
  baseDirDefault = "D:/Downloads/cardsLevels",
  title = "Layouts",
}) => {
  const [baseDir, setBaseDir] = useState(baseDirDefault);

  const [levels, setLevels] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [selectedFolder, setSelectedFolder] = useState("");

  const [saveLevelId, setSaveLevelId] = useState("");

  const [settingsOpen, setSettingsOpen] = useState(false);

  const saveFolderPreview = useMemo(
    () => normalizeLevelFolderNameUI(saveLevelId),
    [saveLevelId]
  );

  // -------------------------
  // Refresh folders
  // -------------------------
  const refreshLevels = useCallback(() => {
    try {
      if (!fs.existsSync(baseDir)) {
        setLevels([]);
        setSelectedFolder("");
        return;
      }

      const entries = fs.readdirSync(baseDir) as string[];
      const folders = entries.filter((name) => {
        const full = path.join(baseDir, name);
        try {
          return fs.statSync(full).isDirectory() && /^lvl_/.test(name);
        } catch {
          return false;
        }
      });

      folders.sort();
      setLevels(folders);
    } catch (e) {
      console.log("refreshLevels error:", e);
      setLevels([]);
      setSelectedFolder("");
    }
  }, [baseDir]);

  useEffect(() => {
    refreshLevels();
  }, [refreshLevels]);

  // -------------------------
  // Filter list
  // -------------------------
  const filtered = useMemo(() => {
    const q = safeTrim(query).toLowerCase();
    if (!q) return levels;
    return levels.filter((x) => x.toLowerCase().includes(q));
  }, [levels, query]);

  // -------------------------
  // Keep selection consistent with filtered list
  // (Fix: do not override selection if it's still valid)
  // -------------------------
  useEffect(() => {
    // if selection is empty and we have options, pick first
    if (!selectedFolder && filtered.length) {
      setSelectedFolder(filtered[0]);
      return;
    }

    // if selection exists but got filtered out, switch to first
    if (selectedFolder && !filtered.includes(selectedFolder)) {
      setSelectedFolder(filtered[0] ?? "");
    }
  }, [filtered, selectedFolder]);

  // -------------------------
  // Apply / Save
  // -------------------------
  const handleApply = useCallback(async () => {
    if (!selectedFolder) {
      alert("No level folder selected.\n\nPick a level and try again.");
      return;
    }

    const levelId = stripLevelPrefix(selectedFolder); // "003-Abracadabra"
    await evalTS("handleApplyCardsLayout", baseDir, levelId);
  }, [baseDir, selectedFolder]);

  const handleSave = useCallback(async () => {
    const lvl = safeTrim(saveLevelId);
    if (!lvl) {
      alert(
        "Type a level id first.\n\nExamples:\n001-SomethingSpecial\n003-Abracadabra"
      );
      return;
    }

    await evalTS("handleSaveCardsLayout", baseDir, lvl);

    // ✅ Success feedback AFTER writing
    // alert(`Layout saved.\n\nGame Level: ${saveFolderPreview.replace("lvl_","")}`);

    refreshLevels();
  }, [baseDir, saveLevelId, saveFolderPreview, refreshLevels]);

  // -------------------------
  // Keyboard shortcuts
  // Ctrl/Cmd + Enter => Apply
  // Ctrl/Cmd + S     => Save
  // (Do not trigger while typing)
  // -------------------------
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
      const mod = isMac ? e.metaKey : e.ctrlKey;

      // don't trigger shortcuts while typing in input/select/textarea
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTyping =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        (target as any)?.isContentEditable;

      if (isTyping) return;

      // Ctrl/Cmd + Enter => Apply
      if (mod && e.key === "Enter") {
        e.preventDefault();
        handleApply();
        return;
      }

      // Ctrl/Cmd + S => Save
      if (mod && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        handleSave();
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleApply, handleSave]);

  return (
    <section className="panel-section layouts-section">
      {/* <div className="layouts-section-header">
        <span className="section-label">{title}</span>

        <button
          type="button"
          className="layouts-btn-ghost"
          onClick={() => {
            const next = !settingsOpen;
            setSettingsOpen(next);
            if (next) refreshLevels();
          }}
          title="Settings"
        >
          ⚙
        </button>
      </div> */}

      {/* Settings (collapsed by default) */}
      {settingsOpen && (
        <div className="layouts-settings">
          <div className="field-row">
            <span className="field-label">Base Dir</span>
            <input
              className="field-input"
              value={baseDir}
              onChange={(e) => setBaseDir(e.target.value)}
              placeholder="D:/Downloads/cardsLevels"
            />
          </div>

          <div className="layouts-hint">
            Looking for folders starting with{" "}
            <span className="layouts-mono">lvl_</span> inside{" "}
            <span className="layouts-mono">{baseDir}</span>
          </div>
        </div>
      )}

      <div className="layouts-grid">
        {/* APPLY */}
        <div className="layouts-card">
          <div className="layouts-card-header">
            <span className="layouts-card-title">Apply</span>
            {/* <button
              onClick={refreshLevels}
              className="layouts-btn-ghost"
              type="button"
              title="Refresh folder list"
            >
              Refresh
            </button> */}
          </div>

          <div className="layouts-apply-row">
            <input
              className="field-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
            />

            <select
              className="field-input"
              value={selectedFolder}
              onChange={(e) => setSelectedFolder(e.target.value)}
              title="Level folder"
            >
              {filtered.length ? (
                filtered.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl.replace("lvl_", "")}
                  </option>
                ))
              ) : (
                <option value="">No level folders found</option>
              )}
            </select>

            <button
              onClick={handleApply}
              disabled={!selectedFolder}
              type="button"
              className="layouts-btn-primary"
              title="Apply selected layout to the active comp (Ctrl/Cmd+Enter)"
            >
              Apply
            </button>
          </div>

          {/* {selectedFolder && (
            <div className="layouts-hint">
              Selected: <span className="layouts-mono">{selectedFolder}</span>
            </div>
          )} */}
        </div>

        {/* SAVE */}
        <div className="layouts-card">
          <div className="layouts-card-header">
            <span className="layouts-card-title">Save</span>
          </div>

          <input
            className="field-input"
            value={saveLevelId}
            onChange={(e) => setSaveLevelId(e.target.value)}
            placeholder="Ex: 001-SomethingSpecial"
          />

          {/* <div className="layouts-hint">
            Will save to: <span className="layouts-mono">{saveFolderPreview}</span>
          </div> */}

          <div className="button-row layouts-actions">
            <button
              onClick={handleSave}
              type="button"
              title="Save layout (Ctrl/Cmd+S)"
            >
              Save Layout
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
