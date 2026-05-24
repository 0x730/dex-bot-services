# Agent Contract

This repository is maintained spec-first. Before meaningful implementation, read the closest files in `0x730/spec/`, `0x730/spec/technical/`, `0x730/PM/kanban.md`, and `0x730/PM/tasks/` when a task card exists.

## Working Rules

- Treat committed code, specs, contracts, examples, and generated artifacts as the current source of truth.
- If code, specs, contracts, examples, or generated artifacts disagree, treat that as a defect and do not silently pick one.
- For behavior changes, update the closest spec/contract/example and add or update a failing test or conformance check before or together with implementation.
- Keep bug fixes safe and non-breaking unless the task explicitly changes the contract.
- Prefer `0x730/spec/` acceptance criteria -> `test/contract` -> `implementation` -> `verification`.
- Do not let agents re-derive platform contracts from scratch when the repo can carry them explicitly.
- Put product and technical specs in `0x730/spec/`.
- Put planning, task state, notes, and durable decisions in `0x730/PM/`.
- Use `0x730/PM/notes/` for temporary discovery and `0x730/PM/decisions/` for accepted decisions that should outlive a task.

## Dexy Integration

This repository is the localhost DEX bot executor used by the sibling Dexy app at `/home/projects/ludo/bots-trading-system`.

When work touches endpoint contracts, Pancake/Uniswap execution, calldata, wallet-signing behavior, or deployment:

- inspect both repositories before changing behavior;
- keep commits separate per repository;
- update executor contracts under this repo's `0x730/spec/` or `0x730/PM/decisions/`;
- update Dexy contracts under `/home/projects/ludo/bots-trading-system/0x730/spec/technical/` when caller behavior or cross-repo assumptions change;
- verify this repo with `npm test` and `npm run check:public`;
- verify Dexy with focused `npm test` coverage for the caller path.

Current Dexy-side cross-repo contract: `/home/projects/ludo/bots-trading-system/0x730/spec/technical/order-executor-contract.md`. Pancake V4 remains pre-built-calldata-only until a route builder is specified and tested.

## Public Repository Scope

- Do not commit private keys, RPC tokens, wallet addresses tied to private operations, `.env*` files, IDE state, or local deployment artifacts.
- Use `.env.example` for public configuration documentation.
- Run `npm run check:public` before publishing.
- Rotate any secret that has ever been committed or printed in logs before making the repository public.
