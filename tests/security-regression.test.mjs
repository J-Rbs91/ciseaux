// Garde-fous de non-régression de sécurité — exécution : `node --test`
// Aucune dépendance externe (Node >= 18, runner intégré).
// Ces tests vérifient, par analyse statique des sources, que les correctifs
// de SECURITY_AUDIT_REPORT.md restent en place et ne « régressent » pas.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

// ──  / aucune génération de clé admin côté client ─────
// La clé est désormais générée côté serveur (genererCleAdmin → Utilities.getUuid).
test(' — pas de génération de clé admin par Math.random côté client', () => {
  const idx = read('index.html');
  assert.doesNotMatch(idx, /function genKey\(/, 'genKey() doit avoir été retiré');
  assert.doesNotMatch(idx, /fAdminKey'\)\.value\s*=\s*\(Date\.now/, 'plus de clé générée via Date.now/Math.random');
  const gs = read('apps-script/Code.gs');
  const gen = gs.slice(gs.indexOf('function genererCleAdmin('));
  assert.match(gen.slice(0, 200), /Utilities\.getUuid\(\)/, 'genererCleAdmin doit utiliser Utilities.getUuid (CSPRNG)');
});

// ── plus d'amorçage public de la clé (claimKey retiré) ────────
test(' — aucun claimKey public exécutable', () => {
  const gs = read('apps-script/Code.gs');
  assert.doesNotMatch(gs, /case 'claimKey'/, "le cas 'claimKey' ne doit plus exister dans le dispatcher");
  assert.doesNotMatch(gs, /function revendiquerCle_/, 'revendiquerCle_ doit avoir été retiré');
  assert.doesNotMatch(gs, /ACTIONS_PUBLIQUES\s*=\s*\{[^}]*claimKey/, "claimKey ne doit pas être une action publique");
  const idx = read('index.html');
  assert.doesNotMatch(idx, /action:'claimKey'/, "l'app ne doit plus appeler claimKey");
});

// ── garde-fous anti-abus du formulaire public ─────────────────
test(' — booking public : throttle par email + plafond du jour', () => {
  const gs = read('apps-script/Code.gs');
  assert.match(gs, /function compteurJour_/, 'compteur quotidien attendu');
  assert.match(gs, /function incrCompteurJour_/, 'incrément quotidien attendu');
  assert.match(gs, /resa_m_/, 'throttle par email attendu');
  assert.match(gs, /maxResaJour/, 'plafond journalier configurable attendu');
});

// ── transport POST (clé hors URL) + doPost serveur ────────────
test(' — POST d\'abord avec repli JSONP, et doPost côté serveur', () => {
  const gs = read('apps-script/Code.gs');
  assert.match(gs, /function doPost\(e\)/, 'doPost attendu côté Apps Script');
  assert.match(gs, /function traiter_\(/, 'dispatcher commun traiter_ attendu');
  for (const f of ['index.html', 'app-sync.js', 'campagnes.html', 'clients.html', 'offres.html', 'prestations.html', 'reservations.html']) {
    const src = read(f);
    assert.match(src, /function jsonpRaw\(/, `${f} doit conserver le repli jsonpRaw`);
    assert.match(src, /method:'POST'[\s\S]{0,80}text\/plain/, `${f} doit tenter un POST text/plain`);
  }
});

// ── lien de désinscription signé (HMAC) ───────────────────────
test(' — désinscription signée HMAC', () => {
  const gs = read('apps-script/Code.gs');
  assert.match(gs, /function signUnsub_/, 'signUnsub_ attendu');
  assert.match(gs, /computeHmacSha256Signature/, 'signature HMAC-SHA256 attendue');
  assert.match(gs, /lienDesinscription_\(baseUrl, c\.id\)/, 'les emails doivent utiliser le lien signé');
  assert.match(gs, /egalConstant_\(sig, signUnsub_\(p\.id\)\)/, 'le handler doit vérifier la signature à temps constant');
});

// ── le nom de callback JSONP doit être validé avant reflet ────
test(' — sortie_ valide le nom de callback', () => {
  const gs = read('apps-script/Code.gs');
  assert.match(gs, /function callbackValide_/, 'helper callbackValide_ attendu');
  assert.match(gs, /callbackValide_\(cb\)/, 'sortie_ doit gater le reflet sur callbackValide_');
  const ok = (cb) => typeof cb === 'string' && cb.length > 0 && cb.length <= 64 && /^[A-Za-z_$][A-Za-z0-9_$.]*$/.test(cb);
  assert.equal(ok('cb_123_456'), true);
  assert.equal(ok('alert(1)//'), false);
  assert.equal(ok('<script>'), false);
  assert.equal(ok(''), false);
});

// ── comparaison de la clé admin à temps constant ──────────────
test(' — egalConstant_ est utilisé pour comparer la clé admin', () => {
  const gs = read('apps-script/Code.gs');
  assert.match(gs, /function egalConstant_/, 'helper egalConstant_ attendu');
  assert.match(gs, /egalConstant_\(String\(p\.key/, 'la garde doit comparer la clé via egalConstant_');
  assert.doesNotMatch(gs, /String\(p\.key\s*\|\|\s*''\)\s*!==\s*cle/, 'comparaison directe !== interdite (timing)');
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

// ── CSP (meta) présente sur les pages ─────────────────────────
test(' — CSP meta présente sur toutes les pages applicatives', () => {
  const pages = ['index.html', 'caisse.html', 'campagnes.html', 'clients.html', 'confidentialite.html',
    'fidelite.html', 'offres.html', 'prestations.html', 'reservation.html', 'reservations.html',
    'stats.html', 'templates.html'];
  for (const f of pages) {
    assert.match(read(f), /http-equiv="Content-Security-Policy"[^>]*object-src 'none'/, `CSP attendue dans ${f}`);
  }
});

// ── les initiales clients doivent être échappées ──────────────
test(' — clients.html échappe la sortie de ini()', () => {
  const html = read('clients.html');
  assert.match(html, /esc\(ini\(c\.nom\)\)/, 'ini(c.nom) doit être enveloppé par esc()');
  assert.doesNotMatch(html, /class="avatar">'\+ini\(c\.nom\)\+'/, 'ini() ne doit pas être inséré sans esc()');
});

// ── res() ne reçoit pas de valeurs distantes non maîtrisées ───
test(' — campagnes.html borne les compteurs et échappe r.error', () => {
  const html = read('campagnes.html');
  assert.match(html, /escH\(r\?r\.error:'inconnue'\)/, "r.error doit être échappé via escH()");
  assert.doesNotMatch(html, /'Échec : '\+\(r\?r\.error/, 'r.error ne doit pas être concaténé sans échappement');
  assert.match(html, /nQuota/, 'compteurs distants coercés en variables numériques (nQuota)');
  assert.doesNotMatch(html, /Quota Gmail restant : '\+r\.quotaRestant/, 'r.quotaRestant ne doit pas être concaténé brut');
});

// ── Garde anti-secret : aucun secret réel ne doit être commité ───────────
test('Aucun secret réel commité (URL …/exec ou clé) hors exemples', () => {
  const files = ['index.html', 'app-sync.js', 'apps-script/Code.gs', 'campagnes.html', 'clients.html', 'reservation.html'];
  const execRe = /script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{30,}\/exec/;
  for (const f of files) {
    assert.doesNotMatch(read(f), execRe, `URL …/exec réelle détectée dans ${f}`);
  }
});
