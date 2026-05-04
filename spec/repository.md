# Repository Specification

## Purpose

This repository contains Node.js services for swap, approval, and gas-estimation workflows across Uniswap and PancakeSwap variants.

## Current Contract

- Runtime services live in `src/`.
- Public documentation lives in the top-level protocol markdown files.
- Environment-specific configuration is supplied through local `.env*` files and must not be committed.
- Public examples must use placeholders only.
- Runtime HTTP services bind to localhost by default and are not intended for direct external exposure.
- Uni V4 internally-built swaps wrap V4 planner actions in Universal Router `execute(bytes,bytes[],uint256)` calldata with a single `V4_SWAP` command.
- V4 services load environment configuration from `ENV_PATH` and default to `.env.dexy.dev` for local development parity.
- Pancake V4 is pre-built calldata only until a Pancake Infinity Universal Router builder is specified and tested.

## Development Contract

- Behavior changes require aligned implementation, spec/docs updates, and a test or conformance check.
- Refactors must preserve stable external HTTP endpoint behavior unless the task explicitly changes it.
- Publication readiness requires `npm run check:public` to pass.
