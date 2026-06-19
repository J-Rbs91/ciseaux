# KuT

Outil open source pour salons de coiffure — CRM clients, programme de fidélité, clôture de caisse, campagnes email.

**Démo live :** https://j-rbs91.github.io/ciseaux/

## Fonctionnalités

- **👥 Clients** — fichier clients avec nom, téléphone, email, notes et consentement offres & promotions
- **⭐ Fidélité** — programme **entièrement configurable** : compteurs **points et/ou visites** (nom, unité, gains au passage à valeur fixe ou **par €**, à la vente, ou ajustements manuels), **paliers de récompense** paramétrables (seuil, type, comportement après usage) et **journal des mouvements** par client ; **enregistrement d'un passage** en cochant les prestations payées (le tarif alimente le panier moyen)
- **✂️ Prestations & tarifs** — catalogue de prestations (nom + tarif) géré depuis la **page dédiée Prestations** du hub, utilisé pour cocher les passages et calculer les stats
- **📊 Statistiques** — tableau de bord calculé à partir des passages : **chiffre d'affaires, panier moyen, nombre de passages et clients servis** (par mois en cours, mois précédent, 12 mois glissants ou tout l'historique), **évolution du CA sur 12 mois**, **prestations les plus rentables**, **meilleurs clients** et **clients en sommeil** (aucune nouvelle saisie : tout est dérivé des données existantes)
- **💰 Caisse** — clôture journalière : comptage pièces/billets + paiements électroniques, réserve de monnaie, fond de caisse cible, calcul d'écart vs logiciel de caisse, historique 15 jours, report de la veille
- **✉️ Campagnes** — envoi d'offres par email depuis votre propre Gmail, aux clients opt-in
- **☁️ Synchro Drive** — sauvegarde automatique multi-appareils via votre propre Google Drive
- **💾 Sauvegarde fichier** — export/import `.json` local

## Principe technique

- Site 100 % statique — HTML/CSS/JS inline, **aucun backend**, **aucune dépendance JS** (police Manrope via Google Fonts, avec repli système)
- Données stockées dans `localStorage` du navigateur
- Synchro et envoi d'emails via un script Google Apps Script déployé **sur le compte de chaque utilisateur**
- Communication par **JSONP** (jamais `fetch`) — compatible avec les web apps Apps Script
- Aucune donnée ne quitte le navigateur sauf action explicite de l'utilisateur

## Campagnes email

Les campagnes utilisent le **Gmail du salon** via le script Apps Script :

- Seuls les clients ayant **accepté les offres** (opt-in) sont contactés
- Chaque email est **personnalisé** (`{prenom}`) et contient un **lien de désinscription** automatique
- Quota : **100 emails/jour** (Gmail) ou 1 500/jour (Workspace)

Voir [`docs/campagnes/`](docs/campagnes/) et [`apps-script/README.md`](apps-script/README.md).

## Déploiement GitHub Pages

1. Forker ce dépôt
2. Aller dans **Settings → Pages → Source : Deploy from a branch → main / root**
3. L'application est disponible sur `https://<votre-user>.github.io/ciseaux/`

## Synchro Google Drive

Voir [`apps-script/README.md`](apps-script/README.md) ou la page **docs/sync-drive/** dans l'application.

Pour utiliser KuT sur **plusieurs appareils** (PC, tablette, smartphone) : déployez le script **une seule fois**, puis collez la **même** URL `…/exec` dans **⚙️ Mon salon** sur chaque appareil. Procédure détaillée : [`docs/multi-appareils/`](docs/multi-appareils/).

## Licence

MIT — libre d'utilisation, de modification et de redistribution. Voir [LICENSE](LICENSE).
