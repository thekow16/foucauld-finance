// ══════════════════════════════════════════════════════════════════════
// Segment data from public annual reports (10-K / Document de Référence)
// Covers CAC 40, major European stocks, S&P 500 top tickers
// Values in base currency units (USD for US, EUR for EU, etc.)
// ══════════════════════════════════════════════════════════════════════

const COLORS = [
  "#4f46e5", "#0891b2", "#10b981", "#f59e0b", "#ef4444",
  "#7c3aed", "#ec4899", "#14b8a6", "#ea580c", "#6366f1",
  "#84cc16", "#06b6d4", "#8b5cf6", "#f97316", "#64748b",
];

function b(date, items) {
  const total = items.reduce((s, e) => s + e.value, 0);
  return {
    date,
    total,
    items: items.map((e, i) => ({
      ...e,
      pct: ((e.value / total) * 100).toFixed(1),
      color: COLORS[i % COLORS.length],
    })),
  };
}

// ── Helper: values in millions ──
function M(v) { return v * 1e6; }

const DB = {};

// ═══════════════════════════════════════════
//  FRANCE — CAC 40
// ═══════════════════════════════════════════

DB["RMS"] = {
  product: b("2024", [
    { name: "Maroquinerie & Sellerie", value: M(6020) },
    { name: "Vêtements & Accessoires", value: M(3630) },
    { name: "Soie & Textiles", value: M(960) },
    { name: "Parfums & Beauté", value: M(730) },
    { name: "Horlogerie", value: M(590) },
    { name: "Autres métiers", value: M(700) },
  ]),
  geo: b("2024", [
    { name: "Asie-Pacifique (hors Japon)", value: M(5450) },
    { name: "Europe (hors France)", value: M(2380) },
    { name: "Amériques", value: M(2830) },
    { name: "Japon", value: M(1720) },
    { name: "France", value: M(1250) },
  ]),
};

DB["MC"] = {
  product: b("2024", [
    { name: "Mode & Maroquinerie", value: M(41677) },
    { name: "Distribution sélective", value: M(17648) },
    { name: "Parfums & Cosmétiques", value: M(8741) },
    { name: "Vins & Spiritueux", value: M(5838) },
    { name: "Montres & Joaillerie", value: M(10572) },
    { name: "Autres activités", value: M(282) },
  ]),
  geo: b("2024", [
    { name: "Asie (hors Japon)", value: M(22970) },
    { name: "États-Unis", value: M(19880) },
    { name: "Europe (hors France)", value: M(15420) },
    { name: "Japon", value: M(8250) },
    { name: "France", value: M(7840) },
    { name: "Autres marchés", value: M(10398) },
  ]),
};

DB["OR"] = {
  product: b("2024", [
    { name: "Luxe (L'Oréal Luxe)", value: M(15610) },
    { name: "Produits Grand Public", value: M(15282) },
    { name: "Dermatological Beauty", value: M(7310) },
    { name: "Produits Professionnels", value: M(4830) },
  ]),
  geo: b("2024", [
    { name: "Europe", value: M(12120) },
    { name: "Amérique du Nord", value: M(11450) },
    { name: "Asie du Nord", value: M(10770) },
    { name: "SAPMENA–SSA", value: M(4960) },
    { name: "Amérique latine", value: M(3732) },
  ]),
};

DB["TTE"] = {
  product: b("2024", [
    { name: "Integrated LNG", value: M(14900) },
    { name: "Exploration & Production", value: M(11200) },
    { name: "Raffinage & Chimie", value: M(120400) },
    { name: "Marketing & Services", value: M(72500) },
    { name: "Integrated Power", value: M(18600) },
  ]),
  geo: b("2024", [
    { name: "Europe", value: M(89200) },
    { name: "Afrique", value: M(18400) },
    { name: "Amériques", value: M(54200) },
    { name: "Asie-Pacifique & Moyen-Orient", value: M(75800) },
  ]),
};

DB["SAN"] = {
  product: b("2024", [
    { name: "Biopharma", value: M(34120) },
    { name: "Médecine Générale", value: M(5850) },
    { name: "Vaccins", value: M(6020) },
    { name: "Santé Grand Public", value: M(5800) },
  ]),
  geo: b("2024", [
    { name: "États-Unis", value: M(19580) },
    { name: "Europe", value: M(12490) },
    { name: "Reste du monde", value: M(11430) },
    { name: "Chine", value: M(3100) },
    { name: "Japon", value: M(2430) },
  ]),
};

DB["AIR"] = {
  product: b("2024", [
    { name: "Airbus (Avions commerciaux)", value: M(51900) },
    { name: "Airbus Helicopters", value: M(8150) },
    { name: "Airbus Defence & Space", value: M(11140) },
  ]),
  geo: b("2024", [
    { name: "Europe", value: M(19420) },
    { name: "Asie-Pacifique", value: M(22750) },
    { name: "Amérique du Nord", value: M(14900) },
    { name: "Moyen-Orient", value: M(6200) },
    { name: "Reste du monde", value: M(7920) },
  ]),
};

DB["BNP"] = {
  product: b("2024", [
    { name: "Corporate & Institutional Banking", value: M(17150) },
    { name: "Commercial & Personal Banking", value: M(18900) },
    { name: "Investment & Protection Services", value: M(7650) },
  ]),
  geo: b("2024", [
    { name: "France", value: M(12800) },
    { name: "Europe (hors France)", value: M(17450) },
    { name: "Amériques", value: M(8400) },
    { name: "Asie-Pacifique", value: M(5050) },
  ]),
};

DB["SU"] = {
  product: b("2024", [
    { name: "Energy Management", value: M(20380) },
    { name: "Industrial Automation", value: M(8570) },
    { name: "Digital Energy", value: M(7250) },
  ]),
  geo: b("2024", [
    { name: "Amérique du Nord", value: M(12600) },
    { name: "Europe", value: M(9850) },
    { name: "Asie-Pacifique", value: M(9250) },
    { name: "Reste du monde", value: M(4500) },
  ]),
};

DB["AI"] = {
  product: b("2024", [
    { name: "Gaz & Services", value: M(25300) },
    { name: "Ingénierie & Construction", value: M(640) },
    { name: "Marchés Globaux & Technologies", value: M(970) },
  ]),
  geo: b("2024", [
    { name: "Europe", value: M(9280) },
    { name: "Amériques", value: M(10400) },
    { name: "Asie-Pacifique", value: M(6700) },
    { name: "Moyen-Orient & Afrique", value: M(1530) },
  ]),
};

DB["SAF"] = {
  product: b("2024", [
    { name: "Propulsion aéronautique", value: M(14700) },
    { name: "Équipements aéronautiques", value: M(8500) },
    { name: "Défense", value: M(2300) },
    { name: "Aircraft Interiors", value: M(2800) },
  ]),
  geo: b("2024", [
    { name: "Europe", value: M(9500) },
    { name: "Amérique du Nord", value: M(8800) },
    { name: "Asie & reste du monde", value: M(10000) },
  ]),
};

DB["CS"] = {
  product: b("2024", [
    { name: "Dommages", value: M(55850) },
    { name: "Vie, Épargne & Santé", value: M(34400) },
    { name: "Gestion d'actifs", value: M(1650) },
    { name: "AXA XL (Réassurance)", value: M(20900) },
  ]),
  geo: b("2024", [
    { name: "France", value: M(28700) },
    { name: "Europe", value: M(33200) },
    { name: "Asie", value: M(12600) },
    { name: "International", value: M(10700) },
    { name: "AXA XL", value: M(20900) },
  ]),
};

DB["CAP"] = {
  product: b("2024", [
    { name: "Strategy & Transformation", value: M(4100) },
    { name: "Applications & Technology", value: M(9200) },
    { name: "Operations & Engineering", value: M(9300) },
  ]),
  geo: b("2024", [
    { name: "France", value: M(5050) },
    { name: "Reste de l'Europe", value: M(8900) },
    { name: "Amérique du Nord", value: M(6800) },
    { name: "Reste du monde", value: M(1850) },
  ]),
};

DB["DSY"] = {
  product: b("2024", [
    { name: "Industrial Innovation", value: M(2910) },
    { name: "Life Sciences", value: M(1350) },
    { name: "Mainstream Innovation", value: M(1660) },
  ]),
  geo: b("2024", [
    { name: "Europe", value: M(2200) },
    { name: "Amériques", value: M(2300) },
    { name: "Asie", value: M(1420) },
  ]),
};

DB["RI"] = {
  product: b("2024", [
    { name: "Spiritueux stratégiques internationaux", value: M(6200) },
    { name: "Vins stratégiques", value: M(1250) },
    { name: "Marques locales clés", value: M(2150) },
    { name: "Specialty Brands", value: M(1080) },
  ]),
  geo: b("2024", [
    { name: "Amériques", value: M(3800) },
    { name: "Europe", value: M(2680) },
    { name: "Asie / Reste du monde", value: M(4200) },
  ]),
};

DB["EL"] = {
  product: b("2024", [
    { name: "Verres ophtalmiques", value: M(13200) },
    { name: "Solaire & Lecteurs", value: M(5900) },
    { name: "Instruments & Équipements", value: M(3100) },
    { name: "Luxottica (Montures & Retail)", value: M(3600) },
  ]),
  geo: b("2024", [
    { name: "Europe, Moyen-Orient & Afrique", value: M(10400) },
    { name: "Amérique du Nord", value: M(9800) },
    { name: "Asie-Océanie", value: M(3900) },
    { name: "Amérique latine", value: M(1700) },
  ]),
};

DB["KER"] = {
  product: b("2024", [
    { name: "Gucci", value: M(7448) },
    { name: "Yves Saint Laurent", value: M(3180) },
    { name: "Bottega Veneta", value: M(1730) },
    { name: "Autres maisons", value: M(4270) },
    { name: "Kering Eyewear & Corporate", value: M(1660) },
  ]),
  geo: b("2024", [
    { name: "Asie-Pacifique", value: M(5900) },
    { name: "Europe de l'Ouest", value: M(5450) },
    { name: "Amérique du Nord", value: M(3100) },
    { name: "Japon", value: M(2100) },
    { name: "Reste du monde", value: M(1738) },
  ]),
};

DB["STLAP"] = {
  product: b("2024", [
    { name: "Amérique du Nord (Jeep, RAM, etc.)", value: M(72500) },
    { name: "Europe élargie (Peugeot, Citroën, Fiat, etc.)", value: M(70200) },
    { name: "Amérique du Sud", value: M(13800) },
    { name: "Maserati", value: M(1600) },
    { name: "Moyen-Orient & Afrique", value: M(7300) },
    { name: "Chine & Asie-Pacifique", value: M(4600) },
  ]),
  geo: b("2024", [
    { name: "Amérique du Nord", value: M(72500) },
    { name: "Europe élargie", value: M(70200) },
    { name: "Amérique du Sud", value: M(13800) },
    { name: "Moyen-Orient, Afrique & Asie", value: M(13500) },
  ]),
};

DB["SGO"] = {
  product: b("2024", [
    { name: "Vitrage & Automobile", value: M(12200) },
    { name: "Matériaux Haute Performance", value: M(11200) },
    { name: "Solutions d'Habitat Léger", value: M(22800) },
  ]),
  geo: b("2024", [
    { name: "Europe (hors France)", value: M(14200) },
    { name: "France", value: M(5650) },
    { name: "Amérique du Nord", value: M(13700) },
    { name: "Asie & émergents", value: M(12650) },
  ]),
};

DB["BN"] = {
  product: b("2024", [
    { name: "Produits Laitiers & d'Origine Végétale", value: M(14020) },
    { name: "Nutrition Spécialisée", value: M(8630) },
    { name: "Eaux", value: M(4600) },
  ]),
  geo: b("2024", [
    { name: "Europe & CIS", value: M(9350) },
    { name: "Amérique du Nord", value: M(6950) },
    { name: "Chine, Asie du Nord & Océanie", value: M(4650) },
    { name: "Reste du monde", value: M(6300) },
  ]),
};

DB["EN"] = {
  product: b("2024", [
    { name: "Renewables", value: M(8900) },
    { name: "Networks", value: M(8700) },
    { name: "Energy Solutions", value: M(19700) },
    { name: "Flex Generation & Retail", value: M(40000) },
    { name: "Nuclear", value: M(15000) },
  ]),
  geo: b("2024", [
    { name: "France", value: M(42000) },
    { name: "Europe (hors France)", value: M(27000) },
    { name: "International", value: M(23300) },
  ]),
};

DB["VIV"] = {
  product: b("2024", [
    { name: "Canal+ Group", value: M(6300) },
    { name: "Havas", value: M(2870) },
    { name: "Prisma Media & Autres", value: M(900) },
  ]),
  geo: b("2024", [
    { name: "France", value: M(3870) },
    { name: "Europe (hors France)", value: M(2800) },
    { name: "Reste du monde", value: M(3400) },
  ]),
};

DB["ORA"] = {
  product: b("2024", [
    { name: "Mobile", value: M(18200) },
    { name: "Fixe (Internet & TV)", value: M(11300) },
    { name: "IT & Services d'intégration", value: M(4800) },
    { name: "Wholesale", value: M(3100) },
    { name: "Autres", value: M(5600) },
  ]),
  geo: b("2024", [
    { name: "France", value: M(18800) },
    { name: "Europe", value: M(11900) },
    { name: "Afrique & Moyen-Orient", value: M(7500) },
    { name: "Entreprises", value: M(4800) },
  ]),
};

// ═══════════════════════════════════════════
//  EUROPE — Autres majeurs
// ═══════════════════════════════════════════

DB["ASML"] = {
  product: b("2024", [
    { name: "Systèmes EUV", value: M(16800) },
    { name: "Systèmes DUV", value: M(6800) },
    { name: "Services & Installed Base", value: M(6200) },
  ]),
  geo: b("2024", [
    { name: "Taïwan", value: M(8900) },
    { name: "Corée du Sud", value: M(7400) },
    { name: "Chine", value: M(5200) },
    { name: "États-Unis", value: M(3400) },
    { name: "Reste du monde", value: M(4900) },
  ]),
};

DB["SAP"] = {
  product: b("2024", [
    { name: "Cloud", value: M(17100) },
    { name: "Licences logicielles", value: M(2800) },
    { name: "Support", value: M(11500) },
    { name: "Services", value: M(4000) },
  ]),
  geo: b("2024", [
    { name: "EMEA", value: M(14900) },
    { name: "Amériques", value: M(14800) },
    { name: "Asie-Pacifique Japon", value: M(5700) },
  ]),
};

DB["SIE"] = {
  product: b("2024", [
    { name: "Digital Industries", value: M(19200) },
    { name: "Smart Infrastructure", value: M(20900) },
    { name: "Mobility", value: M(11600) },
    { name: "Siemens Healthineers", value: M(22400) },
  ]),
  geo: b("2024", [
    { name: "Europe, CIS, Afrique", value: M(31600) },
    { name: "Amériques", value: M(22700) },
    { name: "Asie, Australie", value: M(19800) },
  ]),
};

DB["NESN"] = {
  product: b("2024", [
    { name: "Plats préparés & cuisine", value: M(14200) },
    { name: "Nutrition & Health Science", value: M(13400) },
    { name: "Boissons (Nespresso, eau)", value: M(10900) },
    { name: "Confiserie", value: M(8200) },
    { name: "Produits laitiers & Glaces", value: M(10100) },
    { name: "Purina PetCare", value: M(17400) },
    { name: "Café (Nescafé, Starbucks at Home)", value: M(12800) },
  ]),
  geo: b("2024", [
    { name: "Amériques", value: M(37100) },
    { name: "Europe, Moyen-Orient & Afrique", value: M(25200) },
    { name: "Asie, Océanie & Afrique sub.", value: M(24700) },
  ]),
};

DB["ROG"] = {
  product: b("2024", [
    { name: "Pharma", value: M(40600) },
    { name: "Diagnostics", value: M(14100) },
  ]),
  geo: b("2024", [
    { name: "États-Unis", value: M(21900) },
    { name: "Europe", value: M(12800) },
    { name: "Japon", value: M(4900) },
    { name: "International", value: M(15100) },
  ]),
};

DB["NOVN"] = {
  product: b("2024", [
    { name: "Innovative Medicines", value: M(42200) },
    { name: "Sandoz (Génériques) — spun off 2023", value: M(0) },
  ]),
  geo: b("2024", [
    { name: "États-Unis", value: M(21200) },
    { name: "Europe", value: M(9800) },
    { name: "Reste du monde", value: M(11200) },
  ]),
};
// Fix Novartis — single segment after Sandoz spin-off
DB["NOVN"].product = b("2024", [
  { name: "Cardio-rénal-métabolique", value: M(10200) },
  { name: "Immunologie", value: M(9500) },
  { name: "Neuroscience", value: M(6400) },
  { name: "Oncologie", value: M(12300) },
  { name: "Hématologie", value: M(3800) },
]);

DB["NOVO-B"] = {
  product: b("2024", [
    { name: "GLP-1 (Ozempic, Wegovy, Rybelsus)", value: M(28700) },
    { name: "Insulines", value: M(5300) },
    { name: "Autres Diabète & Obésité", value: M(2100) },
    { name: "Biopharm (Hémophilie, HGH)", value: M(3200) },
  ]),
  geo: b("2024", [
    { name: "Amérique du Nord", value: M(22800) },
    { name: "International Operations", value: M(10800) },
    { name: "Europe & International", value: M(5700) },
  ]),
};

DB["SHEL"] = {
  product: b("2024", [
    { name: "Integrated Gas", value: M(28100) },
    { name: "Upstream", value: M(14600) },
    { name: "Marketing", value: M(73200) },
    { name: "Chemicals & Products", value: M(176000) },
    { name: "Renewables & Energy Solutions", value: M(8700) },
  ]),
  geo: b("2024", [
    { name: "Europe", value: M(104000) },
    { name: "Asie, Océanie & Afrique", value: M(116000) },
    { name: "Amériques", value: M(80600) },
  ]),
};

DB["ULVR"] = {
  product: b("2024", [
    { name: "Beauty & Wellbeing", value: M(13400) },
    { name: "Personal Care", value: M(14200) },
    { name: "Home Care", value: M(12300) },
    { name: "Nutrition", value: M(13500) },
    { name: "Ice Cream", value: M(8100) },
  ]),
  geo: b("2024", [
    { name: "Asie-Pacifique & Afrique", value: M(22200) },
    { name: "Amériques", value: M(20800) },
    { name: "Europe", value: M(18500) },
  ]),
};

DB["AZN"] = {
  product: b("2024", [
    { name: "Oncologie", value: M(22600) },
    { name: "CardioVasculaire, Rénal & Métabolisme", value: M(10000) },
    { name: "Respiratoire & Immunologie", value: M(7500) },
    { name: "Vaccins & Thérapies Immunitaires", value: M(2300) },
    { name: "Maladies rares", value: M(7100) },
  ]),
  geo: b("2024", [
    { name: "États-Unis", value: M(18400) },
    { name: "Europe", value: M(9800) },
    { name: "Chine", value: M(5900) },
    { name: "Émergents", value: M(7700) },
    { name: "Reste du monde", value: M(7700) },
  ]),
};

DB["ALV"] = {
  product: b("2024", [
    { name: "Dommages & Biens", value: M(80800) },
    { name: "Vie & Santé", value: M(47400) },
    { name: "Gestion d'actifs (PIMCO, AllianzGI)", value: M(8700) },
  ]),
  geo: b("2024", [
    { name: "Allemagne", value: M(32200) },
    { name: "Europe (hors Allemagne)", value: M(42200) },
    { name: "Amériques", value: M(34200) },
    { name: "Asie-Pacifique", value: M(15800) },
    { name: "Reste du monde", value: M(12500) },
  ]),
};

DB["ADS"] = {
  product: b("2024", [
    { name: "Performance (Running, Training)", value: M(9800) },
    { name: "Lifestyle (Originals, Terrex)", value: M(7200) },
    { name: "Football", value: M(3000) },
    { name: "Autres catégories", value: M(3500) },
  ]),
  geo: b("2024", [
    { name: "EMEA", value: M(9000) },
    { name: "Amérique du Nord", value: M(6100) },
    { name: "Grande Chine", value: M(3700) },
    { name: "Asie-Pacifique", value: M(2900) },
    { name: "Amérique latine", value: M(1800) },
  ]),
};

// ═══════════════════════════════════════════
//  US — S&P 500 majeurs
// ═══════════════════════════════════════════

DB["AAPL"] = {
  product: b("2024", [
    { name: "iPhone", value: M(201183) },
    { name: "Services", value: M(96169) },
    { name: "Wearables & Accessoires", value: M(37005) },
    { name: "Mac", value: M(29984) },
    { name: "iPad", value: M(26694) },
  ]),
  geo: b("2024", [
    { name: "Amériques", value: M(167045) },
    { name: "Europe", value: M(101325) },
    { name: "Chine élargie", value: M(66955) },
    { name: "Reste Asie-Pacifique", value: M(30697) },
    { name: "Japon", value: M(25013) },
  ]),
};

DB["MSFT"] = {
  product: b("2024", [
    { name: "Intelligent Cloud", value: M(96832) },
    { name: "Productivity & Business", value: M(77215) },
    { name: "More Personal Computing", value: M(62475) },
  ]),
  geo: b("2024", [
    { name: "États-Unis", value: M(137474) },
    { name: "Autres pays", value: M(99048) },
  ]),
};

DB["GOOGL"] = {
  product: b("2024", [
    { name: "Google Search", value: M(198117) },
    { name: "Google Cloud", value: M(43232) },
    { name: "YouTube Ads", value: M(36147) },
    { name: "Abonnements & Devices", value: M(34688) },
    { name: "Google Network", value: M(30432) },
    { name: "Other Bets", value: M(1615) },
  ]),
  geo: b("2024", [
    { name: "États-Unis", value: M(178564) },
    { name: "EMEA", value: M(82487) },
    { name: "Asie-Pacifique", value: M(51514) },
    { name: "Autres Amériques", value: M(16434) },
  ]),
};
DB["GOOG"] = DB["GOOGL"];

DB["AMZN"] = {
  product: b("2024", [
    { name: "Online Stores", value: M(246979) },
    { name: "Services tiers", value: M(155612) },
    { name: "AWS", value: M(105222) },
    { name: "Publicité", value: M(56215) },
    { name: "Abonnements", value: M(43661) },
    { name: "Magasins physiques", value: M(21317) },
    { name: "Autres", value: M(5349) },
  ]),
  geo: b("2024", [
    { name: "États-Unis", value: M(387699) },
    { name: "International", value: M(142656) },
  ]),
};

DB["META"] = {
  product: b("2024", [
    { name: "Family of Apps", value: M(156225) },
    { name: "Reality Labs", value: M(2156) },
  ]),
  geo: b("2024", [
    { name: "États-Unis & Canada", value: M(64941) },
    { name: "Europe", value: M(39504) },
    { name: "Asie-Pacifique", value: M(33033) },
    { name: "Reste du monde", value: M(20903) },
  ]),
};

DB["TSLA"] = {
  product: b("2024", [
    { name: "Ventes automobiles", value: M(71462) },
    { name: "Énergie & Stockage", value: M(10382) },
    { name: "Services & Autres", value: M(10247) },
    { name: "Leasing automobile", value: M(2497) },
  ]),
  geo: b("2024", [
    { name: "États-Unis", value: M(45211) },
    { name: "Chine", value: M(21714) },
    { name: "Autres marchés", value: M(27663) },
  ]),
};

DB["NVDA"] = {
  product: b("2025", [
    { name: "Data Center", value: M(115199) },
    { name: "Gaming", value: M(11359) },
    { name: "Visualisation Pro", value: M(1946) },
    { name: "Automobile", value: M(1692) },
    { name: "OEM & Autres", value: M(668) },
  ]),
  geo: b("2025", [
    { name: "États-Unis", value: M(44346) },
    { name: "Taïwan", value: M(27212) },
    { name: "Singapour", value: M(22465) },
    { name: "Chine (incl. HK)", value: M(17105) },
    { name: "Autres pays", value: M(19736) },
  ]),
};

DB["NFLX"] = {
  product: b("2024", [
    { name: "Abonnements", value: M(33634) },
    { name: "Publicité", value: M(1827) },
  ]),
  geo: b("2024", [
    { name: "États-Unis & Canada", value: M(16240) },
    { name: "EMEA", value: M(11866) },
    { name: "Amérique latine", value: M(4808) },
    { name: "Asie-Pacifique", value: M(4547) },
  ]),
};

DB["JPM"] = {
  product: b("2024", [
    { name: "Consumer & Community Banking", value: M(72825) },
    { name: "Corporate & Investment Bank", value: M(56458) },
    { name: "Asset & Wealth Management", value: M(22139) },
    { name: "Commercial Banking", value: M(12046) },
  ]),
  geo: b("2024", [
    { name: "États-Unis", value: M(126684) },
    { name: "EMEA", value: M(21987) },
    { name: "Asie-Pacifique", value: M(11432) },
    { name: "Autres", value: M(3365) },
  ]),
};

DB["V"] = {
  product: b("2024", [
    { name: "Data processing revenues", value: M(17701) },
    { name: "Service revenues", value: M(16139) },
    { name: "International transactions", value: M(13228) },
    { name: "Other revenues", value: M(2818) },
  ]),
  geo: b("2024", [
    { name: "International", value: M(19425) },
    { name: "États-Unis", value: M(16362) },
  ]),
};

DB["DIS"] = {
  product: b("2024", [
    { name: "Entertainment", value: M(41184) },
    { name: "Experiences", value: M(34149) },
    { name: "Sports (ESPN)", value: M(16998) },
  ]),
  geo: b("2024", [
    { name: "Amérique du Nord", value: M(64735) },
    { name: "International", value: M(27596) },
  ]),
};

DB["KO"] = {
  product: b("2024", [
    { name: "Sparkling Flavors", value: M(14149) },
    { name: "Coca-Cola", value: M(11346) },
    { name: "Nutrition, Juice & Dairy", value: M(5361) },
    { name: "Water & Sports", value: M(4917) },
    { name: "Thé & Café", value: M(2316) },
  ]),
  geo: b("2024", [
    { name: "Amérique du Nord", value: M(16280) },
    { name: "Bottling Investments", value: M(10675) },
    { name: "EMEA", value: M(8034) },
    { name: "Asie-Pacifique", value: M(5680) },
    { name: "Amérique latine", value: M(5420) },
  ]),
};

DB["WMT"] = {
  product: b("2025", [
    { name: "Walmart US", value: M(462200) },
    { name: "Walmart International", value: M(121400) },
    { name: "Sam's Club", value: M(86600) },
  ]),
  geo: b("2025", [
    { name: "États-Unis", value: M(548800) },
    { name: "Mexique & Amérique centrale", value: M(43600) },
    { name: "Chine", value: M(17900) },
    { name: "Canada", value: M(24900) },
    { name: "Autres marchés", value: M(35000) },
  ]),
};

DB["PG"] = {
  product: b("2024", [
    { name: "Fabric & Home Care", value: M(29200) },
    { name: "Baby, Feminine & Family Care", value: M(20100) },
    { name: "Beauty", value: M(15700) },
    { name: "Health Care", value: M(11200) },
    { name: "Grooming", value: M(6800) },
  ]),
  geo: b("2024", [
    { name: "Amérique du Nord", value: M(42600) },
    { name: "Europe", value: M(14200) },
    { name: "Grande Chine", value: M(7700) },
    { name: "Asie-Pacifique, Moyen-Orient & Afrique", value: M(9800) },
    { name: "Amérique latine", value: M(8700) },
  ]),
};

DB["JNJ"] = {
  product: b("2024", [
    { name: "Innovative Medicine", value: M(55400) },
    { name: "MedTech", value: M(30400) },
  ]),
  geo: b("2024", [
    { name: "États-Unis", value: M(47500) },
    { name: "Europe", value: M(16100) },
    { name: "Asie-Pacifique & Afrique", value: M(13100) },
    { name: "Hémisphère Ouest (hors US)", value: M(9100) },
  ]),
};

DB["UNH"] = {
  product: b("2024", [
    { name: "UnitedHealthcare (Assurance)", value: M(281200) },
    { name: "Optum Health", value: M(100800) },
    { name: "Optum Rx", value: M(128700) },
    { name: "Optum Insight", value: M(19600) },
  ]),
  geo: b("2024", [
    { name: "États-Unis", value: M(356000) },
    { name: "International", value: M(15500) },
  ]),
};

DB["LLY"] = {
  product: b("2024", [
    { name: "Mounjaro / Zepbound (GLP-1)", value: M(18200) },
    { name: "Verzenio (Oncologie)", value: M(4600) },
    { name: "Humalog / Insulin portfolio", value: M(3100) },
    { name: "Taltz", value: M(2900) },
    { name: "Jardiance", value: M(2400) },
    { name: "Autres produits", value: M(14000) },
  ]),
  geo: b("2024", [
    { name: "États-Unis", value: M(28100) },
    { name: "Europe", value: M(6400) },
    { name: "Japon", value: M(2800) },
    { name: "Chine", value: M(2100) },
    { name: "Reste du monde", value: M(5800) },
  ]),
};

DB["AVGO"] = {
  product: b("2024", [
    { name: "Semiconductor Solutions", value: M(30100) },
    { name: "Infrastructure Software", value: M(21500) },
  ]),
  geo: b("2024", [
    { name: "Amériques", value: M(21700) },
    { name: "Asie-Pacifique", value: M(22400) },
    { name: "Europe, Moyen-Orient & Afrique", value: M(7500) },
  ]),
};

DB["AMD"] = {
  product: b("2024", [
    { name: "Data Center", value: M(12575) },
    { name: "Client (PC)", value: M(6878) },
    { name: "Gaming", value: M(1542) },
    { name: "Embedded", value: M(3651) },
  ]),
  geo: b("2024", [
    { name: "États-Unis", value: M(8400) },
    { name: "Chine", value: M(3100) },
    { name: "Taïwan", value: M(3800) },
    { name: "Europe", value: M(4300) },
    { name: "Autres", value: M(5046) },
  ]),
};

DB["CRM"] = {
  product: b("2025", [
    { name: "Subscription & Support", value: M(34060) },
    { name: "Professional Services", value: M(1860) },
  ]),
  geo: b("2025", [
    { name: "Amériques", value: M(24300) },
    { name: "Europe", value: M(8200) },
    { name: "Asie-Pacifique", value: M(3420) },
  ]),
};

DB["ORCL"] = {
  product: b("2024", [
    { name: "Cloud Services & License Support", value: M(39400) },
    { name: "Cloud Infrastructure (OCI)", value: M(7400) },
    { name: "Hardware", value: M(3400) },
    { name: "Services", value: M(5300) },
  ]),
  geo: b("2024", [
    { name: "Amériques", value: M(29200) },
    { name: "EMEA", value: M(14200) },
    { name: "Asie-Pacifique", value: M(9100) },
  ]),
};

DB["CSCO"] = {
  product: b("2024", [
    { name: "Networking (Secure, Agile)", value: M(24200) },
    { name: "Security", value: M(4500) },
    { name: "Collaboration", value: M(4100) },
    { name: "Observability", value: M(1600) },
    { name: "Services", value: M(14000) },
  ]),
  geo: b("2024", [
    { name: "Amériques", value: M(30100) },
    { name: "EMEA", value: M(12700) },
    { name: "Asie-Pacifique, Japon & Chine", value: M(5600) },
  ]),
};

DB["ADBE"] = {
  product: b("2024", [
    { name: "Digital Media (Creative Cloud + Document Cloud)", value: M(15100) },
    { name: "Digital Experience", value: M(5000) },
    { name: "Publishing & Autres", value: M(300) },
  ]),
  geo: b("2024", [
    { name: "Amériques", value: M(12200) },
    { name: "EMEA", value: M(5000) },
    { name: "Asie-Pacifique", value: M(3200) },
  ]),
};

DB["NKE"] = {
  product: b("2024", [
    { name: "Chaussures", value: M(33400) },
    { name: "Vêtements", value: M(13700) },
    { name: "Équipement", value: M(2100) },
    { name: "Converse", value: M(2100) },
  ]),
  geo: b("2024", [
    { name: "Amérique du Nord", value: M(21500) },
    { name: "EMEA", value: M(13300) },
    { name: "Grande Chine", value: M(7500) },
    { name: "Asie-Pacifique & Amérique latine", value: M(6400) },
    { name: "Global Brand Divisions", value: M(2600) },
  ]),
};

DB["PEP"] = {
  product: b("2024", [
    { name: "Frito-Lay North America", value: M(23382) },
    { name: "PepsiCo Beverages NA", value: M(27704) },
    { name: "Quaker Foods NA", value: M(2614) },
    { name: "International Beverages", value: M(8410) },
    { name: "International Foods", value: M(29440) },
  ]),
  geo: b("2024", [
    { name: "Amérique du Nord", value: M(53700) },
    { name: "International", value: M(37850) },
  ]),
};

DB["COST"] = {
  product: b("2024", [
    { name: "Ventes nettes", value: M(249000) },
    { name: "Cotisations membres", value: M(4800) },
  ]),
  geo: b("2024", [
    { name: "États-Unis", value: M(192500) },
    { name: "Canada", value: M(28100) },
    { name: "Autres marchés", value: M(33200) },
  ]),
};

DB["BA"] = {
  product: b("2024", [
    { name: "Commercial Airplanes", value: M(24900) },
    { name: "Defense, Space & Security", value: M(24300) },
    { name: "Global Services", value: M(20100) },
  ]),
  geo: b("2024", [
    { name: "États-Unis", value: M(37900) },
    { name: "Europe", value: M(7700) },
    { name: "Asie", value: M(9500) },
    { name: "Moyen-Orient", value: M(7600) },
    { name: "Reste du monde", value: M(6600) },
  ]),
};

DB["GS"] = {
  product: b("2024", [
    { name: "Global Banking & Markets", value: M(34500) },
    { name: "Asset & Wealth Management", value: M(16700) },
    { name: "Platform Solutions", value: M(2000) },
  ]),
  geo: b("2024", [
    { name: "Amériques", value: M(31200) },
    { name: "EMEA", value: M(11600) },
    { name: "Asie", value: M(10400) },
  ]),
};

DB["MS"] = {
  product: b("2024", [
    { name: "Institutional Securities", value: M(28200) },
    { name: "Wealth Management", value: M(28400) },
    { name: "Investment Management", value: M(5700) },
  ]),
  geo: b("2024", [
    { name: "Amériques", value: M(42600) },
    { name: "EMEA", value: M(11200) },
    { name: "Asie", value: M(8500) },
  ]),
};

DB["INTC"] = {
  product: b("2024", [
    { name: "Client Computing Group", value: M(29300) },
    { name: "Data Center & AI", value: M(12800) },
    { name: "Network & Edge", value: M(5800) },
    { name: "Mobileye", value: M(1800) },
    { name: "Intel Foundry Services", value: M(900) },
    { name: "Programmable Solutions (Altera)", value: M(1500) },
  ]),
  geo: b("2024", [
    { name: "Chine (incl. HK)", value: M(14800) },
    { name: "États-Unis", value: M(13600) },
    { name: "Singapour", value: M(10200) },
    { name: "Taïwan", value: M(7400) },
    { name: "Reste du monde", value: M(8100) },
  ]),
};

DB["QCOM"] = {
  product: b("2024", [
    { name: "QCT (Chipsets)", value: M(38570) },
    { name: "QTL (Licences)", value: M(5600) },
  ]),
  geo: b("2024", [
    { name: "Chine", value: M(16700) },
    { name: "Corée du Sud", value: M(5100) },
    { name: "Reste d'Asie-Pacifique", value: M(6800) },
    { name: "Amériques & Europe", value: M(15570) },
  ]),
};

DB["UBER"] = {
  product: b("2024", [
    { name: "Mobility (Rides)", value: M(28100) },
    { name: "Delivery (Uber Eats)", value: M(13700) },
    { name: "Freight", value: M(5100) },
  ]),
  geo: b("2024", [
    { name: "États-Unis & Canada", value: M(25200) },
    { name: "International", value: M(21700) },
  ]),
};

DB["PYPL"] = {
  product: b("2024", [
    { name: "Transaction revenues", value: M(27100) },
    { name: "Other value added services", value: M(4700) },
  ]),
  geo: b("2024", [
    { name: "États-Unis", value: M(16600) },
    { name: "International", value: M(15200) },
  ]),
};

DB["SBUX"] = {
  product: b("2024", [
    { name: "Boissons", value: M(25400) },
    { name: "Alimentation", value: M(5900) },
    { name: "Autres (Merch, Packaged)", value: M(5100) },
  ]),
  geo: b("2024", [
    { name: "Amérique du Nord", value: M(27000) },
    { name: "International", value: M(7600) },
    { name: "Channel Development", value: M(1800) },
  ]),
};

DB["ABNB"] = {
  product: b("2024", [
    { name: "Séjours", value: M(8900) },
    { name: "Expériences & Autres", value: M(1100) },
  ]),
  geo: b("2024", [
    { name: "Amérique du Nord", value: M(5200) },
    { name: "Europe", value: M(3200) },
    { name: "Reste du monde", value: M(1600) },
  ]),
};

DB["XOM"] = {
  product: b("2024", [
    { name: "Upstream (E&P)", value: M(29200) },
    { name: "Energy Products (Raffinage)", value: M(249500) },
    { name: "Chemical Products", value: M(30100) },
    { name: "Specialty Products", value: M(27600) },
  ]),
  geo: b("2024", [
    { name: "États-Unis", value: M(175000) },
    { name: "Non-US", value: M(161400) },
  ]),
};

DB["CVX"] = {
  product: b("2024", [
    { name: "Upstream", value: M(22700) },
    { name: "Downstream (Raffinage & Marketing)", value: M(168500) },
    { name: "All Other", value: M(5800) },
  ]),
  geo: b("2024", [
    { name: "États-Unis", value: M(115000) },
    { name: "International", value: M(82000) },
  ]),
};

DB["ABT"] = {
  product: b("2024", [
    { name: "Medical Devices", value: M(17800) },
    { name: "Diagnostics", value: M(8300) },
    { name: "Nutrition", value: M(8400) },
    { name: "Established Pharmaceuticals", value: M(5300) },
  ]),
  geo: b("2024", [
    { name: "États-Unis", value: M(18200) },
    { name: "International", value: M(21600) },
  ]),
};

DB["MRK"] = {
  product: b("2024", [
    { name: "Keytruda (Oncologie)", value: M(25000) },
    { name: "Gardasil (Vaccin HPV)", value: M(6300) },
    { name: "Januvia/Janumet (Diabète)", value: M(2200) },
    { name: "Lynparza", value: M(2300) },
    { name: "Lenvima", value: M(1700) },
    { name: "Animal Health", value: M(5700) },
    { name: "Autres produits pharma", value: M(17400) },
  ]),
  geo: b("2024", [
    { name: "États-Unis", value: M(29400) },
    { name: "EMEA", value: M(12600) },
    { name: "Chine", value: M(5500) },
    { name: "Reste du monde", value: M(13100) },
  ]),
};

DB["PFE"] = {
  product: b("2024", [
    { name: "Oncologie", value: M(11500) },
    { name: "Vaccins (hors COVID)", value: M(7200) },
    { name: "COVID (Paxlovid + Comirnaty)", value: M(8300) },
    { name: "Médecine interne", value: M(7100) },
    { name: "Hôpital", value: M(6200) },
    { name: "Autres (Immunologie, Maladies rares)", value: M(8300) },
  ]),
  geo: b("2024", [
    { name: "États-Unis", value: M(27800) },
    { name: "International", value: M(30800) },
  ]),
};

DB["ABBV"] = {
  product: b("2024", [
    { name: "Immunologie (Skyrizi, Rinvoq, Humira)", value: M(26500) },
    { name: "Oncologie", value: M(6300) },
    { name: "Neuroscience (Botox, Vraylar)", value: M(10200) },
    { name: "Esthétique", value: M(5300) },
    { name: "Autres", value: M(8000) },
  ]),
  geo: b("2024", [
    { name: "États-Unis", value: M(41800) },
    { name: "International", value: M(14500) },
  ]),
};

DB["GE"] = {
  product: b("2024", [
    { name: "GE Aerospace — Propulsion commerciale", value: M(22300) },
    { name: "GE Aerospace — Défense", value: M(7700) },
    { name: "GE Aerospace — Services", value: M(8600) },
  ]),
  geo: b("2024", [
    { name: "États-Unis", value: M(18900) },
    { name: "Europe", value: M(7600) },
    { name: "Asie", value: M(6300) },
    { name: "Reste du monde", value: M(5800) },
  ]),
};

DB["CAT"] = {
  product: b("2024", [
    { name: "Construction Industries", value: M(23600) },
    { name: "Resource Industries", value: M(12900) },
    { name: "Energy & Transportation", value: M(28300) },
    { name: "Financial Products", value: M(3800) },
  ]),
  geo: b("2024", [
    { name: "Amérique du Nord", value: M(35800) },
    { name: "Amérique latine", value: M(7100) },
    { name: "EAME", value: M(12800) },
    { name: "Asie-Pacifique", value: M(12900) },
  ]),
};

DB["HD"] = {
  product: b("2024", [
    { name: "Décoration & Rangement", value: M(24500) },
    { name: "Matériaux de construction", value: M(22300) },
    { name: "Plomberie & Électricité", value: M(20400) },
    { name: "Jardinage & Extérieur", value: M(18700) },
    { name: "Outils & Quincaillerie", value: M(17500) },
    { name: "Peintures & Revêtements", value: M(14200) },
    { name: "Appareils & Pro SRS", value: M(38900) },
  ]),
  geo: b("2024", [
    { name: "États-Unis", value: M(140500) },
    { name: "Canada", value: M(9200) },
    { name: "Mexique", value: M(6800) },
  ]),
};

DB["IBM"] = {
  product: b("2024", [
    { name: "Software", value: M(26300) },
    { name: "Consulting", value: M(20200) },
    { name: "Infrastructure", value: M(14400) },
  ]),
  geo: b("2024", [
    { name: "Amériques", value: M(29300) },
    { name: "Europe, Moyen-Orient & Afrique", value: M(20100) },
    { name: "Asie-Pacifique", value: M(11500) },
  ]),
};

DB["MA"] = {
  product: b("2024", [
    { name: "Payment Network", value: M(14600) },
    { name: "Value-Added Services & Solutions", value: M(12900) },
  ]),
  geo: b("2024", [
    { name: "International", value: M(17700) },
    { name: "États-Unis", value: M(9800) },
  ]),
};

DB["T"] = {
  product: b("2024", [
    { name: "Mobility (Sans-fil)", value: M(84200) },
    { name: "Consumer Wireline (Fibre, DSL)", value: M(13200) },
    { name: "Business Wireline", value: M(17600) },
    { name: "Latin America", value: M(5700) },
  ]),
  geo: b("2024", [
    { name: "États-Unis", value: M(115000) },
    { name: "Mexique", value: M(4200) },
    { name: "Autres", value: M(1500) },
  ]),
};

DB["VZ"] = {
  product: b("2024", [
    { name: "Wireless (Consumer)", value: M(78200) },
    { name: "Fios & Broadband", value: M(12600) },
    { name: "Business", value: M(29800) },
    { name: "Autres", value: M(13100) },
  ]),
  geo: b("2024", [
    { name: "États-Unis", value: M(131700) },
    { name: "International", value: M(2000) },
  ]),
};

DB["COIN"] = {
  product: b("2024", [
    { name: "Transaction revenues", value: M(3700) },
    { name: "Subscription & Services", value: M(2400) },
    { name: "Autres", value: M(500) },
  ]),
  geo: b("2024", [
    { name: "États-Unis", value: M(5100) },
    { name: "International", value: M(1500) },
  ]),
};

DB["PLTR"] = {
  product: b("2024", [
    { name: "Government", value: M(1560) },
    { name: "Commercial", value: M(1240) },
  ]),
  geo: b("2024", [
    { name: "États-Unis", value: M(1960) },
    { name: "International", value: M(840) },
  ]),
};

DB["CRWD"] = {
  product: b("2025", [
    { name: "Subscription", value: M(3440) },
    { name: "Professional Services", value: M(200) },
  ]),
  geo: b("2025", [
    { name: "États-Unis", value: M(2550) },
    { name: "International", value: M(1090) },
  ]),
};

DB["SNOW"] = {
  product: b("2025", [
    { name: "Product revenue", value: M(3250) },
    { name: "Professional Services & Autres", value: M(290) },
  ]),
  geo: b("2025", [
    { name: "Amériques", value: M(2500) },
    { name: "EMEA", value: M(650) },
    { name: "Asie-Pacifique", value: M(390) },
  ]),
};

DB["PANW"] = {
  product: b("2024", [
    { name: "Subscription & Support", value: M(6900) },
    { name: "Product revenue", value: M(1200) },
  ]),
  geo: b("2024", [
    { name: "Amériques", value: M(5600) },
    { name: "EMEA", value: M(1600) },
    { name: "Asie-Pacifique & Japon", value: M(900) },
  ]),
};

DB["NOW"] = {
  product: b("2024", [
    { name: "Subscription", value: M(9950) },
    { name: "Professional Services & Autres", value: M(650) },
  ]),
  geo: b("2024", [
    { name: "Amérique du Nord", value: M(6800) },
    { name: "EMEA & Reste du monde", value: M(3800) },
  ]),
};

DB["NET"] = {
  product: b("2024", [
    { name: "Subscription & Usage", value: M(1660) },
    { name: "Pay-as-you-go", value: M(200) },
  ]),
  geo: b("2024", [
    { name: "États-Unis", value: M(930) },
    { name: "EMEA", value: M(530) },
    { name: "Asie-Pacifique", value: M(250) },
    { name: "Autres", value: M(150) },
  ]),
};

// ═══════════════════════════════════════════
//  UK — Majeurs FTSE
// ═══════════════════════════════════════════

DB["GSK"] = {
  product: b("2024", [
    { name: "Vaccins", value: M(10800) },
    { name: "Specialty Medicines", value: M(11600) },
    { name: "General Medicines", value: M(9000) },
    { name: "HIV (ViiV)", value: M(6400) },
  ]),
  geo: b("2024", [
    { name: "États-Unis", value: M(17900) },
    { name: "Europe", value: M(9200) },
    { name: "International", value: M(10700) },
  ]),
};

DB["HSBA"] = {
  product: b("2024", [
    { name: "Wealth & Personal Banking", value: M(21400) },
    { name: "Commercial Banking", value: M(17600) },
    { name: "Global Banking & Markets", value: M(18900) },
  ]),
  geo: b("2024", [
    { name: "Asie", value: M(26200) },
    { name: "Europe", value: M(13900) },
    { name: "Moyen-Orient & Afrique du Nord", value: M(4200) },
    { name: "Amérique du Nord", value: M(5300) },
    { name: "Amérique latine", value: M(8300) },
  ]),
};

DB["BP"] = {
  product: b("2024", [
    { name: "Gas & Low Carbon Energy", value: M(23800) },
    { name: "Oil Production & Operations", value: M(19600) },
    { name: "Customers & Products (Trading)", value: M(157000) },
  ]),
  geo: b("2024", [
    { name: "États-Unis", value: M(86800) },
    { name: "UK", value: M(26600) },
    { name: "Reste de l'Europe", value: M(40800) },
    { name: "Reste du monde", value: M(46200) },
  ]),
};

// ═══════════════════════════════════════════
//  Aliases for common ticker suffixes
// ═══════════════════════════════════════════

// Paris (.PA)
DB["RMS.PA"] = DB["RMS"]; // Hermès
DB["MC.PA"] = DB["MC"];   // LVMH
DB["OR.PA"] = DB["OR"];   // L'Oréal
DB["TTE.PA"] = DB["TTE"]; // TotalEnergies
DB["SAN.PA"] = DB["SAN"]; // Sanofi
DB["AIR.PA"] = DB["AIR"]; // Airbus
DB["BNP.PA"] = DB["BNP"]; // BNP Paribas
DB["SU.PA"] = DB["SU"];   // Schneider Electric
DB["AI.PA"] = DB["AI"];   // Air Liquide
DB["SAF.PA"] = DB["SAF"]; // Safran
DB["CS.PA"] = DB["CS"];   // AXA
DB["CAP.PA"] = DB["CAP"]; // Capgemini
DB["DSY.PA"] = DB["DSY"]; // Dassault Systèmes
DB["RI.PA"] = DB["RI"];   // Pernod Ricard
DB["EL.PA"] = DB["EL"];   // EssilorLuxottica
DB["KER.PA"] = DB["KER"]; // Kering
DB["SGO.PA"] = DB["SGO"]; // Saint-Gobain
DB["BN.PA"] = DB["BN"];   // Danone
DB["EN.PA"] = DB["EN"];   // Engie
DB["VIV.PA"] = DB["VIV"]; // Vivendi
DB["ORA.PA"] = DB["ORA"]; // Orange

// Stellantis
DB["STLA"] = DB["STLAP"];
DB["STLA.MI"] = DB["STLAP"];
DB["STLAM"] = DB["STLAP"];
DB["STLAM.MI"] = DB["STLAP"];

// Amsterdam
DB["ASML.AS"] = DB["ASML"];

// Frankfurt
DB["SIE.DE"] = DB["SIE"];
DB["ALV.DE"] = DB["ALV"];
DB["ADS.DE"] = DB["ADS"];
DB["SAP.DE"] = DB["SAP"];

// Zurich
DB["NESN.SW"] = DB["NESN"];
DB["NESN"] = DB["NESN"];
DB["ROG.SW"] = DB["ROG"];
DB["NOVN.SW"] = DB["NOVN"];

// Copenhagen
DB["NOVO-B.CO"] = DB["NOVO-B"];
DB["NVO"] = DB["NOVO-B"]; // ADR

// London
DB["SHEL.L"] = DB["SHEL"];
DB["ULVR.L"] = DB["ULVR"];
DB["AZN.L"] = DB["AZN"];
DB["GSK.L"] = DB["GSK"];
DB["HSBA.L"] = DB["HSBA"];
DB["HSBC"] = DB["HSBA"]; // ADR
DB["BP.L"] = DB["BP"];

// US Alias
DB["GOOG"] = DB["GOOGL"];

export default DB;
