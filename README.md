# DEX Bot Services

Local Express services for Uniswap and PancakeSwap execution and gas-estimation
workflows.

## Safety Defaults

- Services bind to `127.0.0.1` unless `HOST` is explicitly set.
- Real `.env` files are ignored and must not be committed.
- Use `.env.example` as the public configuration template.
- Pancake V4 is pre-built-calldata-only until a verified Pancake Infinity route
  builder is specified and tested.

## Checks

```bash
npm test
npm run check:public
```

## Public Release

This source can remain private while publishing a clean public GitHub snapshot.
See [PUBLIC_RELEASE.md](PUBLIC_RELEASE.md).
