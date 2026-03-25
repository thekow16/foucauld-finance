# Alphaview — Analyse boursière gratuite

Application web d'analyse financière en temps réel. Cours, ratios, bilans, graphiques et comparaisons pour toutes les actions mondiales.

**[Accéder à l'application](https://thekow16.github.io/foucauld-finance/)**

## Fonctionnalités

- **30+ ratios financiers** : P/E, PEG, ROE, ROA, marges, dette/CP, etc.
- **États financiers** : Bilan, Compte de résultats, Trésorerie (5-20+ ans d'historique)
- **Graphiques** : Chandelier japonais, indicateurs techniques (SMA, Bandes de Bollinger)
- **Score santé** : Notation 0-100 basée sur 6 critères fondamentaux
- **Comparaison** : 2 actions côte à côte (radar, performance normalisée, métriques)
- **Watchlist** : Favoris persistants avec alertes de croisement MA50/MA200
- **Export CSV** : Téléchargement des données financières
- **Mode sombre** : Thème clair/sombre avec persistance
- **PWA** : Installable, support hors-ligne

## Stack technique

| Catégorie | Technologie |
|-----------|------------|
| Frontend | React 18, Vite 5 |
| Graphiques | Recharts, Lightweight Charts |
| Tests | Vitest, jsdom |
| Proxy | Cloudflare Workers |
| Déploiement | GitHub Pages + GitHub Actions |

## Sources de données

| Source | Couverture | Notes |
|--------|-----------|-------|
| Yahoo Finance | Mondial, 20+ ans | Source principale (cours, fondamentaux) |
| SEC EDGAR | US, 20+ ans | Données XBRL des 10-K |
| Financial Modeling Prep | Mondial, 5 ans | Optionnel (clé API requise) |

## Installation locale

```bash
git clone https://github.com/thekow16/foucauld-finance.git
cd foucauld-finance
npm install
npm run dev
```

### Variables d'environnement (optionnel)

```bash
cp .env.example .env
# Éditer .env avec votre clé FMP si souhaitée
```

### Commandes

| Commande | Description |
|----------|------------|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production |
| `npm run preview` | Prévisualisation du build |
| `npm test` | Lancer les tests |

## Architecture

```
src/
├── components/     # Composants React (Header, Tabs, Charts, Modals)
├── hooks/          # Hooks custom (watchlist, alertes, dark mode)
├── utils/          # API, formatage, indicateurs, auth, export CSV
├── data/           # Données statiques (segments)
├── App.jsx         # Composant principal
└── App.css         # Styles (CSS variables, dark mode)

worker/             # Cloudflare Worker (proxy CORS + injection clé FMP)
.github/workflows/  # CI/CD (build, deploy, monitoring)
```

## Déploiement du Worker

```bash
cd worker
npx wrangler deploy cors-proxy.js --name foucauld-proxy
```

## Licence

Usage éducatif uniquement. Les données financières proviennent de Yahoo Finance, SEC EDGAR et FMP. Ce n'est pas un conseil en investissement.
