import { useEffect, useMemo, useState } from "react";
import { subscribeBackgroundColor } from "../lib/utils/bolt";
import "./main.scss";

import { CardPickerPanel } from "./components/CardPickerPanel/CardPickerPanel";
import { ActionsPanel } from "./components/ActionsPanel/ActionsPanel";
import { LayoutsPanel } from "./components/LayoutsPanel/LayoutsPanel";

type TabKey = "cards" | "layouts";

export const App = () => {
  const [bgColor, setBgColor] = useState("#282c34");

  const [deck, setDeck] = useState("Club_Deck");
  const [cardNumber, setCardNumber] = useState(1);

  const [tab, setTab] = useState<TabKey>("cards");

  useEffect(() => {
    if (window.cep) subscribeBackgroundColor(setBgColor);
  }, []);

  const tabTitle = useMemo(() => {
    return tab === "cards" ? "Cards & Actions" : "Layouts";
  }, [tab]);

  return (
    <div className="app" style={{ backgroundColor: bgColor }}>
      <header className="app-header">
        <div className="panel">
          {/* Header + Tabs */}
          <div className="panel-tabs-header">
            <h1 className="panel-title">{tabTitle}</h1>

            <div className="panel-tabs" role="tablist" aria-label="Main tabs">
              <button
                type="button"
                className={`panel-tab ${tab === "cards" ? "is-active" : ""}`}
                onClick={() => setTab("cards")}
                role="tab"
                aria-selected={tab === "cards"}
              >
                Cards
              </button>

              <button
                type="button"
                className={`panel-tab ${tab === "layouts" ? "is-active" : ""}`}
                onClick={() => setTab("layouts")}
                role="tab"
                aria-selected={tab === "layouts"}
              >
                Layouts
              </button>
            </div>
          </div>

          {/* Content */}
          {tab === "cards" ? (
            <>
              <CardPickerPanel
                deck={deck}
                setDeck={setDeck}
                cardNumber={cardNumber}
                setCardNumber={setCardNumber}
              />

              <ActionsPanel />
            </>
          ) : (
            <LayoutsPanel baseDirDefault="D:/Downloads/cardsLevels" />
          )}
        </div>
      </header>
    </div>
  );
};
