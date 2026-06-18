# Contribuer à 6-o

Merci de votre intérêt pour 6-o ! ✂️ Ce projet est pensé pour rester
**simple, statique et sans dépendance**. Toute contribution qui respecte cette
philosophie est la bienvenue.

## Philosophie du projet (à respecter absolument)

Avant de contribuer, gardez ces invariants en tête :

1. **100 % statique** — HTML / CSS / JS inline, servi sur GitHub Pages.
2. **Aucune dépendance, aucun build, aucun backend.** Pas de npm, pas de
   framework, pas d'étape de compilation.
3. **Les données restent dans le navigateur** (`localStorage`) ; rien ne sort
   sauf action explicite de l'utilisateur.
4. **Synchro via JSONP** vers un Apps Script hébergé par l'utilisateur —
   jamais `fetch`, jamais de serveur côté projet.
5. **Interface en français**, accessible, mobile-first.
6. **Jamais de données client en dur** ; dégradation propre si non configuré.

Si une idée nécessite de casser un de ces points, ouvrez d'abord une *issue*
pour en discuter.

## Comment contribuer

### Signaler un bug

Utilisez le modèle **Bug report** dans les [issues](../../issues/new/choose).
Décrivez les étapes pour reproduire, le comportement attendu et le navigateur.

### Proposer une fonctionnalité

Utilisez le modèle **Feature request**. Expliquez le besoin côté coiffeur,
pas seulement la solution technique.

### Proposer du code (Pull Request)

1. **Forkez** le dépôt et créez une branche : `git checkout -b ma-fonctionnalite`
2. Faites vos modifications en respectant le style existant.
3. **Testez localement** : ouvrez simplement les fichiers `.html` dans un
   navigateur (ou `python3 -m http.server`). Aucune installation requise.
4. Vérifiez que :
   - Les pages fonctionnent sans connexion (mode hors-ligne).
   - La synchro et l'export/import restent compatibles avec le format
     existant (`app: "ciseaux-hub"`, clés `*-v1`).
5. **Commitez** avec un message clair et ouvrez une **Pull Request** vers `main`
   en remplissant le modèle.

## Style de code

- Indentation : 2 espaces.
- JavaScript : ES5 compatible (pas de transpilation), `var` accepté pour rester
  cohérent avec l'existant, fonctions nommées.
- CSS : palette « salon » existante (tons terracotta `#b87c6e`, fond `#fdf3ef`).
- Échappez toujours les données utilisateur affichées en HTML.

## Versionnage des données

Toute modification du format de stockage doit **incrémenter la version** de la
clé concernée (ex. `clients-v1` → `clients-v2`) et prévoir une migration douce,
sans perte de données pour les utilisateurs existants.

## Questions

Ouvrez une issue avec le label `question` ou écrivez à **ribesjeremy@gmail.com**.

Merci ! 💇
