# Rapport QA — Bugs d'affichage : onboarding & présentation de l'app

**App :** KuT (outil salon, statique)
**Date :** 2026-06-22
**Méthode :** audit automatisé Playwright (Chromium) + revue visuelle.
**Couverture :** 14 pages × 2 viewports (desktop 1280×800, mobile 390×844) +
tour d'onboarding complet (12 slides) sur les 2 viewports.
**Diagnostics auto :** débordement horizontal, éléments hors viewport, images
cassées, cibles tactiles, troncature de texte, erreurs console.

> Arbitrage réalisé en QA senior : les candidats remontés par les agents de
> revue ont été **triés et requalifiés** ; les faux positifs (artefacts de
> test ou choix de design) sont documentés en fin de rapport pour traçabilité.

---

## Synthèse

| # | Sévérité | Zone | Bug |
|---|----------|------|-----|
| B1 | **Major** | Caisse (mobile) | Table « HISTORIQUE » déborde horizontalement, colonnes coupées, sans scroll visible |
| B2 | Minor | Onboarding (desktop) | La popup du tour recouvre le bouton d'action (Enregistrer/Envoyer) du formulaire présenté |
| B3 | Minor | Onboarding (mobile) | L'anneau de surbrillance est rogné par le bord haut quand la cible est dans le header |
| B4 | Minor (copie) | Fidélité | « Aucun **points** fidélité » → devrait être « Aucun point » |

**Aucun** bug critique réel. Aucun débordement horizontal au niveau document,
aucune image visible cassée, aucun artefact `undefined`/`NaN`/`[object Object]`,
aucune icône manquante. Les empty states sont volontaires et soignés.

---

## Bugs confirmés

### B1 — Major — Caisse mobile : table « HISTORIQUE » qui déborde
- **Page :** `caisse.html` @ 390px — bas de page.
- **Constat :** la table d'historique est plus large que l'écran. Visibles :
  `DATE | PIÈCES + BILLETS | RÉSERVE MONNAIE | F…` — la 4ᵉ colonne est coupée en
  plein mot et les colonnes suivantes (`Fond cible`, `Sortie`, `Logiciel`,
  `Écart`) sont entièrement hors écran à droite. Le message d'état vide
  « Aucun comptage enregis… » est lui aussi tronqué. **Aucune affordance de
  scroll horizontal** visible.
- **Confirmé par :** diagnostic auto (5 éléments `th` dont `right` jusqu'à 698px
  pour un viewport de 390px) **et** revue visuelle.
- **Impact :** sur mobile, le ou la gérante ne peut pas lire les en-têtes ni les
  colonnes de rapprochement (Écart, Logiciel) — données clés invisibles et
  inatteignables. Les autres tables de la page (La Ferraille / Le Papier /
  L'Électronique) tiennent correctement : seule HISTORIQUE est en cause.
- **Reco :** envelopper la table dans un conteneur `overflow-x:auto` avec
  affordance visuelle, **ou** passer en cartes empilées sur mobile (`<= 540px`).

### B2 — Minor — Onboarding : la popup masque le bouton d'action présenté
- **Slides :** « La fiche client », « Configurer l'offre », « 4 · Les
  campagnes », étape finale « Mon salon » (desktop).
- **Constat :** sur les étapes qui ouvrent un vrai formulaire, la popup du tour
  est ancrée en bas et **recouvre le bouton d'action principal**
  (Enregistrer / Envoyer / Récupérer) que le texte mentionne pourtant
  (« …puis on enregistre »). Les **champs** (contenu pédagogique) restent
  lisibles ; seul le CTA est partiellement caché.
- **Sévérité :** Minor — pédagogie légèrement amoindrie, pas de blocage (les
  champs sont verrouillés pendant la démo, l'utilisateur ne clique pas).
- **Reco :** décaler la popup (ou réduire/scroller le formulaire) pour que le
  bouton mis en avant reste visible sous la zone nette.

### B3 — Minor — Onboarding mobile : anneau de surbrillance rogné en haut
- **Slides :** « 2 · Les offres », « 5 · Les modèles d'email » (cible header
  `.btn-hdr`), motif similaire sur 3/6/7.
- **Constat :** quand la cible est un bouton du bandeau supérieur
  (« + Nouvelle offre », « + Nouveau »), l'anneau lumineux est coupé par le bord
  haut de l'écran. La cible reste identifiable et le texte correspond bien.
- **Sévérité :** Minor (cosmétique).
- **Reco :** clamp de la zone nette dans le viewport avec une marge mini en haut.

### B4 — Minor — Fidélité : faute de copie
- « Aucun **points** fidélité attribué encore. » → « Aucun **point** fidélité
  attribué pour l'instant. » (accord + tournure).

---

## Faux positifs écartés (traçabilité de l'arbitrage)

Remontés par la revue automatique, **rejetés** après vérification :

1. **Tour caisse desktop « rendu à demi-échelle » (annoncé Critical)** →
   c'est l'**effet de zoom cinématique** du tour, capturé en pleine animation.
   La carte mise en avant est nette et bien placée ; le fond « réduit » est le
   plan large volontaire. *Non bug.*
2. **Templates desktop « colonne étroite, n'utilise pas la largeur » (annoncé
   Major)** → layout **centré `max-width:900px`** sur une page bien en 1280px
   (vérifié : capture 1280×1995, CSS `main{max-width:900px;margin:0 auto}`).
   Choix de design standard, identique aux autres pages. *Non bug.*
3. **Onboarding « mauvaise cible » slides Offres/Modèles (annoncé Critical)** →
   la surbrillance vise le bouton header (`sel:".btn-hdr"`) **volontairement**,
   et le texte le dit (« Tout commence par + Nouvelle offre »). *Non bug.*
4. **Erreurs console `ERR_CERT_AUTHORITY_INVALID`** → ressources externes
   (Google Fonts, CDN, Apps Script) bloquées par la politique réseau du
   sandbox. Repli propre sur polices système ; fonctionne sur GitHub Pages.
   *Artefact d'environnement.*
5. **Image « cassée » sur Templates** → `<img id="logoPreview">` sans `src`,
   **masqué** (`display:none`) tant qu'aucun logo n'est importé. *Non visible.*
6. **Contrôles natifs** : libellé « Choose File » (anglais) et date
   `mm/dd/yyyy` → dépendent du navigateur/locale, non stylables. Cosmétique.
7. **Grands espaces vides** (prestations/marketing/planning) → empty states
   volontaires et centrés.

---

## Correctifs appliqués (vérifiés Playwright)

| # | Correctif | Fichier | Vérif |
|---|-----------|---------|-------|
| B1 | Historique caisse → **cartes empilées** sur mobile (`@media <=540px`) avec libellés (`data-label`) ; plus de débordement, état vide et lignes peuplées entièrement lisibles | `caisse.html` | ✅ vide + peuplé, `overflowX=false` |
| B2 | Popup du tour **épinglée en haut** quand la zone dépasse 78 % de la hauteur → le bouton d'action (Enregistrer/Envoyer) reste visible | `onboarding.js` (`placePop`) | ✅ bouton « Enregistrer » visible |
| B3 | Marge mini des bords portée à **14 px** (`applyHole`) → l'anneau lumineux n'est plus rogné quand la cible touche un bord | `onboarding.js` (`applyHole`) | ✅ anneau header complet (mobile) |
| B4 | Copie fidélité : « Aucun **points**… » → « Personne n'a encore de … » (neutre, sans problème d'accord) | `fidelite.html` | ✅ |

Tests de non-régression sécurité : **11/11 ✅**.

## Verdict QA

L'onboarding et la présentation de l'app sont **globalement prêts**, avec des
empty states soignés et aucun défaut bloquant. **Une seule correction
recommandée avant mise en avant : B1 (table caisse mobile)**, vrai défaut
d'affichage qui rend des données illisibles sur mobile. B2/B3/B4 sont des
finitions à traiter au fil de l'eau.
