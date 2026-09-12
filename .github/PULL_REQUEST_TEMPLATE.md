## Description

Please provide a summary of the change, motivation, and context.

Fixes #(issue)

## Type of change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Architectural refactor / optimization
- [ ] Documentation update

## Invariants and quality checklist

Before opening this pull request, please verify that your changes uphold the project invariants:

- [ ] **Hash authority**: Mod categorization and character identification are strictly grounded in 3DMigoto buffer hashes (`ib`, `vb`, `texture`). No folder name string matching or guessing was added.
- [ ] **Panic safety**: No bare `.unwrap()` or `.expect()` calls were added in production backend modules. Errors are handled with `AppError` and propagated cleanly.
- [ ] **Modal portals**: Any new modal or dialog uses `<Modal>` / `<ModalPortal>` portaled to `document.body`.
- [ ] **Internationalization**: Any new user-facing strings are defined in `src/locales/en.json`.
- [ ] **Clippy**: `cargo clippy --all-targets -- -D warnings` exits with 0 warnings.
- [ ] **Tests**: All backend (`cargo test`) and frontend (`npm run check`) test suites pass.
- [ ] **Documentation**: Updated `CODEMAP.md` or `DEVELOPMENT.md` if modules, dependencies, or architectures were changed.
