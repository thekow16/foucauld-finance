// ──────────────────────────────────────────────
// Claude API — Anthropic
// Appels via Cloudflare Worker (proxy CORS)
// ──────────────────────────────────────────────

const WORKER_URL = "https://foucauld-proxy.foucauld-finance.workers.dev";
const STORAGE_KEY = "claude_api_key";

export function getClaudeKey() {
  return localStorage.getItem(STORAGE_KEY) || "";
}

export function setClaudeKey(key) {
  localStorage.setItem(STORAGE_KEY, key);
}

export function hasClaudeKey() {
  return !!getClaudeKey();
}

/**
 * Envoie un message à Claude via le Worker proxy.
 * @param {string} systemPrompt — Instructions système
 * @param {string} userMessage  — Message utilisateur
 * @param {object} opts         — { model, maxTokens }
 * @returns {Promise<string>}   — Réponse texte de Claude
 */
export async function askClaude(
  systemPrompt,
  userMessage,
  { model = "claude-sonnet-4-20250514", maxTokens = 2000 } = {}
) {
  const key = getClaudeKey();
  if (!key) throw new Error("Clé API Claude manquante");

  const targetUrl = "https://api.anthropic.com/v1/messages";
  const proxyUrl = `${WORKER_URL}?url=${encodeURIComponent(targetUrl)}`;

  const res = await fetch(proxyUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    if (res.status === 401) throw new Error("Clé API Claude invalide");
    if (res.status === 429) throw new Error("Limite de requêtes atteinte, réessaie dans quelques secondes");
    throw new Error(`Claude API ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  if (!data.content?.[0]?.text) throw new Error("Réponse Claude vide");
  return data.content[0].text;
}
