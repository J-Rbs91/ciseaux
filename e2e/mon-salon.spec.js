const { test, expect } = require('@playwright/test');

// Regroupement Prestations + Planning équipe sous une carte unique "Mon salon".

test.describe('hub — carte Mon salon', () => {

  // Bloque le service worker (pwa.js) : sinon il peut servir une page en cache
  // antérieure à mon-salon.html lors d'une navigation par clic.
  test.use({ serviceWorkers: 'block' });

  // Neutralise le guide d'onboarding (sinon son overlay intercepte les clics) :
  // il ne se lance pas si le salon est déjà configuré (profil-magasin avec nom).
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('profil-magasin-v1', JSON.stringify({ nom: 'Salon Test' }));
        sessionStorage.setItem('kut-tour-done', '1');
      } catch (e) {}
    });
  });

  test('l\'accueil expose une carte Mon salon (et plus les cartes directes Prestations/Planning)', async ({ page }) => {
    await page.goto('/index.html');
    const card = page.locator('a.card[href="mon-salon.html"]');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Mon salon');
    // Les deux cartes directes ne sont plus sur le hub
    await expect(page.locator('a.card[href="prestations.html"]')).toHaveCount(0);
    await expect(page.locator('a.card[href="planning.html"]')).toHaveCount(0);
  });

  test('la page Mon salon regroupe Prestations et Planning équipe', async ({ page }) => {
    await page.goto('/mon-salon.html');
    await expect(page.locator('h1')).toContainText('Mon salon');
    await expect(page.locator('a.card[href="prestations.html"]')).toContainText('Prestations');
    await expect(page.locator('a.card[href="planning.html"]')).toContainText('Planning équipe');
  });

  test('depuis l\'accueil, la carte mène à la page Mon salon', async ({ page }) => {
    await page.goto('/index.html');
    await page.locator('a.card[href="mon-salon.html"]').click();
    await page.waitForURL('**/mon-salon.html');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toContainText('Mon salon');
    await expect(page.locator('a.card[href="prestations.html"]')).toBeVisible();
  });
});
