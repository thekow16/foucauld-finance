const CACHE_TTL = 15 * 60 * 1000;
const CACHE_VERSION = 10;

export function getCachedData(sym) {
  try {
    const raw = sessionStorage.getItem(`ff_${sym}`);
    if (!raw) return null;
    const { data, ts, v } = JSON.parse(raw);
    if (v !== CACHE_VERSION || Date.now() - ts > CACHE_TTL) {
      sessionStorage.removeItem(`ff_${sym}`);
      return null;
    }
    return { data, fetchedAt: ts };
  } catch {
    return null;
  }
}

export function setCachedData(sym, data) {
  try {
    sessionStorage.setItem(`ff_${sym}`, JSON.stringify({ data, ts: Date.now(), v: CACHE_VERSION }));
  } catch {
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i);
        if (key?.startsWith("ff_")) sessionStorage.removeItem(key);
      }
      sessionStorage.setItem(`ff_${sym}`, JSON.stringify({ data, ts: Date.now(), v: CACHE_VERSION }));
    } catch { /* ignore */ }
  }
}
