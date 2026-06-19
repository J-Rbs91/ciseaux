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
| `saveClients` | Écrase la Google Sheet avec la liste fournie |
| `sendCampaign` | Envoie un email personnalisé aux clients opt-in (depuis votre Gmail) |
| `quota` | Renvoie le nombre d'emails encore envoyables aujourd'hui |
| `unsub` | Page de désinscription (lien placé dans chaque email) |

Le script crée automatiquement un dossier **`Hub_Facilities`** dans votre Drive
avec un fichier `profil-magasin.json` et un classeur `base-clients`.

### Colonnes de la Sheet `Clients`

`id | nom | tel | mail | points | offre | notes | optin | maj`

La colonne **`optin`** détermine qui reçoit les campagnes : mettez `oui` (ou cochez la case
dans l'app) pour les clients ayant accepté les offres. Le lien de désinscription repasse
automatiquement cette valeur à `non`.

## Quota d'envoi Gmail

- Compte Gmail gratuit : **100 destinataires/jour**
- Google Workspace : **1 500 destinataires/jour**

Le script s'arrête proprement quand le quota est atteint et indique combien d'emails ont été ignorés.

## Sécurité & conformité

- L'URL `…/exec` est longue et aléatoire — elle sert de clé secrète. Ne la partagez pas.
- Aucune donnée n'est hébergée par le projet KuT : tout vit sur votre compte Google.
- Les emails ne partent qu'aux clients **opt-in** et incluent un **lien de désinscription** (RGPD).
