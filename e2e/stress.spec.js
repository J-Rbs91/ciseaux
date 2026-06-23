const { test, expect } = require('@playwright/test');
const fs = require('fs');

// Banc d'essai (désactivé en suite normale). Lancer avec :
//   STRESS=1 npx playwright test e2e/stress.spec.js --workers=1
// Mesure la montée en charge d'UN salon (nombre de clients) côté navigateur.

const GEN = `
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function genClients(N){
  var rng=mulberry32(12345), out=[];
  var noms=['Sophie Martîn','Julien Bernard','Camille Dubois','Léa Moreau','Thomas Petit','Émma Laurent','Nicolas Garcia','Chloé Roux'];
  var prest=['Coupe femme','Coupe homme','Coloration','Balayage','Brushing','Barbe'];
  for(var i=0;i<N;i++){
    var V=3+Math.floor(rng()*18); // 3..20 visites
    var visites=[];
    for(var j=0;j<V;j++){
      var nItems=1+(j%2), items=[], montant=0;
      for(var k=0;k<nItems;k++){ var prix=8+Math.floor(rng()*68); montant+=prix; items.push({nom:prest[Math.floor(rng()*prest.length)],prix:prix}); }
      var daysAgo=Math.floor(rng()*1000);
      var d=new Date(Date.now()-daysAgo*86400000);
      visites.push({date:d.toISOString(),montant:montant,items:items,gp:Math.round(montant),gv:1});
    }
    out.push({id:'c_'+i+'_'+Math.floor(rng()*9999),nom:noms[i%noms.length]+' '+i,tel:'06 12 34 56 78',
      mail:'client'+i+'@exemple.fr',dob:'1990-05-15',profil:'',notes:'',points:Math.floor(rng()*200),
      visitsCount:V,offre:'',optin:true,maj:new Date().toISOString(),visites:visites,ledger:[]});
  }
  return out;
}
function bytesOf(s){return new Blob([s]).size;}
`;

test.describe('STRESS — montée en charge clients (un salon)', () => {
  test.skip(!process.env.STRESS, 'banc d\'essai : lancer avec STRESS=1');
  test.setTimeout(600000);

  test('clients par salon : poids, parse, rendu stats & clients, mur de quota', async ({ page, baseURL }) => {
    const Ns = [100, 250, 500, 1000, 2000, 3000, 4000, 5000, 6000, 8000, 10000];
    const rows = [];

    // ---- STATS : parse + render() + progressionData() + poids/quota ----
    await page.goto('/stats.html');
    await page.addScriptTag({ content: GEN });
    for (const N of Ns) {
      const r = await page.evaluate((N) => {
        const arr = genClients(N);
        const json = JSON.stringify(arr);
        const mb = bytesOf(json) / 1048576;
        let quota = false;
        try { localStorage.setItem('clients-v1', json); } catch (e) { quota = true; }
        const passages = arr.reduce((s, c) => s + c.visites.length, 0);
        let parseMs = null, statsMs = null, progMs = null, domNodes = null;
        if (!quota) {
          let t = performance.now(); JSON.parse(localStorage.getItem('clients-v1')); parseMs = performance.now() - t;
          if (typeof progressionData === 'function') { t = performance.now(); progressionData(); progMs = performance.now() - t; }
          if (typeof render === 'function') { t = performance.now(); render(); statsMs = performance.now() - t; domNodes = document.querySelectorAll('#content *').length; }
        }
        localStorage.removeItem('clients-v1');
        return { N, passages, mb, quota, parseMs, statsMs, progMs, domNodes };
      }, N);
      rows.push(r);
      console.log(`N=${r.N}\tpassages=${r.passages}\t${r.mb.toFixed(2)}MB\tquota=${r.quota}\tparse=${fmt(r.parseMs)}\tprog=${fmt(r.progMs)}\tstatsRender=${fmt(r.statsMs)}\tdom=${r.domNodes}`);
      if (r.quota) break; // mur atteint
    }

    // ---- CLIENTS : render() de la liste (poids DOM) ----
    await page.goto('/clients.html');
    await page.addScriptTag({ content: GEN });
    const cliRows = [];
    for (const N of Ns) {
      if (rows.find(x => x.N === N && x.quota)) break;
      const r = await page.evaluate((N) => {
        const arr = genClients(N);
        try { localStorage.setItem('clients-v1', JSON.stringify(arr)); } catch (e) { return { N, quota: true }; }
        let cliMs = null, domNodes = null;
        if (typeof render === 'function') { const t = performance.now(); render(); cliMs = performance.now() - t; domNodes = document.querySelectorAll('body *').length; }
        localStorage.removeItem('clients-v1');
        return { N, cliMs, domNodes };
      }, N);
      cliRows.push(r);
      console.log(`CLIENTS N=${r.N}\trender=${fmt(r.cliMs)}\tdomNodes=${r.domNodes}`);
    }

    // ---- Rapport markdown ----
    function fmtMd(v) { return v == null ? '—' : (Math.round(v * 10) / 10).toString(); }
    let md = '# Stress test — montée en charge (un salon)\n\n';
    md += `Navigateur : Chromium (Playwright). Quota localStorage de l'origine = mur dur.\n\n`;
    md += '## Stats.html (calcul + rendu)\n\n';
    md += '| Clients | Passages | Poids JSON | parse (ms) | progressionData (ms) | render (ms) | nœuds DOM | quota dépassé |\n';
    md += '|--:|--:|--:|--:|--:|--:|--:|:-:|\n';
    for (const r of rows) md += `| ${r.N} | ${r.passages} | ${r.mb.toFixed(2)} Mo | ${fmtMd(r.parseMs)} | ${fmtMd(r.progMs)} | ${fmtMd(r.statsMs)} | ${r.domNodes ?? '—'} | ${r.quota ? '🔴 OUI' : 'non'} |\n`;
    md += '\n## Clients.html (rendu liste)\n\n';
    md += '| Clients | render (ms) | nœuds DOM |\n|--:|--:|--:|\n';
    for (const r of cliRows) md += `| ${r.N} | ${fmtMd(r.cliMs)} | ${r.domNodes ?? '—'} |\n`;
    fs.writeFileSync(__dirname + '/STRESS.md', md);
    console.log('\nRapport écrit : e2e/STRESS.md');

    function fmt(v) { return v == null ? '—' : (Math.round(v * 10) / 10) + 'ms'; }
    expect(rows.length).toBeGreaterThan(0);
  });
});

function fmt(v) { return v == null ? '—' : (Math.round(v * 10) / 10) + 'ms'; }
