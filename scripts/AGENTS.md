# Scripts Guidelines

## Scope
- Applies to `scripts/`.
- Inherits root `AGENTS.md`.

## Purpose
- Use this folder for smoke probes, integration checks, and evaluation runners.
- Keep scripts runnable through `yarn example scripts/<script>.ts` (or equivalent `yarn example` paths).
- Put reusable product behavior in `src/`, not in ad-hoc script logic.

## Safety and Reproducibility
- Do not commit secrets, private endpoints, or personal credentials in scripts.
- Prefer deterministic parameters (seed, target URL, output naming) for reproducible results.
- Document non-obvious prerequisites at the top of the script or in repo docs.
