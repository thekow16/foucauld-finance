# CLAUDE.md — Notes pour Claude Code

## Projet

Alphaview est une SPA React d'analyse boursière déployée sur GitHub Pages.

## Commandes

- `npm run dev` — Serveur dev Vite
- `npm run build` — Build production
- `npm test` — Tests Vitest (vitest run)

## Architecture

- **React 18 + Vite 5** — SPA sans routeur (navigation par état + URL params `?s=SYMBOL`)
- **Pas de TypeScript** — tout en JavaScript ES6+
- **Pas de state manager** — useState/useEffect + localStorage pour la persistance
- **Code splitting** — React.lazy() + Suspense sur tous les onglets et modales
- **CSS** — Fichier unique `App.css` avec CSS custom properties (dark/light)

## Fichiers clés

- `src/App.jsx` — Orchestration principale, routing, état global
- `src/utils/api.js` — Fetching Yahoo Finance avec proxy CORS + fallbacks (~800 lignes)
- `src/utils/fmpApi.js` — Wrapper FMP avec gestion de quota
- `worker/cors-proxy.js` — Cloudflare Worker proxy

## Conventions

- Interface en **français** (textes hardcodés, pas d'i18n)
- Logs console préfixés : `[FF]`, `[FMP]`, `[SEC]`
- Données Yahoo au format `{ raw: number, fmt: string }`
- Formatage via `fmt()` dans `utils/format.js`

## Tests

- Vitest + jsdom
- Tests dans des fichiers `.test.js` à côté du code source
- Directive `// @vitest-environment jsdom` pour les tests DOM

## Proxy et APIs

- Le Worker Cloudflare (`foucauld-proxy.workers.dev`) est le proxy principal
- 5 proxies CORS gratuits en fallback (allorigins, corsproxy, codetabs, etc.)
- Rate limit Worker : 30 req/min/IP
- FMP : 250 req/jour (compteur côté client dans localStorage)

## CI/CD

- `ci.yml` : Build + test sur push/PR
- `deploy.yml` : Auto-deploy GitHub Pages sur push main
- `monitor.yml` : Health check Worker toutes les 15 min
