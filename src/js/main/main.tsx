import { useCallback, useEffect, useMemo, useState } from "react";
import { subscribeBackgroundColor } from "../lib/utils/bolt";
import "./main.scss";

// Import components
import { CardPickerPanel } from "./components/CardPickerPanel/CardPickerPanel";
import { ActionsPanel } from "./components/ActionsPanel/ActionsPanel";
import { LayoutsPanel } from "./components/LayoutsPanel/LayoutsPanel";
import { DuplicatePanel } from "./components/DuplicatePanel/DuplicatePanel";

import { os } from "../lib/cep/node";
import {
  getAssetPaths,
  getDefaultLevelsPath,
  getSavedAssetEntryPoint,
  normalizeAssetPath,
  saveCardsGameplayConfigPatch,
  validateAssetEntryPoint
} from "./assetPaths";
import { getAvailableExtensionUpdate, openExtensionUpdate, ExtensionUpdateInfo } from "./extensionUpdates";
import { version } from "../../shared/shared";

export const getDefaultCardsLevelsDir = (assetEntryPoint: string) => {
  return getDefaultLevelsPath(assetEntryPoint) || "";
};

type TabKey = "cards" | "layouts";

export const App = () => {
  const [bgColor, setBgColor] = useState("#282c34");

  const [deck, setDeck] = useState("Club_Deck");
  const [cardNumber, setCardNumber] = useState(1);
  const [coinValue, setCoinValue] = useState("02"); // NOVO: Estado da moeda morando no App

  const [tab, setTab] = useState<TabKey>("cards");
  const [layoutsSettingsOpen, setLayoutsSettingsOpen] = useState(false);
  const [assetEntryPoint, setAssetEntryPoint] = useState(() => getSavedAssetEntryPoint());
  const [extensionUpdate, setExtensionUpdate] = useState<ExtensionUpdateInfo | null>(null);
  const assetPaths = useMemo(() => getAssetPaths(assetEntryPoint), [assetEntryPoint]);
  const entrySetupOpen = !assetEntryPoint;

  useEffect(() => {
    if (window.cep) subscribeBackgroundColor(setBgColor);
  }, []);

  const refreshExtensionUpdate = useCallback(() => {
    setExtensionUpdate(getAvailableExtensionUpdate(assetEntryPoint, version));
  }, [assetEntryPoint]);

  useEffect(() => {
    refreshExtensionUpdate();
    window.addEventListener("focus", refreshExtensionUpdate);
    const intervalId = window.setInterval(refreshExtensionUpdate, 60000);

    return () => {
      window.removeEventListener("focus", refreshExtensionUpdate);
      window.clearInterval(intervalId);
    };
  }, [refreshExtensionUpdate]);

  const handleOpenExtensionUpdate = useCallback(() => {
    if (extensionUpdate) openExtensionUpdate(extensionUpdate);
  }, [extensionUpdate]);

  const handleToggleSettings = useCallback(() => {
    setLayoutsSettingsOpen(open => !open);
  }, []);

  const handleSetEntryPoint = useCallback(async () => {
    if (!window.cep) {
      window.alert("CEP API unavailable.");
      return;
    }

    const result = window.cep.fs.showOpenDialogEx(
      false,
      true,
      "Select Entry Point",
      assetEntryPoint || os.homedir(),
      []
    );

    if (result.err !== 0 || !result.data || result.data.length === 0) return;

    const newPath = normalizeAssetPath(result.data[0] || "");
    if (!newPath) return;

    saveCardsGameplayConfigPatch({ assetEntryPoint: newPath, savePath: "", tutorialsPath: "" });
    setAssetEntryPoint(newPath);
    window.dispatchEvent(new Event("cards-gameplay.refreshFlyoutMenu"));

    const validation = validateAssetEntryPoint(newPath);
    if (!validation.ok && validation.message) window.alert(validation.message);
  }, [assetEntryPoint]);

  return (
    <div className="app" style={{ backgroundColor: bgColor }} spellCheck={false}>
      <header className="app-header">
        <div className="panel">
          <div className={`extension-update-slot ${extensionUpdate ? "has-update" : ""}`}>
            {extensionUpdate && (
              <div className="extension-update-banner">
                <span>New version available: v{extensionUpdate.version}</span>
                <button
                  type="button"
                  onClick={handleOpenExtensionUpdate}
                >
                  Update
                </button>
              </div>
            )}
          </div>

          {/* Header + Tabs */}
          <div className="panel-tabs-header">
            <button
              type="button"
              className="panel-settings-button"
              title="Settings"
              onClick={handleToggleSettings}
              aria-label="Settings"
            >
              {"\u2699"}
            </button>

            <div className="panel-tabs has-settings" role="tablist" aria-label="Main tabs">
              <button
                type="button"
                className={`panel-tab ${tab === "cards" ? "is-active" : ""}`}
                onClick={() => setTab("cards")}
                role="tab"
                aria-selected={tab === "cards"}
              >
                Cards
              </button>

              <button
                type="button"
                className={`panel-tab ${tab === "layouts" ? "is-active" : ""}`}
                onClick={() => setTab("layouts")}
                role="tab"
                aria-selected={tab === "layouts"}
              >
                Layouts
              </button>
            </div>
          </div>

          {/* Content */}
          {tab === "cards" && (
            <>
              <CardPickerPanel
                deck={deck}
                setDeck={setDeck}
                cardNumber={cardNumber}
                setCardNumber={setCardNumber}
                assetEntryPoint={assetEntryPoint}
                assetPaths={assetPaths}
                coinValue={coinValue}       // <--- Passando valor
                setCoinValue={setCoinValue} // <--- Passando função de alterar valor
              />

              <ActionsPanel assetEntryPoint={assetEntryPoint} coinValue={coinValue} /> {/* <--- Passando o valor para o botão Jump usar */}

              <DuplicatePanel assetEntryPoint={assetEntryPoint} />
            </>
          )}

          <LayoutsPanel
            baseDirDefault={getDefaultCardsLevelsDir(assetEntryPoint)}
            assetEntryPoint={assetEntryPoint}
            onAssetEntryPointChange={setAssetEntryPoint}
            onSettingsClose={() => setLayoutsSettingsOpen(false)}
            settingsOpen={layoutsSettingsOpen}
            showContent={tab === "layouts"}
          />

          {entrySetupOpen && (
            <div className="entry-setup-backdrop">
              <div className="entry-setup-modal" role="dialog" aria-modal="true" aria-label="Entry point setup">
                <div className="entry-setup-title">Set Entry Point</div>
                <p className="entry-setup-copy">
                  Choose the shared drive root to continue. Assets, levels, tutorials, and releases will be derived from it.
                </p>
                <div className="entry-setup-actions">
                  <button
                    type="button"
                    className="entry-setup-primary"
                    onClick={handleSetEntryPoint}
                  >
                    Set Entry Point
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>
    </div>
  );
};
