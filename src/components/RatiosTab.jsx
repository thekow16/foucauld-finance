import { fmt } from "../utils/format";

export default function RatiosTab({ data }) {
  const stats = data?.defaultKeyStatistics;
  const fin = data?.financialData;
  const summ = data?.summaryDetail;
  const pr = data?.price;

  const sections = [
    {
      cat: "Valorisation", rows: [
        ["P/E (trailing)", fmt(stats?.trailingPE?.raw, "ratio"), "Moins c'est bas, moins cher"],
        ["P/E Forward", fmt(stats?.forwardPE?.raw, "ratio"), "Basé sur les prévisions"],
        ["PEG Ratio", fmt(stats?.pegRatio?.raw, "ratio"), "P/E / Croissance"],
        ["Prix / Ventes", fmt(stats?.priceToSalesTrailing12Months?.raw, "ratio"), ""],
        ["Prix / Valeur comptable", fmt(stats?.priceToBook?.raw, "ratio"), "< 1 = sous-évalué"],
        ["EV / EBITDA", fmt(stats?.enterpriseToEbitda?.raw, "ratio"), "< 10 = bon"],
        ["EV / CA", fmt(stats?.enterpriseToRevenue?.raw, "ratio"), ""],
        ["Valeur d'entreprise", fmt(stats?.enterpriseValue?.raw, "currency"), ""],
      ]
    },
    {
      cat: "Rentabilité", rows: [
        ["Marge brute", fmt(fin?.grossMargins?.raw, "percent"), "> 40% = excellent"],
        ["Marge opérationnelle", fmt(fin?.operatingMargins?.raw, "percent"), "> 20% = bon"],
        ["Marge EBITDA", fmt(fin?.ebitdaMargins?.raw, "percent"), ""],
        ["Marge nette", fmt(fin?.profitMargins?.raw, "percent"), "> 10% = sain"],
        ["ROE", fmt(fin?.returnOnEquity?.raw, "percent"), "> 15% = bon"],
        ["ROA", fmt(fin?.returnOnAssets?.raw, "percent"), "> 5% = bon"],
        ["EBITDA", fmt(fin?.ebitda?.raw, "currency"), ""],
        ["Bénéfice brut", fmt(fin?.grossProfits?.raw, "currency"), ""],
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
        ["Free Cash Flow", fmt(fin?.freeCashflow?.raw, "currency"), ""],
        ["Flux opérationnel", fmt(fin?.operatingCashflow?.raw, "currency"), ""],
      ]
    },
    {
      cat: "Croissance & Dividende", rows: [
        ["Croissance CA", fmt(fin?.revenueGrowth?.raw, "percent"), ""],
        ["Croissance bénéfices", fmt(fin?.earningsGrowth?.raw, "percent"), ""],
        ["Croissance CA trim.", fmt(fin?.earningsQuarterlyGrowth?.raw, "percent"), "Trimestriel"],
        ["BPA (EPS)", fmt(stats?.trailingEps?.raw, "ratio"), "Bénéfice par action"],
        ["BPA Forward", fmt(stats?.forwardEps?.raw, "ratio"), "Prévision"],
        ["Dividende / action", summ?.dividendRate?.raw != null ? `${summ.dividendRate.raw.toFixed(2)} ${pr?.currency}` : "—", ""],
        ["Rendement dividende", fmt(summ?.dividendYield?.raw, "percent"), ""],
        ["Payout Ratio", fmt(summ?.payoutRatio?.raw, "percent"), "< 60% = durable"],
      ]
    },
    {
      cat: "Données de marché", rows: [
        ["Capitalisation", fmt(pr?.marketCap?.raw, "currency"), ""],
        ["Volume moyen (10j)", fmt(summ?.averageDailyVolume10Day?.raw, "currency"), ""],
        ["Volume moyen (3m)", fmt(summ?.averageVolume?.raw, "currency"), ""],
        ["52S Haut", summ?.fiftyTwoWeekHigh?.raw ? summ.fiftyTwoWeekHigh.raw.toFixed(2) : "—", ""],
        ["52S Bas", summ?.fiftyTwoWeekLow?.raw ? summ.fiftyTwoWeekLow.raw.toFixed(2) : "—", ""],
        ["Moy. mobile 50j", summ?.fiftyDayAverage?.raw ? summ.fiftyDayAverage.raw.toFixed(2) : "—", ""],
        ["Moy. mobile 200j", summ?.twoHundredDayAverage?.raw ? summ.twoHundredDayAverage.raw.toFixed(2) : "—", ""],
        ["Short % du flottant", stats?.shortPercentOfFloat?.raw ? fmt(stats.shortPercentOfFloat.raw, "percent") : "—", "> 10% = beaucoup"],
      ]
    },
    {
      cat: "Structure du capital", rows: [
        ["Actions en circulation", fmt(stats?.sharesOutstanding?.raw, "currency"), ""],
        ["Flottant", fmt(stats?.floatShares?.raw, "currency"), ""],
        ["% détenus par insiders", stats?.heldPercentInsiders?.raw ? fmt(stats.heldPercentInsiders.raw, "percent") : "—", ""],
        ["% détenus par instit.", stats?.heldPercentInstitutions?.raw ? fmt(stats.heldPercentInstitutions.raw, "percent") : "—", ""],
        ["Rachat d'actions net", fmt(stats?.netSharePurchaseActivity?.raw ?? stats?.sharesShortPriorMonth?.raw, "currency"), ""],
        ["Short ratio", stats?.shortRatio?.raw ? stats.shortRatio.raw.toFixed(2) : "—", "Jours pour couvrir"],
        ["Nb short", fmt(stats?.sharesShort?.raw, "currency"), ""],
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
