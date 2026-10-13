import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|mjs)$/.test(entry)) out.push(full);
  }
  return out;
}

const files = [...walk('src'), ...walk('scripts')];
let errors = 0;

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  if (/^\s*debugger\b/m.test(text)) {
    console.error(`${file}: unexpected debugger statement (no-debugger)`);
    errors++;
  }
  if (text.includes('\t')) {
    console.error(`${file}: tab character found; expected 2-space indentation (.editorconfig / prettier)`);
    errors++;
  }
}

if (errors > 0) process.exit(1);
console.log(`Checked ${files.length} source files: 0 lint or formatting errors.`);
