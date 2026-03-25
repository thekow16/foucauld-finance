import { lazy, Suspense } from "react";
import { fmt } from "../utils/format";
import ScoreCard from "./ScoreCard";
import MetricCards from "./MetricCards";

const KeyMetricsCharts = lazy(() => import("./KeyMetricsCharts"));
const RevenueBreakdown = lazy(() => import("./RevenueBreakdown"));
const CandlestickChart = lazy(() => import("./CandlestickChart"));

const recLabel = {
  strong_buy: "Achat fort",
  buy: "Acheter",
  hold: "Conserver",
  underperform: "Sous-performance",
  sell: "Vendre",
};

const recColor = {
  strong_buy: "#10b981",
  buy: "#34d399",
  hold: "#f59e0b",
  underperform: "#f97316",
  sell: "#ef4444",
};

function ValuationGrid({ data }) {
  const stats = data?.defaultKeyStatistics;
  const summ = data?.summaryDetail;
  const fin = data?.financialData;

  const items = [
    { label: "P/E (TTM)", value: fmt(summ?.trailingPE?.raw, "ratio") },
    { label: "P/E (Forward)", value: fmt(summ?.forwardPE?.raw, "ratio") },
    { label: "PEG Ratio", value: fmt(stats?.pegRatio?.raw, "ratio") },
    { label: "P/B Ratio", value: fmt(stats?.priceToBook?.raw, "ratio") },
    { label: "EV/EBITDA", value: fmt(stats?.enterpriseToEbitda?.raw, "ratio") },
    { label: "EV/CA", value: fmt(stats?.enterpriseToRevenue?.raw, "ratio") },
    { label: "Rend. dividende", value: summ?.dividendYield?.raw != null ? fmt(summ.dividendYield.raw, "percent") : "—" },
    { label: "Taux distribution", value: summ?.payoutRatio?.raw != null ? fmt(summ.payoutRatio.raw, "percent") : "—" },
    { label: "Marge opérationnelle", value: fin?.operatingMargins?.raw != null ? fmt(fin.operatingMargins.raw, "percent") : "—" },
    { label: "Marge nette", value: fin?.profitMargins?.raw != null ? fmt(fin.profitMargins.raw, "percent") : "—" },
    { label: "ROE", value: fin?.returnOnEquity?.raw != null ? fmt(fin.returnOnEquity.raw, "percent") : "—" },
    { label: "ROA", value: fin?.returnOnAssets?.raw != null ? fmt(fin.returnOnAssets.raw, "percent") : "—" },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
        gap: 12,
      }}
    >
      {items.map((it) => (
        <div
          key={it.label}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 14px",
            background: "var(--card)",
            borderRadius: 8,
            border: "1px solid var(--border)",
          }}
        >
          <span style={{ fontSize: 13, color: "var(--muted)" }}>{it.label}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{it.value}</span>
        </div>
      ))}
    </div>
  );
}

function CompanyProfile({ profile }) {
  if (!profile) return null;

  const fields = [
    { label: "Secteur", value: profile.sector },
    { label: "Industrie", value: profile.industry },
    { label: "Pays", value: profile.country },
    { label: "Employés", value: profile.fullTimeEmployees?.toLocaleString("fr-FR") },
    { label: "Site web", value: profile.website, isLink: true },
  ];

  const desc = profile.longBusinessSummary;

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {fields.map(
          (f) =>
            f.value && (
              <span
                key={f.label}
                className="badge"
                style={{
                  display: "inline-flex",
                  gap: 6,
                  alignItems: "center",
                  padding: "5px 12px",
                  borderRadius: 20,
                  fontSize: 13,
                  background: "var(--border)",
                  color: "var(--text)",
                }}
              >
                <span style={{ color: "var(--muted)", fontWeight: 600 }}>{f.label}</span>
                {f.isLink ? (
                  <a
                    href={f.value}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--accent)", textDecoration: "none" }}
                  >
                    {f.value.replace(/^https?:\/\/(www\.)?/, "")}
                  </a>
                ) : (
                  f.value
                )}
              </span>
            )
        )}
      </div>
      {desc && (
        <p
          style={{
            fontSize: 13,
            lineHeight: 1.7,
            color: "var(--muted)",
            margin: 0,
            maxHeight: 120,
            overflow: "hidden",
            WebkitMaskImage: "linear-gradient(180deg, #000 60%, transparent)",
            maskImage: "linear-gradient(180deg, #000 60%, transparent)",
          }}
        >
          {desc}
        </p>
      )}
    </div>
  );
}

function AnalystConsensus({ financialData }) {
  if (!financialData) return null;

  const target = financialData.targetMeanPrice?.raw;
  const targetLow = financialData.targetLowPrice?.raw;
  const targetHigh = financialData.targetHighPrice?.raw;
  const current = financialData.currentPrice?.raw;
  const rec = financialData.recommendationKey;
  const numAnalysts = financialData.numberOfAnalystOpinions?.raw;

  if (!target && !rec) return null;

  const upside = target != null && current != null ? ((target - current) / current) * 100 : null;
  const upsideColor = upside != null ? (upside > 0 ? "#10b981" : "#ef4444") : "var(--text)";

  return (
    <div className="card" style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center" }}>
      {/* Recommendation badge */}
      {rec && (
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              display: "inline-block",
              padding: "8px 20px",
              borderRadius: 24,
              background: recColor[rec] || "var(--accent)",
              color: "#fff",
              fontWeight: 800,
              fontSize: 15,
              letterSpacing: 0.3,
            }}
          >
            {recLabel[rec] || rec}
          </div>
          {numAnalysts != null && (
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
              {numAnalysts} analyste{numAnalysts > 1 ? "s" : ""}
            </div>
          )}
        </div>
      )}

      {/* Price targets */}
      {target != null && (
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 2 }}>Objectif moyen</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)" }}>
                {fmt(target, "ratio")}
              </div>
            </div>
            {upside != null && (
              <div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 2 }}>Potentiel</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: upsideColor }}>
                  {upside > 0 ? "+" : ""}{upside.toFixed(1)} %
                </div>
              </div>
            )}
            {current != null && (
              <div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 2 }}>Cours actuel</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)" }}>
                  {fmt(current, "ratio")}
                </div>
              </div>
            )}
          </div>
          {targetLow != null && targetHigh != null && (
            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  height: 6,
                  borderRadius: 3,
                  background: "var(--border)",
                  position: "relative",
                  overflow: "visible",
                }}
              >
                {/* Range bar */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    height: "100%",
                    borderRadius: 3,
                    background: "linear-gradient(90deg, #ef4444, #f59e0b, #10b981)",
                    opacity: 0.4,
                  }}
                />
                {/* Current price marker */}
                {current != null && current >= targetLow && current <= targetHigh && (
                  <div
                    style={{
                      position: "absolute",
                      left: `${((current - targetLow) / (targetHigh - targetLow)) * 100}%`,
                      top: -4,
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      background: "var(--accent)",
                      border: "2px solid var(--card)",
                      transform: "translateX(-50%)",
                    }}
                  />
                )}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 11,
                  color: "var(--muted)",
                  marginTop: 4,
                }}
              >
                <span>Min {fmt(targetLow, "ratio")}</span>
                <span>Max {fmt(targetHigh, "ratio")}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function OverviewTab({ data, symbol, dark }) {
  const profile = data?.assetProfile;
  const fin = data?.financialData;
  const currency = data?.price?.currency || data?.summaryDetail?.currency || "USD";
  const fallback = <div style={{ textAlign: "center", padding: 20, color: "var(--muted)" }}>Chargement…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* 1. Score de santé */}
      <ScoreCard data={data} />

      {/* 2. Consensus analystes */}
      {fin && (fin.targetMeanPrice?.raw || fin.recommendationKey) && (
        <div>
          <h3 className="section-title" style={{ marginBottom: 10 }}>Consensus analystes</h3>
          <AnalystConsensus financialData={fin} />
        </div>
      )}

      {/* 3. Métriques clés avec sparklines */}
      <MetricCards data={data} />

      {/* 4. Graphiques clés (CA, FCF, ROCE, etc.) */}
      <Suspense fallback={fallback}>
        <KeyMetricsCharts data={data} currency={currency} />
      </Suspense>

      {/* 5. Répartition du CA */}
      <Suspense fallback={fallback}>
        <RevenueBreakdown data={data} symbol={symbol} />
      </Suspense>

      {/* 6. Chandeliers + indicateurs techniques */}
      <Suspense fallback={fallback}>
        <CandlestickChart symbol={symbol} dark={dark} currency={data?.price?.currency} />
      </Suspense>

      {/* 7. Profil de l'entreprise */}
      {profile && (
        <div>
          <h3 className="section-title" style={{ marginBottom: 10 }}>Profil de l'entreprise</h3>
          <CompanyProfile profile={profile} />
        </div>
      )}

      {/* 8. Résumé de valorisation */}
      <div>
        <h3 className="section-title" style={{ marginBottom: 10 }}>Résumé de valorisation</h3>
        <ValuationGrid data={data} />
      </div>
    </div>
  );
}
