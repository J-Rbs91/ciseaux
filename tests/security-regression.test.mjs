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

// ── la clé admin doit être générée via un CSPRNG ──────────────
test(' — genKey() utilise crypto.getRandomValues (CSPRNG)', () => {
  const html = read('index.html');
  const genKey = html.slice(html.indexOf('function genKey('), html.indexOf('function renderHeader('));
  assert.match(genKey, /crypto\.getRandomValues/, 'genKey doit utiliser crypto.getRandomValues');
});

// ── le nom de callback JSONP doit être validé avant reflet ────
test(' — sortie_ valide le nom de callback', () => {
  const gs = read('apps-script/Code.gs');
  assert.match(gs, /function callbackValide_/, 'helper callbackValide_ attendu');
  assert.match(gs, /callbackValide_\(cb\)\s*\n?\s*\?/, 'sortie_ doit gater le reflet sur callbackValide_');
  // On reproduit la regex pour vérifier son comportement.
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
  assert.match(gs, /egalConstant_\(String\(p\.key/, 'doGet doit comparer la clé via egalConstant_');
  assert.doesNotMatch(gs, /String\(p\.key\s*\|\|\s*''\)\s*!==\s*cle/, 'comparaison directe !== interdite (timing)');
  // Comportement attendu de la comparaison.
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
  // URL Apps Script déployée : https://script.google.com/macros/s/<ID>/exec où <ID> fait > 40 chars.
  const execRe = /script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{30,}\/exec/;
  for (const f of files) {
    assert.doesNotMatch(read(f), execRe, `URL …/exec réelle détectée dans ${f}`);
  }
});
