const { test, expect } = require('@playwright/test');
const { seed, client, visit } = require('./_helpers');

// Compteur de membres fidélité + règle obligatoire des 12 mois à l'approche du cap (3000).

async function seedMany(page, activeN, staleMonths) {
  await page.addInitScript(({ activeN, staleMonths }) => {
    const now = Date.now(), arr = [];
    for (let i = 0; i < activeN; i++) {
      arr.push({ id: 'a_' + i, nom: 'Actif ' + i, mail: 'a' + i + '@x.fr', tel: '', dob: '', profil: '', notes: '',
        points: 0, visitsCount: 1, offre: '', optin: true, maj: '',
        visites: [{ date: new Date(now - 5 * 86400000).toISOString(), montant: 30, items: [] }], ledger: [] });
    }
    arr.push({ id: 'STALE', nom: 'Dormant', mail: 'd@x.fr', tel: '', dob: '', profil: '', notes: '',
      points: 0, visitsCount: 1, offre: '', optin: true, maj: '',
      visites: [{ date: new Date(now - staleMonths * 30.44 * 86400000).toISOString(), montant: 30, items: [] }], ledger: [] });
    try { localStorage.setItem('clients-v1', JSON.stringify(arr)); } catch (e) {}
  }, { activeN, staleMonths });
}

test.describe('clients.html — compteur fidélité & cap 3000', () => {

  test('compteur affiché, pas de règle obligatoire en dessous du seuil', async ({ page }) => {
    await seed(page, { clients: [client({ nom: 'A' }), client({ nom: 'B' }), client({ nom: 'C' })] });
    await page.goto('/clients.html');
    const box = page.locator('#capBox');
    await expect(box).toBeVisible();
    await expect(box).toContainText('membres fidélité');
    await expect(box).not.toContainText('obligatoire');
    // modale : réglage libre
    await page.locator('header button:has-text("Inactifs")').click();
    await expect(page.locator('#autoPurge')).toBeEnabled();
    await expect(page.locator('#capLockNote')).toBeHidden();
  });

  test('à l\'approche des 3000 : règle 12 mois imposée + dormant >12 mois supprimé', async ({ page }) => {
    await seedMany(page, 2500, 14); // 2501 membres au total, 1 dormant à 14 mois
    await page.goto('/clients.html');
    await expect(page.locator('#capBox')).toContainText('Règle obligatoire active');

    // La politique a été forcée : auto ON, délai plafonné à 12 mois.
    const polObj = await page.evaluate(() => JSON.parse(localStorage.getItem('crm-policy-v1') || '{}'));
    expect(polObj.autoPurge).toBe(true);
    expect(polObj.purgeMonths).toBeLessThanOrEqual(12);

    // Le dormant >12 mois a été effacé (local). Reste 2500 membres.
    const stats = await page.evaluate(() => {
      const arr = JSON.parse(localStorage.getItem('clients-v1') || '[]');
      return { n: arr.length, hasStale: arr.some(c => c.id === 'STALE') };
    });
    expect(stats.hasStale).toBe(false);
    expect(stats.n).toBe(2500);
  });

  test('à l\'approche : la modale verrouille la règle (12 mois, non désactivable)', async ({ page }) => {
    await seedMany(page, 2500, 3); // dormant récent : pas supprimé, mais cap atteint
    await page.goto('/clients.html');
    await page.locator('header button:has-text("Inactifs")').click();
    await expect(page.locator('#capLockNote')).toBeVisible();
    await expect(page.locator('#autoPurge')).toBeDisabled();
    await expect(page.locator('#autoPurge')).toBeChecked();
    const max = await page.locator('#inactMonths').getAttribute('max');
    expect(Number(max)).toBe(12);
    const val = await page.locator('#inactMonths').inputValue();
    expect(Number(val)).toBeLessThanOrEqual(12);
  });
});
