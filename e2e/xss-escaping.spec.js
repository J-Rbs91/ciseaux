const { test, expect } = require('@playwright/test');
const { seed, tpl, offre } = require('./_helpers');

const XSS = '<img src=x onerror="window.__xss=1">';

test.describe('Échappement HTML (escH/escAttr) — anti-XSS', () => {

  test('offres : nom avec injection HTML n\'exécute pas de script', async ({ page }) => {
    await seed(page, { offres: [offre({ nom: XSS, reduction: XSS, desc: XSS })] });
    await page.goto('/offres.html');
    await page.waitForSelector('.offre-card');
    const xss = await page.evaluate(() => window.__xss);
    expect(xss).toBeUndefined();
    // pas de vraie balise img injectée dans la carte
    const imgs = await page.locator('.offre-card img').count();
    expect(imgs).toBe(0);
    await expect(page.locator('.offre-nom')).toContainText('<img');
  });

  test('offres : prestation avec injection dans la value (escAttr)', async ({ page }) => {
    await seed(page, {
      offres: [],
      profilMagasin: { prestations: [{ nom: '"><img src=x onerror="window.__xss=1">', prix: 10 }] },
    });
    await page.goto('/offres.html');
    await page.locator('.empty-cta').click();
    await page.locator('#fAnniv').check();
    await page.waitForTimeout(50);
    const xss = await page.evaluate(() => window.__xss);
    expect(xss).toBeUndefined();
  });

  test('templates : nom et sujet avec injection dans la liste', async ({ page }) => {
    await seed(page, { templates: [tpl({ id: 't1', nom: XSS, sujet: XSS })] });
    await page.goto('/templates.html');
    await page.waitForSelector('.tpl-card');
    const xss = await page.evaluate(() => window.__xss);
    expect(xss).toBeUndefined();
    const imgs = await page.locator('.tpl-card img').count();
    expect(imgs).toBe(0);
  });

  test('templates : corps avec injection dans l\'aperçu (textContent)', async ({ page }) => {
    await seed(page, { templates: [tpl({ id: 't1', nom: 'X', corps: XSS })] });
    await page.goto('/templates.html');
    await page.locator('.tpl-card').first().click();
    const xss = await page.evaluate(() => window.__xss);
    expect(xss).toBeUndefined();
    await expect(page.locator('#pvBody')).toContainText('<img');
  });

  test('campagnes : picker avec template malveillant n\'exécute rien', async ({ page }) => {
    await seed(page, { templates: [tpl({ id: 't1', nom: XSS, sujet: XSS })] });
    await page.goto('/campagnes.html');
    await page.locator('button:has-text("Choisir un modèle"), #pickBtn, [onclick*="openPicker"]').first().click();
    await page.waitForSelector('.picker-card');
    const xss = await page.evaluate(() => window.__xss);
    expect(xss).toBeUndefined();
    const imgs = await page.locator('.picker-card img').count();
    expect(imgs).toBe(0);
  });

  test('campagnes : bandeau de suggestion échappe le nom du template', async ({ page }) => {
    await seed(page, { templates: [tpl({ id: 't1', nom: XSS, sujet: 's', corps: 'c', segment: 'vip' })] });
    await page.goto('/campagnes.html');
    await page.locator('#seg').selectOption('vip');
    await page.waitForTimeout(50);
    const xss = await page.evaluate(() => window.__xss);
    expect(xss).toBeUndefined();
    const imgs = await page.locator('#tplSuggest img').count();
    expect(imgs).toBe(0);
  });
});
