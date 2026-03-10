import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

function compactNumber(v) {
  if (v == null || Number.isNaN(v)) return "—";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(2)} T`;
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)} Md`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)} M`;
  return `${sign}${abs.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}`;
}

function pct(v) {
  if (v == null || Number.isNaN(v)) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function buildSeries(data) {
  const fmp = data?._fmpData;
  if (fmp?.income?.length && fmp?.cashflow?.length && fmp?.balance?.length) {
    const byYear = new Map();
    fmp.income.forEach((d) => {
      const y = d?.calendarYear || d?.date?.slice(0, 4);
      if (!y) return;
      byYear.set(y, { ...(byYear.get(y) || {}), year: y, revenue: d.revenue, shares: d.weightedAverageShsOutDil, ebit: d.operatingIncome });
    });
    fmp.cashflow.forEach((d) => {
      const y = d?.calendarYear || d?.date?.slice(0, 4);
      if (!y) return;
      byYear.set(y, { ...(byYear.get(y) || {}), year: y, fcf: d.freeCashFlow, sbc: d.stockBasedCompensation });
    });
    fmp.balance.forEach((d) => {
      const y = d?.calendarYear || d?.date?.slice(0, 4);
      if (!y) return;
      byYear.set(y, {
        ...(byYear.get(y) || {}),
        year: y,
        cash: d.cashAndCashEquivalents,
        debt: d.totalDebt,
        assets: d.totalAssets,
        currentLiabilities: d.totalCurrentLiabilities,
      });
    });

    return [...byYear.values()]
      .map((d) => {
        const investedCapital = (d.assets ?? null) != null && (d.currentLiabilities ?? null) != null
          ? d.assets - d.currentLiabilities
          : null;
        const roce = investedCapital && d.ebit != null ? d.ebit / investedCapital : null;
        const fcfMargin = d.fcf != null && d.revenue ? d.fcf / d.revenue : null;
        const fcfPerShare = d.fcf != null && d.shares ? d.fcf / d.shares : null;
        return { ...d, roce, fcfMargin, fcfPerShare };
      })
      .filter((d) => d.year)
      .sort((a, b) => String(a.year).localeCompare(String(b.year)))
      .slice(-8);
  }

  const income = data?.incomeStatementHistory?.incomeStatementHistory || [];
  const cashflow = data?.cashflowStatementHistory?.cashflowStatements || [];
  const balance = data?.balanceSheetHistory?.balanceSheetStatements || [];
  const byYear = new Map();

  income.forEach((d) => {
    const y = d?.endDate?.raw ? new Date(d.endDate.raw * 1000).getFullYear() : null;
    if (!y) return;
    byYear.set(String(y), {
      ...(byYear.get(String(y)) || {}),
      year: String(y),
      revenue: d.totalRevenue?.raw,
      ebit: d.operatingIncome?.raw ?? d.ebit?.raw,
    });
  });

  cashflow.forEach((d) => {
    const y = d?.endDate?.raw ? new Date(d.endDate.raw * 1000).getFullYear() : null;
    if (!y) return;
    byYear.set(String(y), {
      ...(byYear.get(String(y)) || {}),
      year: String(y),
      fcf: d.freeCashFlow?.raw,
    });
  });

  balance.forEach((d) => {
    const y = d?.endDate?.raw ? new Date(d.endDate.raw * 1000).getFullYear() : null;
    if (!y) return;
    byYear.set(String(y), {
      ...(byYear.get(String(y)) || {}),
      year: String(y),
      cash: d.cash?.raw,
      debt: d.longTermDebt?.raw,
      assets: d.totalAssets?.raw,
      currentLiabilities: d.totalCurrentLiabilities?.raw,
    });
  });

  return [...byYear.values()]
    .map((d) => {
      const investedCapital = (d.assets ?? null) != null && (d.currentLiabilities ?? null) != null
        ? d.assets - d.currentLiabilities
        : null;
      const roce = investedCapital && d.ebit != null ? d.ebit / investedCapital : null;
      const fcfMargin = d.fcf != null && d.revenue ? d.fcf / d.revenue : null;
      return { ...d, roce, fcfMargin };
    })
    .filter((d) => d.year)
    .sort((a, b) => String(a.year).localeCompare(String(b.year)))
    .slice(-8);
}

function ChartCard({ title, children }) {
  return (
    <div className="metric-card" style={{ borderTopColor: "#2563eb", minHeight: 290 }}>
      <div style={{ fontWeight: 800, marginBottom: 12, color: "var(--text)", fontSize: 13 }}>{title}</div>
      <div style={{ width: "100%", height: 220 }}>{children}</div>
    </div>
  );
}

export default function KeyMetricsCharts({ data }) {
  const rows = buildSeries(data);
  if (!rows.length) return null;

  return (
    <div className="grid8" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
      <ChartCard title="Chiffre d'affaires">
        <ResponsiveContainer>
          <BarChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="year" />
            <YAxis tickFormatter={compactNumber} />
            <Tooltip formatter={(v) => compactNumber(v)} />
            <Bar dataKey="revenue" fill="#0891b2" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Free cash flow & SBC">
        <ResponsiveContainer>
          <LineChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="year" />
            <YAxis tickFormatter={compactNumber} />
            <Tooltip formatter={(v) => compactNumber(v)} />
            <Legend />
            <Line type="monotone" dataKey="fcf" stroke="#0d9488" strokeWidth={2} name="FCF" dot={false} />
            <Line type="monotone" dataKey="sbc" stroke="#a855f7" strokeWidth={2} name="SBC" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Free cash flow par action">
        <ResponsiveContainer>
          <LineChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="year" />
            <YAxis />
            <Tooltip formatter={(v) => (v == null ? "—" : v.toFixed(2))} />
            <Line type="monotone" dataKey="fcfPerShare" stroke="#2563eb" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="ROCE">
        <ResponsiveContainer>
          <LineChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="year" />
            <YAxis tickFormatter={pct} />
            <Tooltip formatter={(v) => pct(v)} />
            <Line type="monotone" dataKey="roce" stroke="#ea580c" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Marge de free cash flow">
        <ResponsiveContainer>
          <LineChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="year" />
            <YAxis tickFormatter={pct} />
            <Tooltip formatter={(v) => pct(v)} />
            <Line type="monotone" dataKey="fcfMargin" stroke="#16a34a" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Actions en circulation">
        <ResponsiveContainer>
          <BarChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="year" />
            <YAxis tickFormatter={compactNumber} />
            <Tooltip formatter={(v) => compactNumber(v)} />
            <Bar dataKey="shares" fill="#6366f1" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Cash & dette">
        <ResponsiveContainer>
          <BarChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="year" />
            <YAxis tickFormatter={compactNumber} />
            <Tooltip formatter={(v) => compactNumber(v)} />
            <Legend />
            <Bar dataKey="cash" fill="#14b8a6" name="Cash" />
            <Bar dataKey="debt" fill="#ef4444" name="Dette" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
