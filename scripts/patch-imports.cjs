const fs = require('fs');

const edits = [
  [
    'src/App.tsx',
    "import { useEngineKind } from './context/EngineContext';",
    "import { useEngineKind } from './context/engineCore';",
  ],
  [
    'src/App.tsx',
    "import { useLabels } from './context/LabelsContext';",
    "import { useLabels } from './context/labelsCore';",
  ],
  [
    'src/components/CheckForm.tsx',
    "import { useLabelProxy, useLabels } from '../context/LabelsContext';",
    "import { useLabelProxy, useLabels } from '../context/labelsCore';",
  ],
  [
    'src/components/CheckPreview.tsx',
    "import { useLabelProxy } from '../context/LabelsContext';",
    "import { useLabelProxy } from '../context/labelsCore';",
  ],
  [
    'src/context/BootGate.tsx',
    "import { EngineProvider } from './EngineContext';",
    "import { EngineProvider } from './EngineContext';",
  ],
];

for (const [file, from, to] of edits) {
  let text = fs.readFileSync(file, 'utf8');
  if (!text.includes(from)) {
    console.error('MISS', file, from);
    process.exit(1);
  }
  fs.writeFileSync(file, text.replace(from, to));
  console.log('patched', file);
}
