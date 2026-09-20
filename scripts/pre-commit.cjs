const { execSync } = require('child_process');
const fs = require('fs');

try {
  // 1. Get staged files with ACMR filter (Added, Copied, Modified, Renamed)
  const stagedOutput = execSync('git diff --cached --name-only --diff-filter=ACMR', {
    encoding: 'utf-8',
  });
  const staged = stagedOutput
    .split(/\r?\n/)
    .map((f) => f.trim())
    .filter(Boolean);

  if (staged.length === 0) {
    process.exit(0);
  }

  // 2. Run lint-staged (formats only staged files via prettier)
  execSync('npx lint-staged --max-arg-length 4000', { stdio: 'inherit' });

  // 3. Fast syntax & modal checks if TypeScript / TSX files are staged
  const hasTs = staged.some((f) => /\.(ts|tsx)$/.test(f));
  if (hasTs) {
    execSync('npm run typecheck', { stdio: 'inherit' });
    execSync('node scripts/check-modals.cjs', { stdio: 'inherit' });
  }

  // 4. Documentation drift check if docs, the IPC surface, or skills are staged
  const touchesDocs = staged.some(
    (f) =>
      f.endsWith('.md') ||
      f === 'src-tauri/src/lib.rs' ||
      f.startsWith('.agents/skills/') ||
      f.startsWith('src-tauri/src/services/') ||
      f.startsWith('src-tauri/src/infra/') ||
      f.startsWith('src/store/slices/')
  );
  // check-docs.cjs is internal-only and is not mirrored to the public repo.
  if (touchesDocs && fs.existsSync('scripts/check-docs.cjs')) {
    execSync('node scripts/check-docs.cjs', { stdio: 'inherit' });
  }

  // 5. Fast i18n key parity check if locale files or UI components are staged
  const hasI18n = staged.some(
    (f) =>
      f.includes('locales/') ||
      f.includes('en.json') ||
      (f.startsWith('src/') && /\.(ts|tsx)$/.test(f))
  );
  if (hasI18n) {
    execSync('node scripts/check-i18n.cjs', { stdio: 'inherit' });
  }
} catch (err) {
  process.exit(1);
}
