import React, { useEffect, useMemo, useState } from "react";

type ErrorLogModalProps = {
  open: boolean;
  title?: string;
  message?: string;
  details?: any; // pode ser Error, object, string
  onClose: () => void;
  onClear?: () => void;
};

function normalizeDetails(details: any) {
  if (!details) return "";

  // Se for Error
  if (details instanceof Error) {
    return details.stack || details.message || String(details);
  }

  // Se já for string
  if (typeof details === "string") return details;

  // Se for objeto/qualquer coisa serializável
  try {
    return JSON.stringify(details, null, 2);
  } catch (e) {
    return String(details);
  }
}

export const ErrorLogModal: React.FC<ErrorLogModalProps> = ({
  open,
  title = "Error",
  message = "Something went wrong.",
  details,
  onClose,
  onClear,
}) => {
  const [showDetails, setShowDetails] = useState(true);

  const prettyDetails = useMemo(() => normalizeDetails(details), [details]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const handleCopy = async () => {
    const content = `[${title}]\n${message}\n\n${prettyDetails}`;
    try {
      await navigator.clipboard.writeText(content);
    } catch (e) {
      // fallback: tenta selecionar via prompt
      window.prompt("Copy error log:", content);
    }
  };

  if (!open) return null;

  return (
    <div style={styles.backdrop} onMouseDown={onClose}>
      <div
        style={styles.modal}
        onMouseDown={(e) => e.stopPropagation()} // evita fechar clicando dentro
      >
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.titleRow}>
            <span style={styles.title}>{title}</span>
            <button style={styles.iconButton} onClick={onClose} title="Close">
              ✕
            </button>
          </div>

          <div style={styles.message}>{message}</div>
        </div>

        {/* Body */}
        <div style={styles.body}>
          <div style={styles.controls}>
            <button
              style={styles.smallButton}
              onClick={() => setShowDetails((v) => !v)}
              title="Toggle details"
            >
              {showDetails ? "Hide details" : "Show details"}
            </button>

            <button
              style={styles.smallButton}
              onClick={handleCopy}
              title="Copy to clipboard"
            >
              Copy
            </button>

            {onClear && (
              <button
                style={styles.smallButtonDanger}
                onClick={onClear}
                title="Clear error"
              >
                Clear
              </button>
            )}
          </div>

          {showDetails && (
            <pre style={styles.pre}>
              {prettyDetails || "No extra details provided."}
            </pre>
          )}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button style={styles.primaryButton} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// styles inline pra não depender do seu SCSS agora (você pode migrar depois)
const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.65)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: "14px",
  },

  modal: {
    width: "min(720px, 100%)",
    maxHeight: "80vh",
    backgroundColor: "#20232a",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 10,
    overflow: "hidden",
    boxShadow: "0 8px 30px rgba(0,0,0,0.55)",
    color: "#eaeaea",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  },

  header: {
    padding: "12px 14px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    backgroundColor: "#2b2f38",
  },

  titleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  title: {
    fontSize: 14,
    fontWeight: 700,
  },

  iconButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#eaeaea",
    cursor: "pointer",
  },

  message: {
    marginTop: 8,
    fontSize: 12,
    opacity: 0.95,
    lineHeight: 1.4,
  },

  body: {
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    overflow: "auto",
    maxHeight: "56vh",
  },

  controls: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },

  smallButton: {
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "#232733",
    color: "#eaeaea",
    cursor: "pointer",
  },

  smallButtonDanger: {
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "#B53838",
    color: "#fff",
    cursor: "pointer",
  },

  pre: {
    margin: 0,
    padding: 12,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.08)",
    backgroundColor: "#181a1f",
    fontSize: 11,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    lineHeight: 1.35,
    fontFamily:
      '"SF Mono", "Menlo", "Monaco", "Consolas", "Courier New", monospace',
  },

  footer: {
    padding: 12,
    borderTop: "1px solid rgba(255,255,255,0.08)",
    backgroundColor: "#2b2f38",
    display: "flex",
    justifyContent: "flex-end",
  },

  primaryButton: {
    fontSize: 12,
    padding: "7px 12px",
    borderRadius: 9,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "#677DE0",
    color: "#fff",
    cursor: "pointer",
  },
};
