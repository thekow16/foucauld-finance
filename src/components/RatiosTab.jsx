import { fmt } from "../utils/format";

export default function RatiosTab({ data }) {
  const stats = data?.defaultKeyStatistics;
  const fin = data?.financialData;
  const summ = data?.summaryDetail;
  const pr = data?.price;

  // Computed helpers
  const currentPrice = pr?.regularMarketPrice?.raw;
  const eps = stats?.trailingEps?.raw;
  const forwardEps = stats?.forwardEps?.raw;
  const marketCap = pr?.marketCap?.raw;
  const ev = stats?.enterpriseValue?.raw;
  const fcf = fin?.freeCashflow?.raw;
  const ocf = fin?.operatingCashflow?.raw;
  const revenue = fin?.totalRevenue?.raw;
  const netDebt = fin?.totalDebt?.raw && fin?.totalCash?.raw ? fin.totalDebt.raw - fin.totalCash.raw : null;

  const fmtRatio = (v) => v != null && !isNaN(v) ? v.toFixed(2) : "—";
  const fmtPct = (v) => v != null && !isNaN(v) ? `${(v * 100).toFixed(1)} %` : "—";

  const sections = [
    {
      cat: "Valorisation", rows: [
        ["P/E (trailing)", fmt(stats?.trailingPE?.raw, "ratio"), "Moins c'est bas, moins cher"],
        ["P/E Forward", fmt(stats?.forwardPE?.raw, "ratio"), "Basé sur les prévisions"],
        ["PEG Ratio", fmt(stats?.pegRatio?.raw, "ratio"), "P/E / Croissance"],
        ["Prix / Ventes", fmt(stats?.priceToSalesTrailing12Months?.raw, "ratio"), ""],
        ["Prix / Valeur comptable", fmt(stats?.priceToBook?.raw, "ratio"), "< 1 = sous-évalué"],
        ["Prix / FCF", fcf && marketCap ? fmtRatio(marketCap / fcf) : "—", "< 15 = bon"],
        ["Prix / Flux op.", ocf && marketCap ? fmtRatio(marketCap / ocf) : "—", ""],
        ["EV / EBITDA", fmt(stats?.enterpriseToEbitda?.raw, "ratio"), "< 10 = bon"],
        ["EV / CA", fmt(stats?.enterpriseToRevenue?.raw, "ratio"), ""],
        ["EV / FCF", fcf && ev ? fmtRatio(ev / fcf) : "—", ""],
        ["Valeur d'entreprise", fmt(ev, "currency"), ""],
        ["Rendement bénéficiaire", eps && currentPrice ? fmtPct(eps / currentPrice) : "—", "Inverse du P/E"],
        ["Rendement FCF", fcf && marketCap ? fmtPct(fcf / marketCap) : "—", "> 5% = bon"],
      ]
    },
    {
      cat: "Rentabilité", rows: [
        ["Marge brute", fmt(fin?.grossMargins?.raw, "percent"), "> 40% = excellent"],
        ["Marge opérationnelle", fmt(fin?.operatingMargins?.raw, "percent"), "> 20% = bon"],
        ["Marge EBITDA", fmt(fin?.ebitdaMargins?.raw, "percent"), ""],
        ["Marge nette", fmt(fin?.profitMargins?.raw, "percent"), "> 10% = sain"],
        ["Marge FCF", fcf && revenue ? fmtPct(fcf / revenue) : "—", "> 10% = bon"],
        ["ROE", fmt(fin?.returnOnEquity?.raw, "percent"), "> 15% = bon"],
        ["ROA", fmt(fin?.returnOnAssets?.raw, "percent"), "> 5% = bon"],
        ["EBITDA", fmt(fin?.ebitda?.raw, "currency"), ""],
        ["Bénéfice brut", fmt(fin?.grossProfits?.raw, "currency"), ""],
        ["Résultat opérationnel", fmt(fin?.operatingIncome?.raw ?? fin?.ebitda?.raw, "currency"), ""],
        ["Chiffre d'affaires", fmt(revenue, "currency"), ""],
      ]
    },
    {
      cat: "Solidité financière", rows: [
        ["Dette / Capitaux propres", fin?.debtToEquity?.raw != null ? `${fin.debtToEquity.raw.toFixed(1)} %` : "—", "< 100% = sain"],
        ["Ratio de liquidité", fmt(fin?.currentRatio?.raw, "ratio"), "> 1.5 = sain"],
        ["Quick Ratio", fmt(fin?.quickRatio?.raw, "ratio"), "> 1 = bon"],
        ["Trésorerie totale", fmt(fin?.totalCash?.raw, "currency"), ""],
        ["Tréso par action", fmt(fin?.totalCashPerShare?.raw, "ratio"), ""],
        ["Dette totale", fmt(fin?.totalDebt?.raw, "currency"), ""],
        ["Dette nette", netDebt != null ? fmt(netDebt, "currency") : "—", "< 0 = tréso nette"],
        ["Dette nette / EBITDA", netDebt != null && fin?.ebitda?.raw ? fmtRatio(netDebt / fin.ebitda.raw) : "—", "< 2 = sain"],
        ["Free Cash Flow", fmt(fcf, "currency"), ""],
        ["Flux opérationnel", fmt(ocf, "currency"), ""],
        ["FCF / Dette", fcf && fin?.totalDebt?.raw ? fmtPct(fcf / fin.totalDebt.raw) : "—", "Capacité de remboursement"],
        ["Couv. intérêts", fin?.ebitda?.raw && fin?.totalDebt?.raw ? fmtRatio(fin.ebitda.raw / (fin.totalDebt.raw * 0.05)) : "—", "Estimé sur 5% de taux"],
      ]
    },
    {
      cat: "Croissance & Dividende", rows: [
        ["Croissance CA", fmt(fin?.revenueGrowth?.raw, "percent"), ""],
        ["Croissance bénéfices", fmt(fin?.earningsGrowth?.raw, "percent"), ""],
        ["Croissance CA trim.", fmt(fin?.earningsQuarterlyGrowth?.raw, "percent"), "Trimestriel"],
        ["BPA (EPS)", fmt(eps, "ratio"), "Bénéfice par action"],
        ["BPA Forward", fmt(forwardEps, "ratio"), "Prévision"],
        ["Croissance BPA impl.", eps && forwardEps ? fmtPct((forwardEps - eps) / Math.abs(eps)) : "—", "Forward vs Trailing"],
        ["Dividende / action", summ?.dividendRate?.raw != null ? `${summ.dividendRate.raw.toFixed(2)} ${pr?.currency}` : "—", ""],
        ["Rendement dividende", fmt(summ?.dividendYield?.raw, "percent"), ""],
        ["Payout Ratio", fmt(summ?.payoutRatio?.raw, "percent"), "< 60% = durable"],
        ["Date ex-dividende", summ?.exDividendDate?.fmt || "—", ""],
        ["FCF / action", fcf && stats?.sharesOutstanding?.raw ? fmtRatio(fcf / stats.sharesOutstanding.raw) : "—", ""],
      ]
    },
    {
      cat: "Données de marché", rows: [
        ["Capitalisation", fmt(marketCap, "currency"), ""],
        ["Cours actuel", currentPrice ? `${currentPrice.toFixed(2)} ${pr?.currency}` : "—", ""],
        ["Volume moyen (10j)", fmt(summ?.averageDailyVolume10Day?.raw, "currency"), ""],
        ["Volume moyen (3m)", fmt(summ?.averageVolume?.raw, "currency"), ""],
        ["52S Haut", summ?.fiftyTwoWeekHigh?.raw ? summ.fiftyTwoWeekHigh.raw.toFixed(2) : "—", ""],
        ["52S Bas", summ?.fiftyTwoWeekLow?.raw ? summ.fiftyTwoWeekLow.raw.toFixed(2) : "—", ""],
        ["% vs 52S Haut", summ?.fiftyTwoWeekHigh?.raw && currentPrice ? fmtPct((currentPrice - summ.fiftyTwoWeekHigh.raw) / summ.fiftyTwoWeekHigh.raw) : "—", ""],
        ["% vs 52S Bas", summ?.fiftyTwoWeekLow?.raw && currentPrice ? fmtPct((currentPrice - summ.fiftyTwoWeekLow.raw) / summ.fiftyTwoWeekLow.raw) : "—", ""],
        ["Moy. mobile 50j", summ?.fiftyDayAverage?.raw ? summ.fiftyDayAverage.raw.toFixed(2) : "—", ""],
        ["Moy. mobile 200j", summ?.twoHundredDayAverage?.raw ? summ.twoHundredDayAverage.raw.toFixed(2) : "—", ""],
        ["% vs MM50", summ?.fiftyDayAverage?.raw && currentPrice ? fmtPct((currentPrice - summ.fiftyDayAverage.raw) / summ.fiftyDayAverage.raw) : "—", ""],
        ["% vs MM200", summ?.twoHundredDayAverage?.raw && currentPrice ? fmtPct((currentPrice - summ.twoHundredDayAverage.raw) / summ.twoHundredDayAverage.raw) : "—", ""],
        ["Short % du flottant", stats?.shortPercentOfFloat?.raw ? fmt(stats.shortPercentOfFloat.raw, "percent") : "—", "> 10% = beaucoup"],
      ]
    },
    {
      cat: "Structure du capital", rows: [
        ["Actions en circulation", fmt(stats?.sharesOutstanding?.raw, "currency"), ""],
        ["Flottant", fmt(stats?.floatShares?.raw, "currency"), ""],
        ["% flottant", stats?.floatShares?.raw && stats?.sharesOutstanding?.raw ? fmtPct(stats.floatShares.raw / stats.sharesOutstanding.raw) : "—", ""],
        ["% détenus par insiders", stats?.heldPercentInsiders?.raw ? fmt(stats.heldPercentInsiders.raw, "percent") : "—", ""],
        ["% détenus par instit.", stats?.heldPercentInstitutions?.raw ? fmt(stats.heldPercentInstitutions.raw, "percent") : "—", ""],
        ["Rachat d'actions net", fmt(stats?.netSharePurchaseActivity?.raw ?? stats?.sharesShortPriorMonth?.raw, "currency"), ""],
        ["Short ratio", stats?.shortRatio?.raw ? stats.shortRatio.raw.toFixed(2) : "—", "Jours pour couvrir"],
        ["Nb short", fmt(stats?.sharesShort?.raw, "currency"), ""],
        ["Short mois précédent", fmt(stats?.sharesShortPriorMonth?.raw, "currency"), ""],
        ["Beta", fmt(stats?.beta?.raw, "ratio"), "< 1 = défensif"],
      ]
    },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))", gap: "0 32px" }}>
      {sections.map(sec => (
        <div key={sec.cat}>
          <div className="ratio-cat">{sec.cat}</div>
          {sec.rows.map(([label, value, hint]) => (
            <div key={label} className="ratio-row">
              <div>
                <div className="ratio-label">{label}</div>
                {hint && <div className="ratio-hint">{hint}</div>}
              </div>
              <div className={`ratio-value ${value === "—" ? "muted" : ""}`}>{value}</div>
            </div>
          ))}
          <div style={{ height: 20 }} />
        </div>
      ))}
    </div>
  );
}
