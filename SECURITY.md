# Politique de sécurité

## Modèle de sécurité de KuT

KuT est une application **100 % statique** sans backend. Cela a des
implications importantes pour la sécurité :

- Toutes les données (clients, fidélité, caisse, profil) sont stockées
  **localement dans le `localStorage` du navigateur** de l'utilisateur.
- Aucune donnée n'est transmise à un serveur du projet. Le projet n'héberge
  **aucune** donnée.
- La synchronisation optionnelle passe par un script **Google Apps Script
  déployé par l'utilisateur sur son propre compte Google**. Le script étant
  **fermé par défaut**, une **clé admin** doit y être posée pour autoriser la
  synchronisation : l'URL `…/exec` seule ne suffit pas.
- Une **clé admin** protège les actions sensibles du script (lecture/écriture
  des clients, suppression, campagnes). Le script est **fermé par défaut** :
  tant qu'aucune clé n'est posée, ces actions sont **refusées** (`non configuré`),
  jamais ouvertes. Seules les actions **publiques** du formulaire de réservation
  (`createBooking`, `availability`, `catalogue`, gestion d'un RDV par jeton…) et
  `securite` restent accessibles sans clé.

Les revues de sécurité menées sur le projet sont documentées dans
[`SECURITY_AUDIT_REPORT.md`](SECURITY_AUDIT_REPORT.md) (constats) et
[`SECURITY_REMEDIATION_REPORT.md`](SECURITY_REMEDIATION_REPORT.md) (corrections).

## Formulaire de réservation public

Le formulaire `reservation.html` est conçu pour être exposé publiquement :

- Il n'utilise que l'action **write-only** `createBooking`, qui dépose une demande
  « en attente » et **ne renvoie aucune donnée** (ni clients, ni autres réservations).
- Protections anti-abus : champ piège anti-robot, refus des dates passées, limite
  anti-flood. Les demandes restent à **valider** par le salon, jamais inscrites
  directement dans un agenda confirmé.
- L'URL `…/exec` est publique, mais le script étant **fermé par défaut**, elle ne
  donne accès qu'aux actions du formulaire : la base reste inaccessible tant que la
  clé admin n'est pas posée et fournie.

## Recommandations aux utilisateurs

- **Définissez une clé admin** : c'est elle, et non l'URL `…/exec`, qui protège
  vos données. Sans clé posée, le script refuse toute action sensible (`non configuré`)
  — votre back-office ne fonctionnera pas tant qu'elle n'est pas activée.
- Utilisez la **même clé** sur tous vos appareils (recopie manuelle ou via la
  sauvegarde fichier, qui l'inclut).
- Les données du `localStorage` ne sont **pas chiffrées**. Sur un poste
  partagé, utilisez la sauvegarde fichier et videz les données après usage.
- La **sauvegarde fichier `.json`** contient désormais l'URL `…/exec` et la
  **clé admin** (pour qu'une restauration rende un nouvel appareil opérationnel
  sans ressaisie). Conservez ce fichier en lieu sûr et ne le partagez pas.
- Le RGPD s'applique aux données clients que vous saisissez : informez vos
  clients (voir `confidentialite.html`), ne collectez que le nécessaire (la date
  de naissance reste facultative) et préférez un compte **Google Workspace** (avec
  accord de sous-traitance) pour un usage professionnel.

## Versions supportées

Seule la dernière version de la branche `main` reçoit des correctifs de
sécurité.

| Version | Supportée |
|---|---|
| `main` (dernière) | ✅ |
| Anciennes versions | ❌ |

## Signaler une vulnérabilité

Si vous découvrez une faille de sécurité (ex. injection XSS via un champ,
fuite de données entre pages, problème dans le script Apps Script) :

1. **Ne l'ouvrez pas en issue publique.**
2. Écrivez à **ribesjeremy@gmail.com** avec :
   - une description de la faille,
   - les étapes pour la reproduire,
   - l'impact potentiel.
3. Vous recevrez un accusé de réception sous **72 heures** et serons tenu
   informé de la correction.

Merci de contribuer à la sécurité de KuT.
