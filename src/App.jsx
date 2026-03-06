import { useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend
} from "recharts";

const fmt = (v, type = "number") => {
  if (v == null || isNaN(v)) return "—";
  if (type === "currency") {
    const abs = Math.abs(v), sign = v < 0 ? "-" : "";
    if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(2)} T`;
    if (abs >= 1e9)  return `${sign}${(abs / 1e9).toFixed(2)} Md`;
    if (abs >= 1e6)  return `${sign}${(abs / 1e6).toFixed(2)} M`;
    return `${sign}${abs.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}`;
  }
  if (type === "percent") return `${(v * 100).toFixed(2)} %`;
  if (type === "ratio")   return v.toFixed(2);
  return v.toFixed(2);
};

const PERIODS = [
  { label: "1S",  range: "5d",  interval: "1d"  },
  { label: "1M",  range: "1mo", interval: "1d"  },
  { label: "3M",  range: "3mo", interval: "1d"  },
  { label: "6M",  range: "6mo", interval: "1wk" },
  { label: "1A",  range: "1y",  interval: "1wk" },
  { label: "5A",  range: "5y",  interval: "1mo" },
];

const TABS = [
  { id: "ratios",     label: "📊 Ratios"    },
  { id: "bilan",      label: "🏦 Bilan"     },
  { id: "resultats",  label: "💹 Résultats" },
  { id: "tresorerie", label: "💧 Trésorerie"},
];

const SUGGESTIONS = ["AAPL","TSLA","MC.PA","TTE.PA","NVDA","MSFT","BNP.PA","AIR.PA"];

const PROXIES = [
  url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  url => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
];

async function proxyFetch(targetUrl) {
  for (const make of PROXIES) {
    try {
      const res = await fetch(make(targetUrl), { signal: AbortSignal.timeout(9000) });
      if (!res.ok) continue;
      return await res.json();
    } catch (_) {}
  }
  throw new Error("Impossible de contacter Yahoo Finance. Réessayez dans quelques secondes.");
}

const YF = "https://query1.finance.yahoo.com";

export default function FoucauldFinance() {
  const [query,     setQuery]     = useState("");
  const [symbol,    setSymbol]    = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [chartLoad, setChartLoad] = useState(false);
  const [error,     setError]     = useState(null);
  const [data,      setData]      = useState(null);
  const [chartData, setChartData] = useState([]);
  const [period,    setPeriod]    = useState(PERIODS[4]);
  const [activeTab, setActiveTab] = useState("ratios");

  const fetchChart = async (sym, p) => {
    setChartLoad(true);
    try {
      const url = `${YF}/v8/finance/chart/${sym}?interval=${p.interval}&range=${p.range}`;
      const json = await proxyFetch(url);
      const result = json.chart?.result?.[0];
      if (!result) return;
      const ts = result.timestamp || [];
      const cl = result.indicators.quote[0].close || [];
      setChartData(
        ts.map((t, i) => ({
          date:  new Date(t * 1000).toLocaleDateString("fr-FR", { month:"short", day:"numeric" }),
          price: cl[i] ? +cl[i].toFixed(2) : null,
        })).filter(d => d.price !== null)
      );
    } catch (e) { console.warn("chart:", e); }
    finally { setChartLoad(false); }
  };

  const fetchStock = async (sym) => {
    setLoading(true); setError(null); setData(null); setChartData([]);
    try {
      const modules = "price,financialData,defaultKeyStatistics,balanceSheetHistory,incomeStatementHistory,cashflowStatementHistory,summaryDetail,assetProfile";
      const url = `${YF}/v10/finance/quoteSummary/${sym}?modules=${modules}`;
      const json = await proxyFetch(url);
      if (json.quoteSummary?.error) throw new Error("Symbole introuvable — essayez : AAPL, MC.PA, TSLA…");
      const result = json.quoteSummary?.result?.[0];
      if (!result) throw new Error("Aucune donnée reçue pour ce symbole.");
      setData(result);
      await fetchChart(sym, period);
    } catch (e) { setError(e.message || "Erreur inconnue."); }
    finally { setLoading(false); }
  };

  const handleSearch = (e) => {
    e?.preventDefault();
    const sym = query.trim().toUpperCase();
    if (!sym) return;
    setSymbol(sym); setActiveTab("ratios"); fetchStock(sym); setQuery("");
  };

  const go = (sym) => { setSymbol(sym); setActiveTab("ratios"); fetchStock(sym); };
  const handlePeriod = (p) => { setPeriod(p); if (symbol) fetchChart(symbol, p); };

  const pr    = data?.price;
  const stats = data?.defaultKeyStatistics;
  const fin   = data?.financialData;
  const summ  = data?.summaryDetail;
  const prof  = data?.assetProfile;
  const bsArr = data?.balanceSheetHistory?.balanceSheetStatements   || [];
  const isArr = data?.incomeStatementHistory?.incomeStatementHistory || [];
  const cfArr = data?.cashflowStatementHistory?.cashflowStatements   || [];

  const curPrice = pr?.regularMarketPrice?.raw;
  const chg      = pr?.regularMarketChange?.raw;
  const chgPct   = pr?.regularMarketChangePercent?.raw;
  const isUp     = (chg ?? 0) >= 0;
  const chartUp  = chartData.length > 1 && chartData.at(-1).price >= chartData[0].price;

  const getScore = () => {
    if (!fin || !stats) return null;
    let s = 40;
    const pe = stats.trailingPE?.raw;
    if (pe > 0 && pe < 20) s += 12; else if (pe > 0 && pe < 35) s += 6;
    const pm = fin.profitMargins?.raw;
    if (pm > 0.2) s += 16; else if (pm > 0.1) s += 9; else if (pm > 0) s += 4;
    const de = fin.debtToEquity?.raw;
    if (de != null && de < 50) s += 16; else if (de != null && de < 100) s += 9; else if (de != null && de < 200) s += 4;
    const cr = fin.currentRatio?.raw;
    if (cr > 2) s += 10; else if (cr > 1.5) s += 7; else if (cr > 1) s += 4;
    const rg = fin.revenueGrowth?.raw;
    if (rg > 0.15) s += 6; else if (rg > 0.05) s += 3;
    return Math.min(100, Math.max(0, Math.round(s)));
  };
  const score      = getScore();
  const scoreColor = score >= 70 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  const scoreLabel = score >= 70 ? "Excellente" : score >= 55 ? "Bonne" : score >= 40 ? "Correcte" : "Fragile";
  const circ       = 2 * Math.PI * 32;

  const bsChart = [...bsArr].reverse().map(s => ({
    year:     String(new Date((s.endDate?.raw || 0) * 1000).getFullYear()),
    Actifs:   s.totalAssets?.raw             ? +(s.totalAssets.raw             / 1e9).toFixed(1) : 0,
    Dettes:   s.totalLiab?.raw               ? +(s.totalLiab.raw               / 1e9).toFixed(1) : 0,
    Capitaux: s.totalStockholderEquity?.raw  ? +(s.totalStockholderEquity.raw  / 1e9).toFixed(1) : 0,
  }));

  return (
    <div style={{ fontFamily:"'Outfit',sans-serif", background:"#F2F4FF", minHeight:"100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .hero{background:linear-gradient(135deg,#312e81 0%,#4f46e5 45%,#7c3aed 75%,#0f766e 100%);padding:28px 20px 72px;position:relative;overflow:hidden}
        .hero::before{content:'';position:absolute;top:-80px;right:-80px;width:300px;height:300px;background:rgba(255,255,255,.06);border-radius:50%}
        .hero::after{content:'';position:absolute;bottom:-100px;left:-60px;width:340px;height:340px;background:rgba(255,255,255,.04);border-radius:50%}
        .logo{display:flex;align-items:center;gap:10px;margin-bottom:28px;position:relative;z-index:1}
        .logo-icon{width:42px;height:42px;background:rgba(255,255,255,.15);backdrop-filter:blur(10px);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px}
        .logo-text{color:white;font-size:22px;font-weight:900;letter-spacing:-.5px}
        .search-wrap{display:flex;gap:10px;max-width:700px;position:relative;z-index:1}
        .ff-input{flex:1;padding:14px 20px;border-radius:50px;border:2px solid rgba(255,255,255,.2);background:rgba(255,255,255,.12);backdrop-filter:blur(10px);color:white;font-family:'Outfit',sans-serif;font-size:15px;font-weight:500;outline:none;transition:border .2s,background .2s}
        .ff-input::placeholder{color:rgba(255,255,255,.5)}
        .ff-input:focus{border-color:rgba(255,255,255,.55);background:rgba(255,255,255,.18)}
        .ff-btn{padding:14px 26px;background:white;color:#4f46e5;border:none;border-radius:50px;font-family:'Outfit',sans-serif;font-weight:800;font-size:14px;cursor:pointer;transition:transform .15s,box-shadow .15s;box-shadow:0 4px 20px rgba(0,0,0,.2);white-space:nowrap}
        .ff-btn:hover{transform:translateY(-2px);box-shadow:0 6px 26px rgba(0,0,0,.25)}
        .chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px;position:relative;z-index:1}
        .chip{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);color:rgba(255,255,255,.85);padding:5px 14px;border-radius:20px;font-size:13px;font-weight:600;font-family:'Outfit',sans-serif;cursor:pointer;transition:background .2s}
        .chip:hover{background:rgba(255,255,255,.22)}
        .main{max-width:920px;margin:-38px auto 0;padding:0 16px 52px;position:relative}
        .card{background:white;border-radius:22px;padding:24px;box-shadow:0 4px 24px rgba(79,70,229,.08);margin-bottom:18px}
        .metric-card{background:white;border-radius:18px;padding:18px 20px;box-shadow:0 2px 14px rgba(0,0,0,.05);border-top:3px solid;transition:transform .15s}
        .metric-card:hover{transform:translateY(-2px)}
        .grid6{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:14px;margin-bottom:18px}
        .period-btn{background:none;border:none;cursor:pointer;padding:7px 13px;border-radius:20px;font-family:'Outfit',sans-serif;font-size:13px;font-weight:700;color:#94a3b8;transition:all .18s}
        .period-btn:hover{background:#e0e7ff;color:#4f46e5}
        .period-btn.active{background:#4f46e5;color:white}
        .tab-btn{background:none;border:none;border-bottom:3px solid transparent;cursor:pointer;padding:14px 20px;font-family:'Outfit',sans-serif;font-size:14px;font-weight:600;color:#94a3b8;transition:all .18s;white-space:nowrap}
        .tab-btn.active{color:#4f46e5;border-bottom-color:#4f46e5}
        .tab-btn:hover{color:#4f46e5}
        .ff-table{width:100%;border-collapse:collapse;font-size:13px}
        .ff-table th{background:#f8f9ff;text-align:left;padding:10px 14px;color:#64748b;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid #e8ecff}
        .ff-table th:not(:first-child){text-align:right}
        .ff-table td{padding:12px 14px;border-bottom:1px solid #f1f4ff}
        .ff-table td:not(:first-child){text-align:right;font-weight:600}
        .ff-table tr:hover td{background:#f8f9ff}
        .ff-table tr:last-child td{border-bottom:none}
        .ratio-row{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;padding:12px 4px;border-bottom:1px solid #f1f4ff}
        .ratio-row:last-child{border-bottom:none}
        .spinner{width:42px;height:42px;border:4px solid #e0e7ff;border-top-color:#4f46e5;border-radius:50%;animation:spin .7s linear infinite;margin:0 auto 14px}
        @keyframes spin{to{transform:rotate(360deg)}}
        .badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700}
        .stag{font-size:11px;font-weight:700;padding:3px 9px;border-radius:10px}
      `}</style>

      {/* HERO */}
      <div className="hero">
        <div style={{maxWidth:920,margin:"0 auto"}}>
          <div className="logo">
            <div className="logo-icon">📈</div>
            <span className="logo-text">Foucauld Finance</span>
          </div>
          <form onSubmit={handleSearch} className="search-wrap">
            <input className="ff-input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Symbole : AAPL, MC.PA, TSLA, BNP.PA, NESN.SW…"/>
            <button type="submit" className="ff-btn">🔍 Analyser</button>
          </form>
          <div style={{color:"rgba(255,255,255,.6)",fontSize:12,marginTop:10}}>
            💡 <b style={{color:"rgba(255,255,255,.85)"}}>Paris</b> → .PA &nbsp;·&nbsp;
               <b style={{color:"rgba(255,255,255,.85)"}}>Londres</b> → .L &nbsp;·&nbsp;
               <b style={{color:"rgba(255,255,255,.85)"}}>Tokyo</b> → .T &nbsp;·&nbsp;
               <b style={{color:"rgba(255,255,255,.85)"}}>Francfort</b> → .DE
          </div>
          <div className="chips">
            {SUGGESTIONS.map(s=><button key={s} className="chip" onClick={()=>go(s)}>{s}</button>)}
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div className="main">
        {loading && (
          <div className="card" style={{textAlign:"center",padding:"60px 24px"}}>
            <div className="spinner"/>
            <p style={{color:"#4f46e5",fontWeight:700,fontSize:15}}>Analyse de {symbol} en cours…</p>
            <p style={{color:"#94a3b8",fontSize:13,marginTop:6}}>Connexion à Yahoo Finance</p>
          </div>
        )}
        {!loading && error && (
          <div className="card" style={{textAlign:"center",padding:"52px 24px"}}>
            <div style={{fontSize:48,marginBottom:12}}>⚠️</div>
            <p style={{color:"#ef4444",fontWeight:700,fontSize:16,marginBottom:8}}>{error}</p>
            <p style={{color:"#94a3b8",fontSize:13}}>Exemples : AAPL · MC.PA · TSLA · BNP.PA · 7203.T · NESN.SW</p>
          </div>
        )}
        {!loading && !error && !data && (
          <div className="card" style={{textAlign:"center",padding:"64px 24px"}}>
            <div style={{fontSize:64,marginBottom:18}}>🌍</div>
            <h2 style={{color:"#0f172a",fontSize:22,fontWeight:800,marginBottom:10}}>Analysez n'importe quelle action mondiale</h2>
            <p style={{color:"#64748b",fontSize:15,lineHeight:1.7}}>Cours temps réel · Ratios · Bilan · Compte de résultats · Flux de trésorerie</p>
            <p style={{color:"#94a3b8",fontSize:13,marginTop:16}}>Cliquez sur un symbole ci-dessus pour commencer</p>
          </div>
        )}

        {!loading && !error && data && <>
          <div className="card">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16,flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:200}}>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:8}}>
                  <h1 style={{fontSize:23,fontWeight:900,color:"#0f172a",letterSpacing:-.5}}>{pr?.shortName||pr?.longName||symbol}</h1>
                  <span className="badge" style={{background:"#e0e7ff",color:"#4f46e5"}}>{symbol}</span>
                  {prof?.sector && <span className="badge" style={{background:"#f0fdf4",color:"#16a34a"}}>{prof.sector}</span>}
                  {pr?.exchangeName && <span className="badge" style={{background:"#fff7ed",color:"#ea580c"}}>{pr.exchangeName}</span>}
                </div>
                {prof?.longBusinessSummary && (
                  <p style={{color:"#64748b",fontSize:13,lineHeight:1.6,maxWidth:480}}>{prof.longBusinessSummary.substring(0,160)}…</p>
                )}
                {prof?.country && <p style={{color:"#94a3b8",fontSize:12,marginTop:6}}>🌍 {prof.country} · {prof.industry}</p>}
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:38,fontWeight:900,color:"#0f172a",letterSpacing:-1,lineHeight:1}}>
                  {curPrice!=null ? curPrice.toFixed(2) : "—"}
                  <span style={{fontSize:15,fontWeight:600,color:"#94a3b8",marginLeft:6}}>{pr?.currency}</span>
                </div>
                {chg!=null && (
                  <div style={{display:"inline-flex",alignItems:"center",gap:6,marginTop:6,padding:"6px 14px",borderRadius:20,fontWeight:800,fontSize:14,background:isUp?"#f0fdf4":"#fef2f2",color:isUp?"#16a34a":"#dc2626"}}>
                    {isUp?"▲":"▼"} {Math.abs(chg).toFixed(2)} ({Math.abs((chgPct??0)*100).toFixed(2)} %)
                  </div>
                )}
                {pr?.regularMarketVolume?.raw!=null && (
                  <div style={{fontSize:12,color:"#94a3b8",marginTop:8}}>Vol. {fmt(pr.regularMarketVolume.raw,"currency")}</div>
                )}
              </div>
            </div>
          </div>

          <div className="grid6">
            {[
              {label:"Capitalisation", val:fmt(pr?.marketCap?.raw,"currency"),                                     color:"#4f46e5",icon:"🏦"},
              {label:"P/E Ratio",      val:fmt(stats?.trailingPE?.raw,"ratio"),                                    color:"#7c3aed",icon:"📊"},
              {label:"P/B Ratio",      val:fmt(stats?.priceToBook?.raw,"ratio"),                                   color:"#0891b2",icon:"📖"},
              {label:"Dividende",      val:summ?.dividendYield?.raw?fmt(summ.dividendYield.raw,"percent"):"—",     color:"#16a34a",icon:"💰"},
              {label:"Beta",           val:fmt(stats?.beta?.raw,"ratio"),                                          color:"#f59e0b",icon:"⚡"},
              {label:"52S Haut",       val:summ?.fiftyTwoWeekHigh?.raw?summ.fiftyTwoWeekHigh.raw.toFixed(2):"—",   color:"#e11d48",icon:"📈"},
            ].map(m=>(
              <div key={m.label} className="metric-card" style={{borderTopColor:m.color}}>
                <div style={{fontSize:22,marginBottom:8}}>{m.icon}</div>
                <div style={{fontSize:22,fontWeight:900,color:"#0f172a",letterSpacing:-.5}}>{m.val}</div>
                <div style={{fontSize:12,color:"#94a3b8",fontWeight:600,marginTop:4}}>{m.label}</div>
              </div>
            ))}
          </div>

          {score!==null && (
            <div className="card" style={{display:"flex",gap:24,alignItems:"center",flexWrap:"wrap"}}>
              <svg width="90" height="90" viewBox="0 0 90 90">
                <circle cx="45" cy="45" r="32" fill="none" stroke="#e2e8f0" strokeWidth="9"/>
                <circle cx="45" cy="45" r="32" fill="none" stroke={scoreColor} strokeWidth="9"
                  strokeDasharray={`${(score/100)*circ} ${circ}`} strokeLinecap="round"
                  transform="rotate(-90 45 45)" style={{transition:"stroke-dasharray .8s ease"}}/>
                <text x="45" y="50" textAnchor="middle" fontSize="20" fontWeight="800" fill="#0f172a" fontFamily="Outfit,sans-serif">{score}</text>
              </svg>
              <div style={{flex:1}}>
                <div style={{fontSize:19,fontWeight:800,color:scoreColor}}>Santé financière : {scoreLabel}</div>
                <div style={{color:"#64748b",fontSize:13,marginTop:6,lineHeight:1.6,maxWidth:420}}>Score sur 100 — P/E, marges, dette/capitaux propres, liquidité, croissance.</div>
                <div style={{display:"flex",gap:20,marginTop:14,flexWrap:"wrap"}}>
                  {[
                    {label:"Marge nette",val:fmt(fin?.profitMargins?.raw,"percent"), good:(fin?.profitMargins?.raw??0)>0.1},
                    {label:"ROE",        val:fmt(fin?.returnOnEquity?.raw,"percent"), good:(fin?.returnOnEquity?.raw??0)>0.1},
                    {label:"Liquidité",  val:fmt(fin?.currentRatio?.raw,"ratio"),     good:(fin?.currentRatio?.raw??0)>1.5},
                  ].map(it=>(
                    <div key={it.label}>
                      <div style={{fontSize:11,color:"#94a3b8",fontWeight:600,marginBottom:3}}>{it.label}</div>
                      <span className="stag" style={{background:it.good?"#f0fdf4":"#fef2f2",color:it.good?"#16a34a":"#dc2626"}}>{it.good?"✓":"△"} {it.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18,flexWrap:"wrap",gap:10}}>
              <span style={{fontSize:15,fontWeight:800,color:"#0f172a"}}>Évolution du cours</span>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                {PERIODS.map(pp=>(
                  <button key={pp.label} className={`period-btn${period.label===pp.label?" active":""}`} onClick={()=>handlePeriod(pp)}>{pp.label}</button>
                ))}
              </div>
            </div>
            {chartLoad
              ? <div style={{height:220,display:"flex",alignItems:"center",justifyContent:"center"}}><div className="spinner"/></div>
              : chartData.length>0
                ? <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={chartData} margin={{top:5,right:10,bottom:5,left:5}}>
                      <defs>
                        <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%"   stopColor={chartUp?"#10b981":"#ef4444"} stopOpacity={0.28}/>
                          <stop offset="100%" stopColor={chartUp?"#10b981":"#ef4444"} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f4ff"/>
                      <XAxis dataKey="date" tick={{fontSize:11,fill:"#94a3b8"}} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
                      <YAxis tick={{fontSize:11,fill:"#94a3b8"}} tickLine={false} axisLine={false} domain={["auto","auto"]} width={60}/>
                      <Tooltip contentStyle={{background:"#1e293b",border:"none",borderRadius:12,color:"white",fontSize:13}} formatter={v=>[`${v} ${pr?.currency||""}`, "Cours"]} labelStyle={{color:"#94a3b8"}}/>
                      <Area type="monotone" dataKey="price" stroke={chartUp?"#10b981":"#ef4444"} strokeWidth={2.5} fill="url(#grad)" dot={false}/>
                    </AreaChart>
                  </ResponsiveContainer>
                : <div style={{height:220,display:"flex",alignItems:"center",justifyContent:"center",color:"#94a3b8",fontSize:14}}>Données graphique indisponibles</div>
            }
          </div>

          <div className="card" style={{padding:0,overflow:"hidden"}}>
            <div style={{borderBottom:"2px solid #f1f4ff",display:"flex",overflowX:"auto"}}>
              {TABS.map(t=><button key={t.id} className={`tab-btn${activeTab===t.id?" active":""}`} onClick={()=>setActiveTab(t.id)}>{t.label}</button>)}
            </div>
            <div style={{padding:24}}>

              {activeTab==="ratios" && (
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(290px,1fr))",gap:"0 32px"}}>
                  {[
                    {cat:"Valorisation",rows:[
                      ["P/E (trailing)",         fmt(stats?.trailingPE?.raw,"ratio"),                   "Moins c'est bas, moins cher"],
                      ["P/E Forward",            fmt(stats?.forwardPE?.raw,"ratio"),                    "Basé sur les prévisions"],
                      ["PEG Ratio",              fmt(stats?.pegRatio?.raw,"ratio"),                     "P/E / Croissance"],
                      ["Prix / Ventes",          fmt(stats?.priceToSalesTrailing12Months?.raw,"ratio"), ""],
                      ["Prix / Valeur comptable",fmt(stats?.priceToBook?.raw,"ratio"),                  ""],
                      ["EV / EBITDA",            fmt(stats?.enterpriseToEbitda?.raw,"ratio"),           ""],
                    ]},
                    {cat:"Rentabilité",rows:[
                      ["Marge brute",           fmt(fin?.grossMargins?.raw,"percent"),     ""],
                      ["Marge opérationnelle",  fmt(fin?.operatingMargins?.raw,"percent"), ""],
                      ["Marge nette",           fmt(fin?.profitMargins?.raw,"percent"),    ""],
                      ["ROE",                   fmt(fin?.returnOnEquity?.raw,"percent"),   "Rendement capitaux propres"],
                      ["ROA",                   fmt(fin?.returnOnAssets?.raw,"percent"),   "Rendement des actifs"],
                    ]},
                    {cat:"Solidité financière",rows:[
                      ["Dette / Capitaux propres", fin?.debtToEquity?.raw!=null?`${fin.debtToEquity.raw.toFixed(1)} %`:"—",""],
                      ["Ratio de liquidité",       fmt(fin?.currentRatio?.raw,"ratio"),    "> 1.5 = sain"],
                      ["Quick Ratio",              fmt(fin?.quickRatio?.raw,"ratio"),      ""],
                      ["Trésorerie totale",         fmt(fin?.totalCash?.raw,"currency"),   ""],
                      ["Dette totale",              fmt(fin?.totalDebt?.raw,"currency"),   ""],
                    ]},
                    {cat:"Croissance & Dividende",rows:[
                      ["Croissance CA",          fmt(fin?.revenueGrowth?.raw,"percent"),   ""],
                      ["Croissance bénéfices",   fmt(fin?.earningsGrowth?.raw,"percent"),  ""],
                      ["BPA (EPS)",              fmt(stats?.trailingEps?.raw,"ratio"),     "Bénéfice par action"],
                      ["Dividende / action",     summ?.dividendRate?.raw!=null?`${summ.dividendRate.raw.toFixed(2)} ${pr?.currency}`:"—",""],
                      ["Rendement dividende",    fmt(summ?.dividendYield?.raw,"percent"),  ""],
                      ["Payout Ratio",           fmt(summ?.payoutRatio?.raw,"percent"),    ""],
                    ]},
                  ].map(sec=>(
                    <div key={sec.cat}>
                      <div style={{fontSize:11,fontWeight:800,color:"#4f46e5",textTransform:"uppercase",letterSpacing:1,marginBottom:8,marginTop:4}}>{sec.cat}</div>
                      {sec.rows.map(([label,value,hint])=>(
                        <div key={label} className="ratio-row">
                          <div>
                            <div style={{fontWeight:600,fontSize:13,color:"#334155"}}>{label}</div>
                            {hint && <div style={{fontSize:11,color:"#94a3b8"}}>{hint}</div>}
                          </div>
                          <div style={{fontSize:15,fontWeight:800,color:value==="—"?"#cbd5e1":"#4f46e5"}}>{value}</div>
                        </div>
                      ))}
                      <div style={{height:20}}/>
                    </div>
                  ))}
                </div>
              )}

              {activeTab==="bilan" && (
                <div>
                  {bsChart.length>0 && (
                    <div style={{marginBottom:28}}>
                      <div style={{fontSize:12,color:"#94a3b8",fontWeight:700,marginBottom:12}}>EN MILLIARDS ({pr?.currency})</div>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={bsChart} margin={{top:5,right:10,bottom:5,left:5}}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f4ff"/>
                          <XAxis dataKey="year" tick={{fontSize:12,fill:"#94a3b8"}} tickLine={false} axisLine={false}/>
                          <YAxis tick={{fontSize:11,fill:"#94a3b8"}} tickLine={false} axisLine={false}/>
                          <Tooltip contentStyle={{background:"#1e293b",border:"none",borderRadius:12,color:"white",fontSize:12}}/>
                          <Legend wrapperStyle={{fontSize:12}}/>
                          <Bar dataKey="Actifs"   fill="#4f46e5" radius={[4,4,0,0]}/>
                          <Bar dataKey="Dettes"   fill="#ef4444" radius={[4,4,0,0]}/>
                          <Bar dataKey="Capitaux" fill="#10b981" radius={[4,4,0,0]}/>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  <div style={{overflowX:"auto"}}>
                    <table className="ff-table">
                      <thead><tr>
                        <th>Poste</th>
                        {bsArr.map((s,i)=><th key={i}>{new Date((s.endDate?.raw||0)*1000).getFullYear()}</th>)}
                      </tr></thead>
                      <tbody>
                        {[
                          ["💼 Total Actifs",             "totalAssets"],
                          ["📦 Actifs courants",          "totalCurrentAssets"],
                          ["💵 Trésorerie & équivalents", "cash"],
                          ["📈 Créances clients",         "netReceivables"],
                          ["📊 Total Passifs",            "totalLiab"],
                          ["⏰ Passifs courants",         "totalCurrentLiabilities"],
                          ["🏦 Dette long terme",         "longTermDebt"],
                          ["🌱 Capitaux propres",         "totalStockholderEquity"],
                        ].map(([label,key])=>(
                          <tr key={key}>
                            <td style={{fontWeight:600,color:"#334155"}}>{label}</td>
                            {bsArr.map((s,i)=><td key={i} style={{color:"#0f172a"}}>{fmt(s[key]?.raw,"currency")}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab==="resultats" && (
                <div style={{overflowX:"auto"}}>
                  <table className="ff-table">
                    <thead><tr>
                      <th>Poste</th>
                      {isArr.map((s,i)=><th key={i}>{new Date((s.endDate?.raw||0)*1000).getFullYear()}</th>)}
                    </tr></thead>
                    <tbody>
                      {[
                        ["📈 Chiffre d'affaires",      "totalRevenue",           true ],
                        ["💰 Bénéfice brut",           "grossProfit",            false],
                        ["⚙️ Charges opérationnelles", "totalOperatingExpenses", false],
                        ["🏭 Résultat opérationnel",   "operatingIncome",        true ],
                        ["📊 EBIT",                    "ebit",                   false],
                        ["🧾 Charges d'intérêts",      "interestExpense",        false],
                        ["💸 Impôts",                  "incomeTaxExpense",       false],
                        ["✅ Résultat net",             "netIncome",              true ],
                      ].map(([label,key,hl])=>(
                        <tr key={key}>
                          <td style={{fontWeight:hl?700:600,color:hl?"#0f172a":"#334155",background:hl?"#f8f9ff":"transparent"}}>{label}</td>
                          {isArr.map((s,i)=>{const v=s[key]?.raw;return <td key={i} style={{color:v==null?"#cbd5e1":v<0?"#dc2626":"#0f172a",background:hl?"#f8f9ff":"transparent",fontWeight:hl?800:600}}>{fmt(v,"currency")}</td>;})}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab==="tresorerie" && (
                <div style={{overflowX:"auto"}}>
                  <table className="ff-table">
                    <thead><tr>
                      <th>Poste</th>
                      {cfArr.map((s,i)=><th key={i}>{new Date((s.endDate?.raw||0)*1000).getFullYear()}</th>)}
                    </tr></thead>
                    <tbody>
                      {[
                        ["🔄 Flux opérationnels",        "totalCashFromOperatingActivities", true ],
                        ["📦 Variation du BFR",          "changeToOperatingActivities",      false],
                        ["🏗️ CAPEX",                    "capitalExpenditures",              false],
                        ["📊 Flux d'investissement",     "totalCashFromInvestingActivities", false],
                        ["💳 Flux de financement",       "totalCashFromFinancingActivities", false],
                        ["🏦 Dividendes versés",         "dividendsPaid",                    false],
                        ["📈 Rachat d'actions",          "repurchaseOfStock",                false],
                        ["🌊 Free Cash Flow",            "freeCashFlow",                     true ],
                        ["💵 Variation nette de tréso", "changeInCash",                     false],
                      ].map(([label,key,hl])=>(
                        <tr key={key}>
                          <td style={{fontWeight:hl?700:600,color:hl?"#0f172a":"#334155",background:hl?"#f8f9ff":"transparent"}}>{label}</td>
                          {cfArr.map((s,i)=>{const v=s[key]?.raw;return <td key={i} style={{color:v==null?"#cbd5e1":v<0?"#dc2626":"#10b981",background:hl?"#f8f9ff":"transparent",fontWeight:hl?800:600}}>{fmt(v,"currency")}</td>;})}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          </div>

          <div style={{textAlign:"center",color:"#94a3b8",fontSize:12,paddingTop:8,lineHeight:2}}>
            📊 Données Yahoo Finance · À usage éducatif uniquement · Pas un conseil en investissement<br/>
            <strong style={{color:"#4f46e5"}}>Foucauld Finance</strong>
          </div>
        </>}
      </div>
    </div>
  );
}
