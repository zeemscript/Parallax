import assert from 'node:assert/strict';
import { storageKey } from './fixtures.mjs';

export async function runMaintainerSpec({ page, go, settle }, base) {
  await go('/issue/512');
  await page.getByRole('button', { name: 'Apply to this issue' }).click();
  await page.getByLabel('Display name').fill('Casey Contributor');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Apply to this issue' }).click();
  await page.getByLabel('Your plan').fill('Ship assert_emitted helper with tests.');
  await page.getByRole('button', { name: 'Send proposal' }).click();
  await settle();

  await go('/maintainer');
  await page.waitForURL('**/maintainer/login');
  assert.ok(
    await page.getByLabel('Maintainer handle').isVisible(),
    'a contributor session does not open the maintainer area',
  );

  await page.getByLabel('Maintainer handle').fill('ada-org');
  await page.getByRole('button', { name: 'Enter maintainer area' }).click();
  await page.waitForURL('**/maintainer');
  await page.getByRole('heading', { name: 'No repositories connected' }).waitFor();

  await page.getByRole('link', { name: /Connect a repository/ }).click();
  await page.waitForURL('**/maintainer/submit');
  await page.getByLabel('GitHub repository').fill('ada-org/soroban-kit');
  await page.getByLabel('What does it do?').fill('A toolkit for building and testing Soroban contracts.');
  await page.getByRole('button', { name: 'Connect repository' }).click();
  await page.waitForURL('**/maintainer');
  await settle();
  assert.match(await page.locator('.repo-card').first().innerText(), /Pending/);
  assert.equal(
    await page.getByRole('link', { name: /Open dashboard/ }).count(),
    0,
    'no dashboard link while the repository is pending',
  );

  const repoId = await page.evaluate(
    key => JSON.parse(localStorage.getItem(key)).repos.find(r => r.ownerId === 'ada-org').id,
    storageKey,
  );

  await page.goto(`${base}/maintainer/repo/${repoId}`);
  await page.waitForURL('**/maintainer');
  assert.ok(!page.url().includes('/repo/'), 'pending repo dashboard is refused by URL');

  await page.getByRole('button', { name: /Simulate verification/ }).click();
  await settle();
  assert.match(await page.locator('.repo-card').first().innerText(), /Verified/);
  await page.getByRole('link', { name: /Open dashboard/ }).click();
  await page.waitForURL(`**/maintainer/repo/${repoId}`);
  await settle();
  assert.equal(await page.locator('.page-head h1').innerText(), 'soroban-kit');
  assert.equal(
    await page.locator('.rail-scope-sub').innerText(),
    'ada-org/soroban-kit',
    'the dashboard is scoped to one repository',
  );

  await go('/maintainer/login');
  await page.getByLabel('Maintainer handle').fill('someone-else');
  await page.getByRole('button', { name: 'Enter maintainer area' }).click();
  await page.waitForURL('**/maintainer');
  await page.goto(`${base}/maintainer/repo/${repoId}`);
  await page.waitForURL('**/maintainer');
  assert.ok(!page.url().includes('/repo/'), 'another maintainer is refused');

  await go('/maintainer/login');
  await page.getByLabel('Maintainer handle').fill('ada-org');
  await page.getByRole('button', { name: 'Enter maintainer area' }).click();
  await page.waitForURL('**/maintainer');
  await page.evaluate(key => {
    const s = JSON.parse(localStorage.getItem(key));
    s.repos = s.repos.map(r => (['cli', 'soroban-sdk'].includes(r.id) ? { ...r, ownerId: 'ada-org' } : r));
    localStorage.setItem(key, JSON.stringify(s));
  }, storageKey);
  await go('/maintainer/repo/cli/issues');
  await page.getByRole('button', { name: /Resume interrupted contract deploys/ }).click();
  await settle();
  assert.equal(await page.locator('.issue-block-body .proposal').count(), 2, 'two seeded proposals');
  await page.locator('.issue-block-body .proposal').first().getByRole('button', { name: 'Assign' }).click();
  await settle();
  const states = await page.locator('.issue-block-body .proposal .chip').allInnerTexts();
  assert.ok(
    states.includes('Assigned') && states.includes('Rejected'),
    'assigning one candidate declines the rest',
  );

  await page.getByRole('button', { name: 'Post an issue' }).click();
  await page.getByLabel('Issue title').fill('Add shell completions for zsh and fish');
  await page.getByLabel('Acceptance criteria').fill('Generate completions for zsh\nGenerate completions for fish');
  await page.getByLabel('Issue complexity').selectOption('Trivial');
  assert.equal(await page.getByLabel('Bounty').inputValue(), '150', 'complexity suggests a bounty');
  await page.getByLabel('Bounty').fill('250');
  await page.getByRole('button', { name: 'Post and fund issue' }).click();
  await settle();
  assert.ok(await page.getByRole('button', { name: /Add shell completions/ }).isVisible(), 'posted issue is listed');
  await go('/explore');
  await page.getByLabel('Search', { exact: true }).fill('shell completions');
  await settle();
  assert.equal(await page.locator('.list-row').count(), 1, 'posted issue reaches explore');
  assert.match(await page.locator('.list-row').first().innerText(), /\$250/);

  await go('/maintainer/repo/soroban-sdk/issues');
  await page.getByRole('button', { name: /Add a test helper for asserting emitted events/ }).click();
  await settle();
  await page.locator('.issue-block-body .proposal').first().getByRole('button', { name: 'Assign' }).click();
  await settle();

  await go('/me/settings');
  await page.getByLabel('Payout address').fill('not-an-address');
  await page.getByRole('button', { name: 'Save address' }).click();
  assert.ok(await page.getByRole('alert').isVisible(), 'an invalid Stellar address is refused');
  await page.getByLabel('Payout address').fill('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7');
  await page.getByRole('button', { name: 'Save address' }).click();
  await settle();

  await go('/me');
  await page.getByRole('button', { name: 'Submit PR' }).click();
  await page.getByLabel('Pull request URL').fill('https://github.com/stellar/rs-soroban-sdk/pull/1234');
  await page.getByRole('button', { name: 'Submit for review' }).click();
  await settle();

  await go('/maintainer/repo/soroban-sdk/issues');
  await page.getByRole('button', { name: /Add a test helper for asserting emitted events/ }).click();
  await settle();
  await page.getByRole('button', { name: /Merge & release/ }).click();
  await settle();

  await go('/me/receipts');
  assert.equal(await page.locator('.list-row').count(), 1, 'merging writes a receipt');
  assert.match(await page.locator('.list-row').first().innerText(), /\+\$450/);
  assert.match(await page.locator('.stat').first().innerText(), /\$450/, 'earned total reflects the payout');
}
