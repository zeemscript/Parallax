import test from 'node:test';
import assert from 'node:assert/strict';

import { safeRedirectTarget } from './redirect.ts';

test('safeRedirectTarget accepts path-only targets', () => {
  assert.equal(safeRedirectTarget('/issue/1'), '/issue/1');
  assert.equal(safeRedirectTarget('/explore?focus=1'), '/explore?focus=1');
});

test('safeRedirectTarget rejects protocol-relative URLs', () => {
  assert.equal(safeRedirectTarget('//example.com'), '/explore');
  assert.equal(safeRedirectTarget('///example.com'), '/explore');
});

test('safeRedirectTarget rejects backslash-prefixed hosts', () => {
  assert.equal(safeRedirectTarget('/\\example.com'), '/explore');
  assert.equal(safeRedirectTarget('/\\\\example.com'), '/explore');
});

test('safeRedirectTarget rejects absolute URLs and schemes', () => {
  assert.equal(safeRedirectTarget('https://example.com'), '/explore');
  assert.equal(safeRedirectTarget('http://example.com/path'), '/explore');
  assert.equal(safeRedirectTarget('javascript:alert(1)'), '/explore');
});

test('safeRedirectTarget rejects login targets to avoid redirect loops', () => {
  assert.equal(safeRedirectTarget('/login'), '/explore');
  assert.equal(safeRedirectTarget('/login?next=/issue/1'), '/explore');
});

test('safeRedirectTarget falls back for missing or empty values', () => {
  assert.equal(safeRedirectTarget(null), '/explore');
  assert.equal(safeRedirectTarget(undefined), '/explore');
  assert.equal(safeRedirectTarget(''), '/explore');
});

test('safeRedirectTarget honours a custom fallback', () => {
  assert.equal(safeRedirectTarget('//example.com', '/'), '/');
  assert.equal(safeRedirectTarget(null, '/'), '/');
});
