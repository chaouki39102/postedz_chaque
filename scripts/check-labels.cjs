// فحص: كل مفتاح تسمية مستعمل في الواجهة موجود في بذور التسميات.
// أداة تطوير فقط، تُشغَّل بـ node scripts/check-labels.cjs
const fs = require('fs');
const path = require('path');

const files = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.tsx?$/.test(entry.name)) files.push(full);
  }
};
walk('src');

const seeds = fs.readFileSync('src/data/labelSeeds.ts', 'utf8');
const seeded = new Set();
for (const m of seeds.matchAll(/key:\s*'([^']+)'/g)) seeded.add(m[1]);

const missing = [];
const used = new Set();
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  for (const m of source.matchAll(/\bt\(\s*'([a-zA-Z0-9_]+\.[a-zA-Z0-9_]+)'/g)) used.add(m[1]);
  for (const m of source.matchAll(/\bt\(\s*([a-zA-Z0-9_]+\.[a-zA-Z0-9_]+)\s*[,)]/g)) used.add(m[1]);
  for (const m of source.matchAll(/useLabelProxy\(\s*'([a-zA-Z0-9_.]+)'\s*\)/g)) {
    for (const k of source.matchAll(/currentLabels\.([a-zA-Z0-9_]+)/g)) {
      used.add(m[1] + k[1]);
    }
  }
  for (const m of source.matchAll(/currentLabels\[\s*`\$\{[^}]+\}([a-zA-Z0-9_]+)`\s*\]/g)) {
    for (const id of ['banks', 'defaults', 'presets', 'labels', 'data']) used.add('manage.' + id + m[1]);
  }
}

for (const key of used) {
  if (!seeded.has(key)) missing.push(key);
}

console.log('seeded keys:', seeded.size);
console.log('used keys:', used.size);
if (missing.length === 0) {
  console.log('OK: every label key used in the UI exists in labelSeeds.ts');
} else {
  console.log('MISSING (' + missing.length + '):');
  for (const key of missing) console.log('  ' + key);
  process.exitCode = 1;
}
