// ============================================================
// Ciseaux — Script Google Apps Script
// À déployer sur VOTRE compte Google (script.google.com)
// Gère : profil magasin (JSON) + base clients (Google Sheet)
// Déploiement : Application web | Exécuter en tant que : Moi
//               Qui a accès : Tout le monde
// ============================================================

var DOSSIER  = 'Hub_Facilities';
var FICHIER  = 'profil-magasin.json';
var CLASSEUR = 'base-clients';
var ONGLET   = 'Clients';
var ENTETES  = ['id','nom','tel','mail','points','offre','notes','maj'];

function doGet(e) {
  var p = e.parameter || {}, cb = p.callback, res;
  try {
    switch (p.action) {
      case 'save':         JSON.parse(p.data||'{}'); ecrireProfil_(p.data||'{}'); res={ok:true}; break;
      case 'load':         res={ok:true,data:lireProfil_()}; break;
      case 'saveClients':  ecrireClients_(JSON.parse(p.data||'[]')); res={ok:true}; break;
      case 'loadClients':  res={ok:true,data:lireClients_()}; break;
      default:             res={ok:true,data:lireProfil_()};
    }
  } catch(err) {
    res={ok:false,error:String(err)};
  }
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
  if (sh.getLastRow() === 0) sh.appendRow(ENTETES);
  return sh;
}

function lireClients_() {
  var sh = feuille_();
  var rows = sh.getDataRange().getValues();
  var head = rows.shift() || ENTETES;
  return JSON.stringify(rows.map(function(r) {
    var o = {};
    head.forEach(function(h, i) { o[h] = r[i]; });
    return o;
  }));
}

function ecrireClients_(arr) {
  var sh = feuille_();
  sh.clearContents();
  sh.appendRow(ENTETES);
  arr.forEach(function(o) {
    sh.appendRow(ENTETES.map(function(h) { return o[h] != null ? o[h] : ''; }));
  });
}
