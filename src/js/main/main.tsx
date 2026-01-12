import { useEffect, useState } from "react";
import { os, path, fs } from "../lib/cep/node";
import {
  csi,
  evalES,
  openLinkInBrowser,
  subscribeBackgroundColor,
  evalTS,
} from "../lib/utils/bolt";
import "./main.scss";

export const App = () => {
  const [bgColor, setBgColor] = useState("#282c34");
  const [deck, setDeck] = useState("Club_Deck");
  const [cardNumber, setCardNumber] = useState(1);

  const [numCopies, setNumCopies] = useState("5");
  const [cardDistance, setCardDistance] = useState(["0", "0"]);

  const [cardSrc, setCardSrc] = useState<string | null>(null);

  const deckPrefix = deck.split("_")[0]; // Club, Diamond, Heart, Spade

  const cardsMap = {
    1: { name: "2", fileImg: `DS-Cards_2_${deckPrefix}.png` },
    2: { name: "3", fileImg: `DS-Cards_3_${deckPrefix}.png` },
    3: { name: "4", fileImg: `DS-Cards_4_${deckPrefix}.png` },
    4: { name: "5", fileImg: `DS-Cards_5_${deckPrefix}.png` },
    5: { name: "6", fileImg: `DS-Cards_6_${deckPrefix}.png` },
    6: { name: "7", fileImg: `DS-Cards_7_${deckPrefix}.png` },
    7: { name: "8", fileImg: `DS-Cards_8_${deckPrefix}.png` },
    8: { name: "9", fileImg: `DS-Cards_9_${deckPrefix}.png` },
    9: { name: "J", fileImg: `DS-Cards_J_${deckPrefix}.png` },
    10: { name: "Q", fileImg: `DS-Cards_Q_${deckPrefix}.png` },
    11: { name: "K", fileImg: `DS-Cards_K_${deckPrefix}.png` },
    12: { name: "A", fileImg: `DS-Cards_A_${deckPrefix}.png` },
    13: { name: "Wild", fileImg: `wild_card.png` },
  }[cardNumber];

  // se por algum motivo cardNumber sair do range 1–12
  const safeCard = cardsMap ?? { name: "?", fileImg: "" };

  // label bonitinho pro naipe
  const suitLabelMap: Record<string, string> = {
    Club: "Clubs",
    Diamond: "Diamonds",
    Heart: "Hearts",
    Spade: "Spades",
  };

  const suitLabel = suitLabelMap[deckPrefix] ?? deckPrefix;
  const cardTitle = `${safeCard.name} - ${suitLabel}`;
  const assets = `${csi.getSystemPath("extension")}/assets`;
  const cardsDeckPath = `${assets}/cards-deck`

  const cardImage = safeCard.fileImg == "wild_card.png"
    ? `${cardsDeckPath}/${safeCard.fileImg}`
    : `${cardsDeckPath}/${deck}/${safeCard.fileImg}`;

  const presetPath = `${assets}/presets/cards_gameplay_superplay.ffx`
  const cardProject = `${assets}/disney_solitaire_cards.aepx`

  const applyJump = async (presetPath: string) => await evalTS("handleApplyJump", presetPath);
  const flipStockCards = async () => await evalTS("handleFlipStockCards");
  const applyFlipCard = async () => await evalTS("handleFlipCards");
  const turnCards = async () => await evalTS("handleTurnCards");

  const handleSetTargetLayer = async () => await evalTS("handleSetTargetLayer");
  const handleSetStockLayer = async () => await evalTS("handleSetStockLayer");
  const handleSetTableauLayer = async () => await evalTS("handleSetTableauLayer");

  const resetCardsAnimation = async () => await evalTS("resetCardsAnimation");
  const restoreCardsAnimation = async () => await evalTS("restoreCardsAnimation");

  const changeCard = async (deckName: string, card: number) => await evalTS("handleChangeCard", deckName, card, cardTitle);
  const handleImportFilesAndComps = async () => await evalTS("handleImportFilesAndComps", cardProject);
  const duplicateCards = async (numCopies: number, cardDistance: number[]) => await evalTS("handleDuplicateCards", numCopies, cardDistance);

  useEffect(() => {
    if (window.cep) {
      subscribeBackgroundColor(setBgColor);
    }
  }, []);

  useEffect(() => {
    // se não tiver arquivo ou fileImg vazio, limpa preview
    if (!safeCard.fileImg || !fs.existsSync(cardImage)) {
      setCardSrc(null);
      return;
    }

    const buffer = fs.readFileSync(cardImage) as Buffer;

    // converte Buffer (Node) para Uint8Array, que o Blob aceita sem reclamar
    const uint8Array = new Uint8Array(buffer);
    const blob = new Blob([uint8Array], { type: "image/png" });

    const url = URL.createObjectURL(blob);
    setCardSrc(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [cardImage, deck, cardNumber]);

  const handleDuplicateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const copies = parseInt(numCopies, 10);
    const x = Number(cardDistance[0].replace(",", "."));
    const y = Number(cardDistance[1].replace(",", "."));

    if (!Number.isFinite(copies) || copies < 1) return;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    await duplicateCards(copies, [x, y]);
  };



  return (
    <div className="app" style={{ backgroundColor: bgColor }}>
      <header className="app-header">
        <div className="panel">
          {/* título: nome da carta + deck */}
          <h1 className="panel-title">{cardTitle}</h1>

          <section className="panel-section">
            {/* <span className="section-label">Carta</span> */}

            {/* Deck + Valor na mesma linha */}
            <div className="field-row">
              {/* <label className="field-label">Deck</label> */}
              <div className="field-input-group">
                <select
                  value={deck}
                  onChange={(e) => setDeck(e.target.value)}
                  className="field-input"
                >
                  <option value="Club_Deck">Club Cards</option>
                  <option value="Diamond_Deck">Diamond Cards</option>
                  <option value="Spade_Deck">Spade Cards</option>
                  <option value="Heart_Deck">Heart Cards</option>
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
                  <option value="9">J</option>
                  <option value="10">Q</option>
                  <option value="11">K</option>
                  <option value="12">A</option>
                  <option value="13">Wild</option>
                </select>
              </div>
            </div>
          </section>


          <section className="panel-section panel-preview">
            {/* <span className="section-label">Preview</span> */}
            {cardSrc && (
              <div
                className="card-preview"
                onClick={() => changeCard(deck, cardNumber)}
              >
                <img
                  className="card-image"
                  src={cardSrc}
                  alt={cardTitle}
                  title={cardTitle}
                />
                {/* <span className="card-caption">{cardTitle}</span> */}
                <span className="card-hint">Click here to change card</span>
              </div>
            )}
          </section>
          <section className="panel-section">
            {/* <span className="section-label">Animação</span> */}
            <div className="button-row">
              <button onClick={() => applyJump(presetPath)}>Apply Jump</button>
              <button onClick={flipStockCards}>Flip Stock Cards</button>
              <button onClick={applyFlipCard}>Flip Card</button>
              <button onClick={turnCards}>Turn Cards</button>
              {/* <button onClick={teste}>teste</button> */}

              <button onClick={handleSetTargetLayer} style={{backgroundColor:"#B53838"}}>Set Target Layer</button>
              <button onClick={handleSetStockLayer} style={{backgroundColor: "#E4D84C", color: 'black'}}>Set Stock Layers</button>
              <button onClick={handleSetTableauLayer} style={{backgroundColor: "#4AA44C"}}>Set Tableau Layers</button>

              <button onClick={resetCardsAnimation}>Reset</button>
              <button onClick={restoreCardsAnimation}>Restore</button>

              <button onClick={handleImportFilesAndComps}>Import</button>

              <form onSubmit={handleDuplicateSubmit} className="dup-form">
                <div className="dup-grid">
                  <label>
                    Copies
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={numCopies}
                      onChange={(e) => setNumCopies(e.target.value)}
                      placeholder="5"
                    />
                  </label>

                  <label>
                    X Pos
                    <input
                      type="text"
                      inputMode="decimal"
                      pattern="-?[0-9]*[.,]?[0-9]*"
                      value={cardDistance[0]}
                      onChange={(e) => setCardDistance(([_, y]) => [e.target.value, y])}
                      placeholder="0"
                    />
                  </label>

                  <label>
                    Y Pos
                    <input
                      type="text"
                      inputMode="decimal"
                      pattern="-?[0-9]*[.,]?[0-9]*"
                      value={cardDistance[1]}
                      onChange={(e) => setCardDistance(([x, _]) => [x, e.target.value])}
                      placeholder="0"
                    />
                  </label>

                </div>

                <button type="submit">Apply</button>
              </form>

            </div>
          </section>
        </div>
      </header >
    </div >
  );
};
