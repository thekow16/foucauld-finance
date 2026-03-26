import { useState, useRef, useCallback } from "react";
import { callAiAnalysis, canAnalyze, consumeQuota, getQuotaInfo, hasAiApiKey } from "../utils/aiAnalysis";

export default function AIAnalysis({ data, symbol, onShowSettings }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const handleAnalyze = useCallback(async () => {
    if (!canAnalyze()) {
      setError("Limite atteinte : 3 analyses gratuites/mois. Ajoutez votre clé API dans les paramètres pour un accès illimité.");
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysis(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      consumeQuota();
      const result = await callAiAnalysis(data, symbol, { signal: controller.signal });
      setAnalysis(result);
    } catch (e) {
      if (e.name !== "AbortError") {
        setError("Erreur lors de l'analyse. Réessayez.");
        console.error("[FF-AI]", e);
      }
    } finally {
      setLoading(false);
    }
  }, [data, symbol]);

  const quota = getQuotaInfo();
  const hasKey = hasAiApiKey();

  return (
    <div className="card ai-analysis-card">
      <div className="ai-analysis-header">
        <div className="ai-analysis-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a4 4 0 0 1 4 4v1a1 1 0 0 0 1 1h1a4 4 0 0 1 0 8h-1a1 1 0 0 0-1 1v1a4 4 0 0 1-8 0v-1a1 1 0 0 0-1-1H6a4 4 0 0 1 0-8h1a1 1 0 0 0 1-1V6a4 4 0 0 1 4-4z" />
            <circle cx="12" cy="12" r="2" />
          </svg>
          <span>Analyse IA</span>
        </div>
        <div className="ai-analysis-meta">
          {!hasKey && (
            <span className="ai-quota-badge" title="Analyses gratuites restantes ce mois">
              {quota.remaining}/{quota.limit} gratuites
            </span>
          )}
          {hasKey && (
            <span className="ai-quota-badge ai-quota-pro" title="Clé API configurée — analyses illimitées">
              Illimité
            </span>
          )}
        </div>
      </div>

      {!analysis && !loading && !error && (
        <div className="ai-analysis-cta">
          <p className="ai-analysis-desc">
            Obtenez une analyse financière complète : rentabilité, valorisation, risques et conclusion.
          </p>
          <button
            className="ff-btn ai-analyze-btn"
            onClick={handleAnalyze}
            disabled={!canAnalyze()}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            Analyser avec l'IA
          </button>
          {!hasKey && (
            <button className="ai-settings-link" onClick={onShowSettings}>
              Ajouter une clé API pour un accès illimité
            </button>
          )}
        </div>
      )}

      {loading && (
        <div className="ai-analysis-loading">
          <div className="ai-spinner" />
          <span>Analyse en cours{hasKey ? "" : " (mode gratuit)"}...</span>
        </div>
      )}

      {error && (
        <div className="ai-analysis-error">
          <p>{error}</p>
          {error.includes("clé API") && (
            <button className="ai-settings-link" onClick={onShowSettings} style={{ marginTop: 8 }}>
              Configurer la clé API
            </button>
          )}
          <button className="ff-btn" onClick={handleAnalyze} style={{ marginTop: 10, fontSize: 12, padding: "6px 16px" }}>
            Réessayer
          </button>
        </div>
      )}

      {analysis && (
        <div className="ai-analysis-result">
          <div className="ai-analysis-text">{analysis.text}</div>
          <div className="ai-analysis-footer">
            <span className="ai-source-badge">
              {analysis.source === "algo" ? "Analyse algorithmique" :
               analysis.source === "openai" ? "GPT-4o mini" :
               analysis.source === "anthropic" ? "Claude Haiku" : analysis.source}
            </span>
            {analysis.error && (
              <span className="ai-fallback-notice" title={analysis.error}>
                (fallback — API indisponible)
              </span>
            )}
            <button className="ai-redo-btn" onClick={handleAnalyze} title="Relancer l'analyse">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
