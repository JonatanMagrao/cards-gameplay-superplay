import React from "react";
import { csi, evalTS } from "../../../lib/utils/bolt";

type Props = {
  presetRelPath?: string;  // relative to extension assets
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
  const turnCards = async () => await evalTS("handleTurnCards");

  const handleSetTargetLayer = async () => await evalTS("handleSetTargetLayer");
  const handleSetStockLayer = async () => await evalTS("handleSetStockLayer");
  const handleSetTableauLayer = async () => await evalTS("handleSetTableauLayer");

  const resetCardsAnimation = async () => await evalTS("resetCardsAnimation");
  const restoreCardsAnimation = async () => await evalTS("restoreCardsAnimation");

  const handleImportFilesAndComps = async () => await evalTS("handleImportFilesAndComps", cardProject);

  return (
    <section className="panel-section">
      <span className="section-label">Actions</span>

      <div className="button-row">
        <button onClick={applyJump} style={{ border: "1px solid #4AA44C" }}>
          Apply Jump
        </button>

        <button onClick={flipStockCards} style={{ border: "1px solid #E4D84C" }}>
          Flip Stock Cards
        </button>

        <button onClick={applyFlipCard}>Flip Card</button>
        <button onClick={turnCards}>Turn Cards</button>

        <button onClick={handleSetTargetLayer} style={{ backgroundColor: "#B53838" }}>
          Set Target Layer
        </button>

        <button onClick={handleSetStockLayer} style={{ backgroundColor: "#E4D84C", color: "black" }}>
          Set Stock Layers
        </button>

        <button onClick={handleSetTableauLayer} style={{ backgroundColor: "#4AA44C" }}>
          Set Tableau Layers
        </button>

        <button onClick={resetCardsAnimation}>Reset</button>
        <button onClick={restoreCardsAnimation}>Restore</button>

        <button onClick={handleImportFilesAndComps}>Import</button>
      </div>
    </section>
  );
};
