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
        ["Prix / Valeur comptable", fmt(stats?.priceToBook?.raw, "ratio"), ""],
        ["EV / EBITDA", fmt(stats?.enterpriseToEbitda?.raw, "ratio"), ""],
        ["EV / CA", fmt(stats?.enterpriseToRevenue?.raw, "ratio"), ""],
      ]
    },
    {
      cat: "Rentabilité", rows: [
        ["Marge brute", fmt(fin?.grossMargins?.raw, "percent"), ""],
        ["Marge opérationnelle", fmt(fin?.operatingMargins?.raw, "percent"), ""],
        ["Marge nette", fmt(fin?.profitMargins?.raw, "percent"), ""],
        ["ROE", fmt(fin?.returnOnEquity?.raw, "percent"), "Rendement capitaux propres"],
        ["ROA", fmt(fin?.returnOnAssets?.raw, "percent"), "Rendement des actifs"],
      ]
    },
    {
      cat: "Solidité financière", rows: [
        ["Dette / Capitaux propres", fin?.debtToEquity?.raw != null ? `${fin.debtToEquity.raw.toFixed(1)} %` : "—", ""],
        ["Ratio de liquidité", fmt(fin?.currentRatio?.raw, "ratio"), "> 1.5 = sain"],
        ["Quick Ratio", fmt(fin?.quickRatio?.raw, "ratio"), ""],
        ["Trésorerie totale", fmt(fin?.totalCash?.raw, "currency"), ""],
        ["Dette totale", fmt(fin?.totalDebt?.raw, "currency"), ""],
        ["Tréso par action", fmt(fin?.totalCashPerShare?.raw, "ratio"), ""],
      ]
    },
    {
      cat: "Croissance & Dividende", rows: [
        ["Croissance CA", fmt(fin?.revenueGrowth?.raw, "percent"), ""],
        ["Croissance bénéfices", fmt(fin?.earningsGrowth?.raw, "percent"), ""],
        ["BPA (EPS)", fmt(stats?.trailingEps?.raw, "ratio"), "Bénéfice par action"],
        ["Dividende / action", summ?.dividendRate?.raw != null ? `${summ.dividendRate.raw.toFixed(2)} ${pr?.currency}` : "—", ""],
        ["Rendement dividende", fmt(summ?.dividendYield?.raw, "percent"), ""],
        ["Payout Ratio", fmt(summ?.payoutRatio?.raw, "percent"), ""],
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
