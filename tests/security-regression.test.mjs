// Garde-fous de non-régression — exécution : `node --test`
// Aucune dépendance externe (Node >= 18, runner intégré).
// Ces tests vérifient, par analyse statique des sources, que certaines
// propriétés de robustesse du code restent en place et ne « régressent » pas.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

// Clé admin : générée côté serveur uniquement (jamais côté client).
test('clé admin générée côté serveur (Utilities.getUuid)', () => {
  const idx = read('index.html');
  assert.doesNotMatch(idx, /function genKey\(/, 'pas de génération de clé côté client');
  assert.doesNotMatch(idx, /fAdminKey'\)\.value\s*=\s*\(Date\.now/, 'la clé ne doit pas être générée côté client');
  const gs = read('apps-script/Code.gs');
  const gen = gs.slice(gs.indexOf('function genererCleAdmin('));
  assert.match(gen.slice(0, 200), /Utilities\.getUuid\(\)/, 'genererCleAdmin doit utiliser Utilities.getUuid');
});

// La clé admin ne peut pas être posée depuis le réseau.
test('aucune pose de clé admin depuis le réseau', () => {
  const gs = read('apps-script/Code.gs');
  assert.doesNotMatch(gs, /case 'claimKey'/, "le cas 'claimKey' ne doit pas exister dans le dispatcher");
  assert.doesNotMatch(gs, /function revendiquerCle_/, 'revendiquerCle_ ne doit pas exister');
  assert.doesNotMatch(gs, /ACTIONS_PUBLIQUES\s*=\s*\{[^}]*claimKey/, "claimKey ne doit pas être une action publique");
  const idx = read('index.html');
  assert.doesNotMatch(idx, /action:'claimKey'/, "l'app ne doit pas appeler claimKey");
});

// Formulaire public de réservation : garde-fous anti-abus.
test('réservation publique : throttle par email + plafond quotidien', () => {
  const gs = read('apps-script/Code.gs');
  assert.match(gs, /function compteurJour_/, 'compteur quotidien attendu');
  assert.match(gs, /function incrCompteurJour_/, 'incrément quotidien attendu');
  assert.match(gs, /resa_m_/, 'throttle par email attendu');
  assert.match(gs, /maxResaJour/, 'plafond journalier configurable attendu');
});

// Synchro : transport POST (clé dans le corps) avec repli, et doPost serveur.
test('synchro : POST avec repli et doPost côté serveur', () => {
  const gs = read('apps-script/Code.gs');
  assert.match(gs, /function doPost\(e\)/, 'doPost attendu côté Apps Script');
  assert.match(gs, /function traiter_\(/, 'dispatcher commun traiter_ attendu');
  for (const f of ['index.html', 'app-sync.js', 'campagnes.html', 'clients.html', 'offres.html', 'prestations.html', 'reservations.html']) {
    const src = read(f);
    assert.match(src, /function jsonpRaw\(/, `${f} doit conserver le repli jsonpRaw`);
    assert.match(src, /method:'POST'[\s\S]{0,80}text\/plain/, `${f} doit tenter un POST text/plain`);
  }
});

// Désinscription : lien signé (HMAC) vérifié à temps constant.
test('désinscription : lien signé HMAC', () => {
  const gs = read('apps-script/Code.gs');
  assert.match(gs, /function signUnsub_/, 'signUnsub_ attendu');
  assert.match(gs, /computeHmacSha256Signature/, 'signature HMAC-SHA256 attendue');
  assert.match(gs, /lienDesinscription_\(baseUrl, c\.id\)/, 'les emails doivent utiliser le lien signé');
  assert.match(gs, /egalConstant_\(sig, signUnsub_\(p\.id\)\)/, 'la signature doit être vérifiée à temps constant');
});

// Désinscription : aucune action sur un GET non signé (confirmation POST requise).
test('désinscription : pas d\'action sur GET non signé', () => {
  const gs = read('apps-script/Code.gs');
  assert.doesNotMatch(gs, /if \(!sig \|\|/, 'aucune tolérance « sans signature » sur GET');
  assert.match(gs, /function pageConfirmationDesinscription_/, 'page de confirmation (POST) attendue');
  assert.match(gs, /estPost && String\(p\.confirm/, 'la désinscription héritée exige un POST confirmé');
  assert.match(gs, /pageDesinscription_\(p, true\)/, 'doPost route avec estPost=true');
  assert.match(gs, /pageDesinscription_\(p, false\)/, 'doGet ne modifie pas l\'état (estPost=false)');
});

// Nom de callback JSONP validé avant reflet.
test('callback JSONP validé avant reflet', () => {
  const gs = read('apps-script/Code.gs');
  assert.match(gs, /function callbackValide_/, 'helper callbackValide_ attendu');
  assert.match(gs, /callbackValide_\(cb\)/, 'sortie_ doit gater le reflet sur callbackValide_');
  const ok = (cb) => typeof cb === 'string' && cb.length > 0 && cb.length <= 64 && /^[A-Za-z_$][A-Za-z0-9_$.]*$/.test(cb);
  assert.equal(ok('cb_123_456'), true);
  assert.equal(ok('alert(1)//'), false);
  assert.equal(ok('<script>'), false);
  assert.equal(ok(''), false);
});

// Comparaison de la clé admin à temps constant.
test('comparaison de la clé admin à temps constant', () => {
  const gs = read('apps-script/Code.gs');
  assert.match(gs, /function egalConstant_/, 'helper egalConstant_ attendu');
  assert.match(gs, /egalConstant_\(String\(p\.key/, 'la garde doit comparer la clé via egalConstant_');
  assert.doesNotMatch(gs, /String\(p\.key\s*\|\|\s*''\)\s*!==\s*cle/, 'pas de comparaison directe !==');
  const eq = (a, b) => {
    a = String(a ?? ''); b = String(b ?? '');
    let diff = a.length ^ b.length;
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
    return diff === 0;
  };
  assert.equal(eq('secret', 'secret'), true);
  assert.equal(eq('secret', 'secreT'), false);
  assert.equal(eq('secret', 'secret1'), false);
});

// CSP durcie présente sur toutes les pages.
test('CSP durcie présente sur toutes les pages', () => {
  const pages = ['index.html', 'caisse.html', 'campagnes.html', 'clients.html', 'confidentialite.html',
    'fidelite.html', 'marketing.html', 'offres.html', 'prestations.html', 'reservation.html',
    'reservations.html', 'stats.html', 'templates.html'];
  for (const f of pages) {
    const src = read(f);
    const m = src.match(/http-equiv="Content-Security-Policy" content="([^"]*)"/);
    assert.ok(m, `CSP attendue dans ${f}`);
    const csp = m[1];
    assert.match(csp, /default-src 'self'/, `default-src 'self' attendu dans ${f}`);
    assert.match(csp, /object-src 'none'/, `object-src 'none' attendu dans ${f}`);
    assert.match(csp, /base-uri 'self'/, `base-uri 'self' attendu dans ${f}`);
    assert.match(csp, /script-src[^;]*script\.googleusercontent\.com/, `script-src doit autoriser l'hôte de redirection Apps Script dans ${f}`);
    assert.match(csp, /connect-src[^;]*script\.google\.com/, `connect-src doit autoriser Apps Script dans ${f}`);
  }
});

// Export : la clé admin / l'URL ne sont embarquées que sur accord explicite.
test('export : secrets (clé / URL) en opt-in', () => {
  const idx = read('index.html');
  assert.match(idx, /var withSecrets=hasSecrets&&confirm\(/, 'inclusion des secrets soumise à confirmation explicite');
  assert.match(idx, /if\(withSecrets\)\{bundle\.syncUrl=su\(\);bundle\.adminKey=ak\(\);\}/, 'secrets ajoutés uniquement si withSecrets');
  assert.doesNotMatch(idx, /\n\s*bundle\.adminKey=ak\(\);\n/, 'la clé admin ne doit pas être exportée inconditionnellement');
});

// Les initiales clients sont échappées avant insertion HTML.
test('initiales clients échappées', () => {
  const html = read('clients.html');
  assert.match(html, /esc\(ini\(c\.nom\)\)/, 'ini(c.nom) doit être enveloppé par esc()');
  assert.doesNotMatch(html, /class="avatar">'\+ini\(c\.nom\)\+'/, 'ini() ne doit pas être inséré sans esc()');
});

// Valeurs renvoyées par le backend : compteurs bornés et message échappé.
test('valeurs distantes bornées et message échappé', () => {
  const html = read('campagnes.html');
  assert.match(html, /escH\(r\?r\.error:'inconnue'\)/, "le message d'erreur doit être échappé via escH()");
  assert.doesNotMatch(html, /'Échec : '\+\(r\?r\.error/, "le message d'erreur ne doit pas être concaténé sans échappement");
  assert.match(html, /nQuota/, 'compteurs distants coercés en variables numériques');
  assert.doesNotMatch(html, /Quota Gmail restant : '\+r\.quotaRestant/, 'valeur distante non concaténée brute');
});

// Aucun secret réel ne doit être commité (URL …/exec hors exemples).
test('aucun secret réel commité', () => {
  const files = ['index.html', 'app-sync.js', 'apps-script/Code.gs', 'campagnes.html', 'clients.html', 'reservation.html'];
  const execRe = /script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{30,}\/exec/;
  for (const f of files) {
    assert.doesNotMatch(read(f), execRe, `URL …/exec réelle détectée dans ${f}`);
  }
});
