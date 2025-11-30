import { importFilesAndCompsForCards, } from "./cards-utils"
import {
  applyJump,
  setTargetLayer,
  setCardType,
  flipCard,
  turnCards,
  duplicateCards,
  changeCard,
  flipStockCards
} from "./actions";

const cardsFolderName = "Disney Solitaire Cards"

export const handleSetTargetLayer = () => setTargetLayer()

export const handleSetStockLayer = () => setCardType("stock", 2)

export const handleSetTableauLayer = () => setCardType("TABLEAU", 9)

export const handleApplyJump = (presetPath: string) => applyJump(presetPath)

export const handleFlipCards = () => flipCard()

export const handleTurnCards = () => turnCards()

export const handleFlipStockCards = () => flipStockCards()

export const handleDuplicateCards = (numCopies: number, adjustPos: number[]) => duplicateCards(numCopies, adjustPos)

export const handleImportFilesAndComps = (filePath: string) => {
  importFilesAndCompsForCards(filePath, cardsFolderName)
}

export const handleChangeCard = (deckName: string, card: number, cardName: string) => {
  changeCard(deckName, card, cardName)
}

