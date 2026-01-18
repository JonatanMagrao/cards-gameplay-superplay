import React from "react";
import { csi, evalTS } from "../../../lib/utils/bolt";

type Props = {
  presetRelPath?: string; // relative to extension assets
  projectRelPath?: string; // relative to extension assets
};

export const ActionsPanel: React.FC<Props> = ({
  presetRelPath = "presets/cards_gameplay_superplay.ffx",
  projectRelPath = "disney_solitaire_cards.aepx",
}) => {
  const assets = `${csi.getSystemPath("extension")}/assets`;

  const presetPath = `${assets}/${presetRelPath}`;
  const cardProject = `${assets}/${projectRelPath}`;

  const applyJump = async () => await evalTS("handleApplyJump", presetPath);
  const flipStockCards = async () => await evalTS("handleFlipStockCards");
  const applyFlipCard = async () => await evalTS("handleFlipCards");

  const handleSetTargetLayer = async () => await evalTS("handleSetTargetLayer");
  const handleSetStockLayer = async () => await evalTS("handleSetStockLayer");
  const handleSetTableauLayer = async () =>
    await evalTS("handleSetTableauLayer");

  const resetCardsAnimation = async () => await evalTS("resetCardsAnimation");
  const restoreCardsAnimation = async () =>
    await evalTS("restoreCardsAnimation");

  const handleImportFilesAndComps = async () =>
    await evalTS("handleImportFilesAndComps", cardProject);

  return (
    <section className="panel-section">
      <span className="section-label">Actions</span>

      {/* Row 1: most used actions */}
      <div className="button-row">
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

        <button
          onClick={applyFlipCard}
          style={{border:"1px solid #E8920D"}}
          title={"Flip Card"}
        >
          Flip
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
          onClick={handleImportFilesAndComps}
          style={{ border: "1px solid #677DE0" }}
          title={"Import Decks"}
        >
          Import
        </button>
      </div>
    </section>
  );
};
