import React, { useEffect, useMemo, useState } from "react";
import { csi, evalTS } from "../../../lib/utils/bolt";
import { fs } from "../../../lib/cep/node";

type Props = {
  deck: string;
  setDeck: (v: string) => void;
  cardNumber: number;
  setCardNumber: (v: number) => void;
  cardProject: string;
};

export const CardPickerPanel: React.FC<Props> = ({ deck, setDeck, cardNumber, setCardNumber, cardProject }) => {
  const [cardSrc, setCardSrc] = useState<string | null>(null);

  const deckPrefix = useMemo(() => deck.split("_")[0], [deck]);
  const turnCards = async () => await evalTS("handleTurnCards");

  const cardsMap = useMemo(() => {
    return {
      1: { name: "2", fileImg: `DS-Cards_2_${deckPrefix}.png` },
      2: { name: "3", fileImg: `DS-Cards_3_${deckPrefix}.png` },
      3: { name: "4", fileImg: `DS-Cards_4_${deckPrefix}.png` },
      4: { name: "5", fileImg: `DS-Cards_5_${deckPrefix}.png` },
      5: { name: "6", fileImg: `DS-Cards_6_${deckPrefix}.png` },
      6: { name: "7", fileImg: `DS-Cards_7_${deckPrefix}.png` },
      7: { name: "8", fileImg: `DS-Cards_8_${deckPrefix}.png` },
      8: { name: "9", fileImg: `DS-Cards_9_${deckPrefix}.png` },
      9: { name: "10", fileImg: `DS-Cards_10_${deckPrefix}.png` },
      10: { name: "J", fileImg: `DS-Cards_J_${deckPrefix}.png` },
      11: { name: "Q", fileImg: `DS-Cards_Q_${deckPrefix}.png` },
      12: { name: "K", fileImg: `DS-Cards_K_${deckPrefix}.png` },
      13: { name: "A", fileImg: `DS-Cards_A_${deckPrefix}.png` },
      14: { name: "Wild", fileImg: `wild_card.png` },
      15: { name: "Plus", fileImg: `plus_card.png` },
    } as Record<number, { name: string; fileImg: string }>;
  }, [deckPrefix]);

  const safeCard = cardsMap[cardNumber] ?? { name: "?", fileImg: "" };

  const suitLabelMap: Record<string, string> = {
    Club: "Clubs",
    Diamond: "Diamonds",
    Heart: "Hearts",
    Spade: "Spades",
  };

  const suitLabel = suitLabelMap[deckPrefix] ?? deckPrefix;

  // Determina se é uma carta que não pertence a um naipe específico
  const isSpecialCard = safeCard.fileImg === "wild_card.png" || safeCard.fileImg === "plus_card.png";

  // Ajusta o título: Se for especial, mostra apenas o nome (ex: "Wild"). Se não, mostra "A - Hearts"
  const cardTitle = isSpecialCard ? safeCard.name : `${safeCard.name} - ${suitLabel}`;

  const assets = `${csi.getSystemPath("extension")}/assets`;
  const cardsDeckPath = `${assets}/cards-deck`;

  // Define o caminho: Cartas especiais ficam na raiz de /cards-deck/, as outras dentro da pasta do Deck
  const cardImage = isSpecialCard
    ? `${cardsDeckPath}/${safeCard.fileImg}`
    : `${cardsDeckPath}/${deck}/${safeCard.fileImg}`;

  const changeCard = async () =>
    await evalTS("handleChangeCard", deck, cardNumber, cardTitle);

  const handleAddCard = async () => {
    await evalTS("handleAddCard", deck, cardNumber, cardTitle, cardProject);
  };

  const handlePreviewClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      handleAddCard();
    } else {
      changeCard();
    }
  };

  useEffect(() => {
    if (!safeCard.fileImg || !fs.existsSync(cardImage)) {
      setCardSrc(null);
      return;
    }

    try {
      const buffer = fs.readFileSync(cardImage) as Buffer;
      const uint8Array = new Uint8Array(buffer);
      const blob = new Blob([uint8Array], { type: "image/png" });
      const url = URL.createObjectURL(blob);
      setCardSrc(url);

      return () => URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Erro ao ler arquivo de imagem:", err);
      setCardSrc(null);
    }
  }, [cardImage, safeCard.fileImg]);

  return (
    <section className="panel-section">
      <h1 className="panel-title">{cardTitle}</h1>

      <div className="field-row">
        <div className="field-input-group">
          {/* O seletor de Deck pode ser desabilitado visualmente para cartas especiais se desejar */}
          <select
            value={deck}
            onChange={(e) => setDeck(e.target.value)}
            className="field-input"
            disabled={isSpecialCard} 
            style={{ opacity: isSpecialCard ? 0.5 : 1 }}
          >
            <option value="Club_Deck">♣️ Club Cards</option>
            <option value="Diamond_Deck">♦️ Diamond Cards</option>
            <option value="Spade_Deck">♠️ Spade Cards</option>
            <option value="Heart_Deck">♥️ Heart Cards</option>
          </select>

          <select
            value={cardNumber}
            onChange={(e) => setCardNumber(Number(e.target.value))}
            className="field-input field-input--compact"
          >
            <option value="1">2</option>
            <option value="2">3</option>
            <option value="3">4</option>
            <option value="4">5</option>
            <option value="5">6</option>
            <option value="6">7</option>
            <option value="7">8</option>
            <option value="8">9</option>
            <option value="9">10</option>
            <option value="10">J</option>
            <option value="11">Q</option>
            <option value="12">K</option>
            <option value="13">A</option>
            <option value="14">Wild</option>
            <option value="15">Plus</option>
          </select>
          <button onClick={turnCards} title="Turn Cards">
            Turn
          </button>
        </div>
      </div>

      <section className="panel-section panel-preview">
        {cardSrc && (
          <div
            className="card-preview"
            onClick={handlePreviewClick}
            style={{ cursor: "pointer" }}
            title="Click to Change | Ctrl + Click to Add"
          >
            <img className="card-image" src={cardSrc} alt={cardTitle} />
            <span className="card-hint">
              Click to change / Ctrl+Click to add
            </span>
          </div>
        )}
      </section>
    </section>
  );
};