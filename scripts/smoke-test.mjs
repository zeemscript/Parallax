import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createSurfaceContext, launchBrowser } from '../tests/fixtures.mjs';
import { runLandingSpec } from '../tests/landing.spec.mjs';
import { runExploreSpec } from '../tests/explore.spec.mjs';
import { runContributorSpec } from '../tests/contributor.spec.mjs';
import { runMaintainerSpec } from '../tests/maintainer.spec.mjs';
import { runResponsiveSpec } from '../tests/responsive.spec.mjs';

const base = process.argv[2] ?? 'http://localhost:3000';
const filter = process.argv[3] ?? '';

const specs = [
  ['landing', runLandingSpec],
  ['explore', runExploreSpec],
  ['contributor', runContributorSpec],
  ['maintainer', runMaintainerSpec],
  ['responsive', runResponsiveSpec],
].filter(([name]) => !filter || name === filter);

const browser = await launchBrowser();

try {
  await Promise.all(
    specs.map(async ([name, fn]) => {
      const ctx = await createSurfaceContext(browser, base);
      try {
        await fn(ctx, base);
        assert.deepEqual(ctx.errors, [], `console/page errors in ${name}`);
        console.log(`Passed spec: ${name}`);
      } catch (error) {
        mkdirSync('test-results', { recursive: true });
        await ctx.page.screenshot({ path: `test-results/smoke-failure-${name}.png`, fullPage: true });
        writeFileSync(
          'test-results/report.html',
          `<!doctype html><title>Smoke Failure: ${name}</title><pre>${String(error.stack ?? error)}</pre>`,
          'utf8',
        );
        throw error;
      } finally {
        await ctx.context.close();
      }
    }),
  );
  console.log('Passed all 5 surface spec files in parallel with isolated localStorage contexts.');
} finally {
  await browser.close();
}
