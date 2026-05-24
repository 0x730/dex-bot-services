# DEX Bot Services

Local Express services for Uniswap and PancakeSwap execution and gas-estimation
workflows.

## Safety Defaults

- Services bind to `127.0.0.1` unless `HOST` is explicitly set.
- `BOT_API_TOKEN` is optional and can protect POST endpoints on internal-network deployments.
- `BOT_NONCE_LOCK_MODE=process` preserves current nonce behavior; use `file` only when several live processes intentionally share one wallet.
- Real `.env` files are ignored and must not be committed.
- Use `.env.example` as the public configuration template.
- Pancake V4 is pre-built-calldata-only until a verified Pancake Infinity route
  builder is specified and tested.

## Project Workspace

- Specs: [0x730/spec](0x730/spec)
- PM state and runbooks: [0x730/PM](0x730/PM)
- Protocol docs: [0x730/spec/technical/exchanges](0x730/spec/technical/exchanges)

## Checks

```bash
npm test
npm run check:public
```

## Public Release

This source can remain private while publishing a clean public GitHub snapshot.
See [0x730/PM/runbooks/public-github-release.md](0x730/PM/runbooks/public-github-release.md).
