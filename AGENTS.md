# Agent Contract

This repository is maintained spec-first. Before meaningful implementation, read the closest files in `spec/`, `spec/technical/`, `PM/kanban.md`, and `PM/tasks/` when a task card exists.

## Working Rules

- Treat committed code, specs, contracts, examples, and generated artifacts as the current source of truth.
- If code, specs, contracts, examples, or generated artifacts disagree, treat that as a defect and do not silently pick one.
- For behavior changes, update the closest spec/contract/example and add or update a failing test or conformance check before or together with implementation.
- Keep bug fixes safe and non-breaking unless the task explicitly changes the contract.
- Prefer `spec/acceptance criteria -> test/contract -> implementation -> verification`.
- Do not let agents re-derive platform contracts from scratch when the repo can carry them explicitly.
- Put product and technical specs in `spec/`.
- Put planning, task state, notes, and durable decisions in `PM/`.
- Use `PM/notes/` for temporary discovery and `PM/decisions/` for accepted decisions that should outlive a task.

## Public Repository Scope

- Do not commit private keys, RPC tokens, wallet addresses tied to private operations, `.env*` files, IDE state, or local deployment artifacts.
- Use `.env.example` for public configuration documentation.
- Run `npm run check:public` before publishing.
- Rotate any secret that has ever been committed or printed in logs before making the repository public.
