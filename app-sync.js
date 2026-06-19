/* app-sync.js — Synchro Google Drive (via Apps Script).
   Modèle : Drive = source de vérité, localStorage = cache.
   Écritures PAR CLIENT (upsert / delete) → charge utile légère, pas de
   réécriture globale ni de limite de longueur d'URL.
   File d'attente locale (dirty / suppressions) pour résister au hors-ligne.

   API globale :
     DB.boot(cb)      vide la file en attente, récupère la base, puis cb(ok)
     DB.upsert(client) enregistre/màj un client sur le Drive
     DB.remove(id)     supprime un client sur le Drive
     DB.pull(cb)       force une récupération
     DB.configured()   true si une URL de synchro est configurée
     DB.pending()      nombre d'écritures en attente
     DB.onStatus(fn)   fn(message, classe) pour un indicateur de statut
*/
(function (global) {
  var LS_C = 'clients-v1', LS_S = 'sync-url-v1',
      LS_DIRTY = 'clients-dirty-v1', LS_DEL = 'clients-del-v1';

  function lc(){ try { return JSON.parse(localStorage.getItem(LS_C) || '[]'); } catch (e) { return []; } }
  function sc(a){ localStorage.setItem(LS_C, JSON.stringify(a)); }
  function su(){ return (localStorage.getItem(LS_S) || '').trim(); }
  function isOptin(v){ if (v === true) return true; var s = String(v == null ? '' : v).trim().toLowerCase(); return s==='oui'||s==='true'||s==='1'||s==='x'||s==='yes'; }
  function arr_(v){ if (Array.isArray(v)) return v; if (typeof v === 'string' && v) { try { return JSON.parse(v) || []; } catch (e) {} } return []; }

  function normClient(c){
    return {
      id: String(c.id || ('c_' + Date.now() + '_' + Math.floor(Math.random()*9999))),
      nom: String(c.nom || ''), tel: String(c.tel || ''), mail: String(c.mail || ''),
      dob: String(c.dob || ''),
      notes: String(c.notes || ''), points: parseInt(c.points, 10) || 0,
      visitsCount: parseInt(c.visitsCount, 10) || 0, offre: String(c.offre || ''),
      optin: isOptin(c.optin), maj: String(c.maj || ''),
      visites: arr_(c.visites), ledger: arr_(c.ledger)
    };
  }

  // ── Rétention / suppression automatique des clients inactifs ──
  // Politique partagée avec la page Clients (clé localStorage 'crm-policy-v1').
  // Par défaut : suppression automatique 24 mois (2 ans) après la dernière activité.
  var LS_POL = 'crm-policy-v1', purgedCount = 0;
  function policy(){
    try { return Object.assign({ purgeMonths: 24, autoPurge: true }, JSON.parse(localStorage.getItem(LS_POL) || '{}')); }
    catch (e) { return { purgeMonths: 24, autoPurge: true }; }
  }
  function lastActivity(c){
    var ts = 0;
    if (Array.isArray(c.visites)) c.visites.forEach(function (v) { if (v && v.date) { var t = +new Date(v.date); if (t > ts) ts = t; } });
    if (c.maj) { var m = +new Date(c.maj); if (m > ts) ts = m; }
    if (!ts) { var mm = String(c.id || '').match(/^c_(\d+)_/); if (mm) ts = +mm[1]; }
    return ts;
  }
  // Supprime (localement + sur le Drive) les clients sans activité depuis le délai configuré.
  // Renvoie la liste des id supprimés. Sûr : ne touche jamais un client non datable.
  function autoPurge(){
    var pol = policy();
    if (!pol.autoPurge) return [];
    var m = parseInt(pol.purgeMonths, 10) || 24;
    if (m < 1) return [];
    var cut = Date.now() - m * 30.44 * 86400000;
    var keep = [], removed = [];
    lc().forEach(function (c) { var t = lastActivity(c); if (t && t < cut) removed.push(c.id); else keep.push(c); });
    if (removed.length) {
      sc(keep);
      removed.forEach(function (id) { remove(id); });   // file de suppression + Drive si configuré
      purgedCount += removed.length;
    }
    return removed;
  }

  function jget(key){ try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { return []; } }
  function jset(key, a){ localStorage.setItem(key, JSON.stringify(a)); }
  function addId(key, id){ var a = jget(key); if (a.indexOf(id) < 0) { a.push(id); jset(key, a); } }
  function rmId(key, id){ jset(key, jget(key).filter(function (x) { return x !== id; })); }

  var statusCb = null;
  function status(msg, cls){ if (statusCb) try { statusCb(msg, cls || ''); } catch (e) {} }

  function jsonp(base, params, cb){
    if (!('key' in params)) { var ak = ''; try { ak = (localStorage.getItem('admin-key-v1')||'').trim(); } catch (e) {} if (ak) params.key = ak; }
    var name = 'cb_' + Date.now() + '_' + Math.floor(Math.random()*1e6);
    var s = document.createElement('script'), done = false;
    var t = setTimeout(function () { if (!done) fin({ ok:false, error:'délai dépassé' }); }, 20000);
    function fin(r){ done = true; clearTimeout(t); try { delete global[name]; } catch (e) { global[name] = undefined; } if (s.parentNode) s.parentNode.removeChild(s); cb(r); }
    global[name] = function (r) { fin(r); };
    s.onerror = function () { fin({ ok:false, error:'réseau' }); };
    var q = []; for (var k in params) if (params.hasOwnProperty(k)) q.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
    q.push('callback=' + name);
    s.src = base + (base.indexOf('?') >= 0 ? '&' : '?') + q.join('&');
    document.body.appendChild(s);
  }

  function upsert(c){
    if (!c || !c.id) return;
    var url = su(); if (!url) return;            // pas de synchro -> cache local seul
    addId(LS_DIRTY, c.id); renderBanner();
    jsonp(url, { action:'upsertClient', client: JSON.stringify(c) }, function (r) {
      if (r && r.ok) rmId(LS_DIRTY, c.id);
      statusSynced();
    });
  }
  function remove(id){
    if (!id) return;
    var url = su(); if (!url) return;
    rmId(LS_DIRTY, id); addId(LS_DEL, id); renderBanner();
    jsonp(url, { action:'deleteClient', id: id }, function (r) {
      if (r && r.ok) rmId(LS_DEL, id);
      statusSynced();
    });
  }

  // Vide la file (suppressions puis upserts) une par une, puis cb()
  function flush(cb){
    var url = su(); if (!url) { if (cb) cb(); return; }
    var all = lc(), tasks = [];
    jget(LS_DEL).forEach(function (id) { tasks.push({ t:'del', id:id }); });
    jget(LS_DIRTY).forEach(function (id) {
      var c = all.filter(function (x) { return x.id === id; })[0];
      if (c) tasks.push({ t:'up', c:c }); else rmId(LS_DIRTY, id);
    });
    var i = 0;
    (function next(){
      if (i >= tasks.length) { if (cb) cb(); return; }
      var task = tasks[i++];
      if (task.t === 'del') jsonp(url, { action:'deleteClient', id: task.id }, function (r) { if (r && r.ok) rmId(LS_DEL, task.id); next(); });
      else jsonp(url, { action:'upsertClient', client: JSON.stringify(task.c) }, function (r) { if (r && r.ok) rmId(LS_DIRTY, task.c.id); next(); });
    })();
  }

  function statusSynced(){ var p = jget(LS_DIRTY).length + jget(LS_DEL).length; if (p) status('⚠ ' + p + ' modif. en attente', 'err'); else status('✓ à jour', 'ok'); renderBanner(); }

  // Bannière d'alerte visible quand on est HORS-LIGNE avec des modifs non envoyées.
  function renderBanner(){
    if (typeof document === 'undefined' || !document.body) return;
    var p = jget(LS_DIRTY).length + jget(LS_DEL).length;
    var off = (typeof navigator !== 'undefined' && navigator.onLine === false);
    var el = document.getElementById('kut-sync-banner');
    if (p > 0 && off) {
      if (!el) {
        el = document.createElement('div');
        el.id = 'kut-sync-banner';
        el.setAttribute('role', 'alert');
        el.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#A22C29;color:#fff;font-family:inherit;font-size:.85rem;font-weight:700;line-height:1.45;padding:.7rem 1rem;text-align:center;box-shadow:0 -2px 14px rgba(0,0,0,.35)';
        document.body.appendChild(el);
      }
      el.textContent = '⚠ Hors-ligne — ' + p + ' modification' + (p > 1 ? 's' : '') + ' pas encore enregistrée' + (p > 1 ? 's' : '') + ' sur le Drive. Ne fermez pas l’application : tout repartira au retour de la connexion.';
      el.style.display = 'block';
    } else if (el) {
      el.style.display = 'none';
    }
  }
  function pull(cb, quiet){
    var url = su(); if (!url) { if (cb) cb(false); return; }
    if (!quiet) status('⏳ synchro…', 'work');
    jsonp(url, { action:'loadClients' }, function (r) {
      if (r && r.ok) {
        var a = []; try { a = JSON.parse(r.data || '[]'); } catch (e) {}
        sc(a.filter(function (c) { return c && (c.id || c.nom); }).map(normClient));
        autoPurge();   // applique la rétention après chaque récupération (converge le Drive)
        statusSynced(); if (cb) cb(true);
      } else { status('⚠ hors-ligne (données locales)', 'err'); if (cb) cb(false); }
    });
  }

  function boot(cb){
    if (!su()) { autoPurge(); if (cb) cb(false); return; }   // local seul : on applique quand même la rétention
    flush(function () { pull(function (ok) { if (cb) cb(ok); }); });
  }

  // ---- Actualisation auto multi-appareils + garde-fou anti-perte ----
  var busy = false, autoTimer = null, autoCb = null;
  function syncNow(){
    if (!su() || busy) return;
    try { if (document.querySelector && document.querySelector('.overlay.open')) return; } catch (e) {} // ne pas perturber une saisie en cours
    busy = true;
    flush(function () { pull(function () { busy = false; if (autoCb) try { autoCb(); } catch (e) {} }, true); });
  }
  function startAutoSync(cb){
    autoCb = cb || null;
    try {
      window.addEventListener('beforeunload', function (e) {
        if (su() && (jget(LS_DIRTY).length + jget(LS_DEL).length) > 0) { e.preventDefault(); e.returnValue = ''; return ''; }
      });
    } catch (e) {}
    if (!su()) return;
    try {
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) flush();   // arrière-plan / fermeture : on pousse la file (qui persiste de toute façon en local)
        else syncNow();                 // retour au premier plan : resynchro complète
      });
      window.addEventListener('focus', syncNow);
      window.addEventListener('online', function () { renderBanner(); syncNow(); });   // retour du réseau : on masque l'alerte + on resynchronise
      window.addEventListener('offline', renderBanner);                                 // perte du réseau : on prépare l'alerte
    } catch (e) {}
    if (autoTimer) clearInterval(autoTimer);
    autoTimer = setInterval(function () { try { if (document.hidden) return; } catch (e) {} syncNow(); }, 30000);
    renderBanner();
  }

  global.DB = {
    boot: boot, upsert: upsert, remove: remove, pull: pull, flush: flush,
    startAutoSync: startAutoSync, syncNow: syncNow,
    su: su, configured: function () { return !!su(); },
    pending: function () { return jget(LS_DIRTY).length + jget(LS_DEL).length; },
    onStatus: function (fn) { statusCb = fn; },
    autoPurge: autoPurge,
    takePurged: function () { var n = purgedCount; purgedCount = 0; return n; },
    _normClient: normClient
  };
})(window);
