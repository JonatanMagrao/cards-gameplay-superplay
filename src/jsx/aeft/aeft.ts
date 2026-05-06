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
  restoreCardsAnimation,
  groupCardsToControl,
  clearCardsLevel
} from "./actions";
import { requireActiveComp } from "./aeft-utils";
import { clearLayerExpressions, distributeLayers, forEachSelectedLayer } from "./aeft-utils-jonatan";
import { applyCardsLayoutFromObject, getActiveCardsLayoutOrigin, getActiveCompLayoutData, CardsLayoutJson, getActiveCompResolution, saveCardsLayoutThumbnail, ApplyCardsLayoutOptions } from "./game-levels-utils";
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

export const handleShowAlert = (message: string) => {
  alert(String(message || ""));
  return "OK";
}

export const handleShowConfirm = (message: string) => {
  return confirm(String(message || ""));
}

export const handleShowUpdateLayoutTargetDialog = (options?: {
  applied?: { label?: string; thumbnailPath?: string };
  selected?: { label?: string; thumbnailPath?: string };
}) => {
  try {
    const dialogOptions = options || {};
    const applied = dialogOptions.applied || {};
    const selected = dialogOptions.selected || {};
    const choices = [
      {
        id: "applied",
        label: String(applied.label || "Applied layout"),
        thumbnailPath: String(applied.thumbnailPath || "")
      },
      {
        id: "selected",
        label: String(selected.label || "Selected layout"),
        thumbnailPath: String(selected.thumbnailPath || "")
      }
    ];

    let selectedTarget = "applied";
    const thumbWidth = 170;
    const thumbHeight = 130;

    const loadImage = function (filePath: string) {
      try {
        const imageFile = new File(filePath);
        if (!imageFile.exists) return null;

        const image = ScriptUI.newImage(imageFile.fsName);
        return {
          image: image,
          width: getDimensionValue(image.size, "width", 0, 512),
          height: getDimensionValue(image.size, "height", 1, 512)
        };
      } catch (_) {
        return null;
      }
    };

    const dialog = new Window("dialog", "Update Layout", undefined, { resizeable: false });
    dialog.orientation = "column";
    dialog.alignChildren = ["fill", "top"];
    dialog.margins = 14;
    dialog.spacing = 12;

    dialog.add("statictext", undefined, "Which layout do you want to update?");

    const optionsGroup = dialog.add("group");
    optionsGroup.orientation = "row";
    optionsGroup.alignChildren = ["fill", "top"];
    optionsGroup.spacing = 14;

    const optionControls: any[] = [];

    const selectTarget = function (targetId: string) {
      selectedTarget = targetId;

      for (let i = 0; i < optionControls.length; i++) {
        const control = optionControls[i];
        const isSelected = control.id === selectedTarget;
        control.radio.value = isSelected;
        control.selectButton.text = isSelected ? "Selected" : "Select";

        try {
          control.canvas.notify("onDraw");
        } catch (_) { }
      }

      try {
        dialog.update();
      } catch (_) { }
    };

    const addChoiceOption = function (choice: { id: string; label: string; thumbnailPath: string }) {
      const imageData = loadImage(choice.thumbnailPath);

      const item = optionsGroup.add("group");
      item.orientation = "column";
      item.alignChildren = ["fill", "top"];
      item.spacing = 6;
      item.preferredSize = [thumbWidth, thumbHeight + 58];

      const radio = item.add("radiobutton", undefined, choice.label);
      radio.alignment = ["fill", "top"];

      const canvas = item.add("group");
      canvas.alignment = ["fill", "top"];
      canvas.preferredSize = [thumbWidth, thumbHeight];
      canvas.minimumSize = [thumbWidth, thumbHeight];

      canvas.onDraw = function () {
        const graphics = canvas.graphics;
        const width = getDimensionValue(canvas.size, "width", 0, thumbWidth);
        const height = getDimensionValue(canvas.size, "height", 1, thumbHeight);
        const bgBrush = graphics.newBrush(graphics.BrushType.SOLID_COLOR, [0.12, 0.13, 0.16, 1]);
        const emptyBrush = graphics.newBrush(graphics.BrushType.SOLID_COLOR, [0.42, 0.42, 0.42, 1]);
        const borderColor = selectedTarget === choice.id ? [0.35, 0.75, 1, 1] : [0.32, 0.35, 0.42, 1];
        const borderWidth = selectedTarget === choice.id ? 3 : 1;
        const borderPen = graphics.newPen(graphics.PenType.SOLID_COLOR, borderColor, borderWidth);

        graphics.rectPath(0, 0, width, height);
        graphics.fillPath(bgBrush);

        if (imageData && imageData.image) {
          const imageWidth = imageData.width || 1;
          const imageHeight = imageData.height || 1;
          const scale = Math.min((width - 12) / imageWidth, (height - 12) / imageHeight);
          const drawWidth = Math.max(1, Math.round(imageWidth * scale));
          const drawHeight = Math.max(1, Math.round(imageHeight * scale));
          const drawX = Math.round((width - drawWidth) / 2);
          const drawY = Math.round((height - drawHeight) / 2);

          graphics.drawImage(imageData.image, drawX, drawY, drawWidth, drawHeight);
        } else {
          graphics.rectPath(10, 10, width - 20, height - 20);
          graphics.fillPath(emptyBrush);
        }

        graphics.rectPath(1, 1, width - 2, height - 2);
        graphics.strokePath(borderPen);
      };

      const selectButton = item.add("button", undefined, choice.id === selectedTarget ? "Selected" : "Select");
      selectButton.alignment = ["fill", "top"];

      optionControls.push({
        id: choice.id,
        radio: radio,
        canvas: canvas,
        selectButton: selectButton
      });

      const selectChoice = function () { selectTarget(choice.id); };

      radio.onClick = selectChoice;
      canvas.onClick = selectChoice;
      selectButton.onClick = selectChoice;
    };

    for (let i = 0; i < choices.length; i++) {
      addChoiceOption(choices[i]);
    }

    selectTarget(selectedTarget);

    const buttons = dialog.add("group");
    buttons.orientation = "row";
    buttons.alignment = ["right", "top"];
    buttons.spacing = 8;

    const cancelButton = buttons.add("button", undefined, "Cancel", { name: "cancel" });
    const continueButton = buttons.add("button", undefined, "Continue", { name: "ok" });

    cancelButton.onClick = function () {
      dialog.close(0);
    };

    continueButton.onClick = function () {
      dialog.close(1);
    };

    dialog.center();
    const dialogResult = dialog.show();
    if (dialogResult !== 1) return { cancelled: true };

    return {
      cancelled: false,
      target: selectedTarget
    };
  } catch (e) {
    //@ts-ignore
    return { cancelled: true, error: "Could not open update target dialog: " + e.toString() };
  }
}

export const handleApplyCardsLayout = (layoutData: CardsLayoutJson, filePath: string, options?: ApplyCardsLayoutOptions) => {
  app.beginUndoGroup("Apply Cards Layout");
  try {
    const applyOptions: ApplyCardsLayoutOptions = options || {};
    if (!applyOptions.controlPresetPath) {
      alert("Cards control preset path is missing.");
      return "ERROR";
    }
    importFilesAndCompsForCards(filePath, cardsFolderName)
    return applyCardsLayoutFromObject(layoutData, applyOptions);
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

export const handleGetActiveCardsLayoutOrigin = () => {
  try {
    return getActiveCardsLayoutOrigin();
  } catch (_) {
    return null;
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

export const handleShowSaveLayoutDialog = (imagePath: string, defaults?: { name?: string; tags?: string; description?: string; title?: string }) => {
  try {
    const imageFile = new File(imagePath);
    if (!imageFile.exists) return { cancelled: true, error: "Preview image not found: " + imagePath };

    const initialValues = defaults || {};
    const previewImage = ScriptUI.newImage(imageFile.fsName);
    const imageWidth = getDimensionValue(previewImage.size, "width", 0, 512);
    const imageHeight = getDimensionValue(previewImage.size, "height", 1, 512);
    const largestImageSide = Math.max(imageWidth, imageHeight);
    const previewScale = largestImageSide > 0 ? 300 / largestImageSide : 1;
    const previewWidth = Math.max(260, Math.round(imageWidth * previewScale));
    const previewHeight = Math.max(180, Math.round(imageHeight * previewScale));

    const dialog = new Window("dialog", String(initialValues.title || "Save New Layout"), undefined, { resizeable: true });
    dialog.orientation = "column";
    dialog.alignChildren = ["fill", "top"];
    dialog.margins = 12;
    dialog.spacing = 10;

    const previewCanvas = dialog.add("group");
    previewCanvas.alignment = ["fill", "top"];
    previewCanvas.preferredSize = [previewWidth, previewHeight];
    previewCanvas.minimumSize = [240, 160];

    previewCanvas.onDraw = function () {
      const canvasWidth = getDimensionValue(previewCanvas.size, "width", 0, previewWidth);
      const canvasHeight = getDimensionValue(previewCanvas.size, "height", 1, previewHeight);
      const scaleX = canvasWidth / imageWidth;
      const scaleY = canvasHeight / imageHeight;
      const drawScale = Math.min(scaleX, scaleY);
      const drawWidth = Math.max(1, Math.round(imageWidth * drawScale));
      const drawHeight = Math.max(1, Math.round(imageHeight * drawScale));
      const drawX = Math.round((canvasWidth - drawWidth) / 2);
      const drawY = Math.round((canvasHeight - drawHeight) / 2);

      previewCanvas.graphics.drawImage(previewImage, drawX, drawY, drawWidth, drawHeight);
    };

    const addInputRow = function (label: string, defaultValue: string, multiline?: boolean) {
      const group = dialog.add("group");
      group.orientation = "column";
      group.alignChildren = ["fill", "top"];
      group.spacing = 4;
      group.add("statictext", undefined, label);

      const input = group.add("edittext", undefined, defaultValue || "", multiline ? { multiline: true, scrolling: true } : undefined);
      input.alignment = ["fill", "top"];
      input.preferredSize = multiline ? [previewWidth, 70] : [previewWidth, 24];

      return input;
    };

    const nameInput = addInputRow("Level name", String(initialValues.name || ""));
    const tagsInput = addInputRow("Tags (comma separated)", String(initialValues.tags || ""));
    const descriptionInput = addInputRow("Description", String(initialValues.description || ""), true);

    const buttons = dialog.add("group");
    buttons.orientation = "row";
    buttons.alignment = ["right", "top"];
    buttons.spacing = 8;

    const cancelButton = buttons.add("button", undefined, "Cancel", { name: "cancel" });
    const saveButton = buttons.add("button", undefined, "Save", { name: "ok" });

    let result = {
      cancelled: true,
      name: "",
      tags: "",
      description: ""
    };

    cancelButton.onClick = function () {
      dialog.close(0);
    };

    saveButton.onClick = function () {
      const levelName = String(nameInput.text || "").replace(/^\s+|\s+$/g, "");
      if (!levelName) {
        alert("Type a level name first.");
        return;
      }

      result = {
        cancelled: false,
        name: levelName,
        tags: String(tagsInput.text || ""),
        description: String(descriptionInput.text || "")
      };
      dialog.close(1);
    };

    const redrawPreview = function () {
      try {
        dialog.layout.resize();
      } catch (_) { }
    };

    dialog.onResize = redrawPreview;
    dialog.onResizing = redrawPreview;

    dialog.center();
    const dialogResult = dialog.show();

    return dialogResult === 1 ? result : { cancelled: true };
  } catch (e) {
    //@ts-ignore
    return { cancelled: true, error: "Could not open save dialog: " + e.toString() };
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

export const handleApplyJump = (
  presetPath: string,
  coinFilePath: string,
  sfxFolderPath?: string,
  controlPresetPath?: string,
  trimCoveredCards?: boolean
) => {
  app.beginUndoGroup("Apply Jump")
  try {
    applyJumpOnSelectedlayers(presetPath, coinFilePath, sfxFolderPath, controlPresetPath, trimCoveredCards === true)
  } catch (e) {
    alertError(e, 93, "handleApplyJump", "aeft.ts")
  } finally {
    app.endUndoGroup()
  }
}

export const handleFlipStockCards = (
  expressionLibPath?: string,
  sfxFolderPath?: string,
  controlPresetPath?: string,
  trimCoveredCards?: boolean
) => {
  app.beginUndoGroup("Flip Stock Cards")
  try {
    flipStockCards(undefined, expressionLibPath, sfxFolderPath, controlPresetPath, trimCoveredCards === true)
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

export const handleDuplicateCards = (numCopies: number, adjustPos: number[], controlPresetPath?: string) => {
  app.beginUndoGroup("Duplicate Cards")
  try {
    duplicateCards(numCopies, adjustPos, controlPresetPath)
  } catch (e) {
    alertError(e, 147, "handleDuplicateCards", "aeft.ts")
  } finally {
    app.endUndoGroup()
  }
}

export const handleGroupCards = () => {
  app.beginUndoGroup("Group Cards")
  try {
    groupCardsToControl()
  } catch (e) {
    alertError(e, 153, "handleGroupCards", "aeft.ts")
  } finally {
    app.endUndoGroup()
  }
}

export const handleClearCardsLevel = () => {
  app.beginUndoGroup("Clear Level")
  try {
    clearCardsLevel()
  } catch (e) {
    alertError(e, 155, "handleClearCardsLevel", "aeft.ts")
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

export const getCompSize = (showAlert = true) => {
  const comp = requireActiveComp("Get Comp Size", showAlert);
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

export const handleAddCard = (
  deckName: string,
  card: number,
  cardName: string,
  filePath: string,
  controlPresetPath?: string
) => {

  importFilesAndCompsForCards(filePath, cardsFolderName)

  app.beginUndoGroup("Add Card to precomp")
  try {
    addCardToPrecomp(deckName, card, cardName, controlPresetPath)
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
  sfxFolderPath?: string,
  controlPresetPath?: string,
  trimCoveredCards?: boolean
) => {
  app.beginUndoGroup("Restore Cards Animation by Layout")
  restoreCardsAnimation(
    presetPath,
    presetMatchName,
    expressionLibPath,
    coinFilePath,
    sfxFolderPath,
    controlPresetPath,
    trimCoveredCards === true
  )
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







