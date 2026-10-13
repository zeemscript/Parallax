import assert from 'node:assert/strict';

export async function runExploreSpec({ page, go, settle }) {
  await go('/explore');
  await page.getByRole('heading', { name: 'Explore', exact: true }).waitFor();
  await settle();
  assert.equal(await page.locator('.rail').count(), 0, 'explore is not a dashboard');
  assert.equal(await page.locator('.list-row').count(), 7);

  await page.getByLabel('Search', { exact: true }).fill('quickstart');
  await settle();
  assert.equal(await page.locator('.list-row').count(), 1);
  await page.getByLabel('Search', { exact: true }).fill('');

  await page.getByRole('tab', { name: 'Repositories' }).click();
  await page.waitForURL('**/explore/repos');
  await page.locator('.result-count', { hasText: '6 repositories' }).waitFor();
  assert.equal(await page.locator('.repo-tile').count(), 6);

  await page.getByRole('tab', { name: 'Organizations' }).click();
  await page.waitForURL('**/explore/orgs');
  await page.locator('.result-count', { hasText: '2 organizations' }).waitFor();
  assert.equal(await page.locator('.repo-tile').count(), 2, 'stellar and OpenZeppelin');

  await page.getByRole('tab', { name: 'Issues' }).click();
  await page.waitForURL('**/explore');
  await page.locator('.result-count', { hasText: '7 issues' }).waitFor();
  await page.getByRole('button', { name: 'Filters' }).click();
  await page.getByLabel('Complexity').selectOption('High');
  await settle();
  assert.equal(await page.locator('.list-row').count(), 2);
  await page.getByRole('button', { name: 'Reset' }).click();
  await settle();
  assert.equal(await page.locator('.list-row').count(), 7);

  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  await page.getByRole('button', { name: /Switch to light theme/ }).click();
  await settle();
  await page.reload();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
  await page.getByRole('button', { name: /Switch to dark theme/ }).click();
  await settle();
  await page.reload();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
}
