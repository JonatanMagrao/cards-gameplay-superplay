import { importFilesAndCompsForCards, } from "./cards-utils"
import {
  applyJumpOnSelectedlayers,
  applyFlipCardOnSelectedlayers,
  setTargetLayer,
  setCardType,
  turnCards,
  duplicateCards,
  changeCard,
  flipStockCards,
  addCardToPrecomp,
  resetCardsAnimation,
  restoreCardsAnimation
} from "./actions";
import { getActiveComp } from "./aeft-utils";
import { distributeLayers } from "./aeft-utils-jonatan";
import { applyCardsLayoutFromObject, getActiveCompLayoutData, CardsLayoutJson, getActiveCompResolution, } from "./game-levels-utils";
import { alertError } from "./errors";
import { addProgressBar } from "./progressBar-utils";

const cardsFolderName = "Disney Solitaire Cards"
const presetMatchName = "Pseudo/cards_gameplay_superplay"
// const precompRenderer = "ADBE Calder"

export const getCompResolution = () => {
  return getActiveCompResolution();
}

export const handleApplyCardsLayout = (layoutData: CardsLayoutJson, filePath: string) => {

  importFilesAndCompsForCards(filePath, cardsFolderName)

  app.beginUndoGroup("Apply Cards Layout");
  try {
    return applyCardsLayoutFromObject(layoutData);
  } catch (e) {
    //@ts-ignore
    alert("Error in AE: " + e.toString());
    return "ERROR";
  } finally {
    app.endUndoGroup();
  }
};

export const handleSaveCardsLayout = (levelId: string) => {
  try {
    // Apenas retorna os dados. O React salva.
    return getActiveCompLayoutData(levelId);
  } catch (e) {
    //@ts-ignore
    return JSON.stringify({ error: e.toString() });
  }
};

export const handleSetTargetLayer = () => {
  app.beginUndoGroup("Set Target Layer")
  try {
    setTargetLayer()
  } catch (e) {
    alertError(e, 65, "handleSetTargetLayer", "aeft.ts")
  } finally {
    app.endUndoGroup()
  }
}

export const handleSetStockLayer = () => {
  app.beginUndoGroup("Set Stock Layer")
  try {
    setCardType("stock", 2)
  } catch (e) {
    alertError(e, 76, "handleSetStockLayer", "aeft.ts")
  } finally {
    app.endUndoGroup()
  }
}

export const handleSetTableauLayer = () => {
  app.beginUndoGroup("Set Tableau Layer")
  try {
    setCardType("TABLEAU", 9)
  } catch (e) {
    alertError(e, 87, "handleSetTableauLayer", "aeft.ts")
  } finally {
    app.endUndoGroup()
  }
}

export const handleApplyJump = (presetPath: string) => {
  // const thisComp = getActiveComp()
  // if (thisComp.renderer !== precompRenderer) {
  //   thisComp.renderer = precompRenderer
  // }

  app.beginUndoGroup("Apply Jump")
  try {
    applyJumpOnSelectedlayers(presetPath)
  } catch (e) {
    alertError(e, 103, "handleApplyJump", "aeft.ts")
  } finally {
    app.endUndoGroup()
  }
}

export const handleFlipStockCards = () => {
  app.beginUndoGroup("Flip Stock Cards")
  try {
    flipStockCards()
  } catch (e) {
    alertError(e, 114, "handleFlipStockCards", "aeft.ts")
  } finally {
    app.endUndoGroup()
  }
}

export const handleFlipCards = () => {
  app.beginUndoGroup("Flip Cards")
  try {
    applyFlipCardOnSelectedlayers()
  } catch (e) {
    alertError(e, 125, "handleFlipCards", "aeft.ts")
  } finally {
    app.endUndoGroup()
  }
}

export const handleTurnCards = () => {
  app.beginUndoGroup("Turn Cards")
  try {
    turnCards()
  } catch (e) {
    alertError(e, 136, "handleTurnCards", "aeft.ts")
  } finally {
    app.endUndoGroup()
  }
}

export const handleDuplicateCards = (numCopies: number, adjustPos: number[]) => {
  app.beginUndoGroup("Duplicate Cards")
  try {
    duplicateCards(numCopies, adjustPos)
  } catch (e) {
    alertError(e, 147, "handleDuplicateCards", "aeft.ts")
  } finally {
    app.endUndoGroup()
  }
}

export const handleDistributeLayers = (xStep: number, yStep: number, reverse: boolean) => {
  app.beginUndoGroup("Distribute Layers")
  try {
    distributeLayers(xStep, yStep, reverse)
  } catch (e) {
    alertError(e, 158, "handleDistributeLayers", "aeft.ts")
  } finally {
    app.endUndoGroup()
  }
}

export const getCompSize = () => {
  const { width, height } = getActiveComp();
  return [width, height]
}

export const handleImportFilesAndComps = (filePath: string) => {
  importFilesAndCompsForCards(filePath, cardsFolderName)
}

export const handleChangeCard = (deckName: string, card: number, cardName: string) => {
  app.beginUndoGroup("Update Cards")
  changeCard(deckName, card, cardName)
  app.endUndoGroup()
}

export const handleAddCard = (deckName: string, card: number, cardName: string, filePath: string) => {

  importFilesAndCompsForCards(filePath, cardsFolderName)

  app.beginUndoGroup("Add Card to precomp")
  try {
    addCardToPrecomp(deckName, card, cardName)
  } catch (e) {
    alertError(e, 179, "handleAddCard", "aeft.ts")
  } finally {
    app.endUndoGroup()
  }
}

export const handleResetCardsAnimation = () => {
  app.beginUndoGroup("Reset Cards Animation")
  resetCardsAnimation(presetMatchName)
  app.endUndoGroup()
}

export const handleRestoreCardsAnimation = (presetPath: string) => {
  app.beginUndoGroup("Restore Cards Animation by Layout")
  restoreCardsAnimation(presetPath, presetMatchName)
  app.endUndoGroup()
}


export const handleAddProgressBar = (presetPath: string) => {
  app.beginUndoGroup("Add Progress Bar")
  try {
    addProgressBar(presetPath)
  } catch (e) {
    alertError(e, 216, "handleAddProgressBar", "aeft.ts")
  } finally {
    app.endUndoGroup()
  }
}









