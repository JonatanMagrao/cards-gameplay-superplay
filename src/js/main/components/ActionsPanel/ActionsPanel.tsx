import React from "react";
import { csi, evalTS } from "../../../lib/utils/bolt";

type Props = {
  cardsPreset?: string; // relative to extension assets
  projectRelPath?: string; // relative to extension assets
  progressBarPreset?: string; // relative to extension assets
};

export const ActionsPanel: React.FC<Props> = ({
  cardsPreset = "presets/cards_gameplay_superplay.ffx",
  progressBarPreset = "presets/cards_gameplay_progressbar.ffx",
  projectRelPath = "disney_solitaire_cards.aepx",

}) => {
  const assets = `${csi.getSystemPath("extension")}/assets`;

  const cardPresetPath = `${assets}/${cardsPreset}`;
  const progressBarPresetPath = `${assets}/${progressBarPreset}`;
  const cardProject = `${assets}/${projectRelPath}`;

  const applyJump = async () => await evalTS("handleApplyJump", cardPresetPath);
  const flipStockCards = async () => await evalTS("handleFlipStockCards");
  const applyFlipCard = async () => await evalTS("handleFlipCards");

  const handleSetTargetLayer = async () => await evalTS("handleSetTargetLayer");
  const handleSetStockLayer = async () => await evalTS("handleSetStockLayer");
  const handleSetTableauLayer = async () =>
    await evalTS("handleSetTableauLayer");

  const resetCardsAnimation = async () => await evalTS("handleResetCardsAnimation");
  const restoreCardsAnimation = async () =>
    await evalTS("handleRestoreCardsAnimation", cardPresetPath);

  const handleImportFilesAndComps = async () =>
    await evalTS("handleImportFilesAndComps", cardProject);

  const handleAddProgressBar = async () => await evalTS("handleAddProgressBar", progressBarPresetPath);

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
          title={"Apply Jump"}
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

        {/* <button
          onClick={handleImportFilesAndComps}
          style={{ border: "1px solid #677DE0" }}
          title={"Import Decks"}
        >
          Import
        </button> */}

        <button
          onClick={handleAddProgressBar}
          style={{ border: "1px solid #E8920D" }}
          title={"Add Progress Bar"}
        >
          Progress Bar
        </button>
      </div>
    </section>
  );
};
