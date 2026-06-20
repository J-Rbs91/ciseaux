# Script Google Apps Script — KuT

Ce script à déployer sur **votre propre compte Google** permet :
- La **synchro Drive** du profil salon entre plusieurs appareils
- La **base clients** stockée dans une Google Sheet éditable directement
- L'**envoi de campagnes email** depuis votre Gmail (offres, promotions)

## Déploiement (5 minutes)

1. Ouvrir [script.google.com](https://script.google.com) et créer un **Nouveau projet**
2. Supprimer le code existant et **coller le contenu de `Code.gs`**
3. Cliquer **Enregistrer** (icône disquette)
4. Cliquer **Déployer → Nouveau déploiement**
5. Type : **Application web**
6. Exécuter en tant que : **Moi**
7. Qui a accès : **Tout le monde**
8. Cliquer **Déployer** et **autoriser** (écran « application non vérifiée » → Paramètres avancés → Continuer)
9. **Copier l'URL** `https://script.google.com/macros/s/…/exec`
10. Coller cette URL dans **Mon salon → Synchro Google Drive**

> ⚠️ **Compte Google Workspace (pro)** : si l'option « Tout le monde » n'est pas disponible,
> créer un compte Gmail personnel dédié (ex. `monsalon.sync@gmail.com`) et déployer depuis ce compte.

## Mise à jour du script (campagnes email)

Si vous aviez déjà déployé une version précédente, le nouveau code ajoute l'envoi d'emails. Pour l'activer :

1. Coller le nouveau `Code.gs`, **Enregistrer**.
2. **Déployer → Gérer les déploiements → Modifier (crayon) → Version : Nouvelle version → Déployer**.
3. **Réautoriser** : Google demande cette fois l'autorisation d'**envoyer des emails** en votre nom. Acceptez.

L'URL `…/exec` reste la même, inutile de la recoller.

## Ce que fait le script

| Action (`?action=`) | Effet |
|---|---|
| `load` *(défaut)* | Renvoie le profil salon (JSON) |
| `save` | Enregistre le profil salon |
| `loadClients` | Renvoie la liste clients depuis la Google Sheet |
| `saveClients` | Écrase la Google Sheet avec la liste fournie (sauvegarde complète) |
| `upsertClient` | Crée/met à jour **un seul** client (par `id`) — synchro incrémentale |
| `deleteClient` | Supprime **un seul** client (par `id`) |
| `loadOffres` | Renvoie les offres commerciales synchronisées |
| `saveOffres` | Enregistre les offres (depuis la page Offres) — nécessaire à l'envoi auto des anniversaires |
| `sendCampaign` | Envoie un email personnalisé aux clients opt-in (depuis votre Gmail) |
| `sendBirthdays` | Envoie le mail d'anniversaire du jour (test/forçage manuel) |
| `quota` | Renvoie le nombre d'emails encore envoyables aujourd'hui |
| `unsub` | Page de désinscription (lien placé dans chaque email) |
| `createBooking` | **Public** — réserve un créneau (vérif. de disponibilité + blocage automatique) |
| `availability` | **Public** — renvoie les créneaux libres d'une date pour une durée donnée |
| `catalogue` | **Public** — renvoie les prestations (nom, prix, durée) et les bornes d'agenda |
| `loadBookings` | Renvoie les demandes de rendez-vous (admin) |
| `setBookingStatus` | Confirme / refuse / remet en attente une demande (admin) |
| `deleteBooking` | Supprime une demande de rendez-vous (admin) |
| `claimKey` | Définit la clé admin si aucune n'est encore enregistrée |
| `securite` | Indique si une clé admin protège le script |

Le script crée automatiquement un dossier **`Hub_Facilities`** dans votre Drive
avec un fichier `profil-magasin.json` et un classeur `base-clients`.

### Colonnes de la Sheet `Clients`

`id | nom | tel | mail | dob | points | visitsCount | offre | notes | optin | maj | visites | ledger`

La colonne **`dob`** (date de naissance, format `AAAA-MM-JJ`) est renseignée depuis la fiche client.
Elle sert à déclencher l'**offre et le mail d'anniversaire**.

La colonne **`optin`** détermine qui reçoit les campagnes : mettez `oui` (ou cochez la case
dans l'app) pour les clients ayant accepté les offres. Le lien de désinscription repasse
automatiquement cette valeur à `non`.

- **`points`** / **`visitsCount`** : soldes des compteurs de fidélité (paramétrables dans la page Fidélité).
- **`visites`** : historique JSON des passages (date, prestations, montant) servant aux statistiques.
- **`ledger`** : journal JSON des mouvements de fidélité (date, compteur, delta, source, note).

> ⚠️ **Mise à jour des colonnes fidélité** : si vous aviez déjà déployé une version précédente,
> le nouveau code ajoute les colonnes `visitsCount` et `ledger`. Refaites **Déployer → Gérer les
> déploiements → Modifier → Nouvelle version**. Au prochain « Envoyer vers Drive » depuis l'app,
> la Sheet est réécrite avec les nouvelles colonnes (les données existantes sont conservées).

## Mails d'anniversaire automatiques 🎂

Le salon crée une **offre anniversaire** depuis la page **Offres** : il coche
« 🎂 Offre anniversaire », choisit la **prestation (ou le groupe de prestations)**
offerte et rédige l'**objet** et le **message** du mail. Tant que l'offre est
**active**, le mail part automatiquement chaque année le jour de l'anniversaire
à chaque client qui a :

- une **date de naissance** renseignée dans sa fiche, **et**
- accepté les **communications commerciales** (case opt-in).

Chaque client ne reçoit le mail **qu'une seule fois par an**. Variables disponibles
dans le message : `{prenom}`, `{nom}`, `{offre}`, `{prestations}`.

### Activer l'envoi automatique (une seule fois)

1. Mettre à jour le `Code.gs` (voir « Mise à jour du script » ci-dessus) et réautoriser.
2. Dans l'éditeur Apps Script, sélectionner la fonction **`creerDeclencheurAnniversaire`**
   dans la liste déroulante, puis cliquer **Exécuter**. Cela programme un déclencheur
   quotidien (vers 9h) qui envoie les mails d'anniversaire du jour.
3. (Optionnel) Pour tester immédiatement : appeler l'URL `…/exec?action=sendBirthdays`
   ou exécuter la fonction `envoyerAnniversaires_` depuis l'éditeur.

> Les offres sont synchronisées vers le Drive (`offres.json`) à chaque
> enregistrement sur la page Offres : c'est ce fichier que lit l'envoi automatique.

## Quota d'envoi Gmail

- Compte Gmail gratuit : **100 destinataires/jour**
- Google Workspace : **1 500 destinataires/jour**

Le script s'arrête proprement quand le quota est atteint et indique combien d'emails ont été ignorés.

## Réservations en ligne (agenda) 📅

Le formulaire public `reservation.html` est un **vrai agenda** : le client choisit une
**prestation**, une **date**, puis un **créneau réellement disponible**. Le créneau est
**bloqué automatiquement** (réservation ferme). Vous gérez les RDV dans la page
**Réservations** (confirmer, annuler, ajouter le client au fichier).

- Stockage dans l'onglet **`Réservations`** du classeur `base-clients` :
  `id | createdAt | statut | date | heure | duree | prestation | nom | tel | mail | dob | notes | optin`
- Calcul des créneaux : à partir des **horaires d'ouverture**, de la **durée de la prestation**,
  de la **capacité** (RDV simultanés) et des RDV déjà pris. L'action publique `availability`
  ne renvoie **que des heures** (aucune donnée client).
- Anti-doublon : `createBooking` re-vérifie la disponibilité **sous verrou** (`LockService`)
  avant d'écrire — deux clients ne peuvent pas prendre le même dernier créneau.
- Autres protections : piège anti-robot, refus des dates passées/hors horizon, anti-flood.

**Réglages (depuis l'app, page Réservations → ⚙ Réglages agenda)** : capacité (postes en
parallèle), pas des créneaux, délai minimum avant RDV, horizon de réservation, et **horaires
par jour** (avec pause). Ils sont enregistrés dans le profil (`profil.agenda`) et synchronisés.

Les **prestations et leurs durées** proviennent de votre page **Prestations** (chargées
automatiquement par le formulaire via `catalogue`). Pour mettre le formulaire en ligne :
page **Réservations → 🔗 Lien de réservation**, copiez le lien et placez-le comme bouton
**« Prendre rendez-vous »** sur votre fiche Google Business, Instagram, etc.

> Migration : le nouveau code ajoute la colonne `duree`. Refaites **Déployer → Gérer les
> déploiements → Modifier → Nouvelle version** ; la colonne est ajoutée automatiquement.

## Clé admin (sécurité) 🔐

Comme le formulaire de réservation rend l'URL `…/exec` **publique**, cette URL ne peut plus
servir de secret. Une **clé admin** protège alors toutes les actions sensibles (lecture des
clients, suppression, campagnes…) : seules `createBooking` et `securite` restent publiques.

**Mise en place (une fois) :**

1. Dans l'app, ouvrir **Mon salon**, cliquer **Générer** à côté de « Clé admin », puis
   **Enregistrer**. L'app enregistre la clé sur le script (action `claimKey`, qui n'aboutit
   que si aucune clé n'existe encore).
2. Coller la **même clé** dans **Mon salon** sur chaque appareil utilisé par le salon
   — ou plus simple : **exporter la sauvegarde fichier** depuis le 1ᵉʳ appareil et la
   **restaurer** sur les autres (l'URL `…/exec` et la clé admin y sont incluses).
3. (Alternative experte) Exécuter `genererCleAdmin` depuis l'éditeur Apps Script : la clé
   s'affiche dans les **journaux**, à recopier dans l'app.

> Tant qu'aucune clé n'est définie, le script reste en mode **ouvert** (compatibilité des
> déploiements existants) et l'app affiche un avertissement. **N'activez pas le formulaire
> public sans avoir défini une clé.**

## Sécurité & conformité

- L'URL `…/exec` est longue et aléatoire. Tant que vous n'ouvrez pas de formulaire public,
  elle fait office de secret ; **dès que vous publiez `reservation.html`, définissez une clé admin.**
- Aucune donnée n'est hébergée par le projet KuT : tout vit sur votre compte Google.
- Les emails ne partent qu'aux clients **opt-in** et incluent un **lien de désinscription** (RGPD).
- Le formulaire de réservation affiche un lien vers `confidentialite.html` et exige le
  consentement à la politique de confidentialité (case obligatoire), avec un opt-in marketing
  **distinct** (case facultative).
