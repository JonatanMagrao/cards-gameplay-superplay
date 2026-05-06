import { useEffect, useMemo, useState } from "react";
import { subscribeBackgroundColor } from "../lib/utils/bolt";
import "./main.scss";

// Import components
import { CardPickerPanel } from "./components/CardPickerPanel/CardPickerPanel";
import { ActionsPanel } from "./components/ActionsPanel/ActionsPanel";
import { LayoutsPanel } from "./components/LayoutsPanel/LayoutsPanel";
import { DuplicatePanel } from "./components/DuplicatePanel/DuplicatePanel";

import { os, path } from "../lib/cep/node";
import { getAssetPaths, getDefaultLevelsPath, getSavedAssetEntryPoint } from "./assetPaths";

export const getDefaultCardsLevelsDir = (assetEntryPoint: string) => {
  return getDefaultLevelsPath(assetEntryPoint) || path.join(os.homedir(), "Documents", "cards-level-layouts");
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
  const assetPaths = useMemo(() => getAssetPaths(assetEntryPoint), [assetEntryPoint]);

  useEffect(() => {
    if (window.cep) subscribeBackgroundColor(setBgColor);
  }, []);

  return (
    <div className="app" style={{ backgroundColor: bgColor }} spellCheck={false}>
      <header className="app-header">
        <div className="panel">
          {/* Header + Tabs */}
          <div className="panel-tabs-header">
            {tab === "layouts" && (
              <button
                type="button"
                className="panel-settings-button"
                title="Open Paths Settings"
                onClick={() => setLayoutsSettingsOpen(open => !open)}
                aria-label="Open Paths Settings"
              >
                {"\u2699"}
              </button>
            )}

            <div className={`panel-tabs ${tab === "layouts" ? "has-settings" : ""}`} role="tablist" aria-label="Main tabs">
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
          {tab === "cards" ? (
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
          ) : (
            <LayoutsPanel
              baseDirDefault={getDefaultCardsLevelsDir(assetEntryPoint)}
              assetEntryPoint={assetEntryPoint}
              onAssetEntryPointChange={setAssetEntryPoint}
              onSettingsClose={() => setLayoutsSettingsOpen(false)}
              settingsOpen={layoutsSettingsOpen}
            />
          )}
        </div>
      </header>
    </div>
  );
};
