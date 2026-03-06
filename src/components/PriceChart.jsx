import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from "recharts";
import { PERIODS } from "../utils/format";

export default function PriceChart({ chartData, chartLoad, period, onPeriodChange, currency, dark }) {
  const chartUp = chartData.length > 1 && chartData.at(-1).price >= chartData[0].price;
  const upColor = "#10b981";
  const downColor = "#ef4444";
  const lineColor = chartUp ? upColor : downColor;

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <span className="section-title">Évolution du cours</span>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {PERIODS.map(pp => (
            <button key={pp.label} className={`period-btn${period.label === pp.label ? " active" : ""}`} onClick={() => onPeriodChange(pp)}>
              {pp.label}
            </button>
          ))}
        </div>
      </div>
      {chartLoad ? (
        <div style={{ height: 240, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="spinner" />
        </div>
      ) : chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
            <defs>
              <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={lineColor} stopOpacity={0.28} />
                <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} domain={["auto", "auto"]} width={60} />
            <Tooltip
              contentStyle={{ background: dark ? "#1e293b" : "#1e293b", border: "none", borderRadius: 12, color: "white", fontSize: 13 }}
              formatter={v => [`${v} ${currency || ""}`, "Cours"]}
              labelStyle={{ color: "#94a3b8" }}
            />
            <Area type="monotone" dataKey="price" stroke={lineColor} strokeWidth={2.5} fill="url(#chartGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ height: 240, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 14 }}>
          Données graphique indisponibles
        </div>
      )}
    </div>
  );
}
