#!/usr/bin/env node
/*
  Build-time check: Ensure all frontend EXTENSION_* constants match extension constants
  - For each frontend constant named EXTENSION_XXX, verify there is a constant XXX in
    jreader-extension/src/lib/constants.ts with the exact same string value.
*/

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    console.error(`[constants-check] Failed to read ${filePath}:`, err.message);
    process.exit(1);
  }
}

function extractConsts(tsSource) {
  // Matches: export const NAME = 'value' as const;
  const re = /export\s+const\s+([A-Z0-9_]+)\s*=\s*'([^']+)'\s+as\s+const\s*;/g;
  const map = new Map();
  let m;
  while ((m = re.exec(tsSource)) !== null) {
    map.set(m[1], m[2]);
  }
  return map;
}

function runCheckOnce() {
  const frontendEventsPath = path.join(__dirname, '..', 'types', 'events.ts');
  const extensionConstantsPath = path.join(__dirname, '..', '..', 'jreader-extension', 'src', 'lib', 'constants.ts');

  const feSrc = readFile(frontendEventsPath);
  const extSrc = readFile(extensionConstantsPath);

  const feConsts = extractConsts(feSrc);
  const extConsts = extractConsts(extSrc);

  const errors = [];

  for (const [feName, feValue] of feConsts) {
    if (!feName.startsWith('EXTENSION_')) continue;
    const extName = feName.replace(/^EXTENSION_/, '');
    const extValue = extConsts.get(extName);
    if (extValue === undefined) {
      errors.push(`Missing extension constant for ${feName} → expected '${extName}' in extension constants.`);
      continue;
    }
    if (extValue !== feValue) {
      errors.push(`Value mismatch for ${feName} and ${extName}: frontend='${feValue}' extension='${extValue}'`);
    }
  }

  if (errors.length > 0) {
    const header = '[constants-check] Frontend/extension event constants mismatch:';
    return { ok: false, header, errors };
  }

  return { ok: true };
}
function main() {
  const isWatch = process.argv.includes('--watch');
  const result = runCheckOnce();
  if (!isWatch) {
    if (!result.ok) {
      console.error(result.header);
      for (const e of result.errors) console.error(' -', e);
      process.exit(1);
    }
    console.log('[constants-check] Extension event constants are in sync.');
    return;
  }

  // Watch mode: re-run on changes and report errors without exiting
  const frontendEventsPath = path.join(__dirname, '..', 'types', 'events.ts');
  const extensionConstantsPath = path.join(__dirname, '..', '..', 'jreader-extension', 'src', 'lib', 'constants.ts');

  const rerun = (src) => {
    const res = runCheckOnce();
    const ts = new Date().toLocaleTimeString();
    if (res.ok) {
      console.log(`[${ts}] [constants-check] OK after change in ${src}`);
    } else {
      console.error(`[${ts}] [constants-check] MISMATCH after change in ${src}:`);
      for (const e of res.errors) console.error(' -', e);
    }
  };

  // Use fs.watchFile for portability without extra deps
  fs.watchFile(frontendEventsPath, { interval: 300 }, () => rerun('frontend events.ts'));
  fs.watchFile(extensionConstantsPath, { interval: 300 }, () => rerun('extension constants.ts'));

  console.log('[constants-check] Watching for constant changes...');
}

main();


