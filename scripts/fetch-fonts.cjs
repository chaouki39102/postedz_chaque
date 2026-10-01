const fs = require('fs');
const path = require('path');

const dir = path.join('public', 'fonts');
fs.mkdirSync(dir, { recursive: true });

const files = [
  [
    'cairo-400-arabic.woff2',
    'https://fonts.gstatic.com/s/cairo/v31/SLXgc1nY6HkvangtZmpQdkhzfH5lkSs2SgRjCAGMQ1z0hOA-a1biLD-H.woff2',
    'U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0897-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC',
  ],
  [
    'cairo-400-latin.woff2',
    'https://fonts.gstatic.com/s/cairo/v31/SLXgc1nY6HkvangtZmpQdkhzfH5lkSs2SgRjCAGMQ1z0hOA-a1PiLA.woff2',
    'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
  ],
];

const face = (name, range) =>
  [
    '@font-face {',
    "  font-family: 'Cairo';",
    '  font-style: normal;',
    '  font-weight: 400;',
    '  font-display: swap;',
    "  src: url('./" + name + "') format('woff2');",
    '  unicode-range: ' + range + ';',
    '}',
  ].join('\n');

(async () => {
  for (const [name, url] of files) {
    const res = await fetch(url);
    if (!res.ok) {
      console.error('fail', name, res.status);
      process.exit(1);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(path.join(dir, name), buf);
    console.log(name, buf.length, 'bytes');
  }

  const css = files.map(([name, , range]) => face(name, range)).join('\n\n') + '\n';
  fs.writeFileSync(path.join(dir, 'cairo.css'), css);
  console.log('cairo.css written');
})();
