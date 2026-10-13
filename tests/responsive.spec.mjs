import assert from 'node:assert/strict';
import { storageKey } from './fixtures.mjs';

export async function runResponsiveSpec({ page, go, settle }) {
  await go('/');
  await page.evaluate(key => {
    const s = JSON.parse(localStorage.getItem(key));
    s.session = { contributor: 'Casey Contributor', maintainer: 'ada-org' };
    s.repos = s.repos.map(r => (r.id === 'cli' ? { ...r, ownerId: 'ada-org' } : r));
    localStorage.setItem(key, JSON.stringify(s));
  }, storageKey);

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

  await page.setViewportSize({ width: 390, height: 900 });
  await go('/maintainer');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await settle();
  await page.locator('.rail.open').getByRole('link', { name: 'Connect a repo' }).click();
  await page.waitForURL('**/maintainer/submit');
}
