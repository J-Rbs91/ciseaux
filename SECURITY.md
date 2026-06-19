# Politique de sécurité

## Modèle de sécurité de KuT

KuT est une application **100 % statique** sans backend. Cela a des
implications importantes pour la sécurité :

- Toutes les données (clients, fidélité, caisse, profil) sont stockées
  **localement dans le `localStorage` du navigateur** de l'utilisateur.
- Aucune donnée n'est transmise à un serveur du projet. Le projet n'héberge
  **aucune** donnée.
- La synchronisation optionnelle passe par un script **Google Apps Script
  déployé par l'utilisateur sur son propre compte Google**. L'URL `…/exec`
  générée fait office de clé secrète.

## Recommandations aux utilisateurs

- **Ne partagez jamais votre URL `…/exec`** : quiconque la possède peut lire et
  écrire vos données de synchro.
- Les données du `localStorage` ne sont **pas chiffrées**. Sur un poste
  partagé, utilisez la sauvegarde fichier et videz les données après usage.
- Le RGPD s'applique aux données clients que vous saisissez : informez vos
  clients et ne collectez que le nécessaire.

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
