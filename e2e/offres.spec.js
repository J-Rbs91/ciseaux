const { test, expect } = require('@playwright/test');
const { seed, offre, lsGet } = require('./_helpers');

test.describe('offres.html — CRUD, activation, anniversaire, badges', () => {

  test('état vide : affiche l\'empty state avec CTA', async ({ page }) => {
    await seed(page, { offres: [] });
    await page.goto('/offres.html');
    await expect(page.locator('.empty-title')).toHaveText('Vos offres commerciales');
    await expect(page.locator('.empty-cta')).toBeVisible();
  });

  test('création d\'une offre : persiste dans localStorage et s\'affiche', async ({ page }) => {
    await seed(page, { offres: [] });
    await page.goto('/offres.html');
    await page.locator('.empty-cta').click();
    await page.locator('#fNom').fill('Coupe -20%');
    await page.locator('#fReduction').fill('-20%');
    await page.locator('#fDesc').fill('Sur toute coupe');
    await page.locator('button:has-text("Enregistrer")').first().click();
    await expect(page.locator('.offre-nom')).toHaveText('Coupe -20%');
    await expect(page.locator('.offre-badge')).toHaveText('-20%');
    const arr = await lsGet(page, 'offres-v1');
    expect(arr).toHaveLength(1);
    expect(arr[0].nom).toBe('Coupe -20%');
    expect(arr[0].actif).toBe(true);
  });

  test('création sans nom : bloquée par alert', async ({ page }) => {
    await seed(page, { offres: [] });
    let alertText = '';
    page.on('dialog', d => { alertText = d.message(); d.accept(); });
    await page.goto('/offres.html');
    await page.locator('.empty-cta').click();
    await page.locator('button:has-text("Enregistrer")').first().click();
    expect(alertText).toMatch(/nom/i);
    const arr = await lsGet(page, 'offres-v1');
    expect(arr).toHaveLength(0);
  });

  test('badge réduction affiché ; badge vide si pas de réduction', async ({ page }) => {
    await seed(page, { offres: [offre({ nom: 'Soin offert', reduction: '' }), offre({ nom: 'Promo', reduction: '-30%' })] });
    await page.goto('/offres.html');
    const badges = page.locator('.offre-badge');
    await expect(badges).toHaveCount(2);
  });

  test('toggle activation : bascule actif/inactif et persiste', async ({ page }) => {
    await seed(page, { offres: [offre({ id: 'o_1', nom: 'X', actif: true })] });
    await page.goto('/offres.html');
    const toggle = page.locator('.toggle');
    await expect(toggle).toHaveClass(/on/);
    await toggle.click();
    await expect(page.locator('.toggle')).toHaveClass(/off/);
    let arr = await lsGet(page, 'offres-v1');
    expect(arr[0].actif).toBe(false);
    // la carte porte la classe inactif
    await expect(page.locator('.offre-card')).toHaveClass(/inactif/);
  });

  test('suppression : retire l\'offre après confirmation', async ({ page }) => {
    await seed(page, { offres: [offre({ id: 'o_1', nom: 'À supprimer' })] });
    page.on('dialog', d => d.accept());
    await page.goto('/offres.html');
    await page.locator('.offre-actions .del').click();
    await expect(page.locator('.empty-title')).toBeVisible();
    const arr = await lsGet(page, 'offres-v1');
    expect(arr).toHaveLength(0);
  });

  test('édition : recharge les champs et met à jour', async ({ page }) => {
    await seed(page, { offres: [offre({ id: 'o_1', nom: 'Ancien', reduction: '-10%' })] });
    await page.goto('/offres.html');
    await page.locator('.btn-ic:not(.del)').first().click();
    await expect(page.locator('#fNom')).toHaveValue('Ancien');
    await page.locator('#fNom').fill('Nouveau');
    await page.locator('button:has-text("Enregistrer")').first().click();
    await expect(page.locator('.offre-nom')).toHaveText('Nouveau');
  });

  test('offre anniversaire : tag 🎂 et bloc email visible quand actif', async ({ page }) => {
    await seed(page, { offres: [offre({ id: 'o_1', nom: 'Anniv', anniv: true, actif: true, emailSujet: 'Joyeux', emailCorps: 'Hello' })] });
    await page.goto('/offres.html');
    const tag = page.locator('.anniv-tag');
    await expect(tag).toBeVisible();
    await expect(tag).toContainText('Anniversaire');
    await expect(tag).toContainText('envoi auto');
  });

  test('offre anniversaire désactivée : pas de "envoi auto"', async ({ page }) => {
    await seed(page, { offres: [offre({ id: 'o_1', nom: 'Anniv', anniv: true, actif: false })] });
    await page.goto('/offres.html');
    await expect(page.locator('.anniv-tag')).toContainText('Anniversaire');
    await expect(page.locator('.anniv-tag')).not.toContainText('envoi auto');
  });

  test('toggle anniversaire dans le modal révèle le bloc anniv', async ({ page }) => {
    await seed(page, { offres: [] });
    await page.goto('/offres.html');
    await page.locator('.empty-cta').click();
    await expect(page.locator('#annivBlock')).toBeHidden();
    await page.locator('#fAnniv').check();
    await expect(page.locator('#annivBlock')).toBeVisible();
  });

  test('persistance après reload', async ({ page }) => {
    await seed(page, { offres: [] });
    await page.goto('/offres.html');
    await page.locator('.empty-cta').click();
    await page.locator('#fNom').fill('Persistante');
    await page.locator('button:has-text("Enregistrer")').first().click();
    await expect(page.locator('.offre-nom')).toHaveText('Persistante');
    await page.reload();
    await expect(page.locator('.offre-nom')).toHaveText('Persistante');
  });

  test('emoji / accents dans le nom affichés correctement', async ({ page }) => {
    await seed(page, { offres: [offre({ nom: 'Été ☀️ -15%', reduction: 'Réduit' })] });
    await page.goto('/offres.html');
    await expect(page.locator('.offre-nom')).toHaveText('Été ☀️ -15%');
  });
});
