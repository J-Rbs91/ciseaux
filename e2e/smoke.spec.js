const { test, expect } = require('@playwright/test');

test('smoke: la page Templates se charge et liste les modèles de base', async ({ page }) => {
  await page.goto('/templates.html');
  // initSeeds doit injecter au moins les modèles de base
  await expect(page.locator('#tplList')).toBeVisible();
  await page.waitForTimeout(200);
  const txt = await page.locator('body').innerText();
  expect(txt).toContain('Promo du moment');
});
