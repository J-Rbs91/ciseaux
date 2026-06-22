const { test, expect } = require('@playwright/test');
const { seed, tpl } = require('./_helpers');

// Présélection auto du modèle selon le segment (campagnes.html).
// Règle attendue : le modèle dont .segment === clé-du-segment est PROPOSÉ et
// pré-rempli AUTOMATIQUEMENT tant que l'utilisateur n'a rien saisi/choisi à la
// main, SANS JAMAIS écraser un texte saisi manuellement.

function tplSet() {
  return [
    tpl({ id: 'tp_win', nom: 'TPL Winback', sujet: 'Sujet Winback', corps: 'Corps winback', segment: 'winback' }),
    tpl({ id: 'tp_vip', nom: 'TPL VIP', sujet: 'Sujet VIP', corps: 'Corps vip', segment: 'vip' }),
    tpl({ id: 'tp_enf', nom: 'TPL Enfant', sujet: 'Sujet Enfant', corps: 'Corps enfant', segment: 'profil:enfant' }),
    tpl({ id: 'tp_none', nom: 'TPL Neutre', sujet: 'Sujet Neutre', corps: 'Corps neutre', segment: '' }),
  ];
}

test.describe('campagnes.html — présélection auto template↔segment', () => {

  test('changement de segment : propose le modèle correspondant (bandeau)', async ({ page }) => {
    await seed(page, { templates: tplSet() });
    await page.goto('/campagnes.html');
    await page.locator('#seg').selectOption('winback');
    await expect(page.locator('#tplSuggest')).toBeVisible();
    await expect(page.locator('#tplSuggest')).toContainText('TPL Winback');
  });

  test('pré-remplissage auto du sujet et corps quand champs vides', async ({ page }) => {
    await seed(page, { templates: tplSet() });
    await page.goto('/campagnes.html');
    await page.locator('#seg').selectOption('winback');
    await expect(page.locator('#subject')).toHaveValue('Sujet Winback');
    await expect(page.locator('#body')).toHaveValue(/Corps winback/);
  });

  test('changements de segment successifs : ré-écrase le contenu auto-rempli', async ({ page }) => {
    await seed(page, { templates: tplSet() });
    await page.goto('/campagnes.html');
    await page.locator('#seg').selectOption('winback');
    await expect(page.locator('#subject')).toHaveValue('Sujet Winback');
    await page.locator('#seg').selectOption('vip');
    await expect(page.locator('#subject')).toHaveValue('Sujet VIP');
    await expect(page.locator('#body')).toHaveValue(/Corps vip/);
  });

  test('NE PAS écraser un sujet saisi à la main lors d\'un changement de segment', async ({ page }) => {
    await seed(page, { templates: tplSet() });
    await page.goto('/campagnes.html');
    await page.locator('#subject').fill('MON SUJET PERSO');
    await page.locator('#seg').selectOption('winback');
    // le sujet manuel doit survivre
    await expect(page.locator('#subject')).toHaveValue('MON SUJET PERSO');
  });

  test('NE PAS écraser un corps saisi à la main', async ({ page }) => {
    await seed(page, { templates: tplSet() });
    await page.goto('/campagnes.html');
    await page.locator('#body').fill('MON CORPS PERSO');
    await page.locator('#seg').selectOption('vip');
    await expect(page.locator('#body')).toHaveValue('MON CORPS PERSO');
    await expect(page.locator('#subject')).not.toHaveValue('Sujet VIP');
  });

  test('saisie manuelle APRÈS auto-remplissage : changements de segment ne l\'écrasent plus', async ({ page }) => {
    await seed(page, { templates: tplSet() });
    await page.goto('/campagnes.html');
    await page.locator('#seg').selectOption('winback');
    await expect(page.locator('#subject')).toHaveValue('Sujet Winback');
    // l'utilisateur édite le corps -> tplManual devient true
    await page.locator('#body').fill('Je personnalise');
    await page.locator('#seg').selectOption('vip');
    await expect(page.locator('#body')).toHaveValue('Je personnalise');
    await expect(page.locator('#subject')).toHaveValue('Sujet Winback'); // pas réécrasé
  });

  test('clic "Utiliser ce modèle" applique le modèle et verrouille (manuel)', async ({ page }) => {
    await seed(page, { templates: tplSet() });
    await page.goto('/campagnes.html');
    await page.locator('#seg').selectOption('vip');
    await page.locator('#tplSuggest button:has-text("Utiliser ce modèle")').click();
    await expect(page.locator('#subject')).toHaveValue('Sujet VIP');
    // après pick manuel, changer de segment ne doit pas écraser
    await page.locator('#seg').selectOption('winback');
    await expect(page.locator('#subject')).toHaveValue('Sujet VIP');
  });

  test('segment profil + profilSel=enfant : propose le modèle profil:enfant', async ({ page }) => {
    await seed(page, { templates: tplSet() });
    await page.goto('/campagnes.html');
    await page.locator('#seg').selectOption('profil');
    await page.locator('#profilSel').selectOption('enfant');
    await expect(page.locator('#tplSuggest')).toContainText('TPL Enfant');
    await expect(page.locator('#subject')).toHaveValue('Sujet Enfant');
  });

  test('changement de profilSel re-suggère le bon modèle', async ({ page }) => {
    const tpls = tplSet();
    tpls.push(tpl({ id: 'tp_femme', nom: 'TPL Femme', sujet: 'Sujet Femme', corps: 'c', segment: 'profil:femme' }));
    await seed(page, { templates: tpls });
    await page.goto('/campagnes.html');
    await page.locator('#seg').selectOption('profil');
    await page.locator('#profilSel').selectOption('enfant');
    await expect(page.locator('#subject')).toHaveValue('Sujet Enfant');
    await page.locator('#profilSel').selectOption('femme');
    await expect(page.locator('#tplSuggest')).toContainText('TPL Femme');
    await expect(page.locator('#subject')).toHaveValue('Sujet Femme');
  });

  test('segment all : aucune suggestion (clé vide)', async ({ page }) => {
    await seed(page, { templates: tplSet() });
    await page.goto('/campagnes.html');
    await page.locator('#seg').selectOption('all');
    await expect(page.locator('#tplSuggest')).toBeHidden();
  });

  test('segment sans modèle correspondant : suggestion masquée', async ({ page }) => {
    // pas de template segment=freq
    await seed(page, { templates: tplSet() });
    await page.goto('/campagnes.html');
    await page.locator('#seg').selectOption('freq');
    await expect(page.locator('#tplSuggest')).toBeHidden();
  });

  test('profilSel=none (Non précisé) : pas de modèle profil:none -> suggestion masquée', async ({ page }) => {
    await seed(page, { templates: tplSet() });
    await page.goto('/campagnes.html');
    await page.locator('#seg').selectOption('profil');
    await page.locator('#profilSel').selectOption('none');
    await expect(page.locator('#tplSuggest')).toBeHidden();
  });

  test('cohérence inter-pages : template créé dans Templates est suggéré dans Campagnes', async ({ page }) => {
    // segment "freq" : aucun seed ne le porte -> propagation cross-page non ambiguë.
    await seed(page, { templates: [] });
    // 1) créer un template segmenté dans templates.html
    await page.goto('/templates.html');
    await page.locator('button:has-text("+ Nouveau")').click();
    await page.locator('#fNomTpl').fill('Cross Freq');
    await page.locator('#fSujet').fill('Cross Sujet Freq');
    await page.locator('#fSeg').selectOption('freq');
    await page.locator('#fCorps').fill('Cross corps');
    await page.locator('button:has-text("Enregistrer le template")').click();
    await expect(page.locator('#saveSt')).toContainText('enregistré');
    // 2) le retrouver suggéré dans campagnes.html
    await page.goto('/campagnes.html');
    await page.locator('#seg').selectOption('freq');
    await expect(page.locator('#tplSuggest')).toContainText('Cross Freq');
    await expect(page.locator('#subject')).toHaveValue('Cross Sujet Freq');
  });

  test('F1 corrigé : un modèle perso partageant un segment avec un seed est prioritaire sur le seed', async ({ page }) => {
    // On part de [] : initSeeds injecte les seeds (dont "Client fidèle" pour vip),
    // puis on ajoute un modèle perso également segmenté 'vip'. bestTplForSeg doit
    // désormais préférer le modèle personnalisé (non-seed) au seed.
    await seed(page, { templates: [] });
    await page.goto('/templates.html');
    await page.locator('button:has-text("+ Nouveau")').click();
    await page.locator('#fNomTpl').fill('Mon VIP à moi');
    await page.locator('#fSujet').fill('Sujet perso VIP');
    await page.locator('#fSeg').selectOption('vip');
    await page.locator('button:has-text("Enregistrer le template")').click();
    await page.goto('/campagnes.html');
    await page.locator('#seg').selectOption('vip');
    await expect(page.locator('#tplSuggest')).toContainText('Mon VIP à moi');
    await expect(page.locator('#tplSuggest')).not.toContainText('Client fidèle');
  });

  test('F2 corrigé : un modèle segmenté profil:none est suggéré quand profilSel=none', async ({ page }) => {
    await seed(page, { templates: [
      tpl({ id: 'tp_np', nom: 'TPL Non précisé', sujet: 'Sujet NP', corps: 'Corps NP', segment: 'profil:none' }),
    ] });
    await page.goto('/campagnes.html');
    await page.locator('#seg').selectOption('profil');
    await page.locator('#profilSel').selectOption('none');
    await expect(page.locator('#tplSuggest')).toBeVisible();
    await expect(page.locator('#tplSuggest')).toContainText('TPL Non précisé');
    await expect(page.locator('#subject')).toHaveValue('Sujet NP');
  });

  test('point A : "Utiliser dans campagne" reporte le segment du modèle sur le sélecteur de destinataires', async ({ page }) => {
    await seed(page, { templates: [] });
    await page.goto('/templates.html');
    await page.locator('button:has-text("+ Nouveau")').click();
    await page.locator('#fNomTpl').fill('Spécial Enfant');
    await page.locator('#fSujet').fill('Sujet Enfant Camp');
    await page.locator('#fSeg').selectOption('profil:enfant');
    await page.locator('#fCorps').fill('Corps enfant camp');
    await page.locator('button:has-text("Enregistrer le template")').click();
    // Utilise ce modèle dans une campagne
    await page.locator('button:has-text("Utiliser dans une campagne"), button:has-text("Utiliser dans campagne")').first().click();
    await page.waitForURL('**/campagnes.html');
    // Le segment destinataires doit refléter le modèle (profil + enfant), pas "Tous".
    await expect(page.locator('#seg')).toHaveValue('profil');
    await expect(page.locator('#profilSel')).toHaveValue('enfant');
    await expect(page.locator('#subject')).toHaveValue('Sujet Enfant Camp');
  });
});
