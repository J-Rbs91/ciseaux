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
var CLASSEUR = 'base-clients';
var ONGLET   = 'Clients';
var ENTETES  = ['id','nom','tel','mail','points','offre','notes','optin','maj'];

function doGet(e) {
  var p = e.parameter || {}, cb = p.callback, res;

  // Lien de désinscription cliqué depuis un email : navigation directe (page HTML)
  if (p.action === 'unsub') return pageDesinscription_(p);

  try {
    switch (p.action) {
      case 'save':         JSON.parse(p.data||'{}'); ecrireProfil_(p.data||'{}'); res={ok:true}; break;
      case 'load':         res={ok:true,data:lireProfil_()}; break;
      case 'saveClients':  ecrireClients_(JSON.parse(p.data||'[]')); res={ok:true}; break;
      case 'loadClients':  res={ok:true,data:lireClients_()}; break;
      case 'sendCampaign': res=envoyerCampagne_(p); break;
      case 'quota':        res={ok:true,quota:MailApp.getRemainingDailyQuota()}; break;
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

// ── Campagnes email (Gmail) ──────────────────────────────────
// Envoie un email personnalisé à chaque client opt-in, depuis le Gmail du salon.
// Quota Gmail : 100 destinataires/jour (compte perso), 1500/jour (Workspace).

function envoyerCampagne_(p) {
  var sujet   = p.subject || '(sans objet)';
  var corps   = p.body || '';
  var segment = p.segment || 'all';
  var seuil   = parseInt(p.seuil || '0', 10) || 0;
  var baseUrl = ScriptApp.getService().getUrl() || (p.base || '');
  var logoUrl = p.logoUrl || '';

  var profil = {};
  try { profil = JSON.parse(lireProfil_() || '{}') || {}; } catch(e) {}

  var clients = JSON.parse(lireClients_() || '[]');
  var dest = clients.filter(function(c) {
    if (!c.mail || String(c.mail).indexOf('@') < 0) return false;
    if (!estOptin_(c.optin)) return false;
    if (segment === 'reward') return (Number(c.points) || 0) >= seuil;
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

function estOptin_(v) {
  if (v === true) return true;
  var s = String(v == null ? '' : v).trim().toLowerCase();
  return s === 'oui' || s === 'true' || s === '1' || s === 'x' || s === 'yes';
}

function personnaliser_(txt, c, prenom) {
  return String(txt || '')
    .replace(/\{prenom\}/gi, prenom)
    .replace(/\{nom\}/gi, String(c.nom || ''))
    .replace(/\{points\}/gi, String(Number(c.points) || 0));
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
