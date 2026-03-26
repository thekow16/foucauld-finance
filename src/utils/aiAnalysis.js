// AI Analysis utility — extracts financial metrics and generates analysis via OpenAI-compatible API
// [FF-AI] prefix for console logs

const LS_KEY_API = "ff_ai_api_key";
const LS_KEY_PROVIDER = "ff_ai_provider";
const LS_KEY_QUOTA = "ff_ai_quota";

// ── API key management ──

export const getAiApiKey = () => localStorage.getItem(LS_KEY_API) || "";
export const setAiApiKey = (key) => {
  if (key) localStorage.setItem(LS_KEY_API, key);
  else localStorage.removeItem(LS_KEY_API);
};
export const hasAiApiKey = () => !!localStorage.getItem(LS_KEY_API);

export const getAiProvider = () => localStorage.getItem(LS_KEY_PROVIDER) || "openai";
export const setAiProvider = (p) => localStorage.setItem(LS_KEY_PROVIDER, p);

// ── Freemium quota: 3 analyses/month ──

function getQuotaData() {
  try {
    const raw = localStorage.getItem(LS_KEY_QUOTA);
    if (!raw) return { month: "", count: 0 };
    return JSON.parse(raw);
  } catch { return { month: "", count: 0 }; }
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function getQuotaInfo() {
  const data = getQuotaData();
  const cm = currentMonth();
  if (data.month !== cm) return { used: 0, limit: 3, remaining: 3 };
  return { used: data.count, limit: 3, remaining: Math.max(0, 3 - data.count) };
}

export function consumeQuota() {
  const cm = currentMonth();
  const data = getQuotaData();
  if (data.month !== cm) {
    localStorage.setItem(LS_KEY_QUOTA, JSON.stringify({ month: cm, count: 1 }));
    return true;
  }
  if (data.count >= 3 && !hasAiApiKey()) return false;
  data.count++;
  localStorage.setItem(LS_KEY_QUOTA, JSON.stringify(data));
  return true;
}

export function canAnalyze() {
  if (hasAiApiKey()) return true;
  return getQuotaInfo().remaining > 0;
}

// ── Extract key metrics from stock data ──

export function extractMetrics(data, symbol) {
  const fin = data?.financialData || {};
  const stats = data?.defaultKeyStatistics || {};
  const price = data?.price || {};
  const cfArr = data?.cashflowStatementHistory?.cashflowStatements || [];
  const bsArr = data?.balanceSheetHistory?.balanceSheetStatements || [];
  const incArr = data?.incomeStatementHistory?.incomeStatementHistory || [];
  const fmp = data?._fmpData;

  const r = (obj) => obj?.raw;

  // Basic info
  const name = price.shortName || price.longName || symbol;
  const currency = price.currency || "USD";
  const mktPrice = r(price.regularMarketPrice);
  const marketCap = r(stats.marketCap) || r(price.marketCap);

  // Profitability
  const grossMargin = r(fin.grossMargins);
  const opMargin = r(fin.operatingMargins);
  const netMargin = r(fin.profitMargins);
  const roe = r(fin.returnOnEquity);
  const roa = r(fin.returnOnAssets);

  // Cash flow
  const fcf = r(fin.freeCashflow) || r(cfArr[0]?.freeCashFlow);
  const ocf = r(fin.operatingCashflow) || r(cfArr[0]?.totalCashFromOperatingActivities);
  const capex = r(cfArr[0]?.capitalExpenditures);
  const dividends = r(cfArr[0]?.dividendsPaid);
  const buybacks = r(cfArr[0]?.repurchaseOfStock);

  // Revenue
  const revenue = r(fin.totalRevenue) || r(incArr[0]?.totalRevenue);
  const revenueGrowth = r(fin.revenueGrowth);
  const netIncome = r(incArr[0]?.netIncome);
  const ebitda = r(fin.ebitda) || r(incArr[0]?.ebitda);

  // Balance sheet
  const totalDebt = r(fin.totalDebt) || r(bsArr[0]?.longTermDebt);
  const totalCash = r(fin.totalCash) || r(bsArr[0]?.cash);
  const equity = r(bsArr[0]?.totalStockholderEquity);
  const currentRatio = r(fin.currentRatio);
  const debtToEquity = r(fin.debtToEquity);

  // Valuation
  const pe = r(stats.trailingPE) || r(stats.forwardPE);
  const pb = r(stats.priceToBook);
  const evEbitda = r(stats.enterpriseToEbitda);
  const evRevenue = r(stats.enterpriseToRevenue);
  const pegRatio = r(stats.pegRatio);
  const beta = r(stats.beta);
  const dividendYield = r(data?.summaryDetail?.dividendYield);
  const payoutRatio = r(data?.summaryDetail?.payoutRatio);

  // Computed
  const fcfYield = fcf && marketCap ? fcf / marketCap : null;
  const fcfMargin = fcf && revenue ? fcf / revenue : null;
  const netDebt = totalDebt != null && totalCash != null ? totalDebt - totalCash : null;
  const netDebtFcf = netDebt != null && fcf && fcf > 0 ? netDebt / fcf : null;
  const priceFcf = fcf && marketCap ? marketCap / fcf : null;

  // Historical growth (from FMP or Yahoo)
  let revenueHistory = [];
  let fcfHistory = [];
  if (fmp?.income?.length) {
    revenueHistory = fmp.income.slice(0, 5).map(y => ({ year: y.calendarYear || y.date?.slice(0, 4), revenue: y.revenue }));
  } else if (incArr.length) {
    revenueHistory = incArr.slice(0, 4).map(y => ({ year: y.endDate?.fmt?.slice(0, 4), revenue: r(y.totalRevenue) }));
  }
  if (fmp?.cashflow?.length) {
    fcfHistory = fmp.cashflow.slice(0, 5).map(y => ({ year: y.calendarYear || y.date?.slice(0, 4), fcf: y.freeCashFlow }));
  } else if (cfArr.length) {
    fcfHistory = cfArr.slice(0, 4).map(y => ({ year: y.endDate?.fmt?.slice(0, 4), fcf: r(y.freeCashFlow) }));
  }

  return {
    name, symbol, currency, mktPrice, marketCap,
    revenue, revenueGrowth, netIncome, ebitda,
    grossMargin, opMargin, netMargin, roe, roa,
    fcf, ocf, capex, dividends, buybacks,
    totalDebt, totalCash, equity, currentRatio, debtToEquity,
    pe, pb, evEbitda, evRevenue, pegRatio, beta, dividendYield, payoutRatio,
    fcfYield, fcfMargin, netDebt, netDebtFcf, priceFcf,
    revenueHistory, fcfHistory,
  };
}

// ── Build prompt for AI ──

function fmtNum(v, type = "number") {
  if (v == null || isNaN(v)) return "N/A";
  if (type === "currency") {
    const abs = Math.abs(v), sign = v < 0 ? "-" : "";
    if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(1)}T`;
    if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1)}Md`;
    if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(0)}M`;
    return `${sign}${abs.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}`;
  }
  if (type === "pct") return `${(v * 100).toFixed(1)}%`;
  if (type === "ratio") return v.toFixed(1) + "x";
  return v.toFixed(2);
}

function buildPrompt(m) {
  const lines = [
    `Analyse l'action ${m.name} (${m.symbol}) en tant qu'analyste financier expérimenté.`,
    ``,
    `Données financières actuelles :`,
    `- Cours : ${fmtNum(m.mktPrice)} ${m.currency} | Capitalisation : ${fmtNum(m.marketCap, "currency")} ${m.currency}`,
    `- Chiffre d'affaires : ${fmtNum(m.revenue, "currency")} ${m.currency} (croissance : ${fmtNum(m.revenueGrowth, "pct")})`,
    `- EBITDA : ${fmtNum(m.ebitda, "currency")} | Résultat net : ${fmtNum(m.netIncome, "currency")}`,
    `- Free Cash Flow : ${fmtNum(m.fcf, "currency")} | FCF Yield : ${fmtNum(m.fcfYield, "pct")} | FCF Margin : ${fmtNum(m.fcfMargin, "pct")}`,
    `- Marge brute : ${fmtNum(m.grossMargin, "pct")} | Marge opérationnelle : ${fmtNum(m.opMargin, "pct")} | Marge nette : ${fmtNum(m.netMargin, "pct")}`,
    `- ROE : ${fmtNum(m.roe, "pct")} | ROA : ${fmtNum(m.roa, "pct")}`,
    `- Dette totale : ${fmtNum(m.totalDebt, "currency")} | Trésorerie : ${fmtNum(m.totalCash, "currency")} | Dette nette/FCF : ${fmtNum(m.netDebtFcf, "ratio")}`,
    `- Current Ratio : ${fmtNum(m.currentRatio)} | Debt/Equity : ${fmtNum(m.debtToEquity)}`,
    `- P/E : ${fmtNum(m.pe, "ratio")} | P/B : ${fmtNum(m.pb, "ratio")} | EV/EBITDA : ${fmtNum(m.evEbitda, "ratio")} | P/FCF : ${fmtNum(m.priceFcf, "ratio")}`,
    `- PEG : ${fmtNum(m.pegRatio)} | Beta : ${fmtNum(m.beta)}`,
    `- Dividende : ${fmtNum(m.dividendYield, "pct")} | Payout ratio : ${fmtNum(m.payoutRatio, "pct")}`,
  ];

  if (m.revenueHistory.length > 1) {
    lines.push(``, `Historique CA : ${m.revenueHistory.map(h => `${h.year}: ${fmtNum(h.revenue, "currency")}`).join(" → ")}`);
  }
  if (m.fcfHistory.length > 1) {
    lines.push(`Historique FCF : ${m.fcfHistory.map(h => `${h.year}: ${fmtNum(h.fcf, "currency")}`).join(" → ")}`);
  }

  lines.push(
    ``,
    `Rédige une analyse concise (4-6 phrases max) en français. Structure :`,
    `1. Résumé des forces financières (marges, cash flow, rentabilité)`,
    `2. Valorisation actuelle (chère/raisonnable/décotée) avec justification`,
    `3. Points de vigilance ou risques`,
    `4. Conclusion avec ton avis (positif/neutre/prudent)`,
    ``,
    `Style : direct, factuel, avec les chiffres clés. Comme un analyste qui parle à un investisseur averti. Pas de disclaimers juridiques.`,
  );

  return lines.join("\n");
}

// ── Algorithmic fallback analysis (no API needed) ──

export function generateAlgoAnalysis(data, symbol) {
  const m = extractMetrics(data, symbol);
  const parts = [];

  // Profitability assessment
  const profitWords = [];
  if (m.netMargin != null) {
    if (m.netMargin > 0.20) profitWords.push(`une marge nette élevée de ${fmtNum(m.netMargin, "pct")}`);
    else if (m.netMargin > 0.10) profitWords.push(`une marge nette correcte de ${fmtNum(m.netMargin, "pct")}`);
    else if (m.netMargin > 0) profitWords.push(`une marge nette faible de ${fmtNum(m.netMargin, "pct")}`);
    else profitWords.push(`une marge nette négative (${fmtNum(m.netMargin, "pct")})`);
  }
  if (m.fcfMargin != null) {
    if (m.fcfMargin > 0.15) profitWords.push(`un excellent FCF margin de ${fmtNum(m.fcfMargin, "pct")}`);
    else if (m.fcfMargin > 0.05) profitWords.push(`un FCF margin de ${fmtNum(m.fcfMargin, "pct")}`);
  }
  if (m.roe != null && m.roe > 0.15) {
    profitWords.push(`un ROE solide de ${fmtNum(m.roe, "pct")}`);
  }

  if (profitWords.length) {
    parts.push(`${m.name} affiche ${profitWords.join(", ")}.`);
  } else {
    parts.push(`${m.name} (${m.symbol}) — données de rentabilité limitées.`);
  }

  // Cash flow
  if (m.fcf != null && m.fcfYield != null) {
    const fcfQuality = m.fcfYield > 0.06 ? "généreux" : m.fcfYield > 0.03 ? "correct" : "modeste";
    parts.push(`Le FCF yield est ${fcfQuality} à ${fmtNum(m.fcfYield, "pct")} (FCF de ${fmtNum(m.fcf, "currency")} ${m.currency}).`);
  }

  // Debt
  if (m.netDebtFcf != null) {
    if (m.netDebtFcf < 0) parts.push(`L'entreprise est en position de trésorerie nette positive — aucun risque d'endettement.`);
    else if (m.netDebtFcf < 2) parts.push(`La dette nette/FCF de ${fmtNum(m.netDebtFcf, "ratio")} est saine et maîtrisée.`);
    else if (m.netDebtFcf < 4) parts.push(`La dette nette/FCF de ${fmtNum(m.netDebtFcf, "ratio")} reste acceptable mais à surveiller.`);
    else parts.push(`Attention : la dette nette/FCF de ${fmtNum(m.netDebtFcf, "ratio")} est élevée.`);
  }

  // Valuation
  const valParts = [];
  if (m.pe != null) valParts.push(`P/E de ${fmtNum(m.pe, "ratio")}`);
  if (m.priceFcf != null) valParts.push(`P/FCF de ${fmtNum(m.priceFcf, "ratio")}`);
  if (m.evEbitda != null) valParts.push(`EV/EBITDA de ${fmtNum(m.evEbitda, "ratio")}`);
  if (valParts.length) {
    const avgMultiple = [m.pe, m.priceFcf].filter(Boolean);
    const avg = avgMultiple.length ? avgMultiple.reduce((a, b) => a + b) / avgMultiple.length : null;
    let valJudgment = "";
    if (avg != null) {
      if (avg > 35) valJudgment = "La valorisation est élevée — le marché price une forte croissance future.";
      else if (avg > 20) valJudgment = "La valorisation est raisonnable pour une entreprise de qualité.";
      else if (avg > 12) valJudgment = "La valorisation semble modérée et potentiellement attractive.";
      else valJudgment = "La valorisation est basse — opportunité possible ou reflet de difficultés.";
    }
    parts.push(`L'action traite à ${valParts.join(", ")}. ${valJudgment}`);
  }

  // Growth
  if (m.revenueGrowth != null) {
    if (m.revenueGrowth > 0.15) parts.push(`La croissance du CA de ${fmtNum(m.revenueGrowth, "pct")} est dynamique.`);
    else if (m.revenueGrowth > 0.03) parts.push(`La croissance du CA de ${fmtNum(m.revenueGrowth, "pct")} est modérée.`);
    else if (m.revenueGrowth > -0.03) parts.push(`Le CA est quasi stable (${fmtNum(m.revenueGrowth, "pct")}).`);
    else parts.push(`Point de vigilance : le CA recule de ${fmtNum(Math.abs(m.revenueGrowth), "pct")}.`);
  }

  return parts.join(" ");
}

// ── Call AI API ──

const API_URLS = {
  openai: "https://api.openai.com/v1/chat/completions",
  anthropic: "https://api.anthropic.com/v1/messages",
};

const MODELS = {
  openai: "gpt-4o-mini",
  anthropic: "claude-haiku-4-5-20251001",
};

export async function callAiAnalysis(data, symbol, { signal } = {}) {
  const m = extractMetrics(data, symbol);
  const prompt = buildPrompt(m);
  const apiKey = getAiApiKey();
  const provider = getAiProvider();

  if (!apiKey) {
    // Fallback to algorithmic analysis
    console.log("[FF-AI] No API key, using algorithmic analysis");
    return { text: generateAlgoAnalysis(data, symbol), source: "algo" };
  }

  console.log(`[FF-AI] Calling ${provider} API for ${symbol}`);

  try {
    if (provider === "anthropic") {
      const res = await fetch(API_URLS.anthropic, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: MODELS.anthropic,
          max_tokens: 500,
          messages: [{ role: "user", content: prompt }],
        }),
        signal,
      });
      if (!res.ok) {
        const err = await res.text().catch(() => "");
        throw new Error(`Anthropic API error ${res.status}: ${err}`);
      }
      const json = await res.json();
      return { text: json.content?.[0]?.text || "Pas de réponse", source: "anthropic" };
    }

    // OpenAI (default)
    const res = await fetch(API_URLS.openai, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODELS.openai,
        messages: [
          { role: "system", content: "Tu es un analyste financier expert. Tu réponds en français, de manière concise et factuelle." },
          { role: "user", content: prompt },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
      signal,
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`OpenAI API error ${res.status}: ${err}`);
    }
    const json = await res.json();
    return { text: json.choices?.[0]?.message?.content || "Pas de réponse", source: "openai" };
  } catch (e) {
    if (e.name === "AbortError") throw e;
    console.error("[FF-AI] API call failed, falling back to algo:", e.message);
    return { text: generateAlgoAnalysis(data, symbol), source: "algo", error: e.message };
  }
}
