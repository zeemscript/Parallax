import assert from 'node:assert/strict';

export async function runContributorSpec({ page, go, settle }) {
  await go('/issue/512');
  await page.getByRole('heading', { name: 'Add a test helper for asserting emitted events' }).waitFor();
  await page.getByRole('button', { name: 'Apply to this issue' }).click();
  await page.waitForURL('**/login?**');
  await page.getByLabel('Display name').fill('Casey Contributor');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForURL('**/issue/512');
  await page.getByRole('button', { name: 'Apply to this issue' }).click();
  await page
    .getByLabel('Your plan')
    .fill(
      'I would add an assert_emitted helper that matches topics and data, prints a readable diff on failure, and ships with a documented example test.',
    );
  await page.getByRole('button', { name: 'Send proposal' }).click();
  await settle();
  assert.equal(await page.locator('.proposal').count(), 1);
  await page.reload();
  await settle();
  assert.match(await page.locator('.proposal').first().innerText(), /Applied/, 'proposal persists');

  await go('/me');
  assert.equal(await page.locator('.list-row').count(), 1, 'assignment appears in contributor workspace');
}
