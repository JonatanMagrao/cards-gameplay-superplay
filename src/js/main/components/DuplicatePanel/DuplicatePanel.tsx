import React, { useState, useEffect } from "react";
import { evalTS } from "../../../lib/utils/bolt";
import "./DuplicatePanel.scss";

// --- CAMADA DE SERVIÇO (API) ---
const aeService = {
  getCompSize: async () => {
    const result = await evalTS("getCompSize");
    return typeof result === 'string' ? JSON.parse(result) : result;
  },
  distribute: (x: number, y: number, reverse: boolean) => 
    evalTS("handleDistributeLayers", x, y, reverse),
    
  duplicate: (copies: number, pos: number[]) => 
    evalTS("handleDuplicateCards", copies, pos),
};

export const DuplicatePanel = () => {
  const [numCopies, setNumCopies] = useState("5");
  const [cardDistance, setCardDistance] = useState(["0", "0"]);
  const [isPrecisionMode, setPrecisionMode] = useState(false);
  const [limits, setLimits] = useState({ x: 960, y: 540 });
  const [isReversed, setIsReversed] = useState(false);

  // --- EFEITOS ---
  useEffect(() => {
    let isMounted = true;
    const fetchSize = async () => {
      try {
        const size = await aeService.getCompSize();
        if (isMounted && Array.isArray(size) && size.length >= 2) {
          setLimits({ x: size[0] / 2, y: size[1] / 2 });
        }
      } catch (e) { console.error(e); }
    };
    fetchSize();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Control" || e.key === "Meta") setPrecisionMode(e.type === "keydown");
    };
    window.addEventListener("keydown", handleKey);
    window.addEventListener("keyup", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("keyup", handleKey);
    };
  }, []);

  // --- HANDLERS UI ---
  const handleCopiesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value === "" || /^[0-9]+$/.test(e.target.value)) setNumCopies(e.target.value);
  };

  const handleCoordTextChange = (val: string, index: 0 | 1) => {
    if (/^-?\d*[.,]?\d*$/.test(val)) {
      const newDist = [...cardDistance];
      newDist[index] = val;
      setCardDistance(newDist as [string, string]);
    }
  };

  const handleCoordSliderChange = (e: React.ChangeEvent<HTMLInputElement>, index: 0 | 1) => {
    let val = parseFloat(e.target.value);
    const formattedVal = isPrecisionMode ? val.toFixed(1) : Math.round(val).toString();
    const newDist = [...cardDistance];
    newDist[index] = formattedVal;
    setCardDistance(newDist as [string, string]);
  };

  // --- COMUNICAÇÃO AE ---
  const sendDistributeCommand = async () => {
    const x = Number(cardDistance[0].replace(",", ".") || "0");
    const y = Number(cardDistance[1].replace(",", ".") || "0");
    if (Number.isFinite(x) && Number.isFinite(y)) {
      // Aqui ele pega o estado ATUAL de isReversed
      await aeService.distribute(x, y, isReversed);
    }
  };

  // --- ALTERAÇÃO FEITA AQUI ---
  const toggleReverse = () => {
    // Apenas muda o estado visual/lógico.
    // Não chama mais o aeService.distribute()
    setIsReversed(!isReversed);
  }

  const handleDuplicateSubmit = async (e: React.MouseEvent) => {
    e.preventDefault();
    const copies = parseInt(numCopies || "1", 10);
    const x = Number(cardDistance[0].replace(",", ".") || "0");
    const y = Number(cardDistance[1].replace(",", ".") || "0");
    if (copies > 0 && Number.isFinite(x) && Number.isFinite(y)) {
      await aeService.duplicate(copies, [x, y]);
    }
  };

  const handleInputCommit = (e: React.KeyboardEvent | React.FocusEvent) => {
    if (e.type === 'keydown' && (e as React.KeyboardEvent).key !== 'Enter') return;
    if (e.type === 'keydown') (e.target as HTMLInputElement).blur();
    sendDistributeCommand();
  };

  return (
    <section className="panel-section duplicate-panel">
      <h3 className="section-label">Duplicate Cards</h3>

      <form className="dup-form" onSubmit={(e) => e.preventDefault()}>
        
        <div className="top-row">
          <div className="field-group copies-group">
            <label>Copies</label>
            <input
              type="text"
              inputMode="numeric"
              value={numCopies}
              onChange={handleCopiesChange}
              placeholder="5"
              autoComplete="off"
              tabIndex={-1} 
            />
          </div>

          <button
            type="button"
            className={`btn-icon ${isReversed ? "is-active" : ""}`}
            onClick={toggleReverse}
            title={isReversed ? "Order: Bottom to Top" : "Order: Top to Bottom"}
            tabIndex={-1} 
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
               {isReversed ? (
                 <>
                   <path d="M3 18h4" />
                   <path d="M3 12h9" />
                   <path d="M3 6h15" />
                 </>
               ) : (
                 <>
                   <path d="M3 6h4" />
                   <path d="M3 12h9" />
                   <path d="M3 18h15" />
                 </>
               )}
            </svg>
          </button>
          
          <button 
            type="button" 
            className="btn-duplicate" 
            onClick={handleDuplicateSubmit}
            tabIndex={-1} 
          >
            Duplicate
          </button>
        </div>

        <div className="slider-row">
          <label className="row-label">X</label>
          <input
            className="compact-input"
            type="text"
            value={cardDistance[0]}
            onChange={(e) => handleCoordTextChange(e.target.value, 0)}
            onBlur={handleInputCommit}
            onKeyDown={handleInputCommit}
          />
          <input
            className="range-slider"
            type="range"
            min={-(limits.x || 500)} max={limits.x || 500}
            step={isPrecisionMode ? 0.1 : 1}
            value={Number(cardDistance[0].replace(",", ".") || 0)}
            onChange={(e) => handleCoordSliderChange(e, 0)}
            onMouseUp={sendDistributeCommand}
            tabIndex={-1} 
          />
        </div>

        <div className="slider-row">
          <label className="row-label">Y</label>
          <input
            className="compact-input"
            type="text"
            value={cardDistance[1]}
            onChange={(e) => handleCoordTextChange(e.target.value, 1)}
            onBlur={handleInputCommit}
            onKeyDown={handleInputCommit}
          />
          <input
            className="range-slider"
            type="range"
            min={-(limits.y || 500)} max={limits.y || 500}
            step={isPrecisionMode ? 0.1 : 1}
            value={Number(cardDistance[1].replace(",", ".") || 0)}
            onChange={(e) => handleCoordSliderChange(e, 1)}
            onMouseUp={sendDistributeCommand}
            tabIndex={-1} 
          />
        </div>

      </form>
    </section>
  );
};