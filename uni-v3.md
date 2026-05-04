# 🌐 **Uniswap V3 Multi-Chain DEX Bot Documentation**

This documentation provides `curl` examples and detailed explanations for all endpoints defined in the multi-chain **Uniswap V3** bot. Adjust `localhost:3001` and the parameters as needed based on your deployment setup.

---

## 📢 **Important Notes**

- **Chain Parameter:** Each request requires a `"chain"` parameter (e.g., `"ethereum"`, `"polygon"`, or `"base"`) to select the desired blockchain network's configuration.

- **Environment Setup:** Ensure that your `.env` file and chain configurations are correctly set up. The tokens involved in the swaps must exist on the chosen chain.

- **Approval Requirement:** Before performing any token swaps or sells, ensure that the router has sufficient allowance to spend the tokens. Use the respective `/approve` endpoints as needed.

---

## 📝 **Table of Contents**

1. [Prerequisites](#1-prerequisites)
2. [Endpoints](#2-endpoints)
   - [1. Approve Tokens (`/approve`)](#1-approve-tokens-approve)
   - [2. Buy Token (`/uni-v3-buy`)](#2-buy-token-uni-v3-buy)
   - [3. Sell Token (`/uni-v3-sell`)](#3-sell-token-uni-v3-sell)
   - [4. Swap Tokens (`/uni-v3-swap`)](#4-swap-tokens-uni-v3-swap)
   - [5. Estimate Buy Transaction Cost (`/uni-v3-estimate-buy-cost`)](#5-estimate-buy-transaction-cost-uni-v3-estimate-buy-cost)
   - [6. Estimate Sell Transaction Cost (`/uni-v3-estimate-sell-cost`)](#6-estimate-sell-transaction-cost-uni-v3-estimate-sell-cost)
   - [7. Estimate Swap Cost (`/uni-v3-estimate-swap-cost`)](#7-estimate-swap-cost-uni-v3-estimate-swap-cost)
3. [Additional Tips](#3-additional-tips)
4. [Security Best Practices](#4-security-best-practices)
5. [Troubleshooting](#5-troubleshooting)
6. [Support](#6-support)

---

## 🛠️ **1. Prerequisites**

Before interacting with the Uniswap V3 endpoints, ensure the following:

1. **cURL Installed:**
   Ensure that you have `cURL` installed on your system. Verify by running:

   ```bash
   curl --version
   ```

   If not installed, download it from [cURL's official website](https://curl.se/download.html) or install via your package manager.

2. **Service Running:**
   Make sure your Uniswap V3 service (`index.js`) is running and accessible at the specified port (e.g., `http://localhost:3001`).

3. **Valid Environment Configuration:**
   Ensure your `.env` file is correctly configured with all necessary variables for the supported chains (e.g., `ethereum`, `polygon`, `base`). Example:

   ```env
   # Uniswap V3 Configurations
   UNI_V3_RPC_URL_ETHEREUM=your_ethereum_rpc_url
   UNI_V3_PRIVATE_KEY_ETHEREUM=your_ethereum_private_key
   UNI_V3_WETH_ADDRESS_ETHEREUM=0xWETHAddress
   UNI_V3_ROUTER_ADDRESS_ETHEREUM=0xUniswapRouterAddress
   UNI_V3_QUOTER_ADDRESS_ETHEREUM=0xQuoterAddress
   UNI_V3_WRAPPED_ADDRESS_ETHEREUM=0xWrappedETHAddress
   UNI_V3_PORT=3001

   UNI_V3_RPC_URL_POLYGON=your_polygon_rpc_url
   UNI_V3_PRIVATE_KEY_POLYGON=your_polygon_private_key
   UNI_V3_WETH_ADDRESS_POLYGON=0xWMATICAddress
   UNI_V3_ROUTER_ADDRESS_POLYGON=0xUniswapRouterAddress
   UNI_V3_QUOTER_ADDRESS_POLYGON=0xQuoterAddressPolygon
   UNI_V3_WRAPPED_ADDRESS_POLYGON=0xWrappedMATICAddress
   UNI_V3_RPC_URL_BASE=your_base_rpc_url
   UNI_V3_PRIVATE_KEY_BASE=your_base_private_key
   UNI_V3_WETH_ADDRESS_BASE=0xWETHAddressBase
   UNI_V3_ROUTER_ADDRESS_BASE=0xUniswapRouterAddressBase
   UNI_V3_QUOTER_ADDRESS_BASE=0xQuoterAddressBase
   UNI_V3_WRAPPED_ADDRESS_BASE=0xWrappedBaseAddress
   # Add more Uniswap configurations as needed

   GAS_BUFFER_PERCENT=100
   MAX_GAS_ETHEREUM=200000
   UNI_V3_FEE_TIER_DEFAULT=3000
   ```

---

## 🚀 **2. Endpoints**

### 2.1 **Approve Tokens (`/approve`)**

**Endpoint:**

```
POST /approve
```

**Description:**
Approves the Uniswap V3 router to spend a specified amount of a token on behalf of your wallet. This is a prerequisite for performing buy, sell, or swap operations.

**Request Payload:**

```json
{
  "chain": "polygon",
  "tokenAddress": "0xYourTokenAddress",
  "amount": "1000"
}
```

**Parameters:**

- **`chain`** (string, required): The blockchain network you want to interact with (e.g., `"ethereum"`, `"polygon"`, `"base"`).
- **`tokenAddress`** (string, required): The contract address of the ERC20 token you want to approve.
- **`amount`** (string or number, required): The amount of tokens to approve (in token units, considering decimals).

**🔹 Example cURL Commands:**

- **Approve Token on Ethereum:**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{
          "chain": "ethereum",
          "tokenAddress": "0xYourTokenAddress",
          "amount": "1000"
        }' \
    http://localhost:3001/approve
  ```

- **Approve Token on Polygon:**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{
          "chain": "polygon",
          "tokenAddress": "0xYourTokenAddress",
          "amount": "500"
        }' \
    http://localhost:3001/approve
  ```

- **Approve Token on Base:**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{
          "chain": "base",
          "tokenAddress": "0xYourTokenAddressBase",
          "amount": "300"
        }' \
    http://localhost:3001/approve
  ```

**Expected Response:**

```json
{
  "message": "Approval successful for Uniswap V3 router."
}
```

**Notes:**

- Replace `"0xYourTokenAddress"` with the actual token contract address you intend to approve.
- Ensure that the `amount` reflects the number of tokens you wish to approve, considering the token's decimals.

---

### 2.2 **Buy Token (`/uni-v3-buy`)**

**Endpoint:**

```
POST /uni-v3-buy
```

**Description:**
Buys a specified token using Uniswap V3 by swapping ETH/WETH for the desired ERC20 token.

**Request Payload:**

```json
{
  "chain": "polygon",
  "tokenAddress": "0xYourTokenAddress",
  "amountInEth": "1",
  "slippagePercent": 3,
  "fee": 3000,
  "path": ["0xWrappedMATICAddress", "0xYourTokenAddress"]
}
```

**Parameters:**

- **`chain`** (string, required): The blockchain network (e.g., `"ethereum"`, `"polygon"`, `"base"`).
- **`tokenAddress`** (string, required): The contract address of the ERC20 token you want to buy.
- **`amountInEth`** (string or number, required): The amount of ETH/WETH you want to spend (in ETH units).
- **`slippagePercent`** (number, optional): Maximum acceptable slippage percentage (default is `3`).
- **`fee`** (number, optional): Fee tier for Uniswap V3 (default is `3000` for 0.3%).
- **`path`** (array of strings, optional): Array specifying the swap path. If omitted, defaults to `[WETH/WMATIC, token]`.

**🔹 Example cURL Commands:**

- **Buy Token with Default Path and Fee on Polygon:**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{
          "chain": "polygon",
          "tokenAddress": "0x311434160D7537be358930def317AfB606C0d737",
          "amountInEth": "1",
          "slippagePercent": 3,
          "fee": 3000
        }' \
    http://localhost:3001/uni-v3-buy
  ```

- **Buy Token with Custom Path and Fee on Ethereum:**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{
          "chain": "ethereum",
          "tokenAddress": "0xYourTokenAddress",
          "amountInEth": "0.5",
          "slippagePercent": 5,
          "fee": 10000,
          "path": [
            "0xC02aaA39b223FE8D0A0E5C4F27eAD9083C756Cc2",
            "0xIntermediateTokenAddress",
            "0xYourTokenAddress"
          ]
        }' \
    http://localhost:3001/uni-v3-buy
  ```

**Expected Response:**

```json
{
  "message": "Uniswap V3 Buy successful",
  "txHash": "0xYourTransactionHash",
  "totalCostEth": "0.5",
  "amountOutMin": "0.95",
  "amountOutEstimate": "1.0",
  "amount": "1.0"
}
```

**Notes:**

- **Path:**

  - When **buying ETH → Token**, the path typically starts with **WETH/WMATIC** and ends with the desired token.
  - For **ETH → Token** swaps on Ethereum, use the WETH address. On Polygon, use the WMATIC address.

- **Fee Tier:**

  - Uniswap V3 allows different fee tiers (e.g., `500`, `3000`, `10000` representing 0.05%, 0.3%, 1% respectively). Choose the fee tier based on the liquidity of the pool and desired price impact.

- **Slippage:**

  - A slippage of `3%` is standard, but adjust based on market conditions. Higher slippage increases the chance of transaction success but may result in less favorable rates.

- **Gas Limit:**
  - The service sets a default gas limit (e.g., `500,000`). Depending on the token and network conditions, you might need to adjust this value.

---

### 2.3 **Sell Token (`/uni-v3-sell`)**

**Endpoint:**

```
POST /uni-v3-sell
```

**Description:**
Sells a specified token using Uniswap V3 by swapping the ERC20 token back to ETH/WETH.

**Request Payload:**

```json
{
  "chain": "polygon",
  "tokenAddress": "0xYourTokenAddress",
  "amountInTokens": "100",
  "slippagePercent": 3,
  "fee": 3000,
  "path": ["0xYourTokenAddress", "0xWrappedMATICAddress"]
}
```

**Parameters:**

- **`chain`** (string, required): The blockchain network (e.g., `"ethereum"`, `"polygon"`, `"base"`).
- **`tokenAddress`** (string, required): The contract address of the ERC20 token you want to sell.
- **`amountInTokens`** (string or number, required): The amount of tokens you want to sell (in token units).
- **`slippagePercent`** (number, optional): Maximum acceptable slippage percentage (default is `3`).
- **`fee`** (number, optional): Fee tier for Uniswap V3 (default is `3000` for 0.3%).
- **`path`** (array of strings, optional): Array specifying the swap path. If omitted, defaults to `[token, WETH/WMATIC]`.

**🔹 Example cURL Commands:**

- **Sell Token with Default Path and Fee on Polygon:**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{
          "chain": "polygon",
          "tokenAddress": "0x311434160D7537be358930def317AfB606C0d737",
          "amountInTokens": "100",
          "slippagePercent": 3,
          "fee": 3000
        }' \
    http://localhost:3001/uni-v3-sell
  ```

- **Sell Token with Custom Path and Fee on Ethereum:**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{
          "chain": "ethereum",
          "tokenAddress": "0xYourTokenAddress",
          "amountInTokens": "50",
          "slippagePercent": 5,
          "fee": 10000,
          "path": [
            "0xYourTokenAddress",
            "0xIntermediateTokenAddress",
            "0xC02aaA39b223FE8D0A0E5C4F27eAD9083C756Cc2"
          ]
        }' \
    http://localhost:3001/uni-v3-sell
  ```

**Expected Response:**

```json
{
  "message": "Uniswap V3 Sell successful",
  "txHash": "0xYourTransactionHash",
  "totalCostEth": "0.5",
  "amountOutMin": "0.95",
  "amountOutEstimate": "1.0",
  "amount": "1.0"
}
```

**Notes:**

- **Path:**

  - When **selling Token → ETH**, the path typically starts with the token and ends with **WETH/WMATIC**.
  - For **Token → Token** swaps, ensure the path starts with the input token and ends with the output token, including any intermediary tokens if necessary.

- **Fee Tier:**

  - Choose the fee tier based on the liquidity of the pool and desired price impact.

- **Slippage:**

  - A slippage of `3%` is standard, but adjust based on market conditions.

- **Gas Limit:**
  - The service sets a default gas limit (e.g., `500,000`). Adjust as necessary based on the specific swap.

---

### 2.4 **Swap Tokens (`/uni-v3-swap`)**

**Endpoint:**

```
POST /uni-v3-swap
```

**Description:**
Performs a token-to-token swap on Uniswap V3, exchanging a specified amount of input tokens for output tokens, considering slippage and fee tiers.

**Request Payload:**

```json
{
  "chain": "polygon",
  "tokenIn": "0xYourInputTokenOnPolygon",
  "tokenOut": "0xYourOutputTokenOnPolygon",
  "amountInTokens": "200",
  "slippagePercent": 3,
  "fee": 3000,
  "path": [
    "0xYourInputTokenOnPolygon",
    "0xIntermediateTokenOnPolygon",
    "0xYourOutputTokenOnPolygon"
  ]
}
```

**Parameters:**

- **`chain`** (string, required): The blockchain network (e.g., `"ethereum"`, `"polygon"`, `"base"`).
- **`tokenIn`** (string, required): The address of the input ERC20 token.
- **`tokenOut`** (string, required): The address of the output ERC20 token.
- **`amountInTokens`** (string or number, required): The amount of input tokens to swap.
- **`slippagePercent`** (number, optional): Maximum acceptable slippage percentage (default is `3`).
- **`fee`** (number, optional): Fee tier for Uniswap V3 (default is `3000` for 0.3%).
- **`path`** (array of strings, optional): Array specifying the swap path. If omitted, defaults to `[tokenIn, tokenOut]`.

**🔹 Example cURL Commands:**

- **Token-to-Token Swap on Polygon with Default Path and Fee:**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{
          "chain": "polygon",
          "tokenIn": "0xYourInputTokenOnPolygon",
          "tokenOut": "0xYourOutputTokenOnPolygon",
          "amountInTokens": "200",
          "slippagePercent": 3,
          "fee": 3000
        }' \
    http://localhost:3001/uni-v3-swap
  ```

- **Token-to-Token Swap on Ethereum with Custom Path and Fee:**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{
          "chain": "ethereum",
          "tokenIn": "0xYourInputTokenOnEthereum",
          "tokenOut": "0xYourOutputTokenOnEthereum",
          "amountInTokens": "50",
          "slippagePercent": 5,
          "fee": 10000,
          "path": [
            "0xYourInputTokenOnEthereum",
            "0xIntermediateTokenAddress",
            "0xYourOutputTokenOnEthereum"
          ]
        }' \
    http://localhost:3001/uni-v3-swap
  ```

**Expected Response:**

```json
{
  "message": "Uniswap V3 Swap successful",
  "txHash": "0xYourTransactionHash",
  "amountOutMin": "0.95",
  "amountOutEstimate": "1.0",
  "amountReceived": "1.0"
}
```

**Notes:**

- **Path:**

  - Ensure the `path` array starts with `tokenIn` and ends with `tokenOut`, including any intermediary tokens if necessary.

- **Fee Tier:**

  - Select the appropriate fee tier based on pool liquidity and desired price impact.

- **Slippage:**

  - A slippage of `3%` is standard, but adjust based on market conditions.

- **Gas Limit:**

  - The service sets a default gas limit (e.g., `500,000`). Depending on the tokens and network conditions, you might need to adjust this value.

- **Transaction Hash:**
  - The `txHash` can be used to track the transaction on a blockchain explorer (e.g., [Etherscan](https://etherscan.io/) for Ethereum, [PolygonScan](https://polygonscan.com/) for Polygon).

---

### 2.5 **Estimate Buy Transaction Cost (`/uni-v3-estimate-buy-cost`)**

**Endpoint:**

```
POST /uni-v3-estimate-buy-cost
```

**Description:**
Estimates the gas cost and potential output for a Uniswap V3 buy operation without executing the transaction.

**Request Payload:**

```json
{
  "chain": "polygon",
  "tokenAddress": "0xYourTokenAddress",
  "amountInEth": "1",
  "slippagePercent": 3,
  "fee": 3000,
  "path": ["0xWrappedMATICAddress", "0xYourTokenAddress"]
}
```

**Parameters:**

- **`chain`** (string, required): The blockchain network (e.g., `"ethereum"`, `"polygon"`, `"base"`).
- **`tokenAddress`** (string, required): The contract address of the ERC20 token you want to buy.
- **`amountInEth`** (string or number, required): The amount of ETH/WETH you intend to spend (in ETH units).
- **`slippagePercent`** (number, optional): Maximum acceptable slippage percentage (default is `3`).
- **`fee`** (number, optional): Fee tier for Uniswap V3 (default is `3000` for 0.3%).
- **`path`** (array of strings, optional): Array specifying the swap path. If omitted, defaults to `[WETH/WMATIC, token]`.

**🔹 Example cURL Commands:**

- **Estimate ETH → Token Buy on Polygon:**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{
          "chain": "polygon",
          "tokenAddress": "0xBbba073C31bF03b8ACf7c28EF0738DeCF3695683",
          "amountInEth": "1",
          "slippagePercent": 3,
          "fee": 3000
        }' \
    http://localhost:3001/uni-v3-estimate-buy-cost
  ```

- **Estimate ETH → Token Buy on Ethereum with Custom Path:**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{
          "chain": "ethereum",
          "tokenAddress": "0xYourTokenAddress",
          "amountInEth": "0.5",
          "slippagePercent": 5,
          "fee": 10000,
          "path": [
            "0xC02aaA39b223FE8D0A0E5C4F27eAD9083C756Cc2",
            "0xIntermediateTokenAddress",
            "0xYourTokenAddress"
          ]
        }' \
    http://localhost:3001/uni-v3-estimate-buy-cost
  ```

**Expected Response:**

```json
{
  "message": "Estimated Uniswap V3 Buy cost",
  "estimate": {
    "gasEstimate": "500000",
    "gasPrice": "1000000000",
    "totalCostWei": "500000000000000000",
    "amountOutMin": "0.95",
    "amountOutEstimate": "1.0",
    "totalCostEth": "0.5"
  }
}
```

**Response Fields:**

- **`gasEstimate`**: Estimated gas units required for the transaction.
- **`gasPrice`**: Current gas price in wei.
- **`totalCostWei`**: Total gas cost in wei (`gasEstimate * gasPrice`).
- **`amountOutMin`**: Minimum tokens expected after slippage.
- **`amountOutEstimate`**: Estimated tokens to receive without considering slippage.
- **`totalCostEth`**: Total gas cost in ETH (converted from wei).

**Notes:**

- Replace `"0xBbba073C31bF03b8ACf7c28EF0738DeCF3695683"` with your target token's contract address.
- Ensure that the `path` array starts with WETH/WMATIC and ends with the target token.
- Adjust `slippagePercent` based on your tolerance for price movement.

---

### 2.6 **Estimate Sell Transaction Cost (`/uni-v3-estimate-sell-cost`)**

**Endpoint:**

```
POST /uni-v3-estimate-sell-cost
```

**Description:**
Estimates the gas cost and potential output for a Uniswap V3 sell operation without executing the transaction.

**Request Payload:**

```json
{
  "chain": "polygon",
  "tokenAddress": "0xYourTokenAddress",
  "amountInTokens": "100",
  "slippagePercent": 3,
  "fee": 3000,
  "path": ["0xYourTokenAddress", "0xWrappedMATICAddress"]
}
```

**Parameters:**

- **`chain`** (string, required): The blockchain network (e.g., `"ethereum"`, `"polygon"`, `"base"`).
- **`tokenAddress`** (string, required): The contract address of the ERC20 token you want to sell.
- **`amountInTokens`** (string or number, required): The amount of tokens you intend to sell (in token units).
- **`slippagePercent`** (number, optional): Maximum acceptable slippage percentage (default is `3`).
- **`fee`** (number, optional): Fee tier for Uniswap V3 (default is `3000` for 0.3%).
- **`path`** (array of strings, optional): Array specifying the swap path. If omitted, defaults to `[token, WETH/WMATIC]`.

**🔹 Example cURL Commands:**

- **Estimate Token → ETH Sell on Polygon:**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{
          "chain": "polygon",
          "tokenAddress": "0x311434160D7537be358930def317AfB606C0d737",
          "amountInTokens": "100",
          "slippagePercent": 3,
          "fee": 3000
        }' \
    http://localhost:3001/uni-v3-estimate-sell-cost
  ```

- **Estimate Token → Token Sell on Ethereum with Custom Path:**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{
          "chain": "ethereum",
          "tokenAddress": "0xYourTokenAddress",
          "amountInTokens": "50",
          "slippagePercent": 5,
          "fee": 10000,
          "path": [
            "0xYourTokenAddress",
            "0xIntermediateTokenAddress",
            "0xC02aaA39b223FE8D0A0E5C4F27eAD9083C756Cc2"
          ]
        }' \
    http://localhost:3001/uni-v3-estimate-sell-cost
  ```

**Expected Response:**

```json
{
  "message": "Estimated Uniswap V3 Sell cost",
  "estimate": {
    "gasEstimate": "500000",
    "gasPrice": "1000000000",
    "totalCostWei": "500000000000000000",
    "amountOutMin": "0.95",
    "amountOutEstimate": "1.0",
    "totalCostEth": "0.5"
  }
}
```

**Response Fields:**

- **`gasEstimate`**: Estimated gas units required for the transaction.
- **`gasPrice`**: Current gas price in wei.
- **`totalCostWei`**: Total gas cost in wei (`gasEstimate * gasPrice`).
- **`amountOutMin`**: Minimum ETH/WETH expected after slippage.
- **`amountOutEstimate`**: Estimated ETH/WETH to receive without considering slippage.
- **`totalCostEth`**: Total gas cost in ETH (converted from wei).

**Notes:**

- Replace `"0x311434160D7537be358930def317AfB606C0d737"` with the token you intend to sell.
- Ensure that the `path` array starts with your input token and ends with WETH/WMATIC.
- Adjust `slippagePercent` based on your tolerance for price movement.

---

### 2.7 **Estimate Swap Cost (`/uni-v3-estimate-swap-cost`)**

**Endpoint:**

```
POST /uni-v3-estimate-swap-cost
```

**Description:**
Estimates the gas cost and expected output for a token-to-token swap on Uniswap V3 without executing the transaction.

**Request Payload:**

```json
{
  "chain": "polygon",
  "tokenIn": "0xYourInputTokenOnPolygon",
  "tokenOut": "0xYourOutputTokenOnPolygon",
  "amountInTokens": "200",
  "slippagePercent": 3,
  "fee": 3000,
  "path": [
    "0xYourInputTokenOnPolygon",
    "0xIntermediateTokenOnPolygon",
    "0xYourOutputTokenOnPolygon"
  ]
}
```

**Parameters:**

- **`chain`** (string, required): The blockchain network (e.g., `"ethereum"`, `"polygon"`, `"base"`).
- **`tokenIn`** (string, required): The address of the input ERC20 token.
- **`tokenOut`** (string, required): The address of the output ERC20 token.
- **`amountInTokens`** (string or number, required): The amount of input tokens to swap.
- **`slippagePercent`** (number, optional): Maximum acceptable slippage percentage (default is `3`).
- **`fee`** (number, optional): Fee tier for Uniswap V3 (default is `3000` for 0.3%).
- **`path`** (array of strings, optional): Array specifying the swap path. If omitted, defaults to `[tokenIn, tokenOut]`.

**🔹 Example cURL Commands:**

- **Estimate Token-to-Token Swap on Polygon with Default Path and Fee:**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{
          "chain": "polygon",
          "tokenIn": "0xYourInputTokenOnPolygon",
          "tokenOut": "0xYourOutputTokenOnPolygon",
          "amountInTokens": "200",
          "slippagePercent": 3,
          "fee": 3000
        }' \
    http://localhost:3001/uni-v3-estimate-swap-cost
  ```

- **Estimate Token-to-Token Swap on Ethereum with Custom Path and Fee:**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{
          "chain": "ethereum",
          "tokenIn": "0xYourInputTokenOnEthereum",
          "tokenOut": "0xYourOutputTokenOnEthereum",
          "amountInTokens": "50",
          "slippagePercent": 5,
          "fee": 10000,
          "path": [
            "0xYourInputTokenOnEthereum",
            "0xIntermediateTokenAddress",
            "0xYourOutputTokenOnEthereum"
          ]
        }' \
    http://localhost:3001/uni-v3-estimate-swap-cost
  ```

**Expected Response:**

```json
{
  "message": "Estimated Uniswap V3 Swap outcome",
  "estimate": {
    "amountOutMin": "0.95",
    "amountOutEstimate": "1.0"
  }
}
```

**Response Fields:**

- **`amountOutMin`**: Minimum output tokens expected after slippage.
- **`amountOutEstimate`**: Estimated output tokens to receive without considering slippage.

**Notes:**

- **Path:**

  - Ensure the `path` array starts with `tokenIn` and ends with `tokenOut`, including any intermediary tokens if necessary.

- **Fee Tier:**

  - Select the appropriate fee tier based on pool liquidity and desired price impact.

- **Slippage:**

  - A slippage of `3%` is standard, but adjust based on your tolerance for price movement.

- **Gas Management:**
  - Monitor current gas prices to ensure accurate estimations.

---

## 🔧 **3. Additional Tips**

### A. **Replace Placeholder Values**

Ensure you replace all placeholder values with actual data:

- **`0xYourTokenAddress`**: Replace with the actual contract address of the token you wish to interact with.
- **`0xYourOutputTokenAddress`**: Replace with the actual contract address of the token you wish to receive.
- **`0xYourInputTokenOnPolygon`** and **`0xYourOutputTokenOnPolygon`**: Replace with the actual contract addresses on Polygon.
- **`0xIntermediateTokenOnPolygon`**: If your swap path includes intermediary tokens, replace with their actual contract addresses.
- **`0xYourTransactionHash`**: Transaction hashes will be returned after successful transactions. They can be used to track the transaction on a blockchain explorer (e.g., [PolygonScan](https://polygonscan.com/) for Polygon).
- **`YOUR_INFURA_PROJECT_ID`** and **`YOUR_PRIVATE_KEY`**: Ensure these are securely stored in your `.env` file and **never** exposed publicly.

### B. **Handling Decimals**

The current implementation assumes that tokens have **18 decimals**. If you're interacting with tokens that have different decimals, adjust the `amountInTokens` and related calculations accordingly.

### C. **Fee Tiers**

Uniswap V3 introduces multiple fee tiers (e.g., `500` for 0.05%, `3000` for 0.3%, `10000` for 1%). Select the appropriate fee tier based on the liquidity and volatility of the token pair:

- **Lower Fee Tiers (e.g., 500):** Suitable for stablecoin pairs or tokens with high liquidity.
- **Higher Fee Tiers (e.g., 10000):** Suitable for volatile or low-liquidity token pairs.

### D. **Gas Management**

- **Gas Limit:**
  The service sets a default gas limit (e.g., `500,000`). Depending on the tokens and network conditions, you might need to adjust this value in your service configuration.

- **Gas Price:**
  Monitor the current gas prices on the network to ensure transactions are processed promptly without overpaying.

### E. **Slippage Considerations**

- **Market Conditions:**
  High volatility tokens might require higher slippage percentages to execute transactions successfully.

- **Liquidity Pools:**
  Ensure that sufficient liquidity exists in the pools to handle your swap amounts, reducing the impact of slippage.

### F. **Fee Management**

- **Approval Steps:**
  Always ensure that the tokens you're swapping are approved for the Uniswap V3 router. Use the `/approve` endpoint before attempting to buy, sell, or swap tokens.

- **Transaction Tracking:**
  Use the returned `txHash` to monitor your transactions on blockchain explorers.

---

## 🔒 **4. Security Best Practices**

- **Secure Private Keys:**
  Ensure that your private keys are **never exposed** in logs, error messages, or version control systems. Use secure storage solutions like environment variables or dedicated secret management tools.

- **Validate Inputs:**
  Rigorously validate all inputs to prevent malicious data from causing unintended behaviors or vulnerabilities.

- **Rate Limiting:**
  Continue to use rate limiting to protect your endpoints from abuse. Adjust the `max` and `windowMs` settings in the rate limiter middleware as needed.

- **Monitor Transactions:**
  Implement monitoring to track the success and failure of transactions. Consider setting up alerts for failed transactions or suspicious activities.

- **Regular Audits:**
  Periodically audit your code and dependencies to identify and mitigate potential security risks.

---

## 🔄 **5. Troubleshooting**

### A. **Insufficient Funds/Error Codes**

- **Error:** `INSUFFICIENT_FUNDS`

  - **Solution:** Ensure that the wallet has enough ETH/WETH or tokens to perform the swap, including gas fees.

- **Error:** `exceeds the maximum allowed gas`
  - **Solution:** Adjust the `MAX_GAS_ETHEREUM` in your `.env` file or review the swap parameters to reduce gas consumption.

### B. **Invalid Token Addresses**

- **Error:** `Invalid token address` or similar.
  - **Solution:** Verify that the token contract addresses provided are correct and exist on the specified chain.

### C. **Connection Issues**

- **Error:** `Failed to connect to RPC endpoint`
  - **Solution:** Check your RPC URLs in the `.env` file and ensure that your server has internet connectivity.

### D. **Slippage Errors**

- **Error:** Swap failed due to slippage.
  - **Solution:** Consider increasing the `slippagePercent` if you are comfortable with a higher deviation, or ensure better liquidity for the token pair.

### E. **Approval Failures**

- **Error:** `Approval failed` or similar.
  - **Solution:** Ensure that you have correctly provided the `tokenAddress` and that the wallet has sufficient tokens to approve. Also, check that the router address is correct.

### F. **Gas Estimation Failures**

- **Error:** `Gas estimation failed` or similar.
  - **Solution:** Verify that the swap path is correct and that there is sufficient liquidity. Additionally, ensure that the tokens involved do not have any transfer restrictions or fees that might affect the swap.

### G. **Unexpected Transaction Reverts**

- **Error:** Transaction reverted without a reason.
  - **Solution:**
    - Double-check the swap path and ensure all tokens are correctly specified.
    - Verify that the pool exists for the specified fee tier.
    - Ensure that the `amountInTokens` does not exceed your token balance.

### H. **Timeouts and Delays**

- **Issue:** Transactions taking longer than expected.
  - **Solution:**
    - Check network congestion and adjust gas prices accordingly.
    - Ensure that the deadline parameter is sufficiently extended to accommodate slower block times.

---

## 🚀 **Getting Started**

1. **Ensure Environment Variables are Set:**

   Your `.env` file should include configurations for all supported chains. For example:

   ```env
   # Uniswap V3 Configurations
   UNI_V3_RPC_URL_ETHEREUM=your_ethereum_rpc_url
   UNI_V3_PRIVATE_KEY_ETHEREUM=your_ethereum_private_key
   UNI_V3_WETH_ADDRESS_ETHEREUM=0xWETHAddress
   UNI_V3_ROUTER_ADDRESS_ETHEREUM=0xUniswapRouterAddress
   UNI_V3_QUOTER_ADDRESS_ETHEREUM=0xQuoterAddress
   UNI_V3_WRAPPED_ADDRESS_ETHEREUM=0xWrappedETHAddress
   UNI_V3_PORT=3001

   UNI_V3_RPC_URL_POLYGON=your_polygon_rpc_url
   UNI_V3_PRIVATE_KEY_POLYGON=your_polygon_private_key
   UNI_V3_WETH_ADDRESS_POLYGON=0xWMATICAddress
   UNI_V3_ROUTER_ADDRESS_POLYGON=0xUniswapRouterAddress
   UNI_V3_QUOTER_ADDRESS_POLYGON=0xQuoterAddressPolygon
   UNI_V3_WRAPPED_ADDRESS_POLYGON=0xWrappedMATICAddress
   UNI_V3_RPC_URL_BASE=your_base_rpc_url
   UNI_V3_PRIVATE_KEY_BASE=your_base_private_key
   UNI_V3_WETH_ADDRESS_BASE=0xWETHAddressBase
   UNI_V3_ROUTER_ADDRESS_BASE=0xUniswapRouterAddressBase
   UNI_V3_QUOTER_ADDRESS_BASE=0xQuoterAddressBase
   UNI_V3_WRAPPED_ADDRESS_BASE=0xWrappedBaseAddress
   # Add more Uniswap configurations as needed

   GAS_BUFFER_PERCENT=100
   MAX_GAS_ETHEREUM=200000
   UNI_V3_FEE_TIER_DEFAULT=3000
   ```

2. **Start the Server:**

   ```bash
   node index.js
   ```

   You should see output similar to:

   ```
   Uniswap V3 Service running on port 3001
   Endpoints:
     - POST /approve
     - POST /uni-v3-buy
     - POST /uni-v3-sell
     - POST /uni-v3-swap
     - POST /uni-v3-estimate-buy-cost
     - POST /uni-v3-estimate-sell-cost
     - POST /uni-v3-estimate-swap-cost
   ```

3. **Perform Swaps and Estimates:**

   Use the provided `curl` commands to interact with the endpoints. Ensure that you replace placeholder addresses (e.g., `"0xYourTokenAddress"`) with actual token contract addresses relevant to your swaps.

---

## 📈 **Best Practices**

- **Start with Small Amounts:**
  When testing new swaps, begin with smaller amounts to ensure everything functions as expected without incurring significant costs.

- **Monitor Gas Prices:**
  Gas prices can fluctuate significantly. Adjust your `gasPrice` settings or implement dynamic gas price fetching based on network conditions.

- **Handle Fees and Taxes:**
  Some tokens have transfer fees or taxes. Ensure your bot accounts for these by adjusting `slippagePercent` or implementing additional logic as needed.

- **Keep Dependencies Updated:**
  Regularly update your dependencies, especially `ethers.js`, to benefit from the latest features and security patches.

- **Secure Your Environment:**
  Always keep your `.env` file secure and avoid exposing sensitive information. Consider using secret management tools for enhanced security.

- **Use Appropriate Fee Tiers:**
  Select the appropriate Uniswap V3 fee tier based on the liquidity and volatility of the token pair to optimize swap efficiency and cost.

- **Implement Robust Error Handling:**
  Ensure that your application gracefully handles errors and provides meaningful feedback to users to facilitate troubleshooting.

---
