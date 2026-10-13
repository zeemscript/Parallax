import assert from 'node:assert/strict';

export async function runLandingSpec({ page, go }) {
  await go('/');
  await page.getByRole('heading', { name: /Every merged PR/ }).waitFor();
  assert.equal(await page.locator('.rail').count(), 0, 'landing has no dashboard rail');
  assert.equal(await page.locator('.lanyard-badge').count(), 1, 'hero lanyard renders');
  assert.ok(
    await page.evaluate(() => {
      const strip = document.querySelector('.strip').getBoundingClientRect();
      return strip.top >= innerHeight - 2;
    }),
    'the hero fills the viewport and the repository strip sits below the fold',
  );
  assert.ok(await page.locator('.announce').isVisible(), 'announcement bar renders');
  assert.ok(await page.locator('.navpill .goo-items a').count() >= 3, 'gooey nav links render');
  assert.ok(await page.locator('.logoloop-set').count() >= 2, 'logo loop duplicates its set');
  assert.equal(await page.locator('.swap-card').count(), 4, 'card swap stack renders');
  assert.equal(await page.locator('.bounce-card').count(), 3, 'bounce cards render');
  assert.ok(await page.locator('.spiral-item').count() >= 6, 'infinite spiral renders');
  assert.equal(await page.locator('.pcard').count(), 4, 'profile cards render');
  assert.ok(await page.locator('section').count() >= 8, 'landing has the full set of sections');
  assert.equal(await page.locator('.faq-item').count(), 6);
  assert.ok(await page.locator('.logoloop .strip-item').count() >= 6, 'repository logo loop renders');
  assert.equal(
    await page.getByRole('link', { name: 'Maintainer sign-in' }).count(),
    0,
    'the maintainer sign-in button is gone from the hero',
  );
  assert.ok(
    await page.locator('.navpill').getByRole('link', { name: 'List your repo' }).isVisible(),
    'top nav says List your repo',
  );
  assert.equal(await page.getByText(/\bwave\b/i).count(), 0, 'no wave wording left on the landing page');
}
