import { useState } from "react";
import { getFmpApiKey, setFmpApiKey, hasFmpApiKey, getFmpUsage } from "../utils/fmpApi";

export default function SettingsModal({ onClose, onFmpKeyChange }) {
  const [fmpKey, setFmpKey] = useState(getFmpApiKey());
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState(hasFmpApiKey() ? "saved" : "empty");
  const [errorMsg, setErrorMsg] = useState("");
  const usage = getFmpUsage();

  // AI settings

  const maskedKey = fmpKey && fmpKey.length > 8
    ? fmpKey.slice(0, 4) + "••••••••" + fmpKey.slice(-4)
    : fmpKey;

  const handleSaveKey = async (e) => {
    e?.preventDefault();
    const trimmed = fmpKey.trim();
    if (!trimmed) {
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
    <div className="auth-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Paramètres">
      <div className="auth-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <button className="auth-close" onClick={onClose} aria-label="Fermer">&#10005;</button>

        <div style={{ padding: "8px 0 0" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)", marginBottom: 4 }}>
            Paramètres
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 20 }}>
            Configuration de l'application
          </div>

          {/* Sources de données */}
          <div style={{
            background: "var(--bg)", borderRadius: 12, padding: 16,
            border: "1px solid var(--border)", marginBottom: 16,
          }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", marginBottom: 10 }}>
              Sources de données
            </div>

            {/* Yahoo Finance - always active */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10, marginBottom: 14,
              background: "var(--card)", borderRadius: 10, padding: "10px 14px",
              border: "1px solid var(--border)",
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>Yahoo Finance</div>
                <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.5 }}>
                  Cours, prix, historique 20+ ans, métriques de base
                </div>
              </div>
              <div style={{
                padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                background: "rgba(16,185,129,0.12)", color: "#10b981",
              }}>
                Actif
              </div>
            </div>

            {/* FMP - optional */}
            <div style={{
              background: "var(--card)", borderRadius: 10, padding: "10px 14px",
              border: "1px solid var(--border)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: status === "saved" ? 8 : 0 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>
                    Financial Modeling Prep
                    <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 500, marginLeft: 6 }}>optionnel</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.5 }}>
                    Métriques avancées, segments, ratios supplémentaires
                  </div>
                </div>
                <div style={{
                  padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                  background: status === "saved" ? "rgba(16,185,129,0.12)" : "rgba(107,114,128,0.12)",
                  color: status === "saved" ? "#10b981" : "var(--muted)",
                }}>
                  {status === "saved" ? "Actif" : "Inactif"}
                </div>
              </div>

              {status === "saved" ? (
                <div>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8,
                    background: "var(--bg)", borderRadius: 8, padding: "6px 10px",
                    border: "1px solid var(--border)", marginBottom: 6,
                  }}>
                    <span style={{ fontFamily: "monospace", fontSize: 12, color: "var(--muted)", flex: 1 }}>
                      {maskedKey}
                    </span>
                    <button
                      onClick={handleRemoveKey}
                      style={{
                        background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "none",
                        borderRadius: 6, padding: "3px 8px", fontSize: 10, fontWeight: 700,
                        cursor: "pointer", fontFamily: "'Inter', sans-serif",
                      }}
                    >
                      Supprimer
                    </button>
                  </div>
                  <div style={{ fontSize: 10, color: "var(--muted)" }}>
                    Utilisation : <strong>{usage}</strong> / 250 req/jour
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSaveKey} style={{ marginTop: 8 }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      className="compare-input"
                      value={fmpKey}
                      onChange={(e) => { setFmpKey(e.target.value); setStatus("empty"); setErrorMsg(""); }}
                      placeholder="Clé API FMP (optionnel)..."
                      style={{ flex: 1, fontSize: 12, padding: "7px 12px" }}
                    />
                    <button
                      type="submit"
                      className="compare-btn"
                      disabled={testing || !fmpKey.trim()}
                      style={{ fontSize: 12, padding: "7px 14px" }}
                    >
                      {testing ? "..." : "OK"}
                    </button>
                  </div>
                  {errorMsg && (
                    <div style={{ color: "#ef4444", fontSize: 11, fontWeight: 600, marginTop: 4 }}>
                      {errorMsg}
                    </div>
                  )}
                </form>
              )}
            </div>
          </div>


          <div style={{
            fontSize: 11, color: "var(--muted)", lineHeight: 1.6, textAlign: "center",
            padding: "0 8px",
          }}>
            Les données historiques (20+ ans) sont fournies par Yahoo Finance sans aucune clé API.
            <br />FMP est optionnel et ajoute des métriques supplémentaires.
          </div>
        </div>
      </div>
    </div>
  );
}
