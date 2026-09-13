# Evals Guidelines

## Scope
- Applies to `evals/`.
- Inherits root `AGENTS.md`.

## Dataset Handling
- Treat committed evaluation datasets as generated artifacts; do not hand-edit them.
- Regenerate datasets via scripts and commit generated output plus generation command notes.
- Keep reference data and run outputs clearly separated.

## Reproducibility
- When adding a new evaluation dataset, include source script and expected input format in nearby docs or script comments.
- Preserve stable file naming so comparison tooling remains reliable.
