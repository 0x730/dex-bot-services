# 0x730 Workspace Rules

The `0x730/` directory is the load-bearing planning and specification workspace for this repository.

## Layout

- `spec/` contains product, repository, protocol, and technical contracts.
- `PM/` contains kanban state, task cards, notes, runbooks, and durable decisions.
- `PM/tasks/` tracks scoped work with acceptance criteria.
- `PM/decisions/` records accepted choices that should survive a task.
- `PM/runbooks/` contains operational procedures.
- `PM/notes/` is for discovery notes and migrated legacy scratch material.

## Boundary

Runtime application code stays outside `0x730/`, under `src/`, `scripts/`, `test/`, and root configuration files.

Behavior changes must update the closest `0x730/spec/` contract and add or update a no-network test or conformance check when practical. Operational/process-only changes should update the closest `0x730/PM/` task or runbook.

This repo is live infrastructure. Do not start, stop, or restart PM2 services unless the user explicitly approves it. Do not run real swap, approve, or order calls as part of tests.
