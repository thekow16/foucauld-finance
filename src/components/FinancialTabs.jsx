import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend
} from "recharts";
import { fmt } from "../utils/format";

function FinancialTable({ headers, rows, data }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="ff-table">
        <thead>
          <tr>
            <th>Poste</th>
            {headers.map((h, i) => <th key={i}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, key, hl]) => (
            <tr key={key}>
              <td style={{ fontWeight: hl ? 700 : 600, color: hl ? "var(--text)" : "var(--text-secondary)", background: hl ? "var(--highlight-row)" : "transparent" }}>{label}</td>
              {data.map((s, i) => {
                const v = s[key]?.raw;
                return (
                  <td key={i} style={{
                    color: v == null ? "var(--muted)" : v < 0 ? "#dc2626" : "var(--text)",
                    background: hl ? "var(--highlight-row)" : "transparent",
                    fontWeight: hl ? 800 : 600
                  }}>
                    {fmt(v, "currency")}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BilanTab({ data }) {
  const pr = data?.price;
  const bsArr = data?.balanceSheetHistory?.balanceSheetStatements || [];

  const bsChart = [...bsArr].reverse().map(s => ({
    year: String(new Date((s.endDate?.raw || 0) * 1000).getFullYear()),
    Actifs: s.totalAssets?.raw ? +(s.totalAssets.raw / 1e9).toFixed(1) : 0,
    Dettes: s.totalLiab?.raw ? +(s.totalLiab.raw / 1e9).toFixed(1) : 0,
    Capitaux: s.totalStockholderEquity?.raw ? +(s.totalStockholderEquity.raw / 1e9).toFixed(1) : 0,
  }));

  const rows = [
    ["Total Actifs", "totalAssets", true],
    ["Actifs courants", "totalCurrentAssets", false],
    ["Trésorerie & équivalents", "cash", false],
    ["Créances clients", "netReceivables", false],
    ["Stocks", "inventory", false],
    ["Total Passifs", "totalLiab", true],
    ["Passifs courants", "totalCurrentLiabilities", false],
    ["Dette long terme", "longTermDebt", false],
    ["Capitaux propres", "totalStockholderEquity", true],
  ];

  return (
    <div>
      {bsChart.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="chart-label">EN MILLIARDS ({pr?.currency})</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={bsChart} margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="year" tick={{ fontSize: 12, fill: "var(--muted)" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "#1e293b", border: "none", borderRadius: 12, color: "white", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Actifs" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Dettes" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Capitaux" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <FinancialTable
        headers={bsArr.map(s => new Date((s.endDate?.raw || 0) * 1000).getFullYear())}
        rows={rows}
        data={bsArr}
      />
    </div>
  );
}

export function ResultatsTab({ data }) {
  const isArr = data?.incomeStatementHistory?.incomeStatementHistory || [];

  const rows = [
    ["Chiffre d'affaires", "totalRevenue", true],
    ["Bénéfice brut", "grossProfit", false],
    ["Charges opérationnelles", "totalOperatingExpenses", false],
    ["Résultat opérationnel", "operatingIncome", true],
    ["EBIT", "ebit", false],
    ["Charges d'intérêts", "interestExpense", false],
    ["Impôts", "incomeTaxExpense", false],
    ["Résultat net", "netIncome", true],
  ];

  const isChart = [...isArr].reverse().map(s => ({
    year: String(new Date((s.endDate?.raw || 0) * 1000).getFullYear()),
    CA: s.totalRevenue?.raw ? +(s.totalRevenue.raw / 1e9).toFixed(1) : 0,
    "Rés. Net": s.netIncome?.raw ? +(s.netIncome.raw / 1e9).toFixed(1) : 0,
    "Rés. Op.": s.operatingIncome?.raw ? +(s.operatingIncome.raw / 1e9).toFixed(1) : 0,
  }));

  return (
    <div>
      {isChart.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="chart-label">EN MILLIARDS ({data?.price?.currency})</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={isChart} margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="year" tick={{ fontSize: 12, fill: "var(--muted)" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "#1e293b", border: "none", borderRadius: 12, color: "white", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="CA" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Rés. Op." fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Rés. Net" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <FinancialTable
        headers={isArr.map(s => new Date((s.endDate?.raw || 0) * 1000).getFullYear())}
        rows={rows}
        data={isArr}
      />
    </div>
  );
}

export function TresorerieTab({ data }) {
  const cfArr = data?.cashflowStatementHistory?.cashflowStatements || [];

  const rows = [
    ["Flux opérationnels", "totalCashFromOperatingActivities", true],
    ["Variation du BFR", "changeToOperatingActivities", false],
    ["CAPEX", "capitalExpenditures", false],
    ["Flux d'investissement", "totalCashFromInvestingActivities", false],
    ["Flux de financement", "totalCashFromFinancingActivities", false],
    ["Dividendes versés", "dividendsPaid", false],
    ["Rachat d'actions", "repurchaseOfStock", false],
    ["Free Cash Flow", "freeCashFlow", true],
    ["Variation nette de tréso", "changeInCash", false],
  ];

  const cfChart = [...cfArr].reverse().map(s => ({
    year: String(new Date((s.endDate?.raw || 0) * 1000).getFullYear()),
    "Flux Op.": s.totalCashFromOperatingActivities?.raw ? +(s.totalCashFromOperatingActivities.raw / 1e9).toFixed(1) : 0,
    FCF: s.freeCashFlow?.raw ? +(s.freeCashFlow.raw / 1e9).toFixed(1) : 0,
    CAPEX: s.capitalExpenditures?.raw ? +(Math.abs(s.capitalExpenditures.raw) / 1e9).toFixed(1) : 0,
  }));

  return (
    <div>
      {cfChart.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="chart-label">EN MILLIARDS ({data?.price?.currency})</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={cfChart} margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="year" tick={{ fontSize: 12, fill: "var(--muted)" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "#1e293b", border: "none", borderRadius: 12, color: "white", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Flux Op." fill="#4f46e5" radius={[4, 4, 0, 0]} />
              <Bar dataKey="FCF" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="CAPEX" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <FinancialTable
        headers={cfArr.map(s => new Date((s.endDate?.raw || 0) * 1000).getFullYear())}
        rows={rows}
        data={cfArr}
      />
    </div>
  );
}
