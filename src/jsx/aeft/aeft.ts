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
import { requireActiveComp } from "./aeft-utils";
import { clearLayerExpressions, distributeLayers, forEachSelectedLayer } from "./aeft-utils-jonatan";
import { applyCardsLayoutFromObject, getActiveCompLayoutData, CardsLayoutJson, getActiveCompResolution, saveCardsLayoutThumbnail } from "./game-levels-utils";
import { alertError } from "./errors";
import { addProgressBar } from "./progressBar-utils";

const cardsFolderName = "Disney Solitaire Cards"
const presetMatchName = "Pseudo/cards_gameplay_superplay"
// const precompRenderer = "ADBE Calder"

const getFileNameFromPath = (filePath: string): string => {
  let startIndex = 0;

  for (let i = filePath.length - 1; i >= 0; i--) {
    const character = filePath.charAt(i);
    if (character === "/" || character === "\\") {
      startIndex = i + 1;
      break;
    }
  }

  return filePath.substring(startIndex);
}

const getDimensionValue = (dimension: Dimension | null, propertyName: string, index: number, fallback: number): number => {
  if (!dimension) return fallback;

  //@ts-ignore
  const namedValue = dimension[propertyName];
  if (typeof namedValue === "number" && namedValue > 0) return namedValue;

  const indexedValue = dimension[index];
  if (typeof indexedValue === "number" && indexedValue > 0) return indexedValue;

  return fallback;
}

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

export const handleSaveCardsLayoutThumbnail = (layoutData: CardsLayoutJson, thumbnailPath: string, maxSide?: number) => {
  try {
    return saveCardsLayoutThumbnail(layoutData, thumbnailPath, maxSide);
  } catch (e) {
    //@ts-ignore
    return "Thumbnail export failed: " + e.toString();
  }
};

export const handleOpenLayoutPreview = (imagePath: string) => {
  try {
    const imageFile = new File(imagePath);
    if (!imageFile.exists) return "Preview image not found: " + imagePath;
    const previewImage = ScriptUI.newImage(imageFile.fsName);
    const imageWidth = getDimensionValue(previewImage.size, "width", 0, 512);
    const imageHeight = getDimensionValue(previewImage.size, "height", 1, 512);
    const largestImageSide = Math.max(imageWidth, imageHeight);
    const initialScale = largestImageSide > 0 ? 720 / largestImageSide : 1;
    const initialWidth = Math.max(360, Math.round(imageWidth * initialScale));
    const initialHeight = Math.max(240, Math.round(imageHeight * initialScale));

    const dialog = new Window(
      "dialog",
      "Layout Preview - " + getFileNameFromPath(imagePath),
      undefined,
      { resizeable: true }
    );

    dialog.orientation = "column";
    dialog.alignChildren = ["fill", "fill"];
    dialog.margins = 10;
    dialog.spacing = 0;

    const previewCanvas = dialog.add("group");
    previewCanvas.alignment = ["fill", "fill"];
    previewCanvas.preferredSize = [initialWidth, initialHeight];
    previewCanvas.minimumSize = [240, 160];

    previewCanvas.onDraw = function () {
      const canvasWidth = getDimensionValue(previewCanvas.size, "width", 0, initialWidth);
      const canvasHeight = getDimensionValue(previewCanvas.size, "height", 1, initialHeight);
      const scaleX = canvasWidth / imageWidth;
      const scaleY = canvasHeight / imageHeight;
      const drawScale = Math.min(scaleX, scaleY);
      const drawWidth = Math.max(1, Math.round(imageWidth * drawScale));
      const drawHeight = Math.max(1, Math.round(imageHeight * drawScale));
      const drawX = Math.round((canvasWidth - drawWidth) / 2);
      const drawY = Math.round((canvasHeight - drawHeight) / 2);

      previewCanvas.graphics.drawImage(previewImage, drawX, drawY, drawWidth, drawHeight);
    };

    const redrawPreview = function () {
      try {
        dialog.layout.resize();
      } catch (_) { }
    };

    dialog.onResize = redrawPreview;
    dialog.onResizing = redrawPreview;

    dialog.center();
    dialog.show();

    return "OK";
  } catch (e) {
    //@ts-ignore
    return "Could not open preview: " + e.toString();
  }
}

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

export const handleApplyJump = (presetPath: string, coinFilePath: string, sfxFolderPath?: string) => {
  app.beginUndoGroup("Apply Jump")
  try {
    applyJumpOnSelectedlayers(presetPath, coinFilePath, sfxFolderPath)
  } catch (e) {
    alertError(e, 93, "handleApplyJump", "aeft.ts")
  } finally {
    app.endUndoGroup()
  }
}

export const handleFlipStockCards = (expressionLibPath?: string, sfxFolderPath?: string) => {
  app.beginUndoGroup("Flip Stock Cards")
  try {
    flipStockCards(undefined, expressionLibPath, sfxFolderPath)
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
  const comp = requireActiveComp("Get Comp Size");
  if (!comp) return [0, 0]

  const { width, height } = comp;
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

export const handleRestoreCardsAnimation = (
  presetPath: string,
  expressionLibPath?: string,
  coinFilePath?: string,
  sfxFolderPath?: string
) => {
  app.beginUndoGroup("Restore Cards Animation by Layout")
  restoreCardsAnimation(presetPath, presetMatchName, expressionLibPath, coinFilePath, sfxFolderPath)
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

export const handleClearLayerExpressions = () => {
  app.beginUndoGroup("Clear Layer Expressions")
  try {

    const thisComp = requireActiveComp("Clear Layer Expressions")
    if (!thisComp) return

    forEachSelectedLayer(thisComp, layer => {
      clearLayerExpressions(layer)
    })
  } catch (e) {
    alertError(e, 220, "handleClearLayerExpressions", "aeft.ts")
  } finally {
    app.endUndoGroup()
  }
}







