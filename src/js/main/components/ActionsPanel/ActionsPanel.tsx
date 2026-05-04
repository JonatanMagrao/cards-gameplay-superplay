import React from "react";
import { csi, evalTS } from "../../../lib/utils/bolt";
import { fs, os, path } from "../../../lib/cep/node";

type Props = {
  cardsPreset?: string;
  projectRelPath?: string;
  progressBarPreset?: string;
  expressionLibRelPath?: string;
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

export const ActionsPanel: React.FC<Props> = ({
  cardsPreset = "presets/cards_gameplay_superplay.ffx",
  progressBarPreset = "presets/cards_gameplay_progressbar.ffx",
  expressionLibRelPath = "expressions/superplay-expression-lib.jsx",
  projectRelPath = "disney_solitaire_cards.aepx",
  coinValue, // Extraindo das props
}) => {
  const assets = `${csi.getSystemPath("extension")}/assets`;

  const cardPresetPath = `${assets}/${cardsPreset}`;
  const progressBarPresetPath = `${assets}/${progressBarPreset}`;
  const expressionLibPath = `${assets}/${expressionLibRelPath}`;
  const cardProject = `${assets}/${projectRelPath}`;
  const sfxFolderPath = `${assets}/sfx`;

  // NOVO: Montando o caminho do arquivo de moeda baseado no que foi selecionado
  const coinPath = `${assets}/coins-vfx/coin_plus-${coinValue}.mov`;

  // NOVO: Passando os dois caminhos pro seu ExtendScript
  const applyJump = async () => await evalTS("handleApplyJump", cardPresetPath, coinPath, sfxFolderPath, readTrimCoveredCardsPreference());

  const flipStockCards = async () => await evalTS("handleFlipStockCards", expressionLibPath, sfxFolderPath, readTrimCoveredCardsPreference());
  const applyFlipCard = async () => await evalTS("handleFlipCards");

  const handleSetTargetLayer = async () => await evalTS("handleSetTargetLayer");
  const handleSetStockLayer = async () => await evalTS("handleSetStockLayer");
  const handleSetTableauLayer = async () =>
    await evalTS("handleSetTableauLayer");

  const resetCardsAnimation = async () => await evalTS("handleResetCardsAnimation");
  const restoreCardsAnimation = async () =>
    await evalTS("handleRestoreCardsAnimation", cardPresetPath, expressionLibPath, coinPath, sfxFolderPath, readTrimCoveredCardsPreference());

  const handleImportFilesAndComps = async () =>
    await evalTS("handleImportFilesAndComps", cardProject);

  const handleAddProgressBar = async () =>
    await evalTS("handleAddProgressBar", progressBarPresetPath);

  const handleClearExpressions = async () =>
    await evalTS("handleClearLayerExpressions");

  const handleGroupCards = async () =>
    await evalTS("handleGroupCards");

  const handleClearCardsLevel = async () =>
    await evalTS("handleClearCardsLevel");

  return (
    <section className="panel-section">
      <span className="section-label">Actions</span>

      {/* Row 1: most used actions */}
      <div className="button-row">
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

      {/* Row 2: set layers */}
      <div className="button-row">
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

      {/* Row 3: setup */}
      <div className="button-row">
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
          onClick={handleGroupCards}
          style={{ border: "1px solid #677DE0" }}
          title={"Create a centered null and parent all card layers"}
        >
          Group Cards
        </button>

        <button
          onClick={handleClearCardsLevel}
          style={{ border: "1px solid #677DE0" }}
          title={"Remove cards and gameplay control layers from this comp"}
        >
          Clear Level
        </button>
      </div>

      <div className="button-row">
        <button
          onClick={handleAddProgressBar}
          style={{ border: "1px solid #E8920D" }}
          title={"Add Progress Bar"}
        >
          Progress Bar
        </button>

        <button
          onClick={handleClearExpressions}
          style={{ border: "1px solid #E8920D" }}
          title={"Clear Layer Expressions"}
        >
          Clear Expressions
        </button>
      </div>
    </section>
  );
};
