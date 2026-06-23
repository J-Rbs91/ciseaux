# Stress test — KuT / ciseaux

Mesures réelles via Playwright (Chromium), `STRESS=1 npx playwright test e2e/stress.spec.js --workers=1`.
Jeu de données : clients avec historique riche (≈ 11–12 visites/client, 1–2 prestations/visite).

---

## 1) Un salon : combien de CLIENTS avant que ça rame / casse ?

### Stats.html (le plus lourd en calcul)

| Clients | Passages | Poids JSON | parse | progressionData | render total | quota |
|--:|--:|--:|--:|--:|--:|:-:|
| 100 | 1 218 | 0,16 Mo | 1,3 ms | 16 ms | 41 ms | non |
| 250 | 3 010 | 0,40 Mo | 2 ms | 27 ms | 60 ms | non |
| 500 | 5 835 | 0,78 Mo | 3,4 ms | 37 ms | 92 ms | non |
| 1 000 | 11 591 | 1,55 Mo | 6,8 ms | 76 ms | 155 ms | non |
| 2 000 | 23 123 | 3,09 Mo | 13 ms | 170 ms | 292 ms | non |
| 3 000 | 34 248 | 4,59 Mo | 19 ms | 200 ms | 416 ms | non |
| **4 000** | 45 630 | **6,11 Mo** | — | — | — | **🔴 QUOTA** |

### Clients.html (le plus lourd en DOM — liste non virtualisée)

| Clients | render | nœuds DOM |
|--:|--:|--:|
| 100 | 6,6 ms | 892 |
| 500 | 20 ms | 4 092 |
| 1 000 | 41 ms | 8 092 |
| 2 000 | 81 ms | 16 092 |
| 3 000 | 129 ms | 24 092 |

### Verdict (un salon)

- **Mur dur ≈ 3 000–3 500 clients** : le quota `localStorage` (~5 Mo) est dépassé vers 4 000 clients à historique riche → **l'app ne peut plus enregistrer** (échec de sauvegarde / synchro). C'est LA limite à connaître. Elle dépend du nombre de visites/client : moins de visites → plafond plus haut (jusqu'à ~6–8 000 clients « légers »), plus de visites → plafond plus bas.
- **« Ça commence à ramer »** bien avant le mur, surtout **sur l'appareil réel d'un salon** (tablette/téléphone d'entrée de gamme = **3 à 8× plus lent** que la machine de test) :
  - Stats fluide jusqu'à ~**500 clients** (<100 ms ici → ~0,3–0,8 s sur tablette).
  - Stats perceptible à ~**1 000–1 500** (155–230 ms ici → ~**1–2 s** par changement de période sur tablette).
  - Liste clients lourde au défilement dès ~**1 500–2 000** (16 000+ nœuds DOM, pas de virtualisation).
- **Garde-fou déjà en place** : la purge automatique des inactifs (`crm-policy-v1`, 24 mois par défaut) borne la base **active** → en pratique, la plupart des salons restent loin du mur.

**Réponse courte :** confort jusqu'à ~**800–1 000 clients**, ça **rame** vers **1 500–2 000**, et ça **casse (quota)** vers **3 000–3 500** clients à historique fourni.

---

## 2) Combien de SALONS (utilisateurs) avant que ça tire la langue ?

**Architecturalement : aucune limite côté app.** Il n'y a **pas de serveur central**. Chaque salon = sa propre instance :
son `localStorage` (sur son appareil) + son **Google Apps Script + Drive** (sur son propre compte Google).
Ajouter des salons **n'ajoute aucune charge partagée** : ça scale horizontalement, gratuitement.

Les seules limites sont **par salon** (= par compte Google), indépendantes du nombre total de salons :

| Ressource (par compte Google du salon) | Plafond indicatif |
|---|---|
| Envoi d'emails Gmail (campagnes) | ~**500/jour** (Gmail grand public), ~1 500–2 000/jour (Workspace) |
| Apps Script — durée d'exécution | **6 min/exécution** |
| Apps Script — UrlFetch / triggers | ~20 000 appels/jour ; ~90 min/jour de triggers (grand public) |
| Stockage Drive (le JSON fait quelques Mo) | 15 Go gratuits → **jamais un problème** |

➡️ **« Le nombre de salons » n'est donc pas un facteur de ralentissement.** Le vrai plafond, c'est l'envoi de campagnes par salon (quota Gmail/jour). Tant que le script reste **déployé par salon** (chacun le sien), il n'y a pas de goulot d'étranglement commun.

⚠️ **Seul scénario où « le nombre de salons » deviendrait limitant** : si un jour tu mutualises **un même** Apps Script / Drive pour tous les salons. Là, les quotas ci-dessus deviendraient partagés → goulot. Le modèle actuel (1 script par salon) l'évite.

---

## 3) Recommandations pour repousser le mur (un salon)

Par ordre de rapport effort/gain :

1. **Pagination / virtualisation de la liste clients** (n'afficher que ~50 lignes + recherche) → supprime le coût DOM, gain immédiat dès 1 000+ clients.
2. **Migrer le stockage de `localStorage` → IndexedDB** (quota typiquement **50 Mo–plusieurs Go** au lieu de 5 Mo) → repousse le mur dur d'un facteur 10–100. Vrai changement structurant pour viser des salons « gros volume ».
3. **Mémoïser `progressionData()`** (recalcul des 13 mois à chaque rendu) → invalider seulement quand les données changent.
4. **Garder la purge automatique active** (déjà le cas) pour borner la base active.

---

_Banc d'essai : `e2e/stress.spec.js` (désactivé en suite normale ; lancer avec `STRESS=1`)._
