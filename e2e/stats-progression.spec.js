const { test, expect } = require('@playwright/test');
const { seed, client, visit } = require('./_helpers');

// Vérifie la section "Progression commerciale" de stats.html sur un jeu déterministe.
// Périmètre = clients fidélité. Données calées sur "aujourd'hui" (mois en cours).

function dataset() {
  const prestations = [
    { id: 'p1', nom: 'Coupe', prix: 30, duree: 30 },    // 60 €/h
    { id: 'p2', nom: 'Couleur', prix: 60, duree: 90 },  // 40 €/h
  ];
  const jourOuvert = { open: true, start: '09:00', end: '17:00', pause: ['', ''] };
  const jours = {};
  for (let i = 0; i < 7; i++) jours[i] = jourOuvert;
  const agenda = { mode: 'capacite', capacite: 1, jours, collaborateurs: [], fermetures: [] };

  // A : client connu (1ʳᵉ visite il y a 100 j) revenu aujourd'hui -> "revenus"
  const a = client({ id: 'cA', nom: 'Alice', visites: [
    visit(0, 30, [{ nom: 'Coupe', prix: 30 }]),
    visit(100, 30, [{ nom: 'Coupe', prix: 30 }]),
  ] });
  // B : nouveau client (seule visite = aujourd'hui) -> "nouveaux"
  const b = client({ id: 'cB', nom: 'Bob', visites: [
    visit(0, 60, [{ nom: 'Couleur', prix: 60 }]),
  ] });

  return { clients: [a, b], profilMagasin: { nom: 'Salon Test', prestations, agenda } };
}

test.describe('stats.html — Progression commerciale', () => {

  test('bandeau de périmètre fidélité affiché', async ({ page }) => {
    await seed(page, dataset());
    await page.goto('/stats.html');
    await expect(page.locator('.scope')).toContainText('programme de fidélité');
  });

  test('les 6 leviers sont présents', async ({ page }) => {
    await seed(page, dataset());
    await page.goto('/stats.html');
    const panel = page.locator('.panel', { hasText: 'Progression commerciale' });
    await expect(panel).toBeVisible();
    for (const nom of ['Chiffre d\'affaires', 'Acquisition', 'Rétention', 'Fréquence', 'Valeur', 'Réactivation']) {
      await expect(panel.locator('.lever', { hasText: nom })).toBeVisible();
    }
  });

  test('acquisition = 1 nouveau, rétention = 1 connu (50 %), panier = 45,00 €, CA = 90 €', async ({ page }) => {
    await seed(page, dataset());
    await page.goto('/stats.html');
    await expect(page.locator('.lever', { hasText: 'Acquisition' }).locator('.lever-v')).toHaveText('1');
    await expect(page.locator('.lever', { hasText: 'Rétention' })).toContainText('50 %');
    await expect(page.locator('.lever', { hasText: 'Valeur' }).locator('.lever-v')).toHaveText('45,00 €');
    await expect(page.locator('.lever', { hasText: 'Chiffre d\'affaires' }).locator('.lever-v')).toHaveText('90 €');
  });

  test('rentabilité par temps : Coupe (60 €/h) classée avant Couleur (40 €/h)', async ({ page }) => {
    await seed(page, dataset());
    await page.goto('/stats.html');
    // période = Tout pour inclure toutes les prestations
    await page.locator('.pbtn[data-p="all"]').click();
    const panel = page.locator('.panel', { hasText: 'Rentabilité par temps' });
    await expect(panel).toBeVisible();
    const first = panel.locator('.rank-item').first();
    await expect(first.locator('.rank-name')).toHaveText('Coupe');
    await expect(first.locator('.rank-val')).toHaveText('60 €/h');
  });

  test('taux d\'occupation de l\'agenda calculé (capacité connue)', async ({ page }) => {
    await seed(page, dataset());
    await page.goto('/stats.html');
    const panel = page.locator('.panel', { hasText: 'Taux d\'occupation de l\'agenda' });
    await expect(panel).toBeVisible();
    await expect(panel.locator('.occ-big')).toContainText('%');
    await expect(panel.locator('.gauge-f')).toBeVisible();
  });

  test('CA nouveaux vs fidèles : 60 € nouveaux / 30 € fidèles ce mois', async ({ page }) => {
    await seed(page, dataset());
    await page.goto('/stats.html');
    const panel = page.locator('.panel', { hasText: 'CA nouveaux vs fidèles' });
    await expect(panel).toContainText('Nouveaux 60 €');
    await expect(panel).toContainText('Fidèles 30 €');
  });
});
