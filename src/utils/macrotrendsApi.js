import { warn } from "./log";
import { WORKER_URL, FREE_PROXIES } from "./proxy";

const MT_BASE = "https://www.macrotrends.net";
const MT_TIMEOUT = 20000;

async function fetchHtml(url) {
  if (WORKER_URL) {
    try {
      const res = await fetch(`${WORKER_URL}?url=${encodeURIComponent(url)}`, {
        signal: AbortSignal.timeout(MT_TIMEOUT),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      warn("[MT] Worker failed:", e.message);
    }
  }
  for (let i = 0; i < FREE_PROXIES.length; i++) {
    const { url: proxyUrl, unwrap } = FREE_PROXIES[i](url);
    try {
      const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(MT_TIMEOUT) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (unwrap) {
        try {
          const json = JSON.parse(text);
          if (typeof json.contents === "string") return json.contents;
        } catch {}
      }
      return text;
    } catch (e) {
      warn(`[MT] proxy ${i} failed:`, e.message);
    }
  }
  throw new Error("Macrotrends inaccessible via tous les proxies");
}

function slugify(name) {
  return name
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/\b(sa|sca|se|nv|plc|ag|inc|corp|ltd|limited|co|group)\b/gi, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function parseChartData(html) {
  const results = [];

  const patterns = [
    /var\s+originalData\s*=\s*(\[[\s\S]*?\])\s*;/,
    /var\s+chartData\s*=\s*(\[[\s\S]*?\])\s*;/,
  ];

  for (const re of patterns) {
    const match = html.match(re);
    if (!match) continue;
    try {
      const raw = match[1]
        .replace(/'/g, '"')
        .replace(/new Date\((\d+)\)/g, "$1");
      const data = JSON.parse(raw);
      if (!Array.isArray(data) || data.length === 0) continue;

      for (const item of data) {
        let date, value;
        if (Array.isArray(item)) {
          if (typeof item[0] === "number" && item[0] > 1e9) {
            date = new Date(item[0]).toISOString().slice(0, 10);
          } else {
            date = String(item[0]);
          }
          value = item[1];
        } else if (item && typeof item === "object") {
          date = item.date || item.asOfDate || Object.keys(item).find(k => /\d{4}/.test(k));
          value = item.v ?? item.value ?? item.val ?? Object.values(item).find(v => typeof v === "number");
        }
        if (!date || value == null) continue;
        const year = String(date).slice(0, 4);
        if (!/^\d{4}$/.test(year)) continue;
        results.push({ year, value: Number(value) });
      }
      if (results.length > 0) return results;
    } catch {}
  }

  const tableRe = /<td[^>]*>\s*(\d{4}-\d{2}-\d{2})\s*<\/td>\s*<td[^>]*>\s*\$?([\d,.-]+(?:\.\d+)?(?:[BMT])?)\s*<\/td>/gi;
  let m;
  while ((m = tableRe.exec(html)) !== null) {
    const year = m[1].slice(0, 4);
    let raw = m[2].replace(/,/g, "").trim();
    let multiplier = 1;
    if (raw.endsWith("B")) { multiplier = 1e9; raw = raw.slice(0, -1); }
    else if (raw.endsWith("M")) { multiplier = 1e6; raw = raw.slice(0, -1); }
    else if (raw.endsWith("T")) { multiplier = 1e12; raw = raw.slice(0, -1); }
    const value = parseFloat(raw) * multiplier;
    if (!isNaN(value)) results.push({ year, value });
  }

  return results;
}

function dedup(arr) {
  const seen = new Map();
  for (const item of arr) {
    if (!seen.has(item.year)) seen.set(item.year, item);
  }
  return [...seen.values()];
}

async function trySearch(query) {
  try {
    const html = await fetchHtml(`${MT_BASE}/assets/php/ticket_search.php?input=${encodeURIComponent(query)}`);
    const results = JSON.parse(html);
    if (Array.isArray(results) && results.length > 0) {
      for (const entry of results) {
        const str = typeof entry === "string" ? entry : entry.s || entry.label || "";
        const match = str.match(/^(\S+)\s*-\s*(.+?)(?:\s*\||\s*$)/);
        if (match) {
          return { ticker: match[1].trim(), slug: slugify(match[2].trim()) };
        }
      }
    }
  } catch {}
  return null;
}

async function searchCompany(ticker, companyName) {
  const cleanTicker = ticker.replace(/\..+$/, "").toUpperCase();

  const result = await trySearch(cleanTicker);
  if (result) return result;

  if (companyName) {
    const nameSearch = companyName.split(/\s+/).slice(0, 2).join(" ");
    const result2 = await trySearch(nameSearch);
    if (result2) return result2;

    const slug = slugify(companyName);
    const candidates = [cleanTicker, cleanTicker + "Y", cleanTicker.slice(0, 3) + "AY"];
    for (const t of candidates) {
      try {
        const html = await fetchHtml(`${MT_BASE}/stocks/charts/${t}/${slug}/revenue`);
        if (html.length > 5000 && html.includes("macrotrends")) {
          return { ticker: t, slug };
        }
      } catch {}
    }
  }

  return null;
}

export async function fetchMacrotrendsFinancials(ticker, companyName) {
  const info = await searchCompany(ticker, companyName);
  if (!info) {
    warn(`[MT] ${ticker}: introuvable sur macrotrends`);
    return null;
  }

  warn(`[MT] ${ticker}: trouvé → ${info.ticker}/${info.slug}`);
  const base = `${MT_BASE}/stocks/charts/${info.ticker}/${info.slug}`;

  const metrics = {
    revenue: "revenue",
    opIncome: "operating-income",
    fcf: "free-cash-flow",
    shares: "shares-outstanding",
    assets: "total-assets",
    cash: "cash-on-hand",
    debt: "long-term-debt",
    sbc: "stock-based-compensation",
    ocf: "cash-flow-from-operating-activities",
    capex: "capital-expenditures",
    currentLiabilities: "total-current-liabilities",
  };

  const fetched = {};
  const entries = Object.entries(metrics);
  const batchSize = 3;
  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async ([key, path]) => {
        try {
          const html = await fetchHtml(`${base}/${path}`);
          return [key, dedup(parseChartData(html))];
        } catch {
          return [key, []];
        }
      })
    );
    for (const [key, data] of results) fetched[key] = data;
  }

  const allYears = new Set();
  for (const arr of Object.values(fetched)) {
    for (const d of arr) allYears.add(d.year);
  }
  if (allYears.size === 0) {
    warn(`[MT] ${ticker}: aucune donnée parsée`);
    return null;
  }

  const sorted = [...allYears].sort().reverse();
  const v = (arr, year) => (arr || []).find(d => d.year === year)?.value ?? null;

  const income = [];
  const balance = [];
  const cashflow = [];

  for (const fy of sorted) {
    const ocfVal = v(fetched.ocf, fy);
    const capexVal = v(fetched.capex, fy);
    const fcfVal = v(fetched.fcf, fy) ?? (ocfVal != null && capexVal != null ? ocfVal - Math.abs(capexVal) : null);

    income.push({
      date: `${fy}-12-31`,
      calendarYear: fy,
      revenue: v(fetched.revenue, fy),
      operatingIncome: v(fetched.opIncome, fy),
      weightedAverageShsOutDil: v(fetched.shares, fy),
      _source: "macrotrends",
    });
    balance.push({
      date: `${fy}-12-31`,
      calendarYear: fy,
      totalAssets: v(fetched.assets, fy),
      cashAndCashEquivalents: v(fetched.cash, fy),
      totalDebt: v(fetched.debt, fy),
      totalCurrentLiabilities: v(fetched.currentLiabilities, fy),
      _source: "macrotrends",
    });
    cashflow.push({
      date: `${fy}-12-31`,
      calendarYear: fy,
      operatingCashFlow: ocfVal,
      capitalExpenditure: capexVal != null ? -Math.abs(capexVal) : null,
      freeCashFlow: fcfVal,
      stockBasedCompensation: v(fetched.sbc, fy),
      _source: "macrotrends",
    });
  }

  warn(`[MT] ${ticker}: ${sorted.length} ans (${sorted[sorted.length - 1]}–${sorted[0]})`);
  return { income, balance, cashflow };
}
