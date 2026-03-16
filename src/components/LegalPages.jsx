export function MentionsLegales({ onBack }) {
  return (
    <div className="legal-page">
      <button className="legal-back" onClick={onBack}>← Retour</button>
      <h1>Mentions Légales</h1>

      <section>
        <h2>1. Éditeur du site</h2>
        <p>
          Le site <strong>Alphaview</strong> est un projet personnel à vocation éducative.<br />
          Responsable de la publication : Alphaview<br />
          Contact : via le site
        </p>
      </section>

      <section>
        <h2>2. Hébergement</h2>
        <p>
          Le site est hébergé par des services d'hébergement web tiers. Les données financières sont fournies par Yahoo Finance et Financial Modeling Prep (FMP) via leurs API publiques.
        </p>
      </section>

      <section>
        <h2>3. Propriété intellectuelle</h2>
        <p>
          L'ensemble des contenus présents sur le site (textes, code source, design, logos) sont la propriété de l'éditeur, sauf mention contraire. Les données financières affichées proviennent de sources tierces (Yahoo Finance, Financial Modeling Prep) et restent la propriété de leurs fournisseurs respectifs.
        </p>
      </section>

      <section>
        <h2>4. Limitation de responsabilité</h2>
        <p>
          Les informations fournies sur Alphaview le sont à titre purement informatif et éducatif. Elles ne constituent en aucun cas un conseil en investissement, une recommandation d'achat ou de vente de titres financiers, ni une incitation à réaliser des opérations boursières.
        </p>
        <p>
          L'éditeur ne saurait être tenu responsable des décisions d'investissement prises sur la base des informations disponibles sur ce site, ni des éventuelles pertes financières qui pourraient en résulter.
        </p>
      </section>

      <section>
        <h2>5. Données financières</h2>
        <p>
          Les données affichées peuvent comporter des retards, des inexactitudes ou des erreurs. L'éditeur ne garantit ni l'exactitude, ni l'exhaustivité, ni l'actualité des données financières présentées. Il est recommandé de vérifier toute information auprès de sources officielles avant toute prise de décision.
        </p>
      </section>

      <section>
        <h2>6. Liens externes</h2>
        <p>
          Le site peut contenir des liens vers des sites tiers. L'éditeur n'exerce aucun contrôle sur ces sites et décline toute responsabilité quant à leur contenu.
        </p>
      </section>
    </div>
  );
}

export function PolitiqueConfidentialite({ onBack }) {
  return (
    <div className="legal-page">
      <button className="legal-back" onClick={onBack}>← Retour</button>
      <h1>Politique de Confidentialité</h1>

      <p className="legal-updated">Dernière mise à jour : mars 2026</p>

      <section>
        <h2>1. Introduction</h2>
        <p>
          Alphaview s'engage à protéger la vie privée de ses utilisateurs. Cette politique de confidentialité décrit les informations que nous collectons et comment nous les utilisons.
        </p>
      </section>

      <section>
        <h2>2. Données collectées</h2>
        <p>Alphaview collecte les données suivantes :</p>
        <ul>
          <li><strong>Données de compte</strong> : lors de la création d'un compte, nous collectons votre adresse email, un pseudonyme et un mot de passe (stocké sous forme de hash cryptographique SHA-256).</li>
          <li><strong>Données de préférences</strong> : votre watchlist (liste de favoris), vos alertes de moyennes mobiles et vos préférences d'affichage (mode sombre/clair).</li>
          <li><strong>Clé API FMP</strong> : si vous fournissez une clé API Financial Modeling Prep, celle-ci est stockée localement.</li>
        </ul>
      </section>

      <section>
        <h2>3. Stockage des données</h2>
        <p>
          <strong>Toutes les données sont stockées exclusivement dans le navigateur de l'utilisateur</strong> (localStorage). Aucune donnée personnelle n'est transmise à nos serveurs ni à des tiers. Vous pouvez supprimer l'ensemble de vos données à tout moment en effaçant les données de navigation de votre navigateur.
        </p>
      </section>

      <section>
        <h2>4. Cookies</h2>
        <p>
          Alphaview n'utilise pas de cookies. Les préférences utilisateur sont stockées via le mécanisme localStorage du navigateur, qui n'est pas un cookie au sens de la réglementation.
        </p>
      </section>

      <section>
        <h2>5. Services tiers</h2>
        <p>Le site fait appel aux services tiers suivants pour obtenir les données financières :</p>
        <ul>
          <li><strong>Yahoo Finance API</strong> : pour les cours en temps réel et les données financières historiques.</li>
          <li><strong>Financial Modeling Prep (FMP)</strong> : pour les données financières détaillées (optionnel, nécessite une clé API fournie par l'utilisateur).</li>
          <li><strong>Cloudflare Workers</strong> : comme proxy technique pour contourner les restrictions CORS.</li>
        </ul>
        <p>
          Ces services peuvent collecter des données techniques (adresse IP, etc.) conformément à leurs propres politiques de confidentialité.
        </p>
      </section>

      <section>
        <h2>6. Sécurité</h2>
        <p>
          Les mots de passe sont hachés avec l'algorithme SHA-256 avant stockage. Aucune donnée n'est transmise en clair sur le réseau (les communications sont chiffrées via HTTPS). Cependant, le stockage localStorage n'offre pas le même niveau de sécurité qu'un système d'authentification serveur.
        </p>
      </section>

      <section>
        <h2>7. Droits des utilisateurs</h2>
        <p>Conformément au RGPD, vous disposez des droits suivants :</p>
        <ul>
          <li><strong>Droit d'accès</strong> : vous pouvez consulter vos données directement dans les outils de développement de votre navigateur (Application → localStorage).</li>
          <li><strong>Droit de suppression</strong> : vous pouvez supprimer l'intégralité de vos données en effaçant le localStorage de votre navigateur.</li>
          <li><strong>Droit de portabilité</strong> : les données étant en JSON dans votre navigateur, vous pouvez les exporter à tout moment.</li>
        </ul>
      </section>

      <section>
        <h2>8. Modifications</h2>
        <p>
          Cette politique de confidentialité peut être modifiée à tout moment. Les utilisateurs sont invités à la consulter régulièrement.
        </p>
      </section>
    </div>
  );
}

export function CGU({ onBack }) {
  return (
    <div className="legal-page">
      <button className="legal-back" onClick={onBack}>← Retour</button>
      <h1>Conditions Générales d'Utilisation</h1>

      <p className="legal-updated">Dernière mise à jour : mars 2026</p>

      <section>
        <h2>1. Objet</h2>
        <p>
          Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation du site Alphaview. En utilisant le site, vous acceptez sans réserve les présentes CGU.
        </p>
      </section>

      <section>
        <h2>2. Description du service</h2>
        <p>
          Alphaview est une plateforme web gratuite permettant de consulter et d'analyser des données financières publiques. Le service propose notamment :
        </p>
        <ul>
          <li>La consultation de cours boursiers en temps réel</li>
          <li>L'analyse de ratios financiers</li>
          <li>La visualisation de bilans, résultats et trésorerie</li>
          <li>La comparaison d'actions</li>
          <li>La création d'une watchlist personnelle</li>
          <li>Des alertes sur les moyennes mobiles</li>
          <li>Le suivi des portefeuilles de grands investisseurs</li>
        </ul>
      </section>

      <section>
        <h2>3. Accès au service</h2>
        <p>
          L'accès au site est gratuit et ouvert à toute personne disposant d'un accès à Internet. Certaines fonctionnalités (watchlist, alertes) nécessitent la création d'un compte. L'éditeur se réserve le droit de suspendre ou d'interrompre le service à tout moment sans préavis.
        </p>
      </section>

      <section>
        <h2>4. Compte utilisateur</h2>
        <p>
          L'utilisateur est responsable de la confidentialité de son mot de passe et de toute activité effectuée sous son compte. Les données de compte sont stockées localement dans le navigateur ; l'éditeur ne peut pas récupérer un mot de passe oublié.
        </p>
      </section>

      <section>
        <h2>5. Utilisation autorisée</h2>
        <p>L'utilisateur s'engage à utiliser le site de manière conforme aux lois en vigueur. Il est interdit de :</p>
        <ul>
          <li>Utiliser le site à des fins de manipulation de marché</li>
          <li>Reproduire ou redistribuer les données financières à des fins commerciales</li>
          <li>Tenter de contourner les mesures de sécurité du site</li>
          <li>Surcharger les serveurs par des requêtes automatisées excessives</li>
        </ul>
      </section>

      <section>
        <h2>6. Avertissement financier</h2>
        <p>
          <strong>Alphaview ne fournit aucun conseil en investissement.</strong> Les informations présentées sont à titre éducatif uniquement. Les performances passées ne préjugent pas des performances futures. Tout investissement comporte des risques de perte en capital. L'utilisateur est seul responsable de ses décisions d'investissement.
        </p>
      </section>

      <section>
        <h2>7. Fiabilité des données</h2>
        <p>
          Les données financières proviennent de sources tierces (Yahoo Finance, Financial Modeling Prep). L'éditeur ne garantit pas leur exactitude, leur exhaustivité ni leur disponibilité en continu. Des retards, erreurs ou interruptions peuvent survenir.
        </p>
      </section>

      <section>
        <h2>8. Responsabilité</h2>
        <p>
          L'éditeur décline toute responsabilité en cas de dommages directs ou indirects résultant de l'utilisation du site, notamment les pertes financières liées à des décisions d'investissement, les interruptions de service ou les erreurs dans les données affichées.
        </p>
      </section>

      <section>
        <h2>9. Modification des CGU</h2>
        <p>
          L'éditeur se réserve le droit de modifier les présentes CGU à tout moment. Les modifications prennent effet dès leur publication sur le site. L'utilisation continue du site vaut acceptation des CGU modifiées.
        </p>
      </section>

      <section>
        <h2>10. Droit applicable</h2>
        <p>
          Les présentes CGU sont régies par le droit français. Tout litige relatif à l'utilisation du site sera soumis aux tribunaux compétents.
        </p>
      </section>
    </div>
  );
}

export function CGV({ onBack }) {
  return (
    <div className="legal-page">
      <button className="legal-back" onClick={onBack}>← Retour</button>
      <h1>Conditions Générales de Vente</h1>

      <p className="legal-updated">Dernière mise à jour : mars 2026</p>

      <section>
        <h2>1. Objet</h2>
        <p>
          Les présentes Conditions Générales de Vente (CGV) régissent les éventuelles transactions commerciales liées à l'utilisation du site Alphaview.
        </p>
      </section>

      <section>
        <h2>2. Gratuité du service</h2>
        <p>
          <strong>Alphaview est un service entièrement gratuit.</strong> L'ensemble des fonctionnalités du site (consultation de données, analyse financière, watchlist, alertes, comparaison) sont accessibles sans aucun paiement.
        </p>
      </section>

      <section>
        <h2>3. Absence de transaction commerciale</h2>
        <p>
          Le site ne propose aucun produit ni service payant. Aucune transaction financière n'est effectuée via le site. Alphaview ne vend pas de données, d'abonnements ni de services premium.
        </p>
      </section>

      <section>
        <h2>4. Services tiers</h2>
        <p>
          Certaines fonctionnalités avancées nécessitent une clé API Financial Modeling Prep (FMP) que l'utilisateur obtient directement auprès de FMP. Cette relation commerciale éventuelle est strictement entre l'utilisateur et FMP ; Alphaview n'est pas partie prenante.
        </p>
      </section>

      <section>
        <h2>5. Évolution du modèle</h2>
        <p>
          L'éditeur se réserve le droit d'introduire à l'avenir des fonctionnalités payantes. Le cas échéant, les présentes CGV seront mises à jour et les utilisateurs en seront informés. Toute souscription à un service payant nécessitera un consentement explicite de l'utilisateur.
        </p>
      </section>

      <section>
        <h2>6. Droit de rétractation</h2>
        <p>
          En l'absence de toute transaction commerciale, le droit de rétractation prévu par le Code de la consommation ne trouve pas à s'appliquer. Si des services payants venaient à être proposés, un droit de rétractation de 14 jours serait applicable conformément à la législation en vigueur.
        </p>
      </section>

      <section>
        <h2>7. Droit applicable</h2>
        <p>
          Les présentes CGV sont régies par le droit français. En cas de litige, les parties s'efforceront de trouver une solution amiable avant de saisir les tribunaux compétents.
        </p>
      </section>
    </div>
  );
}
