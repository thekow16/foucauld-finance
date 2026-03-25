# Alphaview — L'outil #1 d'analyse fondamentale boursiere

**Analysez n'importe quelle action mondiale en quelques secondes.**

Cours temps reel, 50+ ratios financiers, etats financiers sur 10 ans, graphiques interactifs, score de sante financiere et bien plus.

**[Lancer Alphaview](https://thekow16.github.io/foucauld-finance/)** | 100% Gratuit

---

## Pourquoi Alphaview ?

Alphaview est la plateforme d'analyse fondamentale la plus complete et la plus accessible du marche. Concu pour les investisseurs particuliers et les etudiants en finance, l'outil offre une experience digne des terminaux professionnels, gratuitement.

## Fonctionnalites principales

- **50+ ratios financiers** : P/E, PEG, ROE, ROA, ROIC, EV/EBITDA, marges, dette/CP, etc.
- - **Etats financiers complets** : Bilan, Compte de resultats, Tresorerie (5-20+ ans d'historique)
  - - **Score sante financiere** : Notation 0-100 basee sur 6 criteres (croissance CA & FCF, ROIC, dette nette/FCF, dilution, marge FCF)
    - - **Graphiques interactifs** : Chandeliers japonais, indicateurs techniques (SMA, Bandes de Bollinger), outil de mesure
      - - **Comparaison** : 2 actions cote a cote (radar, performance normalisee, metriques detaillees)
        - - **Top Investisseurs** : Portefeuilles de Warren Buffett, Cathie Wood, Michael Burry, Ray Dalio, etc.
          - - **Watchlist & Alertes** : Favoris persistants avec alertes de croisement MA50/MA200
            - - **Export CSV** : Telechargement des donnees financieres
              - - **MetricCards** : Cartes visuelles avec sparklines, barres 52 semaines, P/E, EV/EBITDA, ROE/ROA, marges
                - - **Mode sombre** : Theme clair/sombre avec persistance
                  - - **PWA** : Installable, support hors-ligne
                    - - **Freemium** : Landing page marketing + plans Free et Pro
                     
                      - ## Stack technique
                     
                      - | Categorie | Technologie |
                      - |-----------|-------------|
                      - | Frontend | React 18, Vite 5 |
                      - | Graphiques | Recharts, Lightweight Charts |
                      - | Auth | Firebase Auth |
                      - | Tests | Vitest, jsdom |
                      - | Proxy | Cloudflare Workers |
                      - | Deploiement | GitHub Pages + GitHub Actions + Vercel |
                     
                      - ## Sources de donnees
                     
                      - | Source | Couverture | Notes |
                      - |--------|-----------|-------|
                      - | Yahoo Finance | 70K+ actions mondiales | Proxy CORS via Cloudflare Worker |
                      - | Financial Modeling Prep | Donnees US detaillees | 250 req/jour (clef optionnelle) |
                      - | SEC EDGAR | Filings 10-K/10-Q | Actions US uniquement |
                     
                      - ## Demarrage rapide
                     
                      - ```bash
                        git clone https://github.com/thekow16/foucauld-finance.git
                        cd foucauld-finance
                        npm install
                        npm run dev
                        ```

                        ## Modele Freemium

                        | Fonctionnalite | Gratuit | Pro (9.99 EUR/mois) |
                        |---------------|---------|---------------------|
                        | Analyses / jour | 10 | Illimitees |
                        | Ratios financiers | 30+ | 50+ |
                        | Comparaison | Non | Oui |
                        | Score sante | Non | Oui |
                        | Top investisseurs | Non | Oui |
                        | Export CSV | Non | Oui |
                        | Watchlist | 5 max | Illimitee |
                        | Alertes MA | Non | Oui |

                        ## SEO & Marketing

                        - Meta tags Open Graph + Twitter Card
                        - - JSON-LD structured data (WebApplication)
                          - - Sitemap + robots optimises
                            - - Landing page marketing avec hero, features, pricing, testimonials, newsletter
                              - - Performance Lighthouse 90+
                               
                                - ## Licence
                               
                                - MIT
                               
                                - ---

                                **Fait avec passion par [thekow16](https://github.com/thekow16)**
