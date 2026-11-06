import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const base = process.env.BASE_URL ?? 'http://localhost:3001';
const recordingsDir = path.resolve('recordings');
mkdirSync(recordingsDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--disable-extensions', '--no-first-run', '--disable-features=Translate']
});

// 1200x750 viewport for readable typography and crisp recording
const context = await browser.newContext({
  recordVideo: {
    dir: recordingsDir,
    size: { width: 1200, height: 750 }
  },
  viewport: { width: 1200, height: 750 },
  deviceScaleFactor: 1
});

const page = await context.newPage();

// Serve blank org avatars so tests are network-independent
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
await page.route(/^https:\/\/github\.com\/[^/]+\.png/, route =>
  route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }));

const sleep = ms => page.waitForTimeout(ms);

try {
  console.log('Step 1: Starting at Maintainer login...');
  await page.goto(`${base}/maintainer/login`);
  await page.waitForLoadState('networkidle');
  await sleep(600);

  // Maintainer logs in
  await page.getByLabel('Maintainer handle').fill('demo-maintainer');
  await sleep(400);
  await page.getByRole('button', { name: 'Enter maintainer area' }).click();
  await page.waitForURL('**/maintainer');
  await sleep(600);

  // Connect repository
  console.log('Step 2: Connecting demo repository...');
  await page.getByRole('link', { name: /Connect a repository/ }).click();
  await page.waitForURL('**/maintainer/submit');
  await sleep(500);

  await page.getByLabel('GitHub repository').fill('demo/bounty-app');
  await page.getByLabel('What does it do?').fill('Open source bounty and escrow app');
  await sleep(400);
  await page.getByRole('button', { name: 'Connect repository' }).click();
  await page.waitForURL('**/maintainer');
  await sleep(600);

  // Simulate verification
  console.log('Step 3: Simulating verification...');
  await page.getByRole('button', { name: /Simulate verification/ }).click();
  await sleep(600);
  await page.getByRole('link', { name: /Open dashboard/ }).click();
  await sleep(800);

  // Open Issues & Proposals
  console.log('Step 4: Posting an issue with bounty...');
  await page.getByRole('link', { name: /Issues & proposals/ }).first().click();
  await sleep(600);

  await page.getByRole('button', { name: 'Post an issue' }).click();
  await sleep(500);
  await page.getByLabel('Issue title').fill('Add dark mode theme persistence');
  await page.getByLabel('Acceptance criteria').fill('Save theme preference in localStorage\nRespect system dark mode');
  await page.getByLabel('Issue complexity').selectOption('Trivial');
  await sleep(400);
  await page.getByRole('button', { name: 'Post and fund issue' }).click();
  await sleep(1000);

  // Contributor signs in and applies
  console.log('Step 5: Contributor applies to the issue...');
  await page.goto(`${base}/login`);
  await sleep(500);
  await page.getByLabel('Display name').fill('casey-builder');
  await sleep(400);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForURL('**/explore');
  await sleep(700);

  // Click on the new issue
  await page.getByRole('link', { name: /Add dark mode theme persistence/ }).first().click();
  await sleep(700);

  // Send proposal
  await page.getByRole('button', { name: 'Apply to this issue' }).click();
  await sleep(500);
  await page.getByLabel('Your plan').fill('I will implement dark mode support using CSS variables and local storage syncing.');
  await sleep(500);
  await page.getByRole('button', { name: 'Send proposal' }).click();
  await sleep(1000);

  // Maintainer assigns contributor
  console.log('Step 6: Maintainer assigns the contributor...');
  const repoId = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('parallax-preview-v1'));
    return s.repos.find(r => r.ownerId === 'demo-maintainer')?.id;
  });

  await page.goto(`${base}/maintainer/repo/${repoId}/issues`);
  await sleep(600);
  await page.getByRole('button', { name: /Add dark mode theme persistence/ }).click();
  await sleep(600);
  await page.locator('.issue-block-body .proposal').first().getByRole('button', { name: 'Assign' }).click();
  await sleep(1000);

  // Contributor submits PR
  console.log('Step 7: Contributor submits pull request...');
  await page.goto(`${base}/me`);
  await sleep(700);
  await page.getByRole('button', { name: 'Submit PR' }).click();
  await sleep(500);
  await page.getByLabel('Pull request URL').fill('https://github.com/demo/bounty-app/pull/1');
  await sleep(400);
  await page.getByRole('button', { name: 'Submit for review' }).click();
  await sleep(1000);

  // Maintainer merges and releases
  console.log('Step 8: Maintainer merges and releases escrow...');
  await page.goto(`${base}/maintainer/repo/${repoId}/issues`);
  await sleep(600);
  await page.getByRole('button', { name: /Add dark mode theme persistence/ }).click();
  await sleep(600);
  await page.getByRole('button', { name: /Merge & release/ }).click();
  await sleep(1200);

  // Contributor checks receipt
  console.log('Step 9: Contributor verifies receipt...');
  await page.goto(`${base}/me/receipts`);
  await sleep(1800);

  console.log('Flow completed successfully!');
} catch (err) {
  console.error('Error in demo script:', err);
  process.exitCode = 1;
} finally {
  await page.close();
  await context.close();
  await browser.close();
}
