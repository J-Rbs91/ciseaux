const { test, expect } = require('@playwright/test');
const { seed, client, visit } = require('./_helpers');

// Les fonctions de filtrage (filtrer/isWinback/hasReward/basketAvg/passCount/
// tookPresta/isProfil) sont globales dans campagnes.html. On les teste directement
// via page.evaluate après avoir réglé le segment et ses paramètres.

async function setSeg(page, seg) {
  await page.locator('#seg').selectOption(seg);
}

test.describe('campagnes.html — segmentation / filtrage destinataires', () => {

  test('filtre de base : exige mail valide + opt-in', async ({ page }) => {
    await seed(page, {});
    await page.goto('/campagnes.html');
    const res = await page.evaluate(() => {
      const arr = [
        { id: 'a', mail: 'a@x.com', optin: true },   // ok
        { id: 'b', mail: '', optin: true },           // pas de mail
        { id: 'c', mail: 'noat', optin: true },       // mail sans @
        { id: 'd', mail: 'd@x.com', optin: false },   // opt-out
      ];
      return filtrer(arr).map(c => c.id);
    });
    expect(res).toEqual(['a']);
  });

  test('opt-in accepte oui/true/1/x (isOptin)', async ({ page }) => {
    await seed(page, {});
    await page.goto('/campagnes.html');
    const res = await page.evaluate(() => {
      const arr = [
        { id: 'oui', mail: 'a@x.com', optin: 'oui' },
        { id: 'true', mail: 'b@x.com', optin: 'true' },
        { id: 'un', mail: 'c@x.com', optin: '1' },
        { id: 'x', mail: 'd@x.com', optin: 'x' },
        { id: 'non', mail: 'e@x.com', optin: 'non' },
      ];
      return filtrer(arr).map(c => c.id).sort();
    });
    expect(res).toEqual(['oui', 'true', 'un', 'x'].sort());
  });

  test('segment reward : dépend des règles de fidélité (seuil points)', async ({ page }) => {
    await seed(page, { fidelite: { seuil: 10, recompense: 'R', ptsParVisite: 1 } });
    await page.goto('/campagnes.html');
    await setSeg(page, 'reward');
    const res = await page.evaluate(() => {
      const arr = [
        { id: 'lo', mail: 'a@x.com', optin: true, points: 5 },
        { id: 'eq', mail: 'b@x.com', optin: true, points: 10 },
        { id: 'hi', mail: 'c@x.com', optin: true, points: 20 },
      ];
      return filtrer(arr).map(c => c.id).sort();
    });
    expect(res).toEqual(['eq', 'hi']);
  });

  test('segment freq : passCount >= minVisits (paramètre)', async ({ page }) => {
    await seed(page, {});
    await page.goto('/campagnes.html');
    await setSeg(page, 'freq');
    await page.locator('#minVisits').fill('3');
    const res = await page.evaluate(() => {
      const v = (n) => Array.from({ length: n }, (_, i) => ({ date: '2024-0' + ((i % 9) + 1) + '-01' }));
      const arr = [
        { id: 'two', mail: 'a@x.com', optin: true, visites: v(2) },
        { id: 'three', mail: 'b@x.com', optin: true, visites: v(3) },
        { id: 'five', mail: 'c@x.com', optin: true, visites: v(5) },
      ];
      return filtrer(arr).map(c => c.id).sort();
    });
    expect(res).toEqual(['five', 'three']);
  });

  test('segment vip : basketAvg >= minBasket', async ({ page }) => {
    await seed(page, {});
    await page.goto('/campagnes.html');
    await setSeg(page, 'vip');
    await page.locator('#minBasket').fill('50');
    const res = await page.evaluate(() => {
      const arr = [
        { id: 'cheap', mail: 'a@x.com', optin: true, visites: [{ date: '2024-01-01', montant: 20 }, { date: '2024-02-01', montant: 20 }] },
        { id: 'rich', mail: 'b@x.com', optin: true, visites: [{ date: '2024-01-01', montant: 60 }, { date: '2024-02-01', montant: 80 }] },
      ];
      return filtrer(arr).map(c => c.id);
    });
    expect(res).toEqual(['rich']);
  });

  test('F4 corrigé : seuil panier 0 n\'inclut PAS les clients sans dépense', async ({ page }) => {
    await seed(page, {});
    await page.goto('/campagnes.html');
    await setSeg(page, 'vip');
    await page.locator('#minBasket').fill('0');
    const res = await page.evaluate(() => {
      const arr = [
        { id: 'nospend', mail: 'a@x.com', optin: true, visites: [{ date: '2024-01-01', montant: 0 }] },
        { id: 'novisit', mail: 'b@x.com', optin: true, visites: [] },
        { id: 'spent', mail: 'c@x.com', optin: true, visites: [{ date: '2024-01-01', montant: 12 }] },
      ];
      return filtrer(arr).map(c => c.id);
    });
    expect(res).toEqual(['spent']); // seul un client ayant réellement dépensé est VIP
  });

  test('basketAvg ignore les montants <= 0', async ({ page }) => {
    await seed(page, {});
    await page.goto('/campagnes.html');
    const avg = await page.evaluate(() => basketAvg({ visites: [{ montant: 0 }, { montant: -5 }, { montant: 100 }] }));
    expect(avg).toBe(100); // seul le 100 compte
  });

  test('segment winback : exige >=3 visites ET retard > moyenne*facteur', async ({ page }) => {
    await seed(page, {});
    await page.goto('/campagnes.html');
    await setSeg(page, 'winback');
    await page.locator('#winMult').fill('2');
    const res = await page.evaluate(() => {
      const day = 86400000, now = Date.now();
      const iso = (ms) => new Date(now - ms).toISOString().slice(0, 10);
      // habitué régulier (intervalle ~30j) mais en retard de 90j -> winback
      const late = { id: 'late', mail: 'a@x.com', optin: true, visites: [
        { date: iso(150 * day) }, { date: iso(120 * day) }, { date: iso(90 * day) }, { date: iso(90 * day) },
      ] };
      // habitué régulier, vu récemment -> PAS winback
      const recent = { id: 'recent', mail: 'b@x.com', optin: true, visites: [
        { date: iso(60 * day) }, { date: iso(40 * day) }, { date: iso(20 * day) }, { date: iso(5 * day) },
      ] };
      // seulement 2 visites -> jamais winback
      const few = { id: 'few', mail: 'c@x.com', optin: true, visites: [{ date: iso(200 * day) }, { date: iso(190 * day) }] };
      return filtrer([late, recent, few]).map(c => c.id);
    });
    expect(res).toEqual(['late']);
  });

  test('isWinback : 1 visite ou 0 visite -> false', async ({ page }) => {
    await seed(page, {});
    await page.goto('/campagnes.html');
    const out = await page.evaluate(() => ({
      zero: isWinback({ visites: [] }, 2),
      one: isWinback({ visites: [{ date: '2020-01-01' }] }, 2),
    }));
    expect(out.zero).toBe(false);
    expect(out.one).toBe(false);
  });

  test('segment profil : isProfil filtre par valeur exacte', async ({ page }) => {
    await seed(page, {});
    await page.goto('/campagnes.html');
    await setSeg(page, 'profil');
    await page.locator('#profilSel').selectOption('enfant');
    const res = await page.evaluate(() => {
      const arr = [
        { id: 'h', mail: 'a@x.com', optin: true, profil: 'homme' },
        { id: 'e', mail: 'b@x.com', optin: true, profil: 'enfant' },
        { id: 'vide', mail: 'c@x.com', optin: true, profil: '' },
      ];
      return filtrer(arr).map(c => c.id);
    });
    expect(res).toEqual(['e']);
  });

  test('segment profil "Non précisé" (none) : ne capte que les profils vides', async ({ page }) => {
    await seed(page, {});
    await page.goto('/campagnes.html');
    await setSeg(page, 'profil');
    await page.locator('#profilSel').selectOption('none');
    const res = await page.evaluate(() => {
      const arr = [
        { id: 'h', mail: 'a@x.com', optin: true, profil: 'homme' },
        { id: 'vide', mail: 'b@x.com', optin: true, profil: '' },
        { id: 'space', mail: 'c@x.com', optin: true, profil: '   ' }, // espaces -> vide après trim
      ];
      return filtrer(arr).map(c => c.id).sort();
    });
    expect(res).toEqual(['space', 'vide']);
  });

  test('segment presta : tookPresta matche un item de visite (insensible casse)', async ({ page }) => {
    await seed(page, { profilMagasin: { prestations: [{ nom: 'Coupe Homme', prix: 20 }] } });
    await page.goto('/campagnes.html');
    await setSeg(page, 'presta');
    await page.locator('#prestaSel').selectOption('Coupe Homme');
    const res = await page.evaluate(() => {
      const arr = [
        { id: 'took', mail: 'a@x.com', optin: true, visites: [{ date: '2024-01-01', items: [{ nom: 'coupe homme' }] }] },
        { id: 'not', mail: 'b@x.com', optin: true, visites: [{ date: '2024-01-01', items: [{ nom: 'Couleur' }] }] },
      ];
      return filtrer(arr).map(c => c.id);
    });
    expect(res).toEqual(['took']);
  });

  test('segment all : tous les opt-in avec mail valide', async ({ page }) => {
    await seed(page, {});
    await page.goto('/campagnes.html');
    await setSeg(page, 'all');
    const res = await page.evaluate(() => filtrer([
      { id: 'a', mail: 'a@x.com', optin: true, profil: 'homme' },
      { id: 'b', mail: 'b@x.com', optin: true, profil: '' },
    ]).map(c => c.id));
    expect(res.sort()).toEqual(['a', 'b']);
  });

  test('segChange affiche le bon panneau de paramètres', async ({ page }) => {
    await seed(page, {});
    await page.goto('/campagnes.html');
    await setSeg(page, 'winback');
    await expect(page.locator('#paramWinback')).toBeVisible();
    await setSeg(page, 'vip');
    await expect(page.locator('#paramVip')).toBeVisible();
    await expect(page.locator('#paramWinback')).toBeHidden();
    await setSeg(page, 'profil');
    await expect(page.locator('#paramProfil')).toBeVisible();
  });
});
