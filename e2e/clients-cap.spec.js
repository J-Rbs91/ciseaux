const { test, expect } = require('@playwright/test');
const { seed, client } = require('./_helpers');

// Compteur de membres fidélité (jauge dans le header de Stats) + règle obligatoire
// des 12 mois à l'approche du cap (3000), appliquée côté Clients.

test.use({ serviceWorkers: 'block' }); // évite qu'un SW serve une page en cache

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

test.describe('Membres fidélité — jauge (Stats) & cap 3000 (Clients)', () => {

  test('jauge membres fidélité affichée dans le header de Stats', async ({ page }) => {
    const recent = d => [{ date: new Date(Date.now() - d * 86400000).toISOString(), montant: 20, items: [] }];
    await seed(page, { clients: [
      client({ nom: 'A', visites: recent(5) }),
      client({ nom: 'B', visites: recent(6) }),
      client({ nom: 'C', visites: recent(7) }),
    ] });
    await page.goto('/stats.html');
    await expect(page.locator('#memg')).toBeVisible();
    // 3 membres sur 3000 -> le texte ne contient que ces chiffres
    const digits = await page.locator('#memgN').evaluate(el => el.textContent.replace(/\D/g, ''));
    expect(digits).toBe('33000');
    // la barre a bien une largeur en pourcentage (proportionnelle au cap)
    const w = await page.locator('#memgF').evaluate(el => el.style.width);
    expect(w).toMatch(/^\d+%$/);
  });

  test('à l\'approche des 3000 : règle 12 mois imposée + dormant >12 mois supprimé', async ({ page }) => {
    await seedMany(page, 2500, 14); // 2501 membres, 1 dormant à 14 mois
    await page.goto('/clients.html');
    await expect(page.locator('#countEl')).toContainText('client'); // page chargée

    const polObj = await page.evaluate(() => JSON.parse(localStorage.getItem('crm-policy-v1') || '{}'));
    expect(polObj.autoPurge).toBe(true);
    expect(polObj.purgeMonths).toBeLessThanOrEqual(12);

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

  test('droit à l\'oubli : efface la fiche client (local + Drive)', async ({ page }) => {
    await seed(page, { clients: [client({ id: 'cX', nom: 'Marie Oubli', mail: 'm@x.fr', visites: [{ date: new Date(Date.now() - 5 * 86400000).toISOString(), montant: 20, items: [] }] })] });
    page.on('dialog', d => d.accept());
    await page.goto('/clients.html');
    await page.locator('.card', { hasText: 'Marie Oubli' }).click();
    await expect(page.locator('#oubliRow')).toBeVisible();
    await page.locator('#oubliRow button').click();
    await expect(page.locator('.card', { hasText: 'Marie Oubli' })).toHaveCount(0);
    const gone = await page.evaluate(() => JSON.parse(localStorage.getItem('clients-v1') || '[]').every(c => c.id !== 'cX'));
    expect(gone).toBe(true);
  });
});
