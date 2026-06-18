# Script Google Apps Script — Ciseaux

Ce script à déployer sur **votre propre compte Google** permet :
- La **synchro Drive** du profil salon entre plusieurs appareils
- La **base clients** stockée dans une Google Sheet éditable directement

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

## Ce que fait le script

| Action (`?action=`) | Effet |
|---|---|
| `load` *(défaut)* | Renvoie le profil salon (JSON) |
| `save` | Enregistre le profil salon |
| `loadClients` | Renvoie la liste clients depuis la Google Sheet |
| `saveClients` | Écrase la Google Sheet avec la liste fournie |

Le script crée automatiquement un dossier **`Hub_Facilities`** dans votre Drive
avec un fichier `profil-magasin.json` et un classeur `base-clients`.

## Sécurité

L'URL `…/exec` est longue et aléatoire — elle sert de clé secrète.
Ne la partagez pas. Aucune donnée n'est hébergée par le projet Ciseaux.
