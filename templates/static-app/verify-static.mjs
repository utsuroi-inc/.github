#!/usr/bin/env node
// Minimal fail-closed checks for HTML/JS static sites, not a replacement for SAST,
// dependency scanning, an authorization test, or human security review.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, extname, sep } from 'node:path';
import { Script } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const textExtensions = new Set(['.html', '.htm', '.js', '.mjs', '.css']);
const ignoredFolders = new Set(['.git', '.github', 'node_modules', 'vendor', 'dist', 'coverage']);

export function verifyStatic(rootDir) {
  const root = resolve(rootDir);
  const errors = [];
  const warnings = [];
  const fail = (message) => errors.push(message);
  const warn = (message) => warnings.push(message);

  function safeFile(relativePath, referringFile) {
    const clean = relativePath.split(/[?#]/, 1)[0];
    if (!clean || clean.startsWith('#')) return;
    if (/^(?:https?:)?\/\//i.test(clean)) return;
    if (/^(?:mailto:|tel:|data:|blob:)/i.test(clean)) return;
    if (/^[a-z][a-z\d+.-]*:/i.test(clean)) {
      fail(`${referringFile}: 未確認のURL scheme: ${clean}`);
      return;
    }
    let decoded;
    try { decoded = decodeURIComponent(clean); }
    catch { fail(`${referringFile}: 不正なURLエンコード: ${clean}`); return; }
    const path = decoded.startsWith('/') ? resolve(root, '.' + decoded) : resolve(dirname(resolve(root, referringFile)), decoded);
    if (path !== root && !path.startsWith(root + sep)) {
      fail(`${referringFile}: ルート外への参照: ${relativePath}`);
    } else if (!existsSync(path) || !statSync(path).isFile()) {
      fail(`${referringFile}: 必要なファイルがない: ${relativePath}`);
    }
  }

  function compileJavaScript(code, origin) {
    if (origin.endsWith('.mjs')) {
      const checked = spawnSync(process.execPath, ['--check', resolve(root, origin)], { encoding: 'utf8' });
      if (checked.status !== 0) fail(`${origin}: JavaScript構文エラー: ${checked.stderr.trim()}`);
    } else {
      try { new Script(code, { filename: origin }); }
      catch (error) { fail(`${origin}: JavaScript構文エラー: ${error.message}`); }
    }
    const forbidden = [
      [/\beval\s*\(/g, 'eval()'],
      [/\bnew\s+Function\s*\(/g, 'new Function()'],
      [/\bdocument\.write\s*\(/g, 'document.write()'],
      [/http:\/\//g, '暗号化されないHTTP通信'],
      [/https?:\/\/[^\s'"`]+\.(?:js|mjs)(?:[?#][^\s'"`]*)?/g, 'コード内の外部JavaScript URL'],
    ];
    for (const [pattern, label] of forbidden) {
      if (pattern.test(code)) fail(`${origin}: ${label} は自動公開前に除去または設計を見直す`);
    }
    if (/\binnerHTML\s*=/.test(code)) warn(`${origin}: innerHTML の入力がすべて信頼済みか人が確認する`);
  }

  function checkHtml(html, filename) {
    const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
    for (const match of html.matchAll(scriptRe)) {
      const attrs = match[1];
      const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1];
      const type = /\btype\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1] || '';
      if (src) {
        if (/^(?:https?:)?\/\//i.test(src)) {
          if (!/\bintegrity\s*=/.test(attrs) || !/\bcrossorigin\s*=/.test(attrs)) {
            fail(`${filename}: 外部<script>にはSRI integrityとcrossoriginが必須: ${src}`);
          }
        } else safeFile(src, filename);
      } else if (type === '' || /javascript|module/i.test(type)) {
        if (type.toLowerCase() === 'module') {
          fail(`${filename}: inline moduleは本検査対象外。対応するbuild/構文検査を追加するまで合格にしない`);
        } else compileJavaScript(match[2], `${filename}: inline script`);
      }
    }
    for (const match of html.matchAll(/<link\b([^>]+)>/gi)) {
      const attrs = match[1];
      const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1];
      if (!href) continue;
      if (/^(?:https?:)?\/\//i.test(href)) {
        if (/\brel\s*=\s*["']stylesheet["']/i.test(attrs) && !/\bintegrity\s*=/.test(attrs)) {
          fail(`${filename}: 外部CSSにSRI integrityがない: ${href}`);
        }
      } else safeFile(href, filename);
    }
    for (const match of html.matchAll(/<img\b([^>]+)>/gi)) {
      const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(match[1])?.[1];
      if (src) safeFile(src, filename);
    }
    if (/\son[a-z]+\s*=\s*["']/i.test(html)) fail(`${filename}: HTMLのインラインイベントハンドラは禁止`);
  }

  if (!existsSync(resolve(root, 'index.html'))) fail('index.html が見つからない');
  const visit = (dir) => {
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      if (item.isDirectory()) {
        if (!ignoredFolders.has(item.name)) visit(resolve(dir, item.name));
      } else if (item.isFile() && textExtensions.has(extname(item.name))) {
        const path = resolve(dir, item.name);
        const relative = path.slice(root.length + 1);
        // CI checker/test fixtures are tooling, not served application code.
        // Their own syntax and tests run as separate CI steps.
        if (relative === 'scripts/verify-static.mjs' || relative === 'scripts/verify-static.test.mjs') continue;
        const content = readFileSync(path, 'utf8');
        if (/\.html?$/.test(item.name)) checkHtml(content, relative);
        else if (/\.(?:js|mjs)$/.test(item.name)) compileJavaScript(content, relative);
      }
    }
  };
  if (existsSync(root)) visit(root);

  const manifestPath = resolve(root, 'manifest.webmanifest');
  if (existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      if (!manifest.name && !manifest.short_name) fail('manifest.webmanifest: name/short_nameがない');
      for (const icon of manifest.icons || []) {
        if (typeof icon.src === 'string') safeFile(icon.src, 'manifest.webmanifest');
      }
    } catch (error) { fail(`manifest.webmanifest: JSONエラー: ${error.message}`); }
  }
  return { ok: errors.length === 0, errors, warnings };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const result = verifyStatic(process.argv[2] || '.');
  for (const warning of result.warnings) console.warn(`WARNING: ${warning}`);
  for (const error of result.errors) console.error(`ERROR: ${error}`);
  console.log(`static-check: ${result.ok ? 'PASS' : 'FAIL'} / errors=${result.errors.length} warnings=${result.warnings.length}`);
  if (!result.ok) process.exitCode = 1;
}
