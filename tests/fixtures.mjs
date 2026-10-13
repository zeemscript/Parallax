import { chromium } from 'playwright-core';

export const storageKey = 'parallax-preview-v1';

const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

export async function launchBrowser() {
  return chromium.launch({
    executablePath:
      process.env.CHROME_PATH ??
      (process.platform === 'win32'
        ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
        : undefined),
    headless: true,
  });
}

export async function createSurfaceContext(browser, base) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 940 } });
  const page = await context.newPage();
  await page.route(/^https:\/\/github\.com\/[^/]+\.png/, route =>
    route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }),
  );
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const go = async path => {
    await page.goto(base + path);
    await page.locator('#main, .public, .auth').first().waitFor();
  };
  const settle = () => page.waitForTimeout(350);
  return { context, page, errors, go, settle };
}
