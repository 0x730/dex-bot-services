# PancakeSwap V4 Service

This service is a local PancakeSwap Infinity V4 execution relay. It does not
build Pancake Infinity routes internally.

The service accepts pre-built Universal Router calldata from an upstream
Pancake-compatible router or quote builder, estimates gas, and optionally
broadcasts the transaction with the configured wallet.

## Runtime Contract

- Default URL: `http://127.0.0.1:3005`.
- Environment file: `ENV_PATH` when set, otherwise `.env.dexy.dev`.
- The service binds to `HOST` when set, otherwise `127.0.0.1`.
- Supported chains are the chains configured with `PANCAKE_V4_RPC_URL_<CHAIN>`,
  `PANCAKE_V4_ROUTER_ADDRESS_<CHAIN>`, and
  `PANCAKE_V4_PRIVATE_KEY_<LABEL>_<CHAIN>`.
- Execute, buy, sell, swap, and estimate endpoints require `calldata`.
- `valueWei` or `valueEth` is optional and is used for native-token input.
- Simplified route fields such as `tokenAddress`, `amountInBnb`,
  `amountInTokens`, `fee`, `path`, and `slippagePercent` are not route-building
  inputs for V4.

Missing or invalid calldata returns HTTP 400:

```json
{
  "error": "Missing or invalid Pancake V4 calldata. Internal route building is disabled. Provide pre-built Universal Router calldata and valueWei/valueEth."
}
```

## Environment

```env
HOST=127.0.0.1
PANCAKE_V4_PORT=3005

PANCAKE_V4_RPC_URL_BSC=https://your-bsc-rpc.example
PANCAKE_V4_PRIVATE_KEY_MAIN_BSC=your_private_key
PANCAKE_V4_ROUTER_ADDRESS_BSC=0xYourPancakeInfinityUniversalRouter

PANCAKE_V4_RPC_URL_BASE=https://your-base-rpc.example
PANCAKE_V4_PRIVATE_KEY_MAIN_BASE=your_private_key
PANCAKE_V4_ROUTER_ADDRESS_BASE=0xYourPancakeInfinityUniversalRouter

GAS_BUFFER_PERCENT=10
```

Do not commit real `.env` files. Use `.env.example` for public placeholders.

## Endpoints

### Approve Token

```http
POST /pancake-v4-approve
```

Approves an ERC20 token for a spender. By default, the spender is Permit2:
`0x000000000022D473030F116dDEE9F6B43aC78BA3`.

```json
{
  "chain": "BSC",
  "walletLabel": "MAIN",
  "tokenAddress": "0xYourTokenAddress",
  "amount": "1000",
  "spenderAddress": "0x000000000022D473030F116dDEE9F6B43aC78BA3"
}
```

`amount` is parsed using the token's on-chain decimals.

### Execute Pre-Built Calldata

```http
POST /pancake-v4-execute
```

Broadcasts pre-built Universal Router calldata.

```json
{
  "chain": "BSC",
  "walletLabel": "MAIN",
  "calldata": "0x...",
  "valueWei": "0"
}
```

`valueEth` can be used instead of `valueWei`.

Successful response:

```json
{
  "message": "Pancake V4 execute successful",
  "txHash": "0xYourTransactionHash"
}
```

### Buy, Sell, And Swap Aliases

These endpoints use the same pre-built calldata contract as
`/pancake-v4-execute`:

- `POST /pancake-v4-buy`
- `POST /pancake-v4-sell`
- `POST /pancake-v4-swap`

Example native-token buy relay:

```bash
curl -X POST http://127.0.0.1:3005/pancake-v4-buy \
  -H "Content-Type: application/json" \
  -d '{
    "chain": "BSC",
    "walletLabel": "MAIN",
    "calldata": "0x...",
    "valueEth": "0.1"
  }'
```

Example ERC20 sell relay:

```bash
curl -X POST http://127.0.0.1:3005/pancake-v4-sell \
  -H "Content-Type: application/json" \
  -d '{
    "chain": "BSC",
    "walletLabel": "MAIN",
    "calldata": "0x...",
    "valueWei": "0"
  }'
```

### Estimate Cost

These endpoints estimate the same pre-built calldata without broadcasting:

- `POST /pancake-v4-estimate-buy-cost`
- `POST /pancake-v4-estimate-sell-cost`
- `POST /pancake-v4-estimate-swap-cost`

Example:

```bash
curl -X POST http://127.0.0.1:3005/pancake-v4-estimate-buy-cost \
  -H "Content-Type: application/json" \
  -d '{
    "chain": "BSC",
    "walletLabel": "MAIN",
    "calldata": "0x...",
    "valueEth": "0.1"
  }'
```

Successful response:

```json
{
  "message": "Pancake V4 Buy estimate",
  "gasEstimate": "123456",
  "gasLimitWithBuffer": "135801",
  "gasPriceWei": "1000000000",
  "totalCostEth": "0.000123456"
}
```

## Approval Guidance

For ERC20 input routes, the upstream router or quote builder determines the
required spender flow. Most Universal Router flows use Permit2, but the exact
approval and permit requirements belong to the route contract generated
upstream.

This service only performs a simple ERC20 `approve(spender, amount)` transaction.
It does not create Permit2 signatures or derive allowance requirements from a
Pancake route.

## Troubleshooting

- `Missing Pancake V4 tx config for chain`: set the RPC URL, router address, and
  private key for the requested chain and wallet label.
- `internal route building is disabled`: generate Universal Router calldata
  upstream and send it as `calldata`.
- `invalid calldata`: ensure `calldata` is a hex string beginning with `0x`.
- Reverted estimates usually mean the pre-built calldata is invalid for the
  router, chain, value, approval state, pool state, or deadline.

## Future Route Builder Work

Before this repo can build Pancake Infinity routes internally, the route-builder
contract must be specified and tested. The current route-builder gate is tested
by `npm run test:pancake-v4-route-builder` and intentionally reports not ready.
The implementation must define:

- The authoritative Pancake Infinity router or quote source.
- The exact Universal Router command and action encoding.
- Pool-key requirements, including pool manager, hooks, fee, and parameters.
- Base-unit amount input and minimum-output behavior.
- Native wrapping, token settlement, Permit2, slippage, and deadline behavior.
- Contract tests or conformance examples proving the generated calldata decodes
  and estimates successfully on the target chain.

Until that exists, the safe behavior is to reject simplified V4 route requests
instead of generating unverified calldata.
