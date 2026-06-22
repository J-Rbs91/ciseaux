// Helpers partagés pour l'audit e2e du CRM KuT.
// Tous les tests seedent leur propre localStorage AVANT le chargement de la page
// via page.addInitScript, afin d'être déterministes et indépendants.

const SYNC_URL = 'https://example.invalid/exec'; // URL de synchro bidon (jamais appelée pour de vrai)

/**
 * Installe un état localStorage déterministe AVANT le chargement de la page.
 * @param {import('@playwright/test').Page} page
 * @param {Object} data { clients, templates, offres, fidelite, syncUrl, extra }
 */
// Le script d'init se rejoue à CHAQUE navigation/reload. Pour ne pas écraser des
// données créées par l'app (persistance, cohérence inter-pages), on ne pose une
// clé QUE si elle est absente (sentinelle '__kut_seeded' posée une seule fois).
async function seed(page, data = {}) {
  await page.addInitScript((d) => {
    try {
      if (localStorage.getItem('__kut_seeded') === '1') return; // déjà seedé : on laisse l'app gérer
      localStorage.setItem('__kut_seeded', '1');
      if (d.clients !== undefined) localStorage.setItem('clients-v1', JSON.stringify(d.clients));
      if (d.templates !== undefined) localStorage.setItem('email-templates-v1', JSON.stringify(d.templates));
      if (d.offres !== undefined) localStorage.setItem('offres-v1', JSON.stringify(d.offres));
      if (d.fidelite !== undefined) localStorage.setItem('fidelite-config-v1', JSON.stringify(d.fidelite));
      if (d.profilMagasin !== undefined) localStorage.setItem('profil-magasin-v1', JSON.stringify(d.profilMagasin));
      if (d.syncUrl !== undefined) localStorage.setItem('sync-url-v1', d.syncUrl);
      if (d.extra) Object.keys(d.extra).forEach((k) => localStorage.setItem(k, d.extra[k]));
    } catch (e) {}
  }, data);
}

// Crée un client minimal normalisé.
function client(o = {}) {
  return Object.assign({
    id: 'c_' + Math.floor(Math.random() * 1e9) + '_1',
    nom: 'Test Client',
    mail: 'test@example.com',
    tel: '', dob: '', profil: '', notes: '',
    points: 0, visitsCount: 0, offre: '',
    optin: true, maj: '', visites: [], ledger: [],
  }, o);
}

// Visite avec date relative (jours dans le passé) et montant optionnel.
function visit(daysAgo, montant, items) {
  const d = new Date(Date.now() - daysAgo * 86400000);
  const v = { date: d.toISOString().slice(0, 10) };
  if (montant != null) v.montant = montant;
  if (items) v.items = items;
  return v;
}

function tpl(o = {}) {
  return Object.assign({
    id: 't_' + Math.floor(Math.random() * 1e9),
    segment: '', nom: 'Modèle', sujet: 'Sujet', titre: '', sousTitre: '',
    accroche: '', corps: 'Corps', offresIds: [], afficherFidelite: false,
    phraseSortie: '', salutation: '', signature: '', logoDataUrl: '', logoUrl: '',
    createdAt: '',
  }, o);
}

function offre(o = {}) {
  return Object.assign({
    id: 'o_' + Math.floor(Math.random() * 1e9), nom: 'Offre', reduction: '',
    desc: '', validite: '', anniv: false, prestations: [], emailSujet: '',
    emailCorps: '', actif: true, createdAt: '',
  }, o);
}

// Lit une clé localStorage parsée depuis la page courante.
async function lsGet(page, key) {
  return page.evaluate((k) => {
    try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return localStorage.getItem(k); }
  }, key);
}

module.exports = { SYNC_URL, seed, client, visit, tpl, offre, lsGet };
