import React from "react";
import { evalTS } from "../../../lib/utils/bolt";
import { fs, os, path } from "../../../lib/cep/node";
import { ensureAssetsReadyOrAlert, getCoinVfxPath } from "../../assetPaths";
import ClearIcon from "../../../assets/icons/clear.svg";
import "./ActionsPanel.scss";

type Props = {
  assetEntryPoint: string;
  coinValue: string; // NOVO: Recebendo a moeda escolhida
};

const CONFIG_FILE_NAME = ".cards-layout-config.json";

const readTrimCoveredCardsPreference = (): boolean => {
  try {
    const configPath = path.join(os.homedir(), CONFIG_FILE_NAME);
    if (!fs.existsSync(configPath)) return false;

    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    return config && config.trimCoveredCards === true;
  } catch (_) {
    return false;
  }
};

type ActionsGroup = "play" | "setup" | "maintenance";

export const ActionsPanel: React.FC<Props> = ({ assetEntryPoint, coinValue }) => {
  const [activeGroup, setActiveGroup] = React.useState<ActionsGroup>("play");

  const applyJump = async () => {
    const readyAssets = await ensureAssetsReadyOrAlert(assetEntryPoint);
    if (!readyAssets) return;

    await evalTS(
      "handleApplyJump",
      readyAssets.cardsPresetPath,
      getCoinVfxPath(readyAssets, coinValue),
      readyAssets.sfxFolderPath,
      readyAssets.cardsControlPresetPath,
      readTrimCoveredCardsPreference()
    );
  };

  const flipStockCards = async () => {
    const readyAssets = await ensureAssetsReadyOrAlert(assetEntryPoint);
    if (!readyAssets) return;

    await evalTS(
      "handleFlipStockCards",
      readyAssets.expressionLibPath,
      readyAssets.sfxFolderPath,
      readyAssets.cardsControlPresetPath,
      readTrimCoveredCardsPreference()
    );
  };
  const applyFlipCard = async () => await evalTS("handleFlipCards");

  const handleSetTargetLayer = async () => await evalTS("handleSetTargetLayer");
  const handleSetStockLayer = async () => await evalTS("handleSetStockLayer");
  const handleSetTableauLayer = async () =>
    await evalTS("handleSetTableauLayer");

  const resetCardsAnimation = async () => await evalTS("handleResetCardsAnimation");
  const restoreCardsAnimation = async () => {
    const readyAssets = await ensureAssetsReadyOrAlert(assetEntryPoint);
    if (!readyAssets) return;

    await evalTS(
      "handleRestoreCardsAnimation",
      readyAssets.cardsPresetPath,
      readyAssets.expressionLibPath,
      getCoinVfxPath(readyAssets, coinValue),
      readyAssets.sfxFolderPath,
      readyAssets.cardsControlPresetPath,
      readTrimCoveredCardsPreference()
    );
  };

  const handleImportFilesAndComps = async () => {
    const readyAssets = await ensureAssetsReadyOrAlert(assetEntryPoint);
    if (!readyAssets) return;

    await evalTS("handleImportFilesAndComps", readyAssets.cardProject);
  };

  const handleAddProgressBar = async () => {
    const readyAssets = await ensureAssetsReadyOrAlert(assetEntryPoint);
    if (!readyAssets) return;

    await evalTS("handleAddProgressBar", readyAssets.progressBarPresetPath);
  };

  const handleClearExpressions = async () =>
    await evalTS("handleClearLayerExpressions");

  const handleGroupCards = async () =>
    await evalTS("handleGroupCards");

  const handleClearCardsLevel = async () =>
    await evalTS("handleClearCardsLevel");

  return (
    <section className="panel-section actions-panel">
      <span className="section-label">Actions</span>

      <div className="actions-toolbar">
        <div className="actions-segmented" role="tablist" aria-label="Action groups">
          <button
            type="button"
            className={`actions-segment ${activeGroup === "play" ? "is-active" : ""}`}
            onClick={() => setActiveGroup("play")}
            role="tab"
            aria-selected={activeGroup === "play"}
          >
            Play
          </button>
          <button
            type="button"
            className={`actions-segment ${activeGroup === "setup" ? "is-active" : ""}`}
            onClick={() => setActiveGroup("setup")}
            role="tab"
            aria-selected={activeGroup === "setup"}
          >
            Setup
          </button>
          <button
            type="button"
            className={`actions-segment ${activeGroup === "maintenance" ? "is-active" : ""}`}
            onClick={() => setActiveGroup("maintenance")}
            role="tab"
            aria-selected={activeGroup === "maintenance"}
          >
            Maint.
          </button>
        </div>

        <button
          type="button"
          className="actions-clear-button"
          onClick={handleClearCardsLevel}
          title={"Clear Level"}
          aria-label="Clear Level"
        >
          <img src={ClearIcon} alt="" />
        </button>
      </div>

      <div className="actions-segment-panel">
        {activeGroup === "play" && (
          <div className="button-row actions-button-row" role="tabpanel">
            <button
              onClick={applyFlipCard}
              style={{ border: "1px solid #4AA44C" }}
              title={"Flip Card"}
            >
              Flip
            </button>

            <button onClick={applyJump}
              style={{ border: "1px solid #4AA44C" }}
              title={"Apply Jump with Coin"}
            >
              Jump
            </button>

            <button
              onClick={flipStockCards}
              style={{ border: "1px solid #E4D84C" }}
              title={"Flip Stock Cards"}
            >
              Flip Stock
            </button>
          </div>
        )}

        {activeGroup === "setup" && (
          <div className="button-row actions-button-row" role="tabpanel">
            <button
              onClick={handleSetTargetLayer}
              style={{ backgroundColor: "#B53838" }}
              title={"Set Target Layer"}
            >
              Set Target
            </button>

            <button
              onClick={handleSetStockLayer}
              style={{ backgroundColor: "#E4D84C", color: "black" }}
              title={"Set Stock Layers"}
            >
              Set Stock
            </button>

            <button
              onClick={handleSetTableauLayer}
              style={{ backgroundColor: "#4AA44C" }}
              title={"Set Tableau Layers"}
            >
              Set Tableau
            </button>

          </div>
        )}

        {activeGroup === "maintenance" && (
          <div className="button-row actions-button-row" role="tabpanel">
            <button
              onClick={resetCardsAnimation}
              style={{ border: "1px solid #677DE0" }}
              title={"Reset Keyframes and Expressions"}
            >
              Reset
            </button>

            <button
              onClick={restoreCardsAnimation}
              style={{ border: "1px solid #677DE0" }}
              title={"Restore Keyframes and Expressions"}
            >
              Restore
            </button>

            <button
              onClick={handleClearExpressions}
              style={{ border: "1px solid #E8920D" }}
              title={"Clear Layer Expressions"}
            >
              Clear Expressions
            </button>

            <button
              onClick={handleGroupCards}
              style={{ border: "1px solid #E8920D" }}
              title={"Create a centered null and parent all card layers"}
            >
              Group Cards
            </button>

            <button
              onClick={handleAddProgressBar}
              style={{ border: "1px solid #E8920D" }}
              title={"Add Progress Bar"}
            >
              Progress Bar
            </button>
          </div>
        )}
      </div>

    </section>
  );
};
