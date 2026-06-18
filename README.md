# ✂️ Ciseaux

Outil open source pour salons de coiffure — CRM clients, programme de fidélité, clôture de caisse, campagnes email.

**Démo live :** https://j-rbs91.github.io/ciseaux/

## Fonctionnalités

- **👥 Clients** — fichier clients avec nom, téléphone, email, notes, points fidélité, consentement offres
- **⭐ Fidélité** — programme points configurable avec récompenses
- **💰 Caisse** — clôture journalière par coupures avec historique
- **✉️ Campagnes** — envoi d'offres par email depuis votre propre Gmail, aux clients opt-in
- **☁️ Synchro Drive** — sauvegarde automatique multi-appareils via votre propre Google Drive
- **💾 Sauvegarde fichier** — export/import `.json` local

## Principe technique

- Site 100 % statique — HTML/CSS/JS inline, **aucune dépendance**, **aucun backend**
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

## Licence

MIT — libre d'utilisation, de modification et de redistribution. Voir [LICENSE](LICENSE).
