import { useState } from "react";

const FEATURES = [
  {
        icon: "📊",
        title: "50+ Ratios Financiers",
        desc: "P/E, EV/EBITDA, ROE, ROA, marges, dette nette, ROIC et bien plus. Tout ce dont un analyste a besoin.",
  },
  {
        icon: "📈",
        title: "Graphiques Interactifs",
        desc: "Chandeliers japonais, moyennes mobiles, Bollinger, mesures personnalisées sur graphiques temps réel.",
  },
  {
        icon: "🏦",
        title: "États Financiers Complets",
        desc: "Bilan, compte de résultats et flux de trésorerie sur 10 ans. Export CSV inclus.",
  },
  {
        icon: "⚖️",
        title: "Comparaison d'Actions",
        desc: "Comparez 2 entreprises côte à côte : ratios, marges, croissance et plus.",
  },
  {
        icon: "🏆",
        title: "Top Investisseurs",
        desc: "Suivez les portefeuilles de Warren Buffett, Cathie Wood, Michael Burry et d'autres légendes.",
  },
  {
        icon: "⭐",
        title: "Watchlist & Alertes",
        desc: "Sauvegardez vos actions favorites et recevez des alertes sur les moyennes mobiles.",
  },
  {
        icon: "🎯",
        title: "Score Santé Financière",
        desc: "Score propriétaire sur 100 basé sur 6 critères clés : croissance, ROIC, dette, dilution, marge FCF.",
  },
  {
        icon: "🌍",
        title: "Couverture Mondiale",
        desc: "Toutes les bourses : NYSE, NASDAQ, Euronext Paris, Londres, Tokyo, Hong Kong et plus.",
  },
  ];

const TESTIMONIALS = [
  {
        name: "Thomas D.",
        role: "Investisseur particulier",
        text: "Alphaview m'a permis de remplacer 3 outils payants. L'analyse fondamentale est incroyablement complète et gratuite.",
        stars: 5,
  },
  {
        name: "Marie L.",
        role: "Étudiante en finance",
        text: "Parfait pour mes études ! Les données sont claires et les graphiques sont magnifiques. Je recommande à 100%.",
        stars: 5,
  },
  {
        name: "Pierre K.",
        role: "Analyste financier",
        text: "Le score santé financière et les 50+ ratios en font un outil sérieux. Impressionnant pour un outil gratuit.",
        stars: 5,
  },
  ];

const POPULAR_STOCKS = [
  { symbol: "AAPL", name: "Apple" },
  { symbol: "MSFT", name: "Microsoft" },
  { symbol: "GOOGL", name: "Alphabet" },
  { symbol: "NVDA", name: "NVIDIA" },
  { symbol: "TSLA", name: "Tesla" },
  { symbol: "AMZN", name: "Amazon" },
  { symbol: "MC.PA", name: "LVMH" },
  { symbol: "OR.PA", name: "L'Oréal" },
  { symbol: "AI.PA", name: "Air Liquide" },
  { symbol: "SAN.PA", name: "Sanofi" },
  ];

export default function LandingPage({ onSearch, onShowAuth }) {
    const [email, setEmail] = useState("");
    const [subscribed, setSubscribed] = useState(false);

  const handleNewsletterSubmit = (e) => {
        e.preventDefault();
        if (email.trim()) {
                try {
                          const list = JSON.parse(localStorage.getItem("av_newsletter") || "[]");
                          if (!list.includes(email.trim())) {
                                      list.push(email.trim());
                                      localStorage.setItem("av_newsletter", JSON.stringify(list));
                          }
                } catch {}
                setSubscribed(true);
                setEmail("");
        }
  };

  return (
        <div className="landing">
          {/* ── HERO SECTION ── */}
              <section className="landing-hero">
                      <div className="landing-hero-bg" />
                      <div className="landing-hero-content">
                                <div className="landing-badge">🚀 100% Gratuit · Aucune carte requise</div>div>
                                <h1 className="landing-h1">
                                            L'outil <span className="landing-gradient">n°1</span>span> d'analyse<br />
                                            fondamentale boursière
                                </h1>h1>
                                <p className="landing-subtitle">
                                            Analysez n'importe quelle action mondiale en quelques secondes. Cours temps réel,
                                            50+ ratios financiers, états financiers sur 10 ans, graphiques interactifs et score de santé financière.
                                </p>p>
                                <div className="landing-cta-group">
                                            <button className="landing-cta-primary" onClick={() => onSearch("AAPL")}>
                                                          Essayer gratuitement →
                                            </button>button>
                                            <button className="landing-cta-secondary" onClick={onShowAuth}>
                                                          Créer un compte
                                            </button>button>
                                </div>div>
                                <div className="landing-stats">
                                            <div className="landing-stat">
                                                          <span className="landing-stat-value">50+</span>span>
                                                          <span className="landing-stat-label">Ratios financiers</span>span>
                                            </div>div>
                                            <div className="landing-stat-divider" />
                                            <div className="landing-stat">
                                                          <span className="landing-stat-value">70K+</span>span>
                                                          <span className="landing-stat-label">Actions mondiales</span>span>
                                            </div>div>
                                            <div className="landing-stat-divider" />
                                            <div className="landing-stat">
                                                          <span className="landing-stat-value">10 ans</span>span>
                                                          <span className="landing-stat-label">d'historique</span>span>
                                            </div>div>
                                            <div className="landing-stat-divider" />
                                            <div className="landing-stat">
                                                          <span className="landing-stat-value">100%</span>span>
                                                          <span className="landing-stat-label">Gratuit</span>span>
                                            </div>div>
                                </div>div>
                      </div>div>
              </section>section>
        
          {/* ── POPULAR STOCKS ── */}
              <section className="landing-section">
                      <h2 className="landing-section-title">Actions populaires</h2>h2>
                      <p className="landing-section-desc">Cliquez sur une action pour commencer votre analyse</p>p>
                      <div className="landing-stocks-grid">
                        {POPULAR_STOCKS.map(s => (
                      <button key={s.symbol} className="landing-stock-chip" onClick={() => onSearch(s.symbol)}>
                                    <span className="landing-stock-symbol">{s.symbol}</span>span>
                                    <span className="landing-stock-name">{s.name}</span>span>
                      </button>button>
                    ))}
                      </div>div>
              </section>section>
        
          {/* ── FEATURES ── */}
              <section className="landing-section">
                      <h2 className="landing-section-title">Tout ce dont vous avez besoin</h2>h2>
                      <p className="landing-section-desc">Des fonctionnalités professionnelles, accessibles à tous</p>p>
                      <div className="landing-features-grid">
                        {FEATURES.map(f => (
                      <div key={f.title} className="landing-feature-card">
                                    <div className="landing-feature-icon">{f.icon}</div>div>
                                    <h3 className="landing-feature-title">{f.title}</h3>h3>
                                    <p className="landing-feature-desc">{f.desc}</p>p>
                      </div>div>
                    ))}
                      </div>div>
              </section>section>
        
          {/* ── PRICING ── */}
              <section className="landing-section landing-pricing-section">
                      <h2 className="landing-section-title">Un outil puissant, un prix simple</h2>h2>
                      <p className="landing-section-desc">Commencez gratuitement, passez Pro quand vous êtes prêt</p>p>
                      <div className="landing-pricing-grid">
                        {/* Free tier */}
                                <div className="landing-price-card">
                                            <div className="landing-price-badge">Gratuit</div>div>
                                            <div className="landing-price-amount">0€<span>/mois</span>span></div>div>
                                            <p className="landing-price-desc">Parfait pour découvrir</p>p>
                                            <ul className="landing-price-features">
                                                          <li>✓ 10 analyses / jour</li>li>
                                                          <li>✓ Cours temps réel</li>li>
                                                          <li>✓ 30+ ratios financiers</li>li>
                                                          <li>✓ Bilan, résultats, trésorerie</li>li>
                                                          <li>✓ Graphiques chandeliers</li>li>
                                                          <li>✓ Watchlist (5 actions max)</li>li>
                                                          <li className="landing-price-disabled">✗ Comparaison d'actions</li>li>
                                                          <li className="landing-price-disabled">✗ Export CSV</li>li>
                                                          <li className="landing-price-disabled">✗ Score santé financière</li>li>
                                                          <li className="landing-price-disabled">✗ Top investisseurs</li>li>
                                            </ul>ul>
                                            <button className="landing-price-btn" onClick={() => onSearch("AAPL")}>
                                                          Commencer gratuitement
                                            </button>button>
                                </div>div>
                        {/* Pro tier */}
                                <div className="landing-price-card landing-price-pro">
                                            <div className="landing-price-popular">⭐ Plus populaire</div>div>
                                            <div className="landing-price-badge">Pro</div>div>
                                            <div className="landing-price-amount">9.99€<span>/mois</span>span></div>div>
                                            <p className="landing-price-desc">Pour les investisseurs sérieux</p>p>
                                            <ul className="landing-price-features">
                                                          <li>✓ Analyses illimitées</li>li>
                                                          <li>✓ Cours temps réel</li>li>
                                                          <li>✓ 50+ ratios financiers</li>li>
                                                          <li>✓ États financiers complets</li>li>
                                                          <li>✓ Graphiques avancés + Bollinger</li>li>
                                                          <li>✓ Watchlist illimitée + alertes MA</li>li>
                                                          <li>✓ Comparaison d'actions</li>li>
                                                          <li>✓ Export CSV illimité</li>li>
                                                          <li>✓ Score santé financière</li>li>
                                                          <li>✓ Top investisseurs (Buffett, etc.)</li>li>
                                            </ul>ul>
                                            <button className="landing-price-btn landing-price-btn-pro" onClick={onShowAuth}>
                                                          Essai gratuit 14 jours →
                                            </button>button>
                                </div>div>
                      </div>div>
              </section>section>
        
          {/* ── TESTIMONIALS ── */}
              <section className="landing-section">
                      <h2 className="landing-section-title">Ils nous font confiance</h2>h2>
                      <div className="landing-testimonials-grid">
                        {TESTIMONIALS.map(t => (
                      <div key={t.name} className="landing-testimonial-card">
                                    <div className="landing-testimonial-stars">
                                      {"★".repeat(t.stars)}
                                    </div>div>
                                    <p className="landing-testimonial-text">"{t.text}"</p>p>
                                    <div className="landing-testimonial-author">
                                                    <strong>{t.name}</strong>strong>
                                                    <span>{t.role}</span>span>
                                    </div>div>
                      </div>div>
                    ))}
                      </div>div>
              </section>section>
        
          {/* ── NEWSLETTER CTA ── */}
              <section className="landing-section landing-newsletter-section">
                      <div className="landing-newsletter-card">
                                <h2 className="landing-newsletter-title">Restez informé</h2>h2>
                                <p className="landing-newsletter-desc">
                                            Recevez nos analyses hebdomadaires et les nouvelles fonctionnalités d'Alphaview.
                                </p>p>
                        {subscribed ? (
                      <div className="landing-newsletter-success">
                                    ✅ Merci ! Vous êtes inscrit à notre newsletter.
                      </div>div>
                    ) : (
                      <form className="landing-newsletter-form" onSubmit={handleNewsletterSubmit}>
                                    <input
                                                      type="email"
                                                      placeholder="votre@email.com"
                                                      value={email}
                                                      onChange={e => setEmail(e.target.value)}
                                                      className="landing-newsletter-input"
                                                      required
                                                    />
                                    <button type="submit" className="landing-newsletter-btn">
                                                    S'inscrire →
                                    </button>button>
                      </form>form>
                                )}
                                <p className="landing-newsletter-privacy">
                                            Pas de spam. Désinscription en un clic.
                                </p>p>
                      </div>div>
              </section>section>
        
          {/* ── FINAL CTA ── */}
              <section className="landing-section landing-final-cta">
                      <h2 className="landing-final-title">
                                Prêt à analyser comme un pro ?
                      </h2>h2>
                      <p className="landing-final-desc">
                                Rejoignez des milliers d'investisseurs qui utilisent Alphaview pour prendre de meilleures décisions.
                      </p>p>
                      <button className="landing-cta-primary landing-cta-large" onClick={() => onSearch("AAPL")}>
                                Commencer maintenant — C'est gratuit →
                      </button>button>
              </section>section>
        </div>div>
      );
}</div>
