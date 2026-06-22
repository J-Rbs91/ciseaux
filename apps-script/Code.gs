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
var ENTETES_RESA = ['id','createdAt','statut','date','heure','duree','prestation','collab','nom','tel','mail','dob','notes','optin','rappel','token'];

// Réglages d'agenda par défaut (le salon les personnalise depuis l'app → profil.agenda).
// jours : 0=dimanche … 6=samedi (Date.getDay).
var AGENDA_DEFAUT = {
  capacite: 1,        // nombre de rendez-vous simultanés (postes/collaborateurs)
  granularite: 15,    // pas des créneaux proposés (minutes)
  delaiMin: 60,       // délai minimum avant un rendez-vous (minutes)
  horizonJours: 30,   // réservation possible jusqu'à N jours à l'avance
  jours: {
    '0': { open:false, start:'09:00', end:'19:00', pause:['',''] },
    '1': { open:true,  start:'09:00', end:'19:00', pause:['',''] },
    '2': { open:true,  start:'09:00', end:'19:00', pause:['',''] },
    '3': { open:true,  start:'09:00', end:'19:00', pause:['',''] },
    '4': { open:true,  start:'09:00', end:'19:00', pause:['',''] },
    '5': { open:true,  start:'09:00', end:'19:00', pause:['',''] },
    '6': { open:true,  start:'09:00', end:'18:00', pause:['',''] }
  }
};

// ── Contrôle d'accès (fermé par défaut) ───────────────────────
// Seule une poignée d'actions est PUBLIQUE (formulaire de réservation en ligne) ;
// toutes les autres sont SENSIBLES et exigent la clé admin. Tant qu'AUCUNE clé n'est
// posée sur le script, les actions sensibles sont REFUSÉES (« non configuré ») et non
// ouvertes : la base clients/réservations n'est jamais exposée par simple oubli de
// configuration. La clé se pose UNIQUEMENT côté éditeur Apps Script via
// genererCleAdmin(), puis se colle dans l'app.
var ACTIONS_PUBLIQUES = { createBooking:1, availability:1, catalogue:1, getBooking:1, cancelBooking:1, modifyBooking:1, securite:1, unsub:1 };

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

// l'amorçage public de la clé (« claimKey ») a été RETIRÉ. La clé ne
// peut plus être posée depuis le réseau (sinon le premier à connaître l'URL …/exec
// pouvait revendiquer la clé et prendre le contrôle). Elle se génère désormais
// UNIQUEMENT depuis l'éditeur Apps Script via genererCleAdmin(), puis se colle
// dans l'application (Mon salon → Clé admin).

function doGet(e) {
  var p = (e && e.parameter) || {}, cb = p.callback;
  // Lien de désinscription cliqué depuis un email : navigation directe (page HTML)
  if ((p.action || 'load') === 'unsub') return pageDesinscription_(p);
  return sortie_(traiter_(p), cb);
}

// transport POST. La clé admin voyage dans le CORPS de la requête
// (Content-Type text/plain → « requête simple », pas de préflight CORS), donc
// elle n'apparaît plus dans l'URL, l'historique du navigateur ni les journaux.
// Le front bascule en POST quand c'est possible et retombe sur JSONP sinon.
function doPost(e) {
  var p = {};
  try { if (e && e.parameter) { for (var k in e.parameter) if (e.parameter.hasOwnProperty(k)) p[k] = e.parameter[k]; } } catch (e0) {}
  try {
    if (e && e.postData && e.postData.contents) {
      var body = null;
      try { body = JSON.parse(e.postData.contents); } catch (e1) {}
      if (body && typeof body === 'object') { for (var b in body) if (body.hasOwnProperty(b)) p[b] = body[b]; }
    }
  } catch (e2) {}
  return sortie_(traiter_(p), p.callback);
}

// Dispatcher commun GET/POST. Renvoie un objet (jamais un ContentService).
function traiter_(p) {
  var action = p.action || 'load';

  // Garde d'accès (fermé par défaut) :
  //   1. Action publique (formulaire de réservation, état sécurité…) → ouverte.
  //   2. Toute autre action est SENSIBLE → exige une clé admin posée ET correspondante.
  //      Sans clé posée : REFUS (« non configuré »). il n'existe plus
  //      d'amorçage public de clé ; la clé se pose UNIQUEMENT côté éditeur Apps
  //      Script via genererCleAdmin() (pas de prise de contrôle « premier arrivé »).
  var cle = cleAdmin_();
  if (!ACTIONS_PUBLIQUES[action]) {
    if (!cle)                                     return { ok:false, error:'non configuré' };
    if (!egalConstant_(String(p.key || ''), cle)) return { ok:false, error:'non autorisé' };
  }

  try {
    switch (action) {
      case 'save':         JSON.parse(p.data||'{}'); ecrireProfil_(p.data||'{}'); return {ok:true};
      case 'load':         return {ok:true,data:lireProfil_()};
      case 'saveClients':  ecrireClients_(JSON.parse(p.data||'[]')); return {ok:true};
      case 'loadClients':  return {ok:true,data:lireClients_()};
      case 'saveOffres':   JSON.parse(p.data||'[]'); ecrireOffres_(p.data||'[]'); return {ok:true};
      case 'loadOffres':   return {ok:true,data:lireOffres_()};
      case 'upsertClient': upsertClient_(JSON.parse(p.client||'{}')); return {ok:true};
      case 'deleteClient': return {ok:true,deleted:deleteClient_(p.id||'')};
      case 'sendCampaign': return envoyerCampagne_(p);
      case 'sendBirthdays':return envoyerAnniversaires_();
      case 'quota':        return {ok:true,quota:MailApp.getRemainingDailyQuota()};
      // Réservations en ligne
      case 'createBooking':    return creerReservation_(p);                       // PUBLIC (formulaire)
      case 'availability':     return {ok:true, slots:creneauxLibres_(String(p.date||''), p.duree, p.collab, jsonArr_(p.prestations), exclureSiToken_(p))};  // PUBLIC
      case 'catalogue':        return cataloguePublic_();                         // PUBLIC
      case 'getBooking':       return getBookingPublic_(p.id||'', p.token||'');   // PUBLIC (jeton)
      case 'cancelBooking':    return cancelBooking_(p);                          // PUBLIC (jeton)
      case 'modifyBooking':    return modifyBooking_(p);                          // PUBLIC (jeton)
      case 'loadBookings':     return {ok:true,data:lireReservations_()};
      case 'setBookingStatus': return {ok:true,updated:majStatutReservation_(p.id||'', p.statut||'')};
      case 'deleteBooking':    return {ok:true,deleted:supprimerReservation_(p.id||'')};
      // Sécurité / clé admin
      case 'securite':         return {ok:true, locked: !!cle};                   // PUBLIC (état)
      default:                 return {ok:true,data:lireProfil_()};
    }
  } catch(err) {
    return {ok:false,error:String(err)};
  }
}

// un nom de callback JSONP doit être un identifiant JS sûr.
// Sinon on renvoie du JSON pur (pas de reflet arbitraire dans une réponse JS).
function callbackValide_(cb) {
  return typeof cb === 'string' && cb.length > 0 && cb.length <= 64 && /^[A-Za-z_$][A-Za-z0-9_$.]*$/.test(cb);
}
function sortie_(res, cb) {
  var json = JSON.stringify(res);
  return callbackValide_(cb)
    ? ContentService.createTextOutput(cb+'('+json+')').setMimeType(ContentService.MimeType.JAVASCRIPT)
    : ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

// comparaison à temps constant de la clé admin (pas de court-circuit sur la longueur).
function egalConstant_(a, b) {
  a = String(a == null ? '' : a);
  b = String(b == null ? '' : b);
  var diff = a.length ^ b.length;
  var n = Math.max(a.length, b.length);
  for (var i = 0; i < n; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
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
  if (sh.getLastRow() === 0) {
    sh.appendRow(ENTETES_RESA);
    // Force les colonnes date/heure en texte pour éviter l'auto-conversion de Sheets.
    ['date','heure'].forEach(function(c){ var i = ENTETES_RESA.indexOf(c); if (i >= 0) sh.getRange(1, i+1, sh.getMaxRows(), 1).setNumberFormat('@'); });
    return sh;
  }
  // Migration : ajoute en fin de ligne les colonnes manquantes (ex. « duree ») des anciens classeurs.
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  ENTETES_RESA.forEach(function(col) {
    if (head.indexOf(col) < 0) { sh.getRange(1, sh.getLastColumn() + 1).setValue(col); head.push(col); }
  });
  return sh;
}

// En-têtes réels de la feuille (gère l'ordre/les colonnes ajoutées par migration).
function enTetesResa_(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
}

// ── Moteur d'agenda : calcul des créneaux libres ─────────────
function agendaConfig_() {
  var profil = {};
  try { profil = JSON.parse(lireProfil_() || '{}') || {}; } catch (e) {}
  var ag = profil.agenda || {};
  var cfg = {
    mode: (ag.mode === 'collaborateurs') ? 'collaborateurs' : 'capacite',
    capacite: parseInt(ag.capacite, 10) > 0 ? parseInt(ag.capacite, 10) : AGENDA_DEFAUT.capacite,
    granularite: parseInt(ag.granularite, 10) > 0 ? parseInt(ag.granularite, 10) : AGENDA_DEFAUT.granularite,
    delaiMin: parseInt(ag.delaiMin, 10) >= 0 ? parseInt(ag.delaiMin, 10) : AGENDA_DEFAUT.delaiMin,
    horizonJours: parseInt(ag.horizonJours, 10) > 0 ? parseInt(ag.horizonJours, 10) : AGENDA_DEFAUT.horizonJours,
    jours: (ag.jours && typeof ag.jours === 'object') ? ag.jours : AGENDA_DEFAUT.jours,
    collaborateurs: (Array.isArray(ag.collaborateurs) ? ag.collaborateurs : []).filter(function(c) {
      return c && String(c.nom || '').trim();
    }),
    fermetures: normPlages_(ag.fermetures),   // fermetures exceptionnelles du salon (jours fériés, congés annuels…)
    mailConfirm: ag.mailConfirm !== false,   // défaut : activé
    mailRappel: ag.mailRappel !== false      // défaut : activé
  };
  cfg.profil = profil;
  return cfg;
}

// Un collaborateur peut-il réaliser TOUTES les prestations demandées ?
// (liste de spécialités vide = polyvalent, fait tout)
function collabPeutFaire_(collab, noms) {
  var sp = (collab && Array.isArray(collab.prestations)) ? collab.prestations.map(function(x){ return String(x||'').trim(); }).filter(Boolean) : [];
  if (!sp.length) return true;
  if (!noms || !noms.length) return true;
  for (var i = 0; i < noms.length; i++) { if (sp.indexOf(String(noms[i]).trim()) < 0) return false; }
  return true;
}

// Collaborateurs éligibles à une demande (nom imposé éventuel + spécialités requises).
function collabsEligibles_(cfg, collabVoulu, prestaNoms) {
  collabVoulu = String(collabVoulu || '').trim();
  return cfg.collaborateurs.filter(function(c) {
    if (collabVoulu && String(c.nom).trim() !== collabVoulu) return false;
    return collabPeutFaire_(c, prestaNoms);
  });
}

function jsonArr_(s) { try { var a = JSON.parse(s || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }

// Normalise une liste de plages de dates [{debut,fin}] : ne garde que celles avec un
// début valide (YYYY-MM-DD), borne fin par défaut sur le début (= une seule journée).
function normPlages_(plages) {
  if (!Array.isArray(plages)) return [];
  var out = [];
  for (var i = 0; i < plages.length; i++) {
    var p = plages[i] || {};
    var d = String(p.debut || p.start || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    var f = String(p.fin || p.end || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f) || f < d) f = d;
    out.push({ debut: d, fin: f });
  }
  return out;
}
// Une date (YYYY-MM-DD) tombe-t-elle dans l'une des plages [debut, fin] (inclusives) ?
// La comparaison lexicographique des chaînes ISO suffit.
function dateDansPlages_(dateStr, plages) {
  if (!Array.isArray(plages)) return false;
  for (var i = 0; i < plages.length; i++) {
    var p = plages[i]; if (!p || !p.debut) continue;
    if (dateStr >= p.debut && dateStr <= (p.fin || p.debut)) return true;
  }
  return false;
}
// Le salon est-il ouvert sur [t, fin[ ce jour-là (horaires du mag + hors pause) ?
// Sert de borne globale, y compris en mode « collaborateurs ».
function salonOuvert_(cfg, dow, t, fin) {
  var j = cfg.jours && cfg.jours[String(dow)];
  if (!j || !j.open) return false;
  var o = hm_(j.start), c = hm_(j.end);
  if (o == null || c == null || t < o || fin > c) return false;
  var pa = Array.isArray(j.pause) ? j.pause : ['', ''];
  var pd = hm_(pa[0]), pf = hm_(pa[1]);
  if (pd != null && pf != null && pf > pd && t < pf && fin > pd) return false;
  return true;
}

// Un collaborateur travaille-t-il sur [t, fin[ ce jour-là (horaires + hors pause) ?
function collabTravaille_(collab, dow, t, fin) {
  var j = (collab.jours && collab.jours[String(dow)]) ? collab.jours[String(dow)] : null;
  if (!j || !j.open) return false;
  var o = hm_(j.start), c = hm_(j.end);
  if (o == null || c == null || t < o || fin > c) return false;
  var pa = Array.isArray(j.pause) ? j.pause : ['', ''];
  var pd = hm_(pa[0]), pf = hm_(pa[1]);
  if (pd != null && pf != null && pf > pd && t < pf && fin > pd) return false;
  return true;
}

// Renvoie le nom d'un collaborateur (parmi les éligibles) libre sur [t, fin[, ou '' si aucun.
function collabLibre_(eligibles, dow, t, fin, occ) {
  // Un RDV sans collaborateur (legacy/capacité) bloque tout le monde, par sécurité.
  for (var k = 0; k < occ.length; k++) { if (!occ[k].collab && t < occ[k].end && fin > occ[k].start) return ''; }
  for (var i = 0; i < eligibles.length; i++) {
    var nom = String(eligibles[i].nom).trim();
    if (!collabTravaille_(eligibles[i], dow, t, fin)) continue;
    var pris = false;
    for (var j = 0; j < occ.length; j++) {
      if (String(occ[j].collab) === nom && t < occ[j].end && fin > occ[j].start) { pris = true; break; }
    }
    if (!pris) return nom;
  }
  return '';
}

// Sheets convertit parfois les colonnes date/heure en objets Date : on renormalise à la lecture.
function asDate_(v) { return (v instanceof Date) ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(v || ''); }
function asTime_(v) { return (v instanceof Date) ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'HH:mm') : String(v || ''); }

function hm_(s) { var m = String(s || '').match(/^(\d{1,2}):(\d{2})/); return m ? (+m[1]) * 60 + (+m[2]) : null; }
function mh_(n) { var h = Math.floor(n / 60), m = n % 60; return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m; }

// Durée d'une prestation (minutes) d'après le catalogue du profil, par nom.
function dureePresta_(profil, nom) {
  var list = (profil && Array.isArray(profil.prestations)) ? profil.prestations : [];
  for (var i = 0; i < list.length; i++) {
    if (String(list[i].nom || '').trim() === String(nom || '').trim()) {
      var d = parseInt(list[i].duree, 10); return d > 0 ? d : 0;
    }
  }
  return 0;
}

// Réservations occupant une date donnée (statuts qui bloquent le créneau).
// exclureId : ignore ce RDV (utile lors d'une modification, pour ne pas se bloquer soi-même).
function resaDuJour_(dateStr, exclureId) {
  var sh = feuilleResa_();
  var data = sh.getDataRange().getValues();
  var head = data.shift() || [];
  var iId = head.indexOf('id'), iDate = head.indexOf('date'), iH = head.indexOf('heure'), iDur = head.indexOf('duree'),
      iSt = head.indexOf('statut'), iPre = head.indexOf('prestation'), iCo = head.indexOf('collab');
  var profil = null, out = [];
  data.forEach(function(r) {
    if (exclureId && String(r[iId]) === String(exclureId)) return;
    if (asDate_(r[iDate]) !== dateStr) return;
    var st = String(r[iSt] || '');
    if (st === 'refuse') return;                 // un RDV refusé/annulé libère le créneau
    var start = hm_(asTime_(r[iH])); if (start == null) return;
    var dur = parseInt(r[iDur], 10) || 0;
    if (!dur) { if (!profil) profil = agendaConfig_().profil; dur = dureePresta_(profil, r[iPre]) || 0; }
    out.push({ start: start, end: start + (dur || 0), collab: (iCo >= 0 ? String(r[iCo] || '') : '') });
  });
  return out;
}

// Liste des créneaux de début libres ("HH:MM") pour une date / durée / (collaborateur) / prestations.
// exclureId : RDV à ignorer dans l'occupation (modification d'un RDV existant).
function creneauxLibres_(dateStr, dureeMin, collabVoulu, prestaNoms, exclureId) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return [];
  var cfg = agendaConfig_();
  var duree = parseInt(dureeMin, 10) > 0 ? parseInt(dureeMin, 10) : cfg.granularite;
  var d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d)) return [];
  var dow = d.getDay();

  // Horizon + non passé (commun aux deux modes)
  var now = new Date();
  var auj = new Date(); auj.setHours(0, 0, 0, 0);
  if (d < auj) return [];
  var limite = new Date(); limite.setDate(limite.getDate() + cfg.horizonJours);
  if (d > limite) return [];
  var estAujourdhui = (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate());
  var minToday = estAujourdhui ? (now.getHours() * 60 + now.getMinutes() + cfg.delaiMin) : -1;
  // Fermeture exceptionnelle du salon (jour férié, congé annuel…) : aucun créneau, quel que soit le mode.
  if (dateDansPlages_(dateStr, cfg.fermetures)) return [];
  var occ = resaDuJour_(dateStr, exclureId);
  var libres = [], t, fin;

  if (cfg.mode === 'collaborateurs') {
    // On écarte d'emblée les collaborateurs absents ce jour-là (congés ponctuels).
    var liste = collabsEligibles_(cfg, collabVoulu, prestaNoms).filter(function(c) {
      return !dateDansPlages_(dateStr, c.absences);
    });
    if (!liste.length) return [];
    // Fenêtre de balayage = union des plages d'ouverture des collaborateurs concernés ce jour-là.
    var minOpen = null, maxClose = null;
    liste.forEach(function(c) {
      var j = c.jours && c.jours[String(dow)];
      if (!j || !j.open) return;
      var o = hm_(j.start), cl = hm_(j.end);
      if (o == null || cl == null || cl <= o) return;
      if (minOpen == null || o < minOpen) minOpen = o;
      if (maxClose == null || cl > maxClose) maxClose = cl;
    });
    if (minOpen == null) return [];
    for (t = minOpen; t + duree <= maxClose; t += cfg.granularite) {
      fin = t + duree;
      if (estAujourdhui && t < minToday) continue;
      if (!salonOuvert_(cfg, dow, t, fin)) continue;   // borne globale : horaires d'ouverture du mag
      if (collabLibre_(liste, dow, t, fin, occ)) libres.push(mh_(t));
    }
    return libres;
  }

  // Mode capacité (postes anonymes en parallèle)
  var jour = cfg.jours[String(dow)];
  if (!jour || !jour.open) return [];
  var openMin = hm_(jour.start), closeMin = hm_(jour.end);
  if (openMin == null || closeMin == null || closeMin <= openMin) return [];
  var pause = Array.isArray(jour.pause) ? jour.pause : ['', ''];
  var pDeb = hm_(pause[0]), pFin = hm_(pause[1]);
  var hasPause = (pDeb != null && pFin != null && pFin > pDeb);
  for (t = openMin; t + duree <= closeMin; t += cfg.granularite) {
    fin = t + duree;
    if (hasPause && t < pFin && fin > pDeb) continue;
    if (estAujourdhui && t < minToday) continue;
    var n = 0;
    for (var i = 0; i < occ.length; i++) { if (t < occ[i].end && fin > occ[i].start) n++; }
    if (n < cfg.capacite) libres.push(mh_(t));
  }
  return libres;
}

// compteur quotidien de réservations enregistrées (plafond anti-abus).
// Stocké en propriété de script « yyyy-MM-dd|count », remis à zéro au changement de jour.
function compteurJour_() {
  var jourKey = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var parts = String(PropertiesService.getScriptProperties().getProperty('resa_jour') || '').split('|');
  return (parts[0] === jourKey) ? (parseInt(parts[1], 10) || 0) : 0;
}
function incrCompteurJour_(jourKey) {
  var props = PropertiesService.getScriptProperties();
  var parts = String(props.getProperty('resa_jour') || '').split('|');
  var cnt = (parts[0] === jourKey) ? (parseInt(parts[1], 10) || 0) : 0;
  props.setProperty('resa_jour', jourKey + '|' + (cnt + 1));
}

function creerReservation_(p) {
  // Piège anti-robot : un champ caché rempli = bot. On répond ok mais on n'enregistre rien.
  if (String(p.hp || '') !== '') return { ok:true };

  var nom  = String(p.nom  || '').trim();
  var tel  = String(p.tel  || '').trim();
  var mail = String(p.mail || '').trim();
  var date = String(p.date || '').trim();
  var heure = String(p.heure || '').trim();

  if (!nom) return { ok:false, error:'Nom requis' };
  if (!mail || mail.indexOf('@') < 0) return { ok:false, error:'Email valide requis' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok:false, error:'Date invalide' };
  if (!/^\d{1,2}:\d{2}$/.test(heure)) return { ok:false, error:'Heure invalide' };

  var d = new Date(date + 'T00:00:00');
  var auj = new Date(); auj.setHours(0,0,0,0);
  if (isNaN(d) || d < auj) return { ok:false, error:'Date dans le passé' };

  // Prestation(s) : on accepte une liste (multi-prestations). Durée calculée côté serveur
  // depuis le catalogue (autorité), repli sur la valeur transmise sinon.
  var cfg = agendaConfig_();
  var noms = [];
  try { noms = JSON.parse(p.prestations || '[]'); } catch (e) { noms = []; }
  if (!Array.isArray(noms)) noms = [];
  noms = noms.map(function(x){ return String(x || '').trim(); }).filter(Boolean);
  if (!noms.length && String(p.prestation || '').trim()) noms = [String(p.prestation).trim()];
  var prestation = noms.join(' + ');
  var duree = 0;
  noms.forEach(function(nm){ duree += dureePresta_(cfg.profil, nm); });
  if (!duree) duree = parseInt(p.duree, 10) > 0 ? parseInt(p.duree, 10) : cfg.granularite;

  // Garde-fous anti-abus du formulaire PUBLIC :
  //   (a) flood global   : 20 demandes / minute max ;
  //   (b) par adresse    : 5 demandes / heure max (évite de spammer une même boîte) ;
  //   (c) plafond du jour : borne le nb de réservations (et d'emails de confirmation
  //       émis par le Gmail du salon) et la saturation de l'agenda. Réglable via
  //       profil.agenda.maxResaJour (défaut 100). Incrémenté seulement à l'enregistrement.
  var cache = CacheService.getScriptCache();
  var n = parseInt(cache.get('resa_count') || '0', 10);
  if (n >= 20) return { ok:false, error:'Trop de demandes, réessayez dans une minute.' };
  cache.put('resa_count', String(n + 1), 60);

  var mailKey = 'resa_m_' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, mail.toLowerCase()));
  var nm = parseInt(cache.get(mailKey) || '0', 10);
  if (nm >= 5) return { ok:false, error:'Trop de demandes pour cette adresse, réessayez plus tard.' };
  cache.put(mailKey, String(nm + 1), 3600);

  var maxJour = parseInt(cfg.profil && cfg.profil.agenda && cfg.profil.agenda.maxResaJour, 10);
  if (!(maxJour > 0)) maxJour = 100;
  var jourKey = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  if (compteurJour_() >= maxJour) return { ok:false, error:'Réservations en ligne indisponibles pour aujourd\'hui, réessayez demain.' };

  var collabVoulu = String(p.collab || '').trim();

  // Réservation ferme : on sérialise pour éviter qu'un même créneau parte deux fois.
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) { return { ok:false, error:'Service occupé, réessayez.' }; }
  try {
    var collabAssigne = '';
    if (cfg.mode === 'collaborateurs') {
      if (dateDansPlages_(date, cfg.fermetures)) return { ok:false, error:'Le salon est fermé ce jour-là.' };
      var d2 = new Date(date + 'T00:00:00'), fin = (hm_(heure) || 0) + duree;
      if (!salonOuvert_(cfg, d2.getDay(), hm_(heure), fin)) return { ok:false, error:'Ce créneau est en dehors des horaires du salon.' };
      var eligibles = collabsEligibles_(cfg, collabVoulu, noms).filter(function(c) { return !dateDansPlages_(date, c.absences); });
      collabAssigne = collabLibre_(eligibles, d2.getDay(), hm_(heure), fin, resaDuJour_(date));
      if (!collabAssigne) {
        return { ok:false, error: collabVoulu
          ? collabVoulu + ' n\'est plus disponible sur ce créneau. Choisissez-en un autre.'
          : 'Ce créneau vient d\'être pris. Choisissez-en un autre.' };
      }
    } else {
      if (creneauxLibres_(date, duree).indexOf(heure) < 0) {
        return { ok:false, error:'Ce créneau vient d\'être pris. Choisissez-en un autre.' };
      }
    }
    var o = {
      id: 'r_' + Date.now() + '_' + Math.floor(Math.random() * 9999),
      createdAt: new Date().toISOString(),
      statut: 'confirme',                 // blocage automatique du créneau
      date: date, heure: heure, duree: duree, prestation: prestation, collab: collabAssigne,
      nom: nom, tel: tel, mail: mail,
      dob: String(p.dob || '').trim(),
      notes: String(p.notes || '').trim(),
      optin: estOptin_(p.optin) ? 'oui' : 'non',
      token: Utilities.getUuid().replace(/-/g, '')   // jeton secret : lien d'annulation/modification
    };
    var sh = feuilleResa_();
    var head = enTetesResa_(sh);
    sh.appendRow(head.map(function(h) { return o[h] != null ? o[h] : ''; }));
    incrCompteurJour_(jourKey);   // compte la réservation réellement enregistrée (plafond du jour)
    if (cfg.mailConfirm) { try { envoiMailRdv_('confirm', o, cfg.profil); } catch (e) {} }   // n'échoue jamais la résa
    return { ok:true, collab: collabAssigne };
  } finally {
    lock.releaseLock();
  }
}

// ── Emails de rendez-vous (confirmation + rappel) ────────────
var MOIS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
var JOURS_FR = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
function frDateLong_(s) {
  var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); if (!m) return String(s || '');
  var d = new Date(s + 'T00:00:00');
  return JOURS_FR[d.getDay()] + ' ' + (+m[3]) + ' ' + MOIS_FR[+m[2] - 1] + ' ' + m[1];
}
// Lien public d'annulation/modification (nécessite profil.agenda.formUrl + jeton du RDV).
function lienGestion_(profil, o) {
  var base = (profil && profil.agenda && profil.agenda.formUrl) ? String(profil.agenda.formUrl).trim() : '';
  if (!base || !o.token) return '';
  var exec = ScriptApp.getService().getUrl() || '';
  return base + (base.indexOf('?') >= 0 ? '&' : '?') + 'api=' + encodeURIComponent(exec)
    + '&manage=' + encodeURIComponent(o.id) + '&token=' + encodeURIComponent(o.token);
}

function envoiMailRdv_(type, o, profil) {
  var mail = String(o.mail || '').trim();
  if (!mail || mail.indexOf('@') < 0) return;
  var salon = String((profil && profil.nom) || 'le salon');
  var quand = frDateLong_(o.date) + ' à ' + asTime_(o.heure);
  var presta = o.prestation ? (' — ' + o.prestation) : '';
  var avec = o.collab ? (' avec ' + o.collab) : '';
  var prenom = String(o.nom || '').trim().split(' ')[0] || '';
  var coords = [];
  if (profil && profil.adresse) coords.push(profil.adresse);
  if (profil && profil.tel) coords.push('Tél. ' + profil.tel);
  var pied = '\n\n' + salon + (coords.length ? '\n' + coords.join('\n') : '');
  var lien = lienGestion_(profil, o);
  var blocLien = lien ? ('\n\nBesoin de changer ? Annulez ou modifiez votre rendez-vous : ' + lien) : '';
  var sujet, corps;
  if (type === 'rappel') {
    sujet = 'Rappel : votre rendez-vous demain chez ' + salon;
    corps = 'Bonjour ' + prenom + ',\n\nNous vous rappelons votre rendez-vous de demain, ' + quand + presta + avec + '.'
      + '\n\nEn cas d\'empêchement, merci de nous prévenir au plus tôt.' + blocLien + '\n\nÀ très bientôt.' + pied;
  } else if (type === 'annul') {
    sujet = 'Annulation de votre rendez-vous chez ' + salon;
    corps = 'Bonjour ' + prenom + ',\n\nVotre rendez-vous du ' + quand + presta + avec + ' a bien été annulé.'
      + '\n\nAu plaisir de vous revoir prochainement.' + pied;
  } else if (type === 'modif') {
    sujet = 'Modification de votre rendez-vous chez ' + salon;
    corps = 'Bonjour ' + prenom + ',\n\nVotre rendez-vous a été modifié : ' + quand + presta + avec + '.'
      + blocLien + '\n\nAu plaisir de vous accueillir.' + pied;
  } else {
    sujet = 'Confirmation de votre rendez-vous chez ' + salon;
    corps = 'Bonjour ' + prenom + ',\n\nVotre rendez-vous est confirmé : ' + quand + presta + avec + '.'
      + '\n\nEn cas d\'empêchement, merci de nous prévenir.' + blocLien + '\n\nAu plaisir de vous accueillir.' + pied;
  }
  MailApp.sendEmail({ to: mail, subject: sujet, body: corps, name: salon });
}

// Rappels J-1 : à déclencher chaque jour vers 7h (voir creerDeclencheurRappels).
function envoyerRappels_() {
  var sh = feuilleResa_();
  var data = sh.getDataRange().getValues();
  var head = data.shift() || [];
  var iSt = head.indexOf('statut'), iDate = head.indexOf('date'), iH = head.indexOf('heure'),
      iPre = head.indexOf('prestation'), iCo = head.indexOf('collab'), iNom = head.indexOf('nom'),
      iMail = head.indexOf('mail'), iRap = head.indexOf('rappel'), iId = head.indexOf('id'), iTok = head.indexOf('token');
  if (iRap < 0) return { ok:false, error:'colonne rappel manquante' };
  var cfg = agendaConfig_();
  if (!cfg.mailRappel) return { ok:true, envoyes:0, desactive:true };   // rappel désactivé par le salon
  var profil = cfg.profil;
  var demain = new Date(); demain.setDate(demain.getDate() + 1);
  var ds = Utilities.formatDate(demain, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var quota = MailApp.getRemainingDailyQuota(), envoyes = 0;
  for (var r = 0; r < data.length; r++) {
    var row = data[r];
    if (asDate_(row[iDate]) !== ds) continue;
    if (String(row[iSt] || '') !== 'confirme') continue;
    if (String(row[iRap] || '').toLowerCase() === 'oui') continue;
    var mail = String(row[iMail] || '').trim();
    if (!mail || mail.indexOf('@') < 0) continue;
    if (envoyes >= quota) break;
    var o = { date: asDate_(row[iDate]), heure: asTime_(row[iH]), prestation: row[iPre],
              collab: (iCo >= 0 ? row[iCo] : ''), nom: row[iNom], mail: mail,
              id: (iId >= 0 ? row[iId] : ''), token: (iTok >= 0 ? row[iTok] : '') };
    try { envoiMailRdv_('rappel', o, profil); envoyes++; sh.getRange(r + 2, iRap + 1).setValue('oui'); } catch (e) {}
  }
  return { ok:true, envoyes:envoyes };
}

// À exécuter UNE fois depuis l'éditeur : programme le rappel quotidien à 7h.
function creerDeclencheurRappels() {
  var existe = ScriptApp.getProjectTriggers().some(function(t){ return t.getHandlerFunction() === 'envoyerRappels_'; });
  if (existe) return 'Déclencheur déjà en place.';
  ScriptApp.newTrigger('envoyerRappels_').timeBased().atHour(7).everyDays(1).create();
  return 'Déclencheur de rappels créé (tous les jours vers 7h).';
}

// ── Gestion client d'un RDV (annulation / modification) via jeton ─────
function trouverResa_(id) {
  if (!id) return null;
  var sh = feuilleResa_();
  var data = sh.getDataRange().getValues();
  var head = data[0] || [];
  var iId = head.indexOf('id');
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][iId]) === String(id)) {
      var o = {}; head.forEach(function(h, i) { o[h] = data[r][i]; });
      return { sh: sh, row: r + 1, head: head, o: o };
    }
  }
  return null;
}
function authResa_(id, token) {
  var t = trouverResa_(id);
  if (!t || !token || String(t.o.token) !== String(token)) return null;
  return t;
}
function exclureSiToken_(p) {
  if (!p.exclure) return '';
  return authResa_(p.exclure, p.token) ? String(p.exclure) : '';
}

// Renvoie les infos publiques d'un RDV (pour la page de gestion), si le jeton correspond.
function getBookingPublic_(id, token) {
  var t = authResa_(id, token);
  if (!t) return { ok:false, error:'Lien invalide ou expiré.' };
  var o = t.o;
  return { ok:true, booking: {
    id: o.id, statut: String(o.statut || ''), date: asDate_(o.date), heure: asTime_(o.heure),
    duree: parseInt(o.duree, 10) || 0, prestation: String(o.prestation || ''),
    collab: String(o.collab || ''), nom: String(o.nom || '')
  }};
}

function cancelBooking_(p) {
  var t = authResa_(p.id, p.token);
  if (!t) return { ok:false, error:'Lien invalide ou expiré.' };
  if (String(t.o.statut) === 'refuse') return { ok:true, already:true };
  var iSt = t.head.indexOf('statut');
  t.sh.getRange(t.row, iSt + 1).setValue('refuse');
  var cfg = agendaConfig_();
  if (cfg.mailConfirm) { try { envoiMailRdv_('annul', t.o, cfg.profil); } catch (e) {} }
  return { ok:true };
}

function modifyBooking_(p) {
  var t = authResa_(p.id, p.token);
  if (!t) return { ok:false, error:'Lien invalide ou expiré.' };
  var date = String(p.date || '').trim(), heure = String(p.heure || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok:false, error:'Date invalide' };
  if (!/^\d{1,2}:\d{2}$/.test(heure)) return { ok:false, error:'Heure invalide' };
  var d = new Date(date + 'T00:00:00'), auj = new Date(); auj.setHours(0,0,0,0);
  if (isNaN(d) || d < auj) return { ok:false, error:'Date dans le passé' };

  var cfg = agendaConfig_();
  var noms = jsonArr_(p.prestations).map(function(x){ return String(x||'').trim(); }).filter(Boolean);
  if (!noms.length && t.o.prestation) noms = String(t.o.prestation).split(' + ');
  var prestation = noms.join(' + ');
  var duree = 0; noms.forEach(function(nm){ duree += dureePresta_(cfg.profil, nm); });
  if (!duree) duree = parseInt(p.duree, 10) > 0 ? parseInt(p.duree, 10) : cfg.granularite;
  var collabVoulu = String(p.collab || '').trim();

  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) { return { ok:false, error:'Service occupé, réessayez.' }; }
  try {
    var collabAssigne = '';
    if (cfg.mode === 'collaborateurs') {
      if (dateDansPlages_(date, cfg.fermetures)) return { ok:false, error:'Le salon est fermé ce jour-là.' };
      var fin = (hm_(heure) || 0) + duree;
      if (!salonOuvert_(cfg, d.getDay(), hm_(heure), fin)) return { ok:false, error:'Ce créneau est en dehors des horaires du salon.' };
      var eligibles = collabsEligibles_(cfg, collabVoulu, noms).filter(function(c) { return !dateDansPlages_(date, c.absences); });
      collabAssigne = collabLibre_(eligibles, d.getDay(), hm_(heure), fin, resaDuJour_(date, p.id));
      if (!collabAssigne) return { ok:false, error:'Ce créneau n\'est plus disponible. Choisissez-en un autre.' };
    } else {
      if (creneauxLibres_(date, duree, '', [], p.id).indexOf(heure) < 0) {
        return { ok:false, error:'Ce créneau n\'est plus disponible. Choisissez-en un autre.' };
      }
    }
    var o = t.o;
    o.date = date; o.heure = heure; o.duree = duree; o.prestation = prestation;
    o.collab = collabAssigne; o.statut = 'confirme'; o.rappel = '';   // re-déclenche le rappel
    t.sh.getRange(t.row, 1, 1, t.head.length).setValues([t.head.map(function(h){ return o[h] != null ? o[h] : ''; })]);
    if (cfg.mailConfirm) { try { envoiMailRdv_('modif', o, cfg.profil); } catch (e) {} }
    return { ok:true, collab: collabAssigne };
  } finally {
    lock.releaseLock();
  }
}

function lireReservations_() {
  var sh = feuilleResa_();
  var rows = sh.getDataRange().getValues();
  var head = rows.shift() || ENTETES_RESA;
  return JSON.stringify(rows.map(function(r) {
    var o = {}; head.forEach(function(h, i) { o[h] = r[i]; });
    o.date = asDate_(o.date); o.heure = asTime_(o.heure);   // normalise pour l'affichage
    return o;
  }));
}

// Catalogue public (nom, prix, durée) pour le formulaire de réservation, + bornes d'agenda.
function cataloguePublic_() {
  var cfg = agendaConfig_();
  var profil = cfg.profil || {};
  var prestations = (Array.isArray(profil.prestations) ? profil.prestations : []).map(function(x) {
    return { nom: String(x.nom || ''), prix: (x.prix != null ? x.prix : ''), duree: parseInt(x.duree, 10) || 0 };
  }).filter(function(x) { return x.nom; });
  return {
    ok: true,
    salon: String(profil.nom || ''),
    prestations: prestations,
    mode: cfg.mode,
    collaborateurs: cfg.collaborateurs.map(function(c) {
      return { nom: String(c.nom || '').trim(), prestations: (Array.isArray(c.prestations) ? c.prestations : []) };
    }),
    horizonJours: cfg.horizonJours,
    granularite: cfg.granularite
  };
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
  var unsub = lienDesinscription_(baseUrl, c.id);
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
  var unsub = lienDesinscription_(baseUrl, c.id);
  return personnaliser_(corps, c, prenom)
    + '\n\n---\n' + (profil.nom || 'Mon salon')
    + '\nSe désinscrire des offres : ' + unsub;
}

// Bascule l'opt-in d'un client à « non » dans la Sheet, puis affiche une page de confirmation.
// lien de désinscription SIGNÉ (HMAC-SHA256) pour empêcher la
// désinscription d'un client tiers par simple devinette de son id. Le secret est
// propre au script (créé à la volée) ; il ne quitte jamais le serveur.
function unsubSecret_() {
  var props = PropertiesService.getScriptProperties();
  var s = props.getProperty('UNSUB_SECRET');
  if (!s) { s = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''); props.setProperty('UNSUB_SECRET', s); }
  return s;
}
function signUnsub_(id) {
  var raw = Utilities.computeHmacSha256Signature(String(id), unsubSecret_());
  return raw.map(function(b){ return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('').slice(0, 32);
}
function lienDesinscription_(baseUrl, id) {
  return baseUrl + '?action=unsub&id=' + encodeURIComponent(id) + '&sig=' + encodeURIComponent(signUnsub_(id));
}

function pageDesinscription_(p) {
  var ok = false;
  try {
    if (p.id) {
      // Si une signature est fournie, elle DOIT être valide (anti-falsification).
      // Les anciens liens sans signature restent acceptés pendant une transition
      // (résiduel documenté ) ; retirer cette tolérance une fois les anciens
      // emails périmés pour fermer entièrement l'.
      var sig = String(p.sig || '');
      if (!sig || egalConstant_(sig, signUnsub_(p.id))) ok = majOptin_(p.id, false);
    }
  } catch(e) {}
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
