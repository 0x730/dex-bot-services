# Live Runtime Hardening Spec

## Goal

Improve reliability and release readiness for the live bot executor services without changing current internal-network behavior or triggering live process restarts.

## Current Contract

- Services bind to `127.0.0.1` by default and may be bound to an internal-network interface with `HOST`.
- `BOT_API_TOKEN` is optional. When unset, POST endpoints keep their existing behavior.
- When `BOT_API_TOKEN` is set, write/transaction endpoints require either `X-Bot-Api-Token: <token>` or `Authorization: Bearer <token>`.
- `GET /health` and `GET /ready` do not execute RPC calls, load wallets, sign transactions, or touch chain state.
- Readiness reports missing environment variable names only; it must not expose secret values.
- PM2 configuration may include additional service entries, but agents must not start, stop, or restart PM2 without explicit user approval.
- Pancake V4 remains pre-built-calldata-only.
- Runtime services use a shared logger that redacts obvious private-key, token, signature, calldata, and long hex payload fields before printing.
- `BOT_LOG_FORMAT=json` switches the shared logger to one JSON object per line on stdout/stderr for external collectors. The default remains console-style text.
- Nonce allocation is per EVM `chainId:senderAddress`. The default `BOT_NONCE_LOCK_MODE=process` preserves in-process behavior. The optional `file` mode coordinates the same wallet across multiple Node.js processes on the same chain.

## Acceptance Criteria

- Every runtime service exposes `GET /health` and `GET /ready`.
- Every runtime service installs optional bot-token middleware without requiring a token by default.
- PM2 config includes `uni-v4` and `pancake-v4` entries with the ethers compatibility preload required by those services.
- `restart` and `stop` scripts include `pancake-v4`.
- Runtime source files do not call `console.*` directly outside the shared logger.
- Optional file nonce locking is keyed by `chainId:senderAddress` and is disabled by default.
- Optional JSON log output redacts the same fields as text output and requires no external sink.
- No-network tests cover route registration, health/readiness, optional token behavior, and Pancake V4 missing-calldata rejection.
- `npm test` and `npm run check:public` pass.

## Deferred Hardening

- Add a vendor or network log sink only if stdout/stderr collection is not enough operationally.
