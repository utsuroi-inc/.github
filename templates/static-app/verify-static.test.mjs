import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyStatic } from './verify-static.mjs';

function fixture(html = '<!DOCTYPE html><script src="vendor/library.js"></script><script>function boot() { return 1; }</script>', manifest = true) {
  const root = mkdtempSync(join(tmpdir(), 'utsuroi-static-check-'));
  mkdirSync(join(root, 'vendor'));
  writeFileSync(join(root, 'vendor/library.js'), 'void 0;');
  writeFileSync(join(root, 'index.html'), html);
  if (manifest) writeFileSync(join(root, 'manifest.webmanifest'), JSON.stringify({ name: 'Demo', icons: [] }));
  return root;
}

function withFixture(html, fn) {
  const root = fixture(html);
  try { fn(root); } finally { rmSync(root, { recursive: true, force: true }); }
}

test('valid static site passes', () => withFixture(undefined, (root) => {
  assert.equal(verifyStatic(root).ok, true);
}));

test('JavaScript parse error fails closed', () => withFixture('<script>const = ;</script>', (root) => {
  assert.equal(verifyStatic(root).ok, false);
}));

test('missing local asset fails closed', () => withFixture('<script src="missing.js"></script>', (root) => {
  assert.match(verifyStatic(root).errors.join(' '), /必要なファイルがない/);
}));

test('runtime CDN JavaScript fails closed', () => withFixture('<script>const url = "https://cdn.example.test/unsafe.js";</script>', (root) => {
  assert.match(verifyStatic(root).errors.join(' '), /外部JavaScript URL/);
}));

test('dynamic code execution fails closed', () => withFixture('<script>eval("1 + 1");</script>', (root) => {
  assert.match(verifyStatic(root).errors.join(' '), /eval/);
}));

test('unsupported inline modules fail closed', () => withFixture('<script type="module">export const ready = true;</script>', (root) => {
  assert.match(verifyStatic(root).errors.join(' '), /inline module/);
}));

test('missing manifest icon fails closed', () => {
  const root = fixture();
  try {
    writeFileSync(join(root, 'manifest.webmanifest'), JSON.stringify({ name: 'Demo', icons: [{src:'icons/absent.png'}] }));
    assert.match(verifyStatic(root).errors.join(' '), /必要なファイルがない/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('path traversal reference fails closed', () => withFixture('<img src="../../private.txt">', (root) => {
  assert.match(verifyStatic(root).errors.join(' '), /ルート外への参照/);
}));
