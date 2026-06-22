const { test, expect } = require('@playwright/test');
const { seed } = require('./_helpers');

// Cycle de vie des modèles fournis (onboarding) :
//  - disponibles dès le premier accès ;
//  - re-fournis tant que le salon n'est pas configuré + script Google déployé ;
//  - définitivement supprimables une fois l'onboarding terminé.
// "Onboardé" = profil-magasin-v1.nom renseigné ET sync-url-v1 posée.

test.describe('templates.html — kit fourni & onboarding', () => {

  test('premier accès (vide, non configuré) : les 9 modèles fournis sont installés', async ({ page }) => {
    await seed(page, { templates: [] });
    await page.goto('/templates.html');
    await expect(page.locator('.tpl-card')).toHaveCount(9);
    await expect(page.locator('.tpl-card', { hasText: 'Offre homme' })).toBeVisible();
    await expect(page.locator('.tpl-card', { hasText: 'Offre femme' })).toBeVisible();
  });

  test('NON configuré : un modèle fourni supprimé est re-fourni au rechargement', async ({ page }) => {
    await seed(page, { templates: [] }); // ni salon ni sync -> onboarding non terminé
    page.on('dialog', d => d.accept());
    await page.goto('/templates.html');
    await page.locator('.tpl-card', { hasText: 'Offre homme' }).locator('.del').click();
    await expect(page.locator('.tpl-card', { hasText: 'Offre homme' })).toHaveCount(0);
    await page.reload();
    // Tant que l'onboarding n'est pas fini, le kit revient.
    await expect(page.locator('.tpl-card', { hasText: 'Offre homme' })).toBeVisible();
  });

  test('configuré (salon + script déployé) : un modèle fourni supprimé reste supprimé', async ({ page }) => {
    await seed(page, {
      templates: [],
      profilMagasin: { nom: 'Salon Démo' },             // salon paramétré
      syncUrl: 'https://example.invalid/exec',          // script Google déployé
    });
    page.on('dialog', d => d.accept());
    await page.goto('/templates.html');
    // Le kit est tout de même posé au tout premier accès…
    await expect(page.locator('.tpl-card', { hasText: 'Offre homme' })).toBeVisible();
    // …mais une fois configuré, la suppression est définitive.
    await page.locator('.tpl-card', { hasText: 'Offre homme' }).locator('.del').click();
    await expect(page.locator('.tpl-card', { hasText: 'Offre homme' })).toHaveCount(0);
    await page.reload();
    await expect(page.locator('.tpl-card', { hasText: 'Offre homme' })).toHaveCount(0);
    // Le journal d'installation a bien retenu le modèle (ne pas le réinjecter).
    const log = await page.evaluate(() => JSON.parse(localStorage.getItem('email-templates-seeds-v1') || '[]'));
    expect(log).toContain('t_seed_homme');
  });

  test('configuré : suppression d\'UN modèle ne supprime pas les autres', async ({ page }) => {
    await seed(page, {
      templates: [],
      profilMagasin: { nom: 'Salon Démo' },
      syncUrl: 'https://example.invalid/exec',
    });
    page.on('dialog', d => d.accept());
    await page.goto('/templates.html');
    await page.locator('.tpl-card', { hasText: 'Offre femme' }).locator('.del').click();
    await page.reload();
    await expect(page.locator('.tpl-card', { hasText: 'Offre femme' })).toHaveCount(0);
    await expect(page.locator('.tpl-card', { hasText: 'Offre homme' })).toBeVisible();
    await expect(page.locator('.tpl-card', { hasText: 'Promo du moment' })).toBeVisible();
  });
});
