/**
 * Guardrail Script: check-modals.cjs
 * 
 * Enforces that all modal dialogs and overlays in src/ use createPortal or
 * the standard <Modal> / <ModalPortal> primitive to prevent them from being
 * clipped by parent containers with CSS transform/filter/overflow rules.
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.resolve(__dirname, '../src');

// Root-level views or full-screen viewports exempt from portal requirement
const EXEMPT_FILES = new Set([
  'App.tsx',
  'TutorialOverlay.tsx',
  'ConfettiManager.tsx',
  'LanguageSelectView.tsx',
  'SetupView.tsx',
  path.join('components', 'ui', 'Modal.tsx'),
]);

let errors = [];

function checkFile(filePath) {
  const relativePath = path.relative(SRC_DIR, filePath).replace(/\\/g, '/');

  for (const exempt of EXEMPT_FILES) {
    if (relativePath === exempt || relativePath.endsWith('/' + exempt)) {
      return;
    }
  }

  const content = fs.readFileSync(filePath, 'utf8');

  // Check if file contains a full-screen overlay/modal class pattern
  const hasFixedOverlay = /className=(?:["'`].*?\bfixed\s+inset-0\b.*?["'`]|{.*?["'`].*?\bfixed\s+inset-0\b.*?["'`].*?})/s.test(content);

  if (!hasFixedOverlay) return;

  // Check if it uses createPortal or the <Modal> / <ModalPortal> primitive
  const usesPortal = content.includes('createPortal(') || 
                     content.includes('<Modal') || 
                     content.includes('<ModalPortal');

  if (!usesPortal) {
    errors.push({
      file: relativePath,
      message: 'Renders a fixed inset-0 overlay without using createPortal(..., document.body) or <Modal>. This causes visual clipping when rendered inside animated/transformed parent cards.'
    });
  }
}

function traverseDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      traverseDirectory(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.jsx'))) {
      checkFile(fullPath);
    }
  }
}

console.log('[check-modals] Scanning for unportaled modal dialogs in src/...');
traverseDirectory(SRC_DIR);

if (errors.length > 0) {
  console.error('\n[check-modals] ❌ Found modal dialogs missing createPortal:');
  for (const err of errors) {
    console.error(`  - ${err.file}: ${err.message}`);
  }
  console.error('\n👉 Solution: Wrap the dialog in `createPortal(..., document.body)` or use `<Modal>` from `src/components/ui/Modal.tsx`.\n');
  process.exit(1);
} else {
  console.log('[check-modals] ✓ All modal dialogs are properly portaled to document.body.');
  process.exit(0);
}
