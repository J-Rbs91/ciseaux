# KuT

Outil open source pour salons de coiffure — CRM clients, programme de fidélité, clôture de caisse, campagnes email.

**Démo live :** https://j-rbs91.github.io/ciseaux/

## Fonctionnalités

- **👥 Clients** — fichier clients avec nom, téléphone, email, notes et consentement offres & promotions
- **⭐ Fidélité** — programme **entièrement configurable** : compteurs **points et/ou visites** (nom, unité, gains au passage à valeur fixe ou **par €**, à la vente, ou ajustements manuels), **paliers de récompense** paramétrables (seuil, type, comportement après usage) et **journal des mouvements** par client ; **enregistrement d'un passage** en cochant les prestations payées (le tarif alimente le panier moyen)
- **✂️ Prestations & tarifs** — catalogue de prestations (nom + tarif) géré depuis la **page dédiée Prestations** du hub, utilisé pour cocher les passages et calculer les stats
- **📊 Statistiques** — tableau de bord calculé à partir des passages : **chiffre d'affaires, panier moyen, nombre de passages et clients servis** (par mois en cours, mois précédent, 12 mois glissants ou tout l'historique), **évolution du CA sur 12 mois**, **prestations les plus rentables**, **meilleurs clients** et **clients en sommeil** (aucune nouvelle saisie : tout est dérivé des données existantes)
- **💰 Caisse** — clôture journalière : comptage pièces/billets + paiements électroniques, réserve de monnaie, fond de caisse cible, calcul d'écart vs logiciel de caisse, historique 15 jours, report de la veille
- **✉️ Campagnes** — envoi d'offres par email depuis votre propre Gmail, aux clients opt-in, avec **segmentation** des destinataires : tous, récompense disponible, à relancer, **clients fidèles** (nombre de passages), **clients VIP** (panier moyen) ou **ayant pris une prestation** donnée
- **📅 Réservations en ligne (agenda)** — formulaire public (`reservation.html`) à lier depuis votre fiche Google : le client choisit une **prestation**, une **date** et un **créneau réellement libre** (calculé selon vos horaires, la durée de la prestation et la capacité). Le créneau est **bloqué automatiquement** (anti-doublon sous verrou) ; horaires & capacité paramétrables depuis la page Réservations. Deux organisations possibles : **postes anonymes** (capacité N) ou **collaborateurs nommés** avec plannings séparés (le client choisit avec qui, ou « sans préférence »)
- **☁️ Synchro Drive** — sauvegarde automatique multi-appareils via votre propre Google Drive
- **💾 Sauvegarde fichier** — export/import `.json` local

## Principe technique

- Site 100 % statique — HTML/CSS/JS inline, **aucun backend**, **aucune dépendance JS** (police Manrope via Google Fonts, avec repli système)
- Données stockées dans `localStorage` du navigateur
- Synchro et envoi d'emails via un script Google Apps Script déployé **sur le compte de chaque utilisateur**
- Communication par **JSONP** (jamais `fetch`) — compatible avec les web apps Apps Script
- Aucune donnée ne quitte le navigateur sauf action explicite de l'utilisateur
- **Clé admin** optionnelle : protège les actions sensibles du script ; seules les actions du formulaire public de réservation restent ouvertes

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

## Réservations en ligne & confidentialité

1. Déployer le script Apps Script et coller l'URL `…/exec` dans **Mon salon**.
2. Dans **Mon salon**, cliquer **Générer** une **clé admin** puis **Enregistrer** (sécurise vos données).
3. Renseigner vos **prestations et leurs durées** (page **Prestations**) et vos **horaires/capacité** (page **Réservations → ⚙ Réglages agenda**).
4. Page **Réservations → 🔗 Lien de réservation** : copier le lien (il contient déjà votre URL `…/exec`) et l'ajouter comme bouton **« Prendre rendez-vous »** sur votre fiche Google Business Profile, Instagram, etc. Éditer [`confidentialite.html`](confidentialite.html) (nom, email, adresse).

> ⚠️ **Avant de publier le formulaire, définissez une clé admin.** Voir [`SECURITY.md`](SECURITY.md) et [`apps-script/README.md`](apps-script/README.md).

### RGPD

L'application collecte nom, prénom, email, téléphone et (facultatif) date de naissance.
Le **salon est responsable de traitement** ; **Google** (Drive/Sheets/Gmail) est sous-traitant ;
le projet KuT n'héberge ni ne traite aucune donnée. Le modèle de politique de confidentialité
[`confidentialite.html`](confidentialite.html) couvre finalités, base légale, durée de conservation
et droits des personnes. Le formulaire exige le consentement à cette politique (case obligatoire)
et propose un opt-in marketing **distinct**. La date de naissance est **facultative** (offre
d'anniversaire uniquement).

**Rétention / suppression automatique** : un client sans aucune visite ni mise à jour depuis un
délai configurable (par défaut **2 ans**) est **supprimé automatiquement** (en local et sur le
Drive) à l'ouverture de l'application. Le délai et l'activation se règlent dans **Clients →
Inactifs & rétention**.

## Synchro Google Drive

Voir [`apps-script/README.md`](apps-script/README.md) ou la page **docs/sync-drive/** dans l'application.

Pour utiliser KuT sur **plusieurs appareils** (PC, tablette, smartphone) : déployez le script **une seule fois**, puis collez la **même** URL `…/exec` dans **⚙️ Mon salon** sur chaque appareil. Procédure détaillée : [`docs/multi-appareils/`](docs/multi-appareils/).

## Licence

MIT — libre d'utilisation, de modification et de redistribution. Voir [LICENSE](LICENSE).
