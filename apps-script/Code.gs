// ============================================================
// Ciseaux — Script Google Apps Script
// À déployer sur VOTRE compte Google (script.google.com)
// Gère : profil salon (JSON) + base clients (Sheet) + campagnes email (Gmail)
//
// Déploiement : Application web | Exécuter en tant que : Moi
//               Qui a accès : Tout le monde
// IMPORTANT : après mise à jour du code, refaire « Déployer → Gérer les
// déploiements → Modifier → Nouvelle version », et réautoriser (scope Gmail).
// ============================================================

var DOSSIER  = 'Hub_Facilities';
var FICHIER  = 'profil-magasin.json';
var OFFRES   = 'offres.json';
var CLASSEUR = 'base-clients';
var ONGLET   = 'Clients';
var ENTETES  = ['id','nom','tel','mail','dob','points','visitsCount','offre','notes','optin','maj','visites','ledger'];
var RESA       = 'Réservations';
var ENTETES_RESA = ['id','createdAt','statut','date','heure','prestation','nom','tel','mail','dob','notes','optin'];

// ── Contrôle d'accès ──────────────────────────────────────────
// Seule une poignée d'actions est PUBLIQUE (formulaire de réservation en ligne) ;
// toutes les autres exigent la clé admin si une clé a été définie. Tant qu'aucune
// clé n'est configurée, le script reste en mode « ouvert » (compatibilité des
// déploiements existants) — d'où l'avertissement affiché dans l'application.
var ACTIONS_PUBLIQUES = { createBooking:1, securite:1, unsub:1 };

function cleAdmin_() {
  return (PropertiesService.getScriptProperties().getProperty('ADMIN_KEY') || '').trim();
}

// À exécuter UNE fois depuis l'éditeur Apps Script pour générer/forcer une clé admin.
// La clé apparaît dans les journaux (Affichage → Journaux) : collez-la dans
// l'application (Mon salon → Clé admin).
function genererCleAdmin() {
  var k = Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('ADMIN_KEY', k);
  Logger.log('Clé admin : ' + k + '\nCollez-la dans Mon salon → Clé admin (sur chaque appareil).');
  return k;
}

// Revendication de la clé depuis l'app : n'aboutit QUE si aucune clé n'est encore définie
// (premier appareil qui configure). La rotation ultérieure se fait via genererCleAdmin().
function revendiquerCle_(k) {
  k = String(k || '').trim();
  if (!k) return { ok:false, error:'clé vide' };
  var props = PropertiesService.getScriptProperties();
  if ((props.getProperty('ADMIN_KEY') || '').trim()) return { ok:false, error:'clé déjà définie' };
  props.setProperty('ADMIN_KEY', k);
  return { ok:true };
}

function doGet(e) {
  var p = e.parameter || {}, cb = p.callback, res;
  var action = p.action || 'load';

  // Lien de désinscription cliqué depuis un email : navigation directe (page HTML)
  if (action === 'unsub') return pageDesinscription_(p);

  // Garde d'accès : si une clé admin est définie, tout sauf les actions publiques l'exige.
  var cle = cleAdmin_();
  if (cle && !ACTIONS_PUBLIQUES[action] && String(p.key || '') !== cle) {
    return sortie_({ ok:false, error:'non autorisé' }, cb);
  }

  try {
    switch (action) {
      case 'save':         JSON.parse(p.data||'{}'); ecrireProfil_(p.data||'{}'); res={ok:true}; break;
      case 'load':         res={ok:true,data:lireProfil_()}; break;
      case 'saveClients':  ecrireClients_(JSON.parse(p.data||'[]')); res={ok:true}; break;
      case 'loadClients':  res={ok:true,data:lireClients_()}; break;
      case 'saveOffres':   JSON.parse(p.data||'[]'); ecrireOffres_(p.data||'[]'); res={ok:true}; break;
      case 'loadOffres':   res={ok:true,data:lireOffres_()}; break;
      case 'upsertClient': upsertClient_(JSON.parse(p.client||'{}')); res={ok:true}; break;
      case 'deleteClient': res={ok:true,deleted:deleteClient_(p.id||'')}; break;
      case 'sendCampaign': res=envoyerCampagne_(p); break;
      case 'sendBirthdays':res=envoyerAnniversaires_(); break;
      case 'quota':        res={ok:true,quota:MailApp.getRemainingDailyQuota()}; break;
      // Réservations en ligne
      case 'createBooking':    res=creerReservation_(p); break;                 // PUBLIC (formulaire)
      case 'loadBookings':     res={ok:true,data:lireReservations_()}; break;
      case 'setBookingStatus': res={ok:true,updated:majStatutReservation_(p.id||'', p.statut||'')}; break;
      case 'deleteBooking':    res={ok:true,deleted:supprimerReservation_(p.id||'')}; break;
      // Sécurité / clé admin
      case 'claimKey':         res=revendiquerCle_(p.key||''); break;
      case 'securite':         res={ok:true, locked: !!cle}; break;             // PUBLIC (état)
      default:                 res={ok:true,data:lireProfil_()};
    }
  } catch(err) {
    res={ok:false,error:String(err)};
  }
  return sortie_(res, cb);
}

function sortie_(res, cb) {
  var json = JSON.stringify(res);
  return cb
    ? ContentService.createTextOutput(cb+'('+json+')').setMimeType(ContentService.MimeType.JAVASCRIPT)
    : ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

// ── Profil (fichier JSON) ─────────────────────────────────────

function dossier_() {
  var it = DriveApp.getFoldersByName(DOSSIER);
  return it.hasNext() ? it.next() : DriveApp.createFolder(DOSSIER);
}
function fichierProfil_() {
  var it = dossier_().getFilesByName(FICHIER);
  return it.hasNext() ? it.next() : null;
}
function lireProfil_() {
  var f = fichierProfil_();
  return f ? f.getBlob().getDataAsString() : '';
}
function ecrireProfil_(contenu) {
  var f = fichierProfil_();
  if (f) { f.setContent(contenu); }
  else   { dossier_().createFile(FICHIER, contenu, 'application/json'); }
}

// ── Offres commerciales (fichier JSON) ────────────────────────
// Synchronisées depuis la page Offres, lues par l'envoi automatique des anniversaires.

function fichierOffres_() {
  var it = dossier_().getFilesByName(OFFRES);
  return it.hasNext() ? it.next() : null;
}
function lireOffres_() {
  var f = fichierOffres_();
  return f ? f.getBlob().getDataAsString() : '[]';
}
function ecrireOffres_(contenu) {
  var f = fichierOffres_();
  if (f) { f.setContent(contenu); }
  else   { dossier_().createFile(OFFRES, contenu, 'application/json'); }
}

// ── Clients (Google Sheet) ────────────────────────────────────

function feuille_() {
  var d = dossier_();
  var it = d.getFilesByName(CLASSEUR), ss;
  if (it.hasNext()) {
    ss = SpreadsheetApp.open(it.next());
  } else {
    ss = SpreadsheetApp.create(CLASSEUR);
    DriveApp.getFileById(ss.getId()).moveTo(d);
  }
  var sh = ss.getSheetByName(ONGLET) || ss.insertSheet(ONGLET);
  if (sh.getLastRow() === 0) { sh.appendRow(ENTETES); return sh; }
  // Mise à niveau de l'en-tête si d'anciennes colonnes diffèrent (ajout visitsCount/ledger…)
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  if (head.join('|') !== ENTETES.join('|')) {
    var rows = sh.getDataRange().getValues(); rows.shift();
    var remapped = rows.map(function(r) {
      var o = {}; head.forEach(function(h, i) { o[h] = r[i]; });
      return ENTETES.map(function(h) { return o[h] != null ? o[h] : ''; });
    });
    sh.clearContents();
    sh.appendRow(ENTETES);
    if (remapped.length) sh.getRange(2, 1, remapped.length, ENTETES.length).setValues(remapped);
  }
  return sh;
}
function lireClients_() {
  var sh = feuille_();
  var rows = sh.getDataRange().getValues();
  var head = rows.shift() || ENTETES;
  return JSON.stringify(rows.map(function(r) {
    var o = {};
    head.forEach(function(h, i) {
      if (h === 'visites' || h === 'ledger') { try { o[h] = r[i] ? JSON.parse(r[i]) : []; } catch(e) { o[h] = []; } }
      else { o[h] = r[i]; }
    });
    return o;
  }));
}
function ecrireClients_(arr) {
  var sh = feuille_();
  sh.clearContents();
  sh.appendRow(ENTETES);
  arr.forEach(function(o) {
    sh.appendRow(ENTETES.map(function(h) {
      if (h === 'visites' || h === 'ledger') return o[h] ? JSON.stringify(o[h]) : '';
      return o[h] != null ? o[h] : '';
    }));
  });
}

// Écrit (ou met à jour) UN client par son id — petite charge utile, pas de réécriture globale.
function ligneClient_(o) {
  return ENTETES.map(function(h) {
    if (h === 'visites' || h === 'ledger') return o[h] ? JSON.stringify(o[h]) : '';
    return o[h] != null ? o[h] : '';
  });
}
function upsertClient_(client) {
  if (!client || !client.id) return false;
  var sh = feuille_();
  var idCol = ENTETES.indexOf('id');
  var n = sh.getLastRow() - 1;
  var ids = n > 0 ? sh.getRange(2, idCol + 1, n, 1).getValues() : [];
  var row = ligneClient_(client);
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(client.id)) {
      sh.getRange(i + 2, 1, 1, ENTETES.length).setValues([row]);
      return true;
    }
  }
  sh.appendRow(row);
  return true;
}
function deleteClient_(id) {
  if (!id) return false;
  var sh = feuille_();
  var idCol = ENTETES.indexOf('id');
  var n = sh.getLastRow() - 1;
  var ids = n > 0 ? sh.getRange(2, idCol + 1, n, 1).getValues() : [];
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) { sh.deleteRow(i + 2); return true; }
  }
  return false;
}

// ── Réservations en ligne (Google Sheet) ─────────────────────
// L'action « createBooking » est PUBLIQUE : c'est le seul point d'entrée du
// formulaire de réservation. Elle est volontairement minimale (write-only) :
// elle dépose une demande « en attente » et ne renvoie AUCUNE donnée. La lecture
// (loadBookings) et la validation (setBookingStatus) exigent la clé admin.

function feuilleResa_() {
  var d = dossier_();
  var it = d.getFilesByName(CLASSEUR), ss;
  if (it.hasNext()) { ss = SpreadsheetApp.open(it.next()); }
  else { ss = SpreadsheetApp.create(CLASSEUR); DriveApp.getFileById(ss.getId()).moveTo(d); }
  var sh = ss.getSheetByName(RESA) || ss.insertSheet(RESA);
  if (sh.getLastRow() === 0) sh.appendRow(ENTETES_RESA);
  return sh;
}

function creerReservation_(p) {
  // Piège anti-robot : un champ caché rempli = bot. On répond ok mais on n'enregistre rien.
  if (String(p.hp || '') !== '') return { ok:true };

  var nom  = String(p.nom  || '').trim();
  var tel  = String(p.tel  || '').trim();
  var mail = String(p.mail || '').trim();
  var date = String(p.date || '').trim();

  if (!nom) return { ok:false, error:'Nom requis' };
  if (!tel && !mail) return { ok:false, error:'Téléphone ou email requis' };
  if (mail && mail.indexOf('@') < 0) return { ok:false, error:'Email invalide' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok:false, error:'Date invalide' };

  var d = new Date(date + 'T00:00:00');
  var auj = new Date(); auj.setHours(0,0,0,0);
  if (isNaN(d) || d < auj) return { ok:false, error:'Date dans le passé' };
  var max = new Date(); max.setMonth(max.getMonth() + 12);
  if (d > max) return { ok:false, error:'Date trop lointaine' };

  // Garde-fou anti-flood (global, fenêtre d'une minute) : limite les abus du formulaire public.
  var cache = CacheService.getScriptCache();
  var n = parseInt(cache.get('resa_count') || '0', 10);
  if (n >= 20) return { ok:false, error:'Trop de demandes, réessayez dans une minute.' };
  cache.put('resa_count', String(n + 1), 60);

  var o = {
    id: 'r_' + Date.now() + '_' + Math.floor(Math.random() * 9999),
    createdAt: new Date().toISOString(),
    statut: 'en_attente',
    date: date,
    heure: String(p.heure || '').trim(),
    prestation: String(p.prestation || '').trim(),
    nom: nom, tel: tel, mail: mail,
    dob: String(p.dob || '').trim(),
    notes: String(p.notes || '').trim(),
    optin: estOptin_(p.optin) ? 'oui' : 'non'
  };
  feuilleResa_().appendRow(ENTETES_RESA.map(function(h) { return o[h] != null ? o[h] : ''; }));
  return { ok:true };
}

function lireReservations_() {
  var sh = feuilleResa_();
  var rows = sh.getDataRange().getValues();
  var head = rows.shift() || ENTETES_RESA;
  return JSON.stringify(rows.map(function(r) {
    var o = {}; head.forEach(function(h, i) { o[h] = r[i]; }); return o;
  }));
}

function majStatutReservation_(id, statut) {
  if (!id) return false;
  var ok = { en_attente:1, confirme:1, refuse:1 };
  if (!ok[statut]) return false;
  var sh = feuilleResa_();
  var data = sh.getDataRange().getValues();
  var head = data[0] || ENTETES_RESA;
  var idCol = head.indexOf('id'), stCol = head.indexOf('statut');
  if (idCol < 0 || stCol < 0) return false;
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][idCol]) === String(id)) { sh.getRange(r + 1, stCol + 1).setValue(statut); return true; }
  }
  return false;
}

function supprimerReservation_(id) {
  if (!id) return false;
  var sh = feuilleResa_();
  var idCol = ENTETES_RESA.indexOf('id');
  var n = sh.getLastRow() - 1;
  var ids = n > 0 ? sh.getRange(2, idCol + 1, n, 1).getValues() : [];
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) { sh.deleteRow(i + 2); return true; }
  }
  return false;
}

// ── Campagnes email (Gmail) ──────────────────────────────────
// Envoie un email personnalisé à chaque client opt-in, depuis le Gmail du salon.
// Quota Gmail : 100 destinataires/jour (compte perso), 1500/jour (Workspace).

function envoyerCampagne_(p) {
  var sujet   = p.subject || '(sans objet)';
  var corps   = p.body || '';
  var segment = p.segment || 'all';
  var seuil   = parseInt(p.seuil || '0', 10) || 0;
  var rules   = [];
  try { if (p.rewardRules) rules = JSON.parse(p.rewardRules) || []; } catch(e) {}
  var winMult = parseFloat(p.winbackMult) || 2;
  var minVisits = parseInt(p.minVisits || '0', 10) || 0;
  var minBasket = parseFloat(p.minBasket) || 0;
  var prestaName = String(p.prestaName == null ? '' : p.prestaName).trim().toLowerCase();
  var baseUrl = ScriptApp.getService().getUrl() || (p.base || '');
  var logoUrl = p.logoUrl || '';

  var profil = {};
  try { profil = JSON.parse(lireProfil_() || '{}') || {}; } catch(e) {}

  var clients = JSON.parse(lireClients_() || '[]');
  var dest = clients.filter(function(c) {
    if (!c.mail || String(c.mail).indexOf('@') < 0) return false;
    if (!estOptin_(c.optin)) return false;
    if (segment === 'reward') {
      if (rules.length) return rules.some(function(r) {
        var b = r.counter === 'visits' ? (Number(c.visitsCount) || 0) : (Number(c.points) || 0);
        return b >= (Number(r.threshold) || 0);
      });
      return (Number(c.points) || 0) >= seuil;
    }
    if (segment === 'winback') return estEnRetard_(c, winMult);
    if (segment === 'freq') return nbPassages_(c) >= minVisits;
    if (segment === 'vip') return panierMoyen_(c) >= minBasket;
    if (segment === 'presta') return aPrisPresta_(c, prestaName);
    return true;
  });

  var quota = MailApp.getRemainingDailyQuota();
  var envoyes = 0, ignores = 0, erreurs = 0;

  for (var i = 0; i < dest.length; i++) {
    if (envoyes >= quota) { ignores++; continue; }
    var c = dest[i];
    try {
      MailApp.sendEmail({
        to: String(c.mail),
        subject: sujet,
        body: construireTexte_(corps, c, profil, baseUrl),
        htmlBody: construireEmail_(corps, c, profil, baseUrl, logoUrl),
        name: (profil.nom || 'Mon salon')
      });
      envoyes++;
    } catch(e) { erreurs++; }
  }

  return { ok:true, cibles:dest.length, envoyes:envoyes, ignores:ignores,
           erreurs:erreurs, quotaRestant:MailApp.getRemainingDailyQuota() };
}

// Client « régulier en retard » : délai depuis la dernière visite > délai moyen × mult (≥ 3 passages).
function estEnRetard_(c, mult) {
  var v = (c.visites && c.visites.length ? c.visites : []).filter(function(x){ return x && x.date; })
            .sort(function(a, b){ return new Date(a.date) - new Date(b.date); });
  if (v.length < 3) return false;
  var gaps = [], i;
  for (i = 1; i < v.length; i++) gaps.push((new Date(v[i].date) - new Date(v[i - 1].date)) / 86400000);
  var avg = gaps.reduce(function(a, b){ return a + b; }, 0) / gaps.length;
  if (!avg) return false;
  return (Date.now() - new Date(v[v.length - 1].date)) / 86400000 > (mult || 2) * avg;
}

// Nombre de passages enregistrés (visites avec une date).
function nbPassages_(c) {
  var v = (c.visites && c.visites.length ? c.visites : []).filter(function(x){ return x && x.date; });
  return v.length;
}

// Panier moyen : moyenne des montants > 0 des passages.
function panierMoyen_(c) {
  var v = (c.visites && c.visites.length ? c.visites : []), sum = 0, n = 0;
  for (var i = 0; i < v.length; i++) {
    var m = Number(v[i] && v[i].montant) || 0;
    if (m > 0) { sum += m; n++; }
  }
  return n ? sum / n : 0;
}

// Le client a-t-il déjà pris une prestation portant ce nom (insensible à la casse) ?
function aPrisPresta_(c, name) {
  if (!name) return false;
  var v = (c.visites && c.visites.length ? c.visites : []);
  for (var i = 0; i < v.length; i++) {
    var it = v[i] && v[i].items;
    if (it && it.length) {
      for (var j = 0; j < it.length; j++) {
        if (String((it[j] && it[j].nom) || '').trim().toLowerCase() === name) return true;
      }
    }
  }
  return false;
}

function estOptin_(v) {
  if (v === true) return true;
  var s = String(v == null ? '' : v).trim().toLowerCase();
  return s === 'oui' || s === 'true' || s === '1' || s === 'x' || s === 'yes';
}

// ── Anniversaires (envoi automatique) ─────────────────────────
// À planifier via un déclencheur quotidien (voir creerDeclencheurAnniversaire).
// Envoie le mail de l'offre anniversaire ACTIVE aux clients opt-in dont c'est
// l'anniversaire (jour + mois), une seule fois par an et par client.

function anniversaireAujourdhui_(dob, today) {
  if (dob instanceof Date && !isNaN(dob)) {
    return dob.getMonth() === today.getMonth() && dob.getDate() === today.getDate();
  }
  var m = String(dob == null ? '' : dob).match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return false;
  return (parseInt(m[2], 10) === today.getMonth() + 1) && (parseInt(m[3], 10) === today.getDate());
}

function envoyerAnniversaires_() {
  var offres = [];
  try { offres = JSON.parse(lireOffres_() || '[]') || []; } catch(e) {}
  // Première offre anniversaire active (cochée « actif » dans l'onglet Offres).
  var offre = offres.filter(function(o){ return o && o.anniv && o.actif !== false; })[0];
  if (!offre) return { ok:true, offreAnniversaire:false, envoyes:0, message:'Aucune offre anniversaire active.' };

  var profil = {};
  try { profil = JSON.parse(lireProfil_() || '{}') || {}; } catch(e) {}
  var clients = JSON.parse(lireClients_() || '[]');
  var baseUrl = ScriptApp.getService().getUrl() || '';
  var logoUrl = profil.logoUrl || profil.logo || '';

  var today = new Date();
  var annee = today.getFullYear();
  var props = PropertiesService.getScriptProperties();

  var prestaTxt = (Array.isArray(offre.prestations) && offre.prestations.length) ? offre.prestations.join(', ') : '';
  var offreTxt = String(offre.reduction || offre.nom || 'une offre spéciale');
  var sujet = String(offre.emailSujet || '').trim() || 'Un cadeau pour votre anniversaire';
  var corpsTpl = String(offre.emailCorps || '').trim();
  if (!corpsTpl) {
    corpsTpl = 'Bonjour {prenom},\n\nÀ l\'occasion de votre anniversaire, toute l\'équipe de ' + (profil.nom || 'notre salon')
      + ' a le plaisir de vous offrir {offre}'
      + (prestaTxt ? ' sur {prestations}' : '') + '.\n\nRéservez votre rendez-vous dès maintenant pour profiter de votre cadeau.\n\nAu plaisir de vous accueillir.';
  }

  var quota = MailApp.getRemainingDailyQuota();
  var cibles = 0, envoyes = 0, ignores = 0, erreurs = 0, dejaEnvoyes = 0;

  for (var i = 0; i < clients.length; i++) {
    var c = clients[i];
    if (!c || !c.dob) continue;
    if (!anniversaireAujourdhui_(c.dob, today)) continue;
    if (!c.mail || String(c.mail).indexOf('@') < 0) continue;
    if (!estOptin_(c.optin)) continue;            // autorisation communications commerciales
    cibles++;
    var cle = 'anniv-' + annee + '-' + String(c.id || c.mail);
    if (props.getProperty(cle)) { dejaEnvoyes++; continue; }   // déjà envoyé cette année
    if (envoyes >= quota) { ignores++; continue; }
    var corps = corpsTpl.replace(/\{offre\}/gi, offreTxt).replace(/\{prestations\}/gi, prestaTxt);
    try {
      MailApp.sendEmail({
        to: String(c.mail),
        subject: sujet,
        body: construireTexte_(corps, c, profil, baseUrl),
        htmlBody: construireEmail_(corps, c, profil, baseUrl, logoUrl),
        name: (profil.nom || 'Mon salon')
      });
      props.setProperty(cle, today.toISOString());
      envoyes++;
    } catch(e) { erreurs++; }
  }

  return { ok:true, offreAnniversaire:true, cibles:cibles, envoyes:envoyes,
           dejaEnvoyes:dejaEnvoyes, ignores:ignores, erreurs:erreurs,
           quotaRestant:MailApp.getRemainingDailyQuota() };
}

// À exécuter UNE fois depuis l'éditeur Apps Script pour planifier l'envoi
// quotidien automatique (chaque jour vers 9h).
function creerDeclencheurAnniversaire() {
  var trigs = ScriptApp.getProjectTriggers();
  for (var i = 0; i < trigs.length; i++) {
    if (trigs[i].getHandlerFunction() === 'envoyerAnniversaires_') ScriptApp.deleteTrigger(trigs[i]);
  }
  ScriptApp.newTrigger('envoyerAnniversaires_').timeBased().everyDays(1).atHour(9).create();
}

function personnaliser_(txt, c, prenom) {
  return String(txt || '')
    .replace(/\{prenom\}/gi, prenom)
    .replace(/\{nom\}/gi, String(c.nom || ''))
    .replace(/\{points\}/gi, String(Number(c.points) || 0))
    .replace(/\{visites\}/gi, String(Number(c.visitsCount) || 0));
}

function construireEmail_(corps, c, profil, baseUrl, logoUrl) {
  var prenom = String(c.nom || '').split(' ')[0] || '';
  var htmlCorps = escapeHtml_(personnaliser_(corps, c, prenom)).replace(/\n/g, '<br>');
  var unsub = baseUrl + '?action=unsub&id=' + encodeURIComponent(c.id);
  var nom = escapeHtml_(profil.nom || 'Mon salon');
  var coords = [];
  if (profil.adresse) coords.push(escapeHtml_(profil.adresse));
  if (profil.tel)     coords.push(escapeHtml_(profil.tel));
  var coordsStr = coords.join(' · ');

  var logoBlock = '';
  if (logoUrl && /^https:\/\//i.test(logoUrl)) {
    logoBlock = '<div style="text-align:center;padding:10px 0 2px"><img src="' + escapeHtml_(logoUrl) + '" alt="" style="max-height:60px;max-width:200px"></div>';
  }

  return ''
    + '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#3d2b27">'
    +   '<div style="background:#b87c6e;color:#ffffff;padding:18px 22px;border-radius:12px 12px 0 0;font-size:18px;font-weight:bold">'
    +     logoBlock + nom
    +   '</div>'
    +   '<div style="background:#ffffff;padding:22px;border:1px solid #f0dbd5;border-top:none;font-size:15px;line-height:1.6">' + htmlCorps + '</div>'
    +   '<div style="padding:16px 22px;font-size:12px;color:#9a8077;background:#fdf3ef;border:1px solid #f0dbd5;border-top:none;border-radius:0 0 12px 12px">'
    +     (coordsStr ? coordsStr + '<br><br>' : '')
    +     'Vous recevez cet email car vous êtes client(e) de ' + nom + '.<br>'
    +     '<a href="' + unsub + '" style="color:#b87c6e">Se désinscrire des offres</a>'
    +   '</div>'
    + '</div>';
}

function construireTexte_(corps, c, profil, baseUrl) {
  var prenom = String(c.nom || '').split(' ')[0] || '';
  var unsub = baseUrl + '?action=unsub&id=' + encodeURIComponent(c.id);
  return personnaliser_(corps, c, prenom)
    + '\n\n---\n' + (profil.nom || 'Mon salon')
    + '\nSe désinscrire des offres : ' + unsub;
}

// Bascule l'opt-in d'un client à « non » dans la Sheet, puis affiche une page de confirmation.
function pageDesinscription_(p) {
  var ok = false;
  try { if (p.id) ok = majOptin_(p.id, false); } catch(e) {}
  var msg = ok
    ? 'Vous êtes bien désinscrit(e) des offres. À bientôt !'
    : 'Lien invalide ou désinscription déjà prise en compte.';
  var html = '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1"><title>Désinscription</title></head>'
    + '<body style="font-family:Arial,Helvetica,sans-serif;background:#fdf3ef;color:#3d2b27;text-align:center;padding:60px 20px">'
    + '<div style="max-width:420px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;box-shadow:0 2px 14px rgba(0,0,0,.08)">'
    + '<div style="font-size:42px">✂️</div>'
    + '<h1 style="font-size:18px;color:#b87c6e">' + msg + '</h1>'
    + '</div></body></html>';
  return HtmlService.createHtmlOutput(html);
}

function majOptin_(id, val) {
  var sh = feuille_();
  var data = sh.getDataRange().getValues();
  var head = data[0] || ENTETES;
  var idCol = head.indexOf('id'), optCol = head.indexOf('optin');
  if (idCol < 0 || optCol < 0) return false;
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][idCol]) === String(id)) {
      sh.getRange(r + 1, optCol + 1).setValue(val ? 'oui' : 'non');
      return true;
    }
  }
  return false;
}

function escapeHtml_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
