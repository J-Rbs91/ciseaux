const { test, expect } = require('@playwright/test');
const { seed, tpl, offre, lsGet } = require('./_helpers');

test.describe('templates.html — seeds, CRUD, segment, variables', () => {

  test('initSeeds : injecte les 9 modèles de base si vide', async ({ page }) => {
    await seed(page, { templates: [] });
    await page.goto('/templates.html');
    await expect(page.locator('.tpl-card')).toHaveCount(9);
    const arr = await lsGet(page, 'email-templates-v1');
    expect(arr).toHaveLength(9);
    const segs = arr.reduce((m, t) => { m[t.id] = t.segment; return m; }, {});
    expect(segs['t_seed_promo']).toBe('winback');
    expect(segs['t_seed_fide']).toBe('reward');
    expect(segs['t_seed_vip']).toBe('vip');
    expect(segs['t_seed_enfant']).toBe('profil:enfant');
    expect(segs['t_seed_homme']).toBe('profil:homme');
    expect(segs['t_seed_femme']).toBe('profil:femme');
  });

  test('initSeeds : rétro-remplit le champ segment des seeds installés SANS segment', async ({ page }) => {
    // Un seed déjà installé d'une ancienne version, sans propriété segment.
    const oldPromo = tpl({ id: 't_seed_promo', nom: 'Promo du moment', sujet: 'x' });
    delete oldPromo.segment; // simule l'absence du champ
    await seed(page, { templates: [oldPromo] });
    await page.goto('/templates.html');
    const arr = await lsGet(page, 'email-templates-v1');
    const promo = arr.find(t => t.id === 't_seed_promo');
    expect(promo.segment).toBe('winback'); // rétro-rempli depuis SEEDS
  });

  test('initSeeds : n\'écrase PAS un segment personnalisé sur un seed', async ({ page }) => {
    const custom = tpl({ id: 't_seed_promo', nom: 'Promo perso', sujet: 'x', segment: 'vip' });
    await seed(page, { templates: [custom] });
    await page.goto('/templates.html');
    const arr = await lsGet(page, 'email-templates-v1');
    const promo = arr.find(t => t.id === 't_seed_promo');
    expect(promo.segment).toBe('vip'); // conservé
  });

  test('initSeeds : ajoute les seeds manquants sans toucher aux modèles persos', async ({ page }) => {
    const mine = tpl({ id: 't_custom', nom: 'Mon modèle', segment: 'freq' });
    await seed(page, { templates: [mine] });
    await page.goto('/templates.html');
    const arr = await lsGet(page, 'email-templates-v1');
    expect(arr.find(t => t.id === 't_custom')).toBeTruthy();
    expect(arr.find(t => t.id === 't_seed_promo')).toBeTruthy();
    expect(arr.length).toBe(10); // 1 perso + 9 seeds
  });

  test('création d\'un template avec segment : persiste', async ({ page }) => {
    await seed(page, { templates: [] });
    await page.goto('/templates.html');
    await page.locator('button:has-text("+ Nouveau")').click();
    await page.locator('#fNomTpl').fill('Mon VIP');
    await page.locator('#fSujet').fill('Sujet VIP');
    await page.locator('#fSeg').selectOption('vip');
    await page.locator('#fCorps').fill('Corps custom');
    await page.locator('button:has-text("Enregistrer le template")').click();
    await expect(page.locator('#saveSt')).toContainText('enregistré');
    const arr = await lsGet(page, 'email-templates-v1');
    const t = arr.find(x => x.nom === 'Mon VIP');
    expect(t).toBeTruthy();
    expect(t.segment).toBe('vip');
    expect(t.sujet).toBe('Sujet VIP');
  });

  test('création sans nom : bloquée', async ({ page }) => {
    await seed(page, { templates: [] });
    let alertText = '';
    page.on('dialog', d => { alertText = d.message(); d.accept(); });
    await page.goto('/templates.html');
    await page.locator('button:has-text("+ Nouveau")').click();
    await page.locator('button:has-text("Enregistrer le template")').click();
    expect(alertText).toMatch(/nom/i);
  });

  test('édition : chargerTpl recharge le segment dans le select', async ({ page }) => {
    await seed(page, { templates: [tpl({ id: 't1', nom: 'Edit', segment: 'profil:enfant' })] });
    await page.goto('/templates.html');
    await page.locator('.tpl-card', { hasText: 'Edit' }).click();
    await expect(page.locator('#fSeg')).toHaveValue('profil:enfant');
  });

  test('suppression d\'un template', async ({ page }) => {
    await seed(page, { templates: [tpl({ id: 't1', nom: 'ASupprimer' })] });
    page.on('dialog', d => d.accept());
    await page.goto('/templates.html');
    await page.locator('.tpl-card', { hasText: 'ASupprimer' }).locator('.del').click();
    await expect(page.locator('.tpl-card', { hasText: 'ASupprimer' })).toHaveCount(0);
  });

  test('variables {prenom}/{points} substituées dans l\'aperçu', async ({ page }) => {
    await seed(page, { templates: [tpl({ id: 't1', nom: 'Var', corps: 'Salut {prenom}, vous avez {points} points' })] });
    await page.goto('/templates.html');
    await page.locator('.tpl-card', { hasText: 'Var' }).click();
    const pv = page.locator('#pvBody');
    await expect(pv).toContainText('Salut Marie');
    await expect(pv).toContainText('7 points'); // {points} -> 7 dans la démo
  });

  test('offres liées : seules les offres actives proposées', async ({ page }) => {
    await seed(page, {
      templates: [],
      offres: [offre({ id: 'o_on', nom: 'Active', actif: true }), offre({ id: 'o_off', nom: 'Inactive', actif: false })],
    });
    await page.goto('/templates.html');
    await page.locator('button:has-text("+ Nouveau")').click();
    await expect(page.locator('#offresChk label')).toHaveCount(1);
    await expect(page.locator('#offresChk')).toContainText('Active');
    await expect(page.locator('#offresChk')).not.toContainText('Inactive');
  });

  test('persistance après reload', async ({ page }) => {
    await seed(page, { templates: [] });
    await page.goto('/templates.html');
    await page.locator('button:has-text("+ Nouveau")').click();
    await page.locator('#fNomTpl').fill('Persistant');
    await page.locator('#fSeg').selectOption('freq');
    await page.locator('button:has-text("Enregistrer le template")').click();
    await page.reload();
    await expect(page.locator('.tpl-card', { hasText: 'Persistant' })).toBeVisible();
  });
});
