## Description

Que fait cette PR ? Quel problème résout-elle ?

Fixes #(numéro de l'issue)

## Type de changement

- [ ] 🐛 Correction de bug
- [ ] ✨ Nouvelle fonctionnalité
- [ ] 📝 Documentation
- [ ] 🎨 Style / UI
- [ ] ♻️ Refactorisation

## Checklist philosophie du projet

- [ ] Reste **100 % statique** (pas de backend, pas de dépendance, pas de build)
- [ ] Les données restent dans le navigateur (`localStorage`)
- [ ] Pas de backend côté projet (synchro en `POST` + repli **JSONP** vers l'Apps Script de l'utilisateur)
- [ ] Compatible avec le format de données existant (`app: "ciseaux-hub"`, clés `*-v1`)
- [ ] Interface en français, **responsive** (mobile, tablette paysage, desktop) et tactile (cibles ≥ 44 px)
- [ ] Rendu correct en **mode clair et sombre**
- [ ] Données utilisateur échappées avant affichage HTML
- [ ] Nouvelle page éventuelle ajoutée à `sw.js` + version du cache incrémentée

## Tests effectués

Comment avez-vous testé ? (navigateur, mode hors-ligne, export/import…)

## Captures d'écran

Si changement visuel.
