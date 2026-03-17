import { useState, useEffect } from "react";
import { getFmpApiKey, setFmpApiKey, hasFmpApiKey, getFmpUsage } from "../utils/fmpApi";

export default function SettingsModal({ onClose, onFmpKeyChange }) {
  const [fmpKey, setFmpKey] = useState(getFmpApiKey());
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState(hasFmpApiKey() ? "saved" : "empty"); // empty | saved | error
  const [errorMsg, setErrorMsg] = useState("");
  const usage = getFmpUsage();

  // Mask API key for display
  const maskedKey = fmpKey && fmpKey.length > 8
    ? fmpKey.slice(0, 4) + "••••••••" + fmpKey.slice(-4)
    : fmpKey;

  const handleSaveKey = async (e) => {
    e?.preventDefault();
    const trimmed = fmpKey.trim();
    if (!trimmed) {
      // Clear key
      setFmpApiKey("");
      setStatus("empty");
      onFmpKeyChange?.();
      return;
    }
    setTesting(true);
    setErrorMsg("");
    try {
      const res = await fetch(
        `https://financialmodelingprep.com/api/v3/profile/AAPL?apikey=${trimmed}`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (!res.ok) throw new Error("Clé invalide");
      const data = await res.json();
      if (!data || data.length === 0 || data["Error Message"]) throw new Error("Clé invalide");
      setFmpApiKey(trimmed);
      setStatus("saved");
      onFmpKeyChange?.();
    } catch {
      setErrorMsg("Clé API invalide ou erreur réseau.");
      setStatus("error");
    } finally {
      setTesting(false);
    }
  };

  const handleRemoveKey = () => {
    setFmpApiKey("");
    setFmpKey("");
    setStatus("empty");
    onFmpKeyChange?.();
  };

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <button className="auth-close" onClick={onClose}>✕</button>

        <div style={{ padding: "8px 0 0" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)", marginBottom: 4 }}>
            Paramètres
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 20 }}>
            Configuration de l'application
          </div>

          {/* FMP API Key Section */}
          <div style={{
            background: "var(--bg)", borderRadius: 12, padding: 16,
            border: "1px solid var(--border)", marginBottom: 16,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 20 }}>🔑</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>
                  Financial Modeling Prep (FMP)
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>
                  Données financières enrichies — 20+ ans d'historique
                </div>
              </div>
              {/* Status badge */}
              <div style={{
                marginLeft: "auto",
                padding: "3px 10px",
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 700,
                background: status === "saved" ? "rgba(16,185,129,0.12)" : status === "error" ? "rgba(239,68,68,0.12)" : "rgba(107,114,128,0.12)",
                color: status === "saved" ? "#10b981" : status === "error" ? "#ef4444" : "var(--muted)",
              }}>
                {status === "saved" ? "Active" : status === "error" ? "Erreur" : "Inactive"}
              </div>
            </div>

            {status === "saved" ? (
              <div>
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: "var(--card)", borderRadius: 8, padding: "8px 12px",
                  border: "1px solid var(--border)", marginBottom: 10,
                }}>
                  <span style={{ fontFamily: "monospace", fontSize: 13, color: "var(--text)", flex: 1 }}>
                    {maskedKey}
                  </span>
                  <button
                    onClick={handleRemoveKey}
                    style={{
                      background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "none",
                      borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700,
                      cursor: "pointer", fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    Supprimer
                  </button>
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>
                  Utilisation aujourd'hui : <strong>{usage}</strong> / 250 requêtes
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveKey}>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input
                    className="compare-input"
                    value={fmpKey}
                    onChange={(e) => { setFmpKey(e.target.value); setStatus("empty"); setErrorMsg(""); }}
                    placeholder="Colle ta clé API FMP ici..."
                    style={{ flex: 1, fontSize: 13 }}
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="compare-btn"
                    disabled={testing || !fmpKey.trim()}
                  >
                    {testing ? "Test..." : "Activer"}
                  </button>
                </div>
                {errorMsg && (
                  <div style={{ color: "#ef4444", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                    {errorMsg}
                  </div>
                )}
                <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.6 }}>
                  Inscription gratuite sur{" "}
                  <a
                    href="https://financialmodelingprep.com/developer/docs/"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--accent)", fontWeight: 700 }}
                  >
                    financialmodelingprep.com
                  </a>
                  {" "}— 250 requêtes/jour, 20+ ans de données financières.
                </div>
              </form>
            )}
          </div>

          {/* Info section */}
          <div style={{
            background: "var(--bg)", borderRadius: 12, padding: 16,
            border: "1px solid var(--border)", fontSize: 12, color: "var(--muted)", lineHeight: 1.7,
          }}>
            <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>Sources de données</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div><strong>Yahoo Finance</strong> — Cours, prix, métriques de base (toujours actif)</div>
              <div><strong>FMP</strong> — Historique financier 20+ ans, métriques avancées, segments
                {status === "saved"
                  ? <span style={{ color: "#10b981", fontWeight: 700 }}> (actif)</span>
                  : <span style={{ color: "var(--muted)", fontWeight: 700 }}> (clé requise)</span>
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
