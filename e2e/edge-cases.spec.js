const { test, expect } = require('@playwright/test');
const { seed, tpl, offre, client, visit } = require('./_helpers');

test.describe('Cas limites & incohérences', () => {

  test('campagnes : preview sans synchro affiche un message d\'erreur', async ({ page }) => {
    await seed(page, { syncUrl: '' });
    await page.goto('/campagnes.html');
    // le notice "synchro non configurée" doit être visible
    await expect(page.locator('#notice')).toBeVisible();
  });

  test('campagnes : send sans sujet -> erreur', async ({ page }) => {
    await seed(page, { syncUrl: 'https://example.invalid/exec' });
    await page.goto('/campagnes.html');
    await page.locator('#body').fill('un corps');
    await page.locator('#sendBtn, button:has-text("Envoyer")').first().click();
    await expect(page.locator('#result')).toContainText(/objet/i);
  });

  test('campagnes : send sans corps -> erreur', async ({ page }) => {
    await seed(page, { syncUrl: 'https://example.invalid/exec' });
    await page.goto('/campagnes.html');
    await page.locator('#subject').fill('un objet');
    await page.locator('#sendBtn, button:has-text("Envoyer")').first().click();
    await expect(page.locator('#result')).toContainText(/message/i);
  });

  test('campagnes : compteur de caractères se met à jour', async ({ page }) => {
    await seed(page, {});
    await page.goto('/campagnes.html');
    await page.locator('#body').fill('12345');
    await expect(page.locator('#counter')).toContainText('5 caractères');
  });

  test('offres : montant/réduction négatif accepté tel quel (pas de validation)', async ({ page }) => {
    await seed(page, { offres: [] });
    await page.goto('/offres.html');
    await page.locator('.empty-cta').click();
    await page.locator('#fNom').fill('Bizarre');
    await page.locator('#fReduction').fill('-999%');
    await page.locator('button:has-text("Enregistrer")').first().click();
    await expect(page.locator('.offre-badge')).toHaveText('-999%');
  });

  test('templates : liste vide impossible (initSeeds reseed toujours)', async ({ page }) => {
    await seed(page, { templates: [] });
    await page.goto('/templates.html');
    await expect(page.locator('.tpl-card').first()).toBeVisible();
  });

  test('fidelite : reward avec règles multiples (visits + points)', async ({ page }) => {
    await seed(page, {
      fidelite: {
        counters: { visits: { enabled: true, label: 'visites' }, points: { enabled: true, label: 'points' } },
        rewards: [
          { active: true, counter: 'visits', threshold: 5, name: 'Coupe offerte' },
          { active: true, counter: 'points', threshold: 100, name: 'Soin offert' },
        ],
      },
    });
    await page.goto('/campagnes.html');
    await page.locator('#seg').selectOption('reward');
    const res = await page.evaluate(() => {
      return filtrer([
        { id: 'v', mail: 'a@x.com', optin: true, visitsCount: 5, points: 0 },   // seuil visites
        { id: 'p', mail: 'b@x.com', optin: true, visitsCount: 0, points: 100 }, // seuil points
        { id: 'none', mail: 'c@x.com', optin: true, visitsCount: 1, points: 1 },
      ]).map(c => c.id).sort();
    });
    expect(res).toEqual(['p', 'v']);
  });

  test('clients : normClient (app-sync) — profil vide => "" ; optin variés', async ({ page }) => {
    // app-sync est chargé par les pages clients ; on l'évalue via clients.html.
    await seed(page, {});
    await page.goto('/clients.html');
    const out = await page.evaluate(() => {
      const n1 = DB._normClient({ id: 'a', nom: 'A', profil: 'Enfant', optin: 'oui' });
      const n2 = DB._normClient({ id: 'b', nom: 'B' });
      const n3 = DB._normClient({ id: 'c', nom: 'C', optin: 'non' });
      return { p1: n1.profil, o1: n1.optin, p2: n2.profil, o2: n2.optin, o3: n3.optin };
    });
    expect(out.p1).toBe('Enfant'); // conserve la casse telle quelle
    expect(out.o1).toBe(true);
    expect(out.p2).toBe('');       // profil par défaut vide = "Non précisé"
    expect(out.o2).toBe(false);
    expect(out.o3).toBe(false);
  });

  test('persistance profil client après reload (clients.html)', async ({ page }) => {
    await seed(page, { clients: [client({ id: 'c_1', nom: 'Profilé', profil: 'femme', mail: 'p@x.com' })] });
    await page.goto('/clients.html');
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('clients-v1'))[0].profil);
    expect(before).toBe('femme');
    await page.reload();
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('clients-v1'))[0].profil);
    expect(after).toBe('femme');
  });

  test('incohérence casse profil : client "Homme" vs segment "homme"', async ({ page }) => {
    // isProfil compare en minuscules : un profil stocké "Homme" doit matcher "homme".
    await seed(page, {});
    await page.goto('/campagnes.html');
    const matched = await page.evaluate(() => isProfil({ profil: 'Homme' }, 'homme'));
    expect(matched).toBe(true);
  });
});
