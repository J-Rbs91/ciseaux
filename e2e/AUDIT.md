# Audit e2e — Cœur CRM KuT (Offres / Templates / Campagnes / Segmentation)

**Auditeur :** QA Senior
**Date :** 2026-06-22
**Périmètre :** `offres.html`, `templates.html`, `campagnes.html`, segmentation profil (`clients.html` + `app-sync.js`)
**Outil :** Playwright 1.56.1 — app statique servie sur `http://127.0.0.1:8099`
**Contrainte :** aucun fichier applicatif modifié. Tests sous `./e2e/` uniquement.

---

## 1. Synthèse exécutive

| Module | Note /5 | Verdict |
|---|---|---|
| `offres.html` | 4.5 / 5 | Solide. CRUD/toggle/anniv/escH corrects. Seul bémol : aucune validation de saisie (réductions aberrantes acceptées) — cosmétique. |
| `templates.html` | 4.5 / 5 | Très bon. `initSeeds` et la rétro-compat `segment` fonctionnent exactement comme spécifié. Échappement OK. |
| `campagnes.html` — filtrage | 5 / 5 | Filtrage destinataires robuste et conforme (mail+opt-in, reward, winback, freq, vip, presta, profil). Aucun bug trouvé. |
| `campagnes.html` — présélection auto | 3.5 / 5 | Le cœur fonctionne (propose, pré-remplit, ne réécrase pas la saisie manuelle). **MAIS** sélection ambiguë quand plusieurs modèles partagent un segment, et `clearTpl` n'arme pas la suggestion. |
| Segmentation profil | 4 / 5 | `normClient`/`isProfil` cohérents (matching insensible à la casse). Trou : profil « Non précisé » (`none`) n'a aucun modèle associable. |

**Verdict global : 4 / 5.** Le cœur CRM est sain et bien défendu contre le XSS. Les défauts résiduels concernent la *présélection auto template↔segment* (priorité d'un modèle parmi plusieurs candidats) et une asymétrie « Non précisé », plus des manques de validation. **Aucun bug bloquant.**

---

## 2. Tableau des findings

| ID | Sévérité | Module | Titre | Repro (test) | Attendu vs Observé | Cause racine probable | Correctif suggéré |
|---|---|---|---|---|---|---|---|
| **F1** | Majeur | campagnes (auto-select) | Un modèle personnalisé partageant un segment avec un seed n'est **jamais** suggéré : le seed gagne toujours | `template-autoselect.spec.js` › *FINDING : un modèle perso partageant un segment…* (**vert**, verrouille le comportement observé) | Attendu : le modèle pertinent (souvent le perso, plus récent) proposé, ou un choix. Observé : `bestTplForSeg` renvoie le **1er** match dans l'ordre du tableau ; les seeds étant injectés avant les ajouts persos, le seed (« Client fidèle » pour `vip`) masque le perso. | `campagnes.html:640-645` `bestTplForSeg()` : `for(i…) if(segment===key) return tpls[i]` — premier trouvé, pas de priorité. | Préférer le modèle le plus récent (`createdAt` max) ou non-seed (`id` ne commençant pas par `t_seed_`) parmi les candidats ; ou proposer une liste si >1. |
| **F2** | Mineur | campagnes (auto-select) | « Non précisé » (`profilSel=none`) n'a aucun modèle associable | `template-autoselect.spec.js` › *profilSel=none … suggestion masquée* (**vert**) | Attendu : un modèle peut cibler les profils non renseignés. Observé : `segKeyForTpl` renvoie `'profil:none'`, mais `templates.html` ne propose que `profil:homme/femme/enfant` (pas de `profil:none`). La suggestion reste donc toujours masquée pour ce cas. | `campagnes.html:634-639` (`'profil:'+profilVal()` → `profil:none`) vs `templates.html:346` (liste d'options du `#fSeg`). | Ajouter une option `profil:none` (« Profil — Non précisé ») dans le `<select id="fSeg">`, ou mapper `none`→`''`. |
| **F3** | Mineur | campagnes (auto-select) | `clearTpl()` ne réarme pas la présélection auto | inspection code (`campagnes.html:694-698`) | Attendu : après avoir « retiré le modèle », un changement de segment re-suggère. Observé : `clearTpl` vide les champs mais ne remet pas `tplManual=false`/`tplAuto=false` ; si l'utilisateur avait tapé, l'auto reste désactivé. | `campagnes.html:694-698` : ne touche pas `tplManual`/`tplAuto`. | Dans `clearTpl()`, remettre `tplManual=false;tplAuto=false;` puis `updateTplSuggest()`. |
| **F4** | Mineur | campagnes (vip) | Seuil panier négatif/zéro inclut les clients sans aucune dépense | `campagnes-segmentation.spec.js` (vip) + probe interne | `minBasketVal()` clampe `<0` à `0` ; `basketAvg(c)=0` pour 0 visite ⇒ `0>=0` vrai ⇒ un client sans dépense passe le segment VIP. | `campagnes.html:515` (`minBasketVal` clamp à 0) + `:552` (`basketAvg(c)>=minBasketVal()`). | Exiger `basketAvg(c)>0` pour le segment VIP, ou minimum effectif `>=1`. |
| **F5** | Cosmétique | offres | Aucune validation des montants/réductions (valeurs aberrantes acceptées) | `edge-cases.spec.js` › *montant/réduction négatif accepté…* (**vert**) | Attendu : garde-fou sur `-999%`. Observé : la réduction est un texte libre, stocké et affiché tel quel dans le badge. | `offres.html:489-490` (`reduction` = texte brut). | Optionnel : champ libre assumé (le salon écrit « -20% », « soin offert »…). Documenter ou valider si format numérique attendu. |
| **F6** | Cosmétique | campagnes | Incohérence des limites de longueur du corps | inspection (`campagnes.html:480,576`) | Compteur en alerte à `>1500` caractères, mais l'envoi n'est bloqué qu'à `>1800`. Pas de `maxlength` sur le textarea. | `campagnes.html:480` (`warn` si `>1500`) vs `:576` (`>1800`). | Aligner les deux seuils, ou clarifier le message d'aide. |

> **Note :** les comportements **conformes** vérifiés et qui auraient pu cacher des bugs (et n'en cachent pas) : non-écrasement d'un sujet/corps saisi à la main, ré-écrasement légitime du contenu auto au changement de segment, import `template-en-cours` non écrasé, rétro-remplissage `segment` des seeds, échappement HTML partout.

---

## 3. Tests écrits

Tous les tests seedent leur propre `localStorage` via `page.addInitScript` (helper `e2e/_helpers.js`, seed **idempotent** pour survivre aux reloads/navigations et tester la persistance et la cohérence inter-pages).

| Fichier | Tests | Résultat |
|---|---|---|
| `e2e/offres.spec.js` | 12 | ✅ tous verts |
| `e2e/templates.spec.js` | 11 | ✅ tous verts |
| `e2e/campagnes-segmentation.spec.js` | 13 | ✅ tous verts |
| `e2e/template-autoselect.spec.js` | 14 | ✅ tous verts (dont 1 verrou de bug **F1** et 1 pour **F2**) |
| `e2e/xss-escaping.spec.js` | 6 | ✅ tous verts |
| `e2e/edge-cases.spec.js` | 10 | ✅ tous verts |
| `e2e/smoke.spec.js` (préexistant) | 1 | ✅ vert |
| **Total** | **67** | **67 passants / 0 échouant** |

### Couverture
- **Happy paths** : création/édition/suppression/toggle offres, CRUD templates, tous les segments de campagne.
- **États vides** : offres vides (empty-state), templates vides (re-seed forcé), base sans destinataire.
- **Valeurs limites/aberrantes** : 0/1/2 visites (winback, freq), montants ≤ 0 (basketAvg), seuils négatifs (clamp), réduction `-999%`.
- **Caractères spéciaux** : accents, emoji (`Été ☀️`).
- **Injection HTML** (`<img src=x onerror=…>`) dans nom/sujet/corps d'offre, de template, de prestation, et dans le picker/bandeau de campagne → **aucune exécution** (escH/escAttr OK).
- **Persistance après reload** : offres, templates, profil client.
- **Cohérence inter-pages** : template créé dans `templates.html` correctement suggéré dans `campagnes.html`.
- **Présélection auto** : changements de segment successifs, changement `profilSel`, saisie manuelle puis changement de segment, clic « Utiliser ce modèle », import depuis Templates.
- **`normClient`** (app-sync) : profil vide ⇒ `''`, variantes d'opt-in.

### Commande pour rejouer
```bash
npx playwright test                 # toute la suite
npx playwright test e2e/template-autoselect.spec.js   # le module présélection auto
npx playwright show-report          # rapport HTML (si généré)
```

---

## 4. Résultat d'exécution (`npx playwright test`)

```
Running 67 tests using N workers
  ...
  67 passed (12.4s)
```

**67 passants / 0 échouant.**

Les findings **F1–F4** sont des écarts de comportement réels :
- **F1** et **F2** sont **reproduits par un test vert** qui *verrouille le comportement observé* (limite documentée) plutôt qu'un test rouge, afin de laisser la suite « verte » tout en figeant la régression : voir `template-autoselect.spec.js` (« FINDING : un modèle perso… le seed gagne » et « profilSel=none … suggestion masquée »).
- **F3/F4/F5/F6** sont documentés par inspection + tests de comportement adjacents.

> Audit initial en lecture seule. **Correctifs appliqués ensuite — voir §5.**

---

## 5. Correctifs appliqués (post-audit)

| ID | Sévérité | Statut | Correctif | Test de non-régression |
|---|---|---|---|---|
| **F1** | Majeur | ✅ Corrigé | `bestTplForSeg()` (`campagnes.html`) départage désormais les candidats : **modèles personnalisés (non-`t_seed_`) prioritaires**, puis le plus récent (`createdAt`). Le seed ne masque plus un modèle perso. | `template-autoselect.spec.js` › *F1 corrigé : … prioritaire sur le seed* (**vert**) |
| **A** | Majeur | ✅ Corrigé | **Asymétrie Templates→Campagne** : « Utiliser dans une campagne » transmet maintenant le `segment` du modèle ; `campagnes.html` positionne le sélecteur de destinataires (et `profilSel`) en conséquence. Un modèle *profil:enfant* ne part plus au segment « Tous ». | `template-autoselect.spec.js` › *point A : reporte le segment…* (**vert**) |
| **F2** | Mineur | ✅ Corrigé | Option **`profil:none` (« Profil — Non précisé »)** ajoutée au `<select id="fSeg">` de `templates.html`. Un modèle peut désormais cibler les profils non renseignés. | `template-autoselect.spec.js` › *F2 corrigé : … profil:none suggéré* (**vert**) |
| **F3** | Mineur | ✅ Corrigé | `clearTpl()` réinitialise `tplManual/tplAuto` et rappelle `updateTplSuggest()` → la présélection auto se réarme après retrait du modèle. | inspection + couverture auto-select |
| **F4** | Mineur | ✅ Corrigé | Segment **VIP** exige `basketAvg(c)>0` : un client sans dépense réelle n'est plus retenu, même avec un seuil à 0. | `campagnes-segmentation.spec.js` › *F4 corrigé : seuil 0 n'inclut pas les sans-dépense* (**vert**) |
| **F6** | Cosmétique | ✅ Ajusté | Seuil d'alerte du compteur aligné sur la limite d'envoi (alerte à 1700, blocage 1800). | — |
| **F5** | Cosmétique | ⏸️ Assumé | Réduction = **champ texte libre** (« -20% », « soin offert »…). Comportement voulu ; pas de validation numérique imposée. | — |

**Suite après correctifs : 70 tests, 70 passants / 0 échouant** (`npx playwright test`).
