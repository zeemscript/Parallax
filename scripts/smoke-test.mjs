import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const base = process.argv[2] ?? 'http://localhost:3000';
const storageKey = 'parallax-preview-v1';
const browser = await chromium.launch({
  // CHROME_PATH wins; on Windows fall back to the stock Chrome install, elsewhere to Playwright's own Chromium.
  executablePath: process.env.CHROME_PATH
    ?? (process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : undefined),
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 940 } });

// Org avatars come from github.com. Serve a blank image instead so the run is
// hermetic and a network hiccup cannot surface as a console error.
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
await page.route(/^https:\/\/github\.com\/[^/]+\.png/, route =>
  route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }));
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

const go = async path => { await page.goto(base + path); await page.locator('#main, .public, .auth').first().waitFor(); };
const settle = () => page.waitForTimeout(350);

try {
  // ---------------------------------------------------------- public surfaces
  await go('/');
  await page.getByRole('heading', { name: /Every merged PR/ }).waitFor();
  assert.equal(await page.locator('.rail').count(), 0, 'landing has no dashboard rail');
  assert.equal(await page.locator('.lanyard-badge').count(), 1, 'hero lanyard renders');
  assert.ok(await page.evaluate(() => {
    const strip = document.querySelector('.strip').getBoundingClientRect();
    return strip.top >= innerHeight - 2;
  }), 'the hero fills the viewport and the repository strip sits below the fold');
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
  assert.equal(await page.getByRole('link', { name: 'Maintainer sign-in' }).count(), 0,
    'the maintainer sign-in button is gone from the hero');
  assert.ok(await page.locator('.navpill').getByRole('link', { name: 'List your repo' }).isVisible(),
    'top nav says List your repo');
  assert.equal(await page.getByText(/\bwave\b/i).count(), 0, 'no wave wording left on the landing page');

  await page.getByRole('link', { name: /Explore issues/ }).first().click();
  await page.waitForURL('**/explore');
  await page.getByRole('heading', { name: 'Explore', exact: true }).waitFor();
  await settle();
  assert.equal(await page.locator('.rail').count(), 0, 'explore is not a dashboard');
  assert.equal(await page.locator('.list-row').count(), 7);

  // search + tabs
  await page.getByLabel('Search', { exact: true }).fill('quickstart');
  await settle();
  assert.equal(await page.locator('.list-row').count(), 1);
  await page.getByLabel('Search', { exact: true }).fill('');
  // Wait on each tab's own result count: the previous tab's tiles linger for a
  // frame after the URL changes, so waiting on any tile can count the old view.
  await page.getByRole('tab', { name: 'Repositories' }).click();
  await page.waitForURL('**/explore/repos');
  await page.locator('.result-count', { hasText: '6 repositories' }).waitFor();
  assert.equal(await page.locator('.repo-tile').count(), 6);
  await page.getByRole('tab', { name: 'Organizations' }).click();
  await page.waitForURL('**/explore/orgs');
  await page.locator('.result-count', { hasText: '2 organizations' }).waitFor();
  assert.equal(await page.locator('.repo-tile').count(), 2, 'stellar and OpenZeppelin');

  // filters
  await page.getByRole('tab', { name: 'Issues' }).click();
  await page.waitForURL('**/explore');
  await page.locator('.result-count', { hasText: '7 issues' }).waitFor();
  await page.getByRole('button', { name: 'Filters' }).click();
  await page.getByLabel('Complexity').selectOption('High');
  await settle();
  assert.equal(await page.locator('.list-row').count(), 2);
  await page.getByLabel('Bounty').selectOption('over $750');
  await settle();
  assert.equal(await page.locator('.list-row').count(), 2);
  await page.getByRole('button', { name: 'Reset' }).click();
  await settle();
  assert.equal(await page.locator('.list-row').count(), 7);

  // ------------------------------------------------------- contributor apply
  await go('/issue/512');
  await page.getByRole('heading', { name: 'Add a test helper for asserting emitted events' }).waitFor();
  await page.getByRole('button', { name: 'Apply to this issue' }).click();
  await page.waitForURL('**/login?**');
  await page.getByLabel('Display name').fill('Casey Contributor');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForURL('**/issue/512');
  await page.getByRole('button', { name: 'Apply to this issue' }).click();
  await page.getByLabel('Your plan').fill('I would add an assert_emitted helper that matches topics and data, prints a readable diff on failure, and ships with a documented example test.');
  await page.getByRole('button', { name: 'Send proposal' }).click();
  await settle();
  assert.equal(await page.locator('.proposal').count(), 1);
  await page.reload();
  await settle();
  assert.match(await page.locator('.proposal').first().innerText(), /Applied/, 'proposal persists');

  await go('/me');
  assert.equal(await page.locator('.list-row').count(), 1, 'assignment appears in contributor workspace');

  // ------------------------------------------- maintainer is a separate login
  await go('/maintainer');
  await page.waitForURL('**/maintainer/login');
  assert.ok(await page.getByLabel('Maintainer handle').isVisible(),
    'a contributor session does not open the maintainer area');

  await page.getByLabel('Maintainer handle').fill('ada-org');
  await page.getByRole('button', { name: 'Enter maintainer area' }).click();
  await page.waitForURL('**/maintainer');
  await page.getByRole('heading', { name: 'No repositories connected' }).waitFor();

  // ------------------------------- connecting does not open a dashboard by itself
  await page.getByRole('link', { name: /Connect a repository/ }).click();
  await page.waitForURL('**/maintainer/submit');
  await page.getByLabel('GitHub repository').fill('ada-org/soroban-kit');
  await page.getByLabel('What does it do?').fill('A toolkit for building and testing Soroban contracts.');
  await page.getByRole('button', { name: 'Connect repository' }).click();
  await page.waitForURL('**/maintainer');
  await settle();
  assert.match(await page.locator('.repo-card').first().innerText(), /Pending/);
  assert.equal(await page.getByRole('link', { name: /Open dashboard/ }).count(), 0,
    'no dashboard link while the repository is pending');

  const repoId = await page.evaluate(key =>
    JSON.parse(localStorage.getItem(key)).repos.find(r => r.ownerId === 'ada-org').id, storageKey);

  // the gate also holds against a direct URL
  await page.goto(`${base}/maintainer/repo/${repoId}`);
  await page.waitForURL('**/maintainer');
  assert.ok(!page.url().includes('/repo/'), 'pending repo dashboard is refused by URL');

  // ----------------------------------------- verification opens that dashboard
  await page.getByRole('button', { name: /Simulate verification/ }).click();
  await settle();
  assert.match(await page.locator('.repo-card').first().innerText(), /Verified/);
  await page.getByRole('link', { name: /Open dashboard/ }).click();
  await page.waitForURL(`**/maintainer/repo/${repoId}`);
  await settle();
  assert.equal(await page.locator('.page-head h1').innerText(), 'soroban-kit');
  assert.equal(await page.locator('.rail-scope-sub').innerText(), 'ada-org/soroban-kit',
    'the dashboard is scoped to one repository');

  // a different maintainer cannot reach it
  await go('/maintainer/login');
  await page.getByLabel('Maintainer handle').fill('someone-else');
  await page.getByRole('button', { name: 'Enter maintainer area' }).click();
  await page.waitForURL('**/maintainer');
  await page.goto(`${base}/maintainer/repo/${repoId}`);
  await page.waitForURL('**/maintainer');
  assert.ok(!page.url().includes('/repo/'), 'another maintainer is refused');

  // --------------------------------------------- proposals on a seeded repo
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
  assert.ok(states.includes('Assigned') && states.includes('Rejected'),
    'assigning one candidate declines the rest');

  // ------------------------------------------------- post and fund an issue
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

  // --------------------------------------- assign, PR, merge, receipt written
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

  // --------------------------------------------------------- theme persistence
  // Dark is the default, so toggle to light, verify it sticks, then return.
  await go('/explore');
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  await page.getByRole('button', { name: /Switch to light theme/ }).click();
  await settle();
  await page.reload();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
  await page.getByRole('button', { name: /Switch to dark theme/ }).click();
  await settle();
  await page.reload();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');

  // ------------------------------------------------------------- responsive
  const routes = [
    '/', '/explore', '/explore/repos', '/explore/orgs', '/issue/842',
    '/login', '/maintainer/login', '/maintainer', '/maintainer/submit',
    '/maintainer/repo/cli', '/maintainer/repo/cli/issues',
    '/maintainer/repo/cli/settings', '/me', '/me/receipts', '/me/settings',
  ];
  for (const width of [1440, 1024, 820, 640, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      await go(route);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1),
        false,
        `${route} overflows horizontally at ${width}px`,
      );
    }
  }

  // ---------------------------------------------------------- mobile drawer
  await page.setViewportSize({ width: 390, height: 900 });
  await go('/maintainer');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await settle();
  await page.locator('.rail.open').getByRole('link', { name: 'Connect a repo' }).click();
  await page.waitForURL('**/maintainer/submit');

  assert.deepEqual(errors, []);
  console.log('Passed: public explore (no dashboard chrome), search/tabs/filters, contributor apply and persistence, separate maintainer sign-in, connect-then-verify gate, per-repo dashboards scoped by owner and verification, proposal assignment, posting a funded issue, payout address validation, merge-and-release writing a receipt, theme persistence, 15 routes at 5 widths with no overflow, and the mobile drawer.');
} catch (error) {
  console.log(await page.locator('body').innerText());
  mkdirSync('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/smoke-failure.png', fullPage: true });
  throw error;
} finally {
  await browser.close();
}
