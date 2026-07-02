/* journal-ventes.js — Journal unique des prestations encaissées (clients fidélité + clients de passage).
   Objectif : pouvoir faire, chaque soir, un rapprochement complet entre les prestations
   réalisées et les sommes réellement encaissées, y compris pour les clients qui ne sont
   pas fichés dans le programme de fidélité.

   Principes (dans l'esprit des obligations françaises de logiciel de caisse — art. 286 I-3° bis
   du CGI — sans certification tierce, ce module reste un outil interne de bonne foi) :
     - jamais de suppression : une correction s'enregistre comme une écriture d'ANNULATION
       (montant négatif) qui référence l'écriture d'origine ; rien n'est retiré du tableau.
     - chaînage d'empreinte SHA-256 (Web Crypto) entre écritures successives, pour pouvoir
       détecter toute modification a posteriori via verifyIntegrity().
     - conservation longue par défaut (pas de purge automatique) + exportArchive() pour
       sortir les données du navigateur (sauvegarde externe, au-delà de la durée légale).

   Conçu pour une bascule future vers un backend multi-tenant (VPS) : chaque écriture porte
   un salonId stable, et toute la persistance passe par load()/save() ci-dessous — remplacer
   ces deux fonctions par des appels à une API suffira à migrer sans toucher au reste de l'app.

   API globale :
     Journal.salonId()                      identifiant stable du salon (généré localement pour l'instant)
     Journal.record(entry) -> Promise<entry>  enregistre une prestation encaissée
     Journal.cancel(id, motif) -> Promise<entry>  annule une écriture (contre-écriture, rien n'est supprimé)
     Journal.all()                          tout le journal
     Journal.forDate(dateStr)               écritures d'un jour donné (format JJ/MM/AAAA)
     Journal.today() / Journal.todayKey()   raccourcis pour la date du jour
     Journal.totalForDate(dateStr)          {total, count, entries} net (annulations incluses)
     Journal.verifyIntegrity() -> Promise<{ok,brokenAt,checked}>   revérifie tout le chaînage
     Journal.exportArchive(fromDateStr, toDateStr)   objet exportable (JSON) du journal
*/
(function (global) {
  var LS_JOURNAL = 'journal-ventes-v1';
  var LS_SALON_ID = 'salon-id-v1';

  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function salonId() {
    var id = localStorage.getItem(LS_SALON_ID);
    if (!id) { id = uuid(); localStorage.setItem(LS_SALON_ID, id); }
    return id;
  }

  function load() { try { return JSON.parse(localStorage.getItem(LS_JOURNAL) || '[]') || []; } catch (e) { return []; } }
  function save(arr) { localStorage.setItem(LS_JOURNAL, JSON.stringify(arr)); }

  function hasCrypto() { return typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function'; }

  function sha256Hex(str) {
    if (!hasCrypto()) return Promise.resolve(null);
    var enc = new TextEncoder().encode(str);
    return crypto.subtle.digest('SHA-256', enc).then(function (buf) {
      var bytes = Array.prototype.slice.call(new Uint8Array(buf));
      return bytes.map(function (b) { return (b < 16 ? '0' : '') + b.toString(16); }).join('');
    });
  }

  function canonical(e) {
    // Sérialisation à clés fixes : le hash doit être reproductible indépendamment de l'ordre d'insertion.
    return JSON.stringify({
      id: e.id, salonId: e.salonId, ts: e.ts, clientId: e.clientId || null, clientNom: e.clientNom || '',
      items: e.items || [], montant: e.montant, moyenPaiement: e.moyenPaiement || '', source: e.source || '',
      annuleDe: e.annuleDe || null, prevHash: e.prevHash || 'GENESIS'
    });
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function dateKey(iso) {
    var d = new Date(iso);
    return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear();
  }
  function parseFrDate(s) {
    var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s || '');
    if (!m) return new Date(s);
    return new Date(+m[3], +m[2] - 1, +m[1]);
  }

  function lastHash() {
    var all = load();
    return all.length ? (all[all.length - 1].hash || 'GENESIS') : 'GENESIS';
  }

  function record(input) {
    var e = {
      id: 'v_' + Date.now() + '_' + Math.floor(Math.random() * 1e6),
      salonId: salonId(),
      ts: new Date().toISOString(),
      clientId: input.clientId || null,
      clientNom: String(input.clientNom || '').trim(),
      items: Array.isArray(input.items) ? input.items : [],
      montant: Math.round((+input.montant || 0) * 100) / 100,
      moyenPaiement: String(input.moyenPaiement || ''),
      source: String(input.source || 'manuel'),
      annuleDe: input.annuleDe || null,
      motif: String(input.motif || ''),
      prevHash: lastHash()
    };
    e.dateStr = dateKey(e.ts);
    return sha256Hex(canonical(e)).then(function (h) {
      e.hash = h;
      var all = load();
      all.push(e);
      save(all);
      return e;
    });
  }

  function cancel(id, motif) {
    var all = load();
    var orig = all.find(function (x) { return x.id === id; });
    if (!orig) return Promise.reject(new Error('Écriture introuvable'));
    if (orig.annule) return Promise.reject(new Error('Cette écriture est déjà annulée'));
    orig.annule = true; // marquage informatif seulement — l'écriture d'origine reste dans le journal
    save(all);
    return record({
      clientId: orig.clientId, clientNom: orig.clientNom, items: orig.items,
      montant: -orig.montant, moyenPaiement: orig.moyenPaiement,
      source: 'annulation', annuleDe: orig.id, motif: motif || ''
    });
  }

  function all() { return load(); }
  function forDate(dateStr) { return load().filter(function (e) { return e.dateStr === dateStr; }); }
  function todayKey() { return dateKey(new Date().toISOString()); }
  function today() { return forDate(todayKey()); }

  function totalForDate(dateStr) {
    var entries = forDate(dateStr), total = 0, count = 0;
    entries.forEach(function (e) {
      total = Math.round((total + (+e.montant || 0)) * 100) / 100;
      if (e.montant > 0 && e.source !== 'annulation') count++;
    });
    return { total: total, count: count, entries: entries };
  }

  function verifyIntegrity() {
    var arr = load();
    if (!arr.length) return Promise.resolve({ ok: true, brokenAt: null, checked: 0 });
    var i = 0, prev = 'GENESIS';
    function step() {
      if (i >= arr.length) return Promise.resolve({ ok: true, brokenAt: null, checked: arr.length });
      var e = arr[i];
      if (e.prevHash !== prev) return Promise.resolve({ ok: false, brokenAt: e.id, checked: i });
      if (e.hash == null) { prev = 'GENESIS'; i++; return step(); } // hachage indisponible à l'origine (appareil sans Web Crypto) : on ne peut pas vérifier ce maillon
      return sha256Hex(canonical(e)).then(function (h) {
        if (h !== e.hash) return { ok: false, brokenAt: e.id, checked: i };
        prev = e.hash; i++;
        return step();
      });
    }
    return step();
  }

  function exportArchive(fromDateStr, toDateStr) {
    var arr = load();
    if (fromDateStr || toDateStr) {
      arr = arr.filter(function (e) {
        var t = +new Date(e.ts);
        if (fromDateStr && t < +parseFrDate(fromDateStr)) return false;
        if (toDateStr && t > +parseFrDate(toDateStr) + 86399999) return false;
        return true;
      });
    }
    return { app: 'ciseaux-kut', type: 'journal-ventes', version: 1, salonId: salonId(), exportedAt: new Date().toISOString(), entries: arr };
  }

  global.Journal = {
    salonId: salonId,
    record: record,
    cancel: cancel,
    all: all,
    forDate: forDate,
    today: today,
    todayKey: todayKey,
    totalForDate: totalForDate,
    verifyIntegrity: verifyIntegrity,
    exportArchive: exportArchive
  };
})(window);
