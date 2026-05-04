# 🌐 **Uniswap V2 Multi-Chain DEX Bot Documentation**

This documentation provides `curl` examples for all endpoints defined in the multi-chain **Uniswap V2** bot. Adjust `localhost:3000` and the parameters as needed based on your deployment setup.

---

## 📢 **Important Notes**

- **Chain Parameter:** Each request now requires a `"chain"` parameter (e.g., `"ethereum"`, `"polygon"`, or `"bsc"`) to select the desired blockchain network's configuration.

- **Environment Setup:** Ensure that your `.env` file and chain configurations are correctly set up. The tokens involved in the swaps must exist on the chosen chain.

- **Approval Requirement:** Before performing any token swaps or sells, ensure that the router has sufficient allowance to spend the tokens. Use the respective `/approve` endpoints as needed.

---

## 📝 **Table of Contents**

1. [Prerequisites](#1-prerequisites)
2. [Endpoints](#2-endpoints)
   - [1. Approve Tokens (`/approve`)](#1-approve-tokens-approve)
   - [2. Buy Token (`/uni-v2-buy`)](#2-buy-token-uni-v2-buy)
   - [3. Sell Token (`/uni-v2-sell`)](#3-sell-token-uni-v2-sell)
   - [4. Estimate Buy Transaction Cost (`/uni-v2-estimate-buy-cost`)](#4-estimate-buy-transaction-cost-uni-v2-estimate-buy-cost)
   - [5. Estimate Sell Transaction Cost (`/uni-v2-estimate-sell-cost`)](#5-estimate-sell-transaction-cost-uni-v2-estimate-sell-cost)
   - [6. Swap Tokens (`/uni-v2-swap`)](#6-swap-tokens-uni-v2-swap)
   - [7. Estimate Swap Cost (`/uni-v2-estimate-swap-cost`)](#7-estimate-swap-cost-uni-v2-estimate-swap-cost)
3. [Additional Tips](#3-additional-tips)
4. [Security Best Practices](#4-security-best-practices)
5. [Troubleshooting](#5-troubleshooting)
6. [Support](#6-support)

---

## 🛠️ **1. Prerequisites**

Before interacting with the Uniswap V2 endpoints, ensure the following:

1. **cURL Installed:**
   Ensure that you have `cURL` installed on your system. Verify by running:

   ```bash
   curl --version
   ```

   If not installed, download it from [cURL's official website](https://curl.se/download.html) or install via your package manager.

2. **Service Running:**
   Make sure your Uniswap V2 service (`uni-v2.js`) is running and accessible at the specified port (e.g., `http://localhost:3000`).

3. **Valid Environment Configuration:**
   Ensure your `.env` file is correctly configured with all necessary variables for the supported chains (e.g., `ethereum`, `polygon`, `bsc`). Example:

   ```env
   # Uniswap V2 Configurations
   UNI_V2_RPC_URL_ETHEREUM=your_ethereum_rpc_url
   UNI_V2_PRIVATE_KEY_ETHEREUM=your_ethereum_private_key
   UNI_V2_WETH_ADDRESS_ETHEREUM=0xWETHAddress
   UNI_V2_ROUTER_ADDRESS_ETHEREUM=0xUniswapRouterAddress
   UNI_V2_PORT=3000

   UNI_V2_RPC_URL_POLYGON=your_polygon_rpc_url
   UNI_V2_PRIVATE_KEY_POLYGON=your_polygon_private_key
   UNI_V2_WETH_ADDRESS_POLYGON=0xWMATICAddress
   UNI_V2_ROUTER_ADDRESS_POLYGON=0xUniswapRouterAddress
   UNI_V2_RPC_URL_BASE=your_base_rpc_url
   UNI_V2_PRIVATE_KEY_BASE=your_base_private_key
   UNI_V2_WETH_ADDRESS_BASE=0xWETHAddressBase
   UNI_V2_ROUTER_ADDRESS_BASE=0xUniswapRouterAddressBase
   # Add more Uniswap configurations as needed

   GAS_BUFFER_PERCENT=100
   MAX_GAS_ETHEREUM=200000
   ```

---

## 🚀 **2. Endpoints**

### 2.1 **Approve Tokens (`/approve`)**

**Endpoint:**

```
POST /approve
```

**Description:**
Approves the Uniswap V2 router to spend a specified amount of a token on behalf of your wallet. This is a prerequisite for performing buy or sell operations.

**Request Payload:**

```json
{
  "chain": "ethereum",
  "tokenAddress": "0xYourTokenAddress",
  "amount": "1000"
}
```

**Parameters:**

- **`chain`** (string, required): The blockchain network you want to interact with (e.g., `"ethereum"`, `"polygon"`, `"bsc"`).
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
    http://localhost:3000/approve
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
    http://localhost:3000/approve
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
    http://localhost:3000/approve
  ```

**Expected Response:**

```json
{
  "message": "Approval successful."
}
```

**Notes:**

- Replace `"0xYourTokenAddress"` with the actual token contract address you intend to approve.
- Ensure that the `amount` reflects the number of tokens you wish to approve, considering the token's decimals.

---

### 2.2 **Buy Token (`/uni-v2-buy`)**

**Endpoint:**

```
POST /uni-v2-buy
```

**Description:**
Swaps ETH/WETH for a specified ERC20 token using Uniswap V2.

**Request Payload:**

```json
{
  "chain": "ethereum",
  "tokenAddress": "0x3f962f6325e61b90bae9971f110863c4e67036e2",
  "amountInEth": "0.015",
  "slippagePercent": 10
}
```

**Parameters:**

- **`chain`** (string, required): The blockchain network (e.g., `"ethereum"`, `"polygon"`, `"bsc"`).
- **`tokenAddress`** (string, required): The contract address of the ERC20 token you want to buy.
- **`amountInEth`** (string or number, required): The amount of ETH/WETH you want to swap.
- **`slippagePercent`** (number, optional): Maximum slippage percentage (default: `3`).
- **`path`** (array of strings, optional): Custom swap path. If omitted, defaults to `[WETH, token]`.

**🔹 Examples:**

- **ETH → Token (Ethereum):**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{"chain":"ethereum","tokenAddress":"0x3f962f6325e61b90bae9971f110863c4e67036e2","amountInEth":"0.015","slippagePercent":10}' \
    http://localhost:3000/uni-v2-buy
  ```

- **ETH → Token (Polygon):**
  _(Here `amountInEth` conceptually means "amount of native token"—MATIC in this case—converted via WETH equivalent.)_

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{"chain":"polygon","tokenAddress":"0x311434160D7537be358930def317AfB606C0D737","amountInEth":"0.5","slippagePercent":3}' \
    http://localhost:3000/uni-v2-buy
  ```

- **Token → Token (Ethereum):**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{
          "chain":"ethereum",
          "tokenAddress":"0xYourOutputTokenAddress",
          "amountInEth":"0.5",
          "slippagePercent":3,
          "path":["WETH","USDT","0x311434160D7537be358930def317AfB606C0D737"]
        }' \
    http://localhost:3000/uni-v2-buy
  ```

**Expected Response:**

```json
{
  "message": "Uniswap V2 Buy successful",
  "txHash": "0xYourTransactionHash",
  "amount": "0.95"
}
```

**Notes:**

- **Path:**

  - When **buying ETH → Token**, the path typically starts with **WETH** and ends with the desired token.
  - For **Token → Token** swaps, ensure the path starts with the input token and ends with the output token, including any intermediary tokens if necessary.

- **Slippage:**

  - A slippage of `3%` is standard, but adjust based on market conditions. Higher slippage increases the chance of transaction success but may result in less favorable rates.

- **Gas Limit:**
  - The service sets a default gas limit (e.g., `500,000`). Depending on the token and network conditions, you might need to adjust this value.

---

### 2.3 **Sell Token (`/uni-v2-sell`)**

**Endpoint:**

```
POST /uni-v2-sell
```

**Description:**
Swaps a specified ERC20 token for ETH/WETH using Uniswap V2.

**Request Payload:**

```json
{
  "chain": "ethereum",
  "tokenAddress": "0xYourTokenAddress",
  "amountInTokens": "1",
  "slippagePercent": 3
}
```

**Parameters:**

- **`chain`** (string, required): The blockchain network (e.g., `"ethereum"`, `"polygon"`, `"bsc"`).
- **`tokenAddress`** (string, required): The contract address of the ERC20 token you want to sell.
- **`amountInTokens`** (string or number, required): The amount of tokens you want to swap.
- **`slippagePercent`** (number, optional): Maximum slippage percentage (default: `3`).
- **`path`** (array of strings, optional): Custom swap path. If omitted, defaults to `[token, WETH]`.

**🔹 Examples:**

- **Token → ETH (Ethereum):**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{"chain":"ethereum","tokenAddress":"0xYourTokenAddress","amountInTokens":"1","slippagePercent":3}' \
    http://localhost:3000/uni-v2-sell

  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{"chain":"polygon","tokenAddress":"0x311434160D7537be358930def317AfB606C0D737","amountInTokens":"0.5","slippagePercent":3}' \
    http://localhost:3000/uni-v2-sell
  ```

- **Token → Token (Polygon):**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{
          "chain":"polygon",
          "tokenAddress":"0xYourInputTokenOnPolygon",
          "amountInTokens":"200",
          "slippagePercent":3,
          "path":["0xYourInputTokenOnPolygon","0xIntermediateToken","0xYourOutputTokenOnPolygon"]
        }' \
    http://localhost:3000/uni-v2-sell
  ```

**Expected Response:**

```json
{
  "message": "Uniswap V2 Sell successful",
  "txHash": "0xYourTransactionHash",
  "amount": "0.95"
}
```

**Notes:**

- **Path:**

  - When **selling Token → ETH**, the path typically starts with the token and ends with **WETH**.
  - For **Token → Token** swaps, ensure the path starts with the input token and ends with the output token, including any intermediary tokens if necessary.

- **Slippage:**

  - A slippage of `3%` is standard, but adjust based on market conditions.

- **Gas Limit:**
  - The service sets a default gas limit (e.g., `500,000`). Adjust as necessary based on the specific swap.

---

### 2.4 **Estimate Buy Transaction Cost (`/uni-v2-estimate-buy-cost`)**

**Endpoint:**

```
POST /uni-v2-estimate-buy-cost
```

**Description:**
Estimates the gas cost and potential output for a buy operation on Uniswap V2 without executing the transaction.

**Request Payload:**

```json
{
  "chain": "ethereum",
  "tokenAddress": "0xb0AC2b5a73da0e67A8e5489Ba922B3f8d582e058",
  "amountInEth": "0.001",
  "slippagePercent": 3
}
```

**Parameters:**

- **`chain`** (string, required): The blockchain network (e.g., `"ethereum"`, `"polygon"`, `"bsc"`).
- **`tokenAddress`** (string, required): The contract address of the ERC20 token you want to buy.
- **`amountInEth`** (string or number, required): The amount of ETH/WETH you intend to spend.
- **`slippagePercent`** (number, optional): Maximum acceptable slippage percentage (default: `3`).
- **`path`** (array of strings, optional): Custom swap path. If omitted, defaults to `[WETH, token]`.

**🔹 Examples:**

- **Estimate ETH → Token Buy (Ethereum):**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{"chain":"ethereum","tokenAddress":"0xb0AC2b5a73da0e67A8e5489Ba922B3f8d582e058","amountInEth":"0.001","slippagePercent":3}' \
    http://localhost:3000/uni-v2-estimate-buy-cost

  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{"chain":"polygon","tokenAddress":"0x311434160D7537be358930def317AfB606C0D737","amountInEth":"5","slippagePercent":3}' \
    http://localhost:3000/uni-v2-estimate-buy-cost
  ```

- **Estimate Token → Token Buy (Polygon):**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{
          "chain":"polygon",
          "tokenAddress":"0xYourOutputTokenOnPolygon",
          "amountInEth":"1.0",
          "slippagePercent":3,
          "path":["0xYourInputTokenOnPolygon","0xIntermediateTokenOnPolygon","0xYourOutputTokenOnPolygon"]
        }' \
    http://localhost:3000/uni-v2-estimate-buy-cost
  ```

**Expected Response:**

```json
{
  "message": "Estimated Uniswap V2 Buy cost",
  "estimate": {
    "gasEstimate": "200000",
    "gasPrice": "50000000000",
    "totalCostWei": "10000000000000000",
    "amountOutMin": "1000.000000000000000000",
    "amountOutEstimate": "1050.000000000000000000",
    "totalCostEth": "0.01"
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

- Replace `"0x311434160D7537be358930def317AfB606C0D737"` with your target token's contract address.
- Ensure that the `path` array starts with WETH and ends with the target token.
- Adjust `slippagePercent` based on your tolerance for price movement.

---

### 2.5 **Estimate Sell Transaction Cost (`/uni-v2-estimate-sell-cost`)**

**Endpoint:**

```
POST /uni-v2-estimate-sell-cost
```

**Description:**
Estimates the gas cost and potential output for a sell operation on Uniswap V2 without executing the transaction.

**Request Payload:**

```json
{
  "chain": "polygon",
  "tokenAddress": "0xYourInputTokenOnPolygon",
  "amountInTokens": "200",
  "slippagePercent": 3
}
```

**Parameters:**

- **`chain`** (string, required): The blockchain network (e.g., `"ethereum"`, `"polygon"`, `"bsc"`).
- **`tokenAddress`** (string, required): The contract address of the ERC20 token you want to sell.
- **`amountInTokens`** (string or number, required): The amount of tokens you intend to sell.
- **`slippagePercent`** (number, optional): Maximum acceptable slippage percentage (default: `3`).
- **`path`** (array of strings, optional): Custom swap path. If omitted, defaults to `[token, WETH]`.

**🔹 Examples:**

- **Estimate Token → ETH Sell (Ethereum):**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{"chain":"ethereum","tokenAddress":"0xF107edABF59ba696E38DE62Ad5327415Bd4D4236","amountInTokens":"10","slippagePercent":3}' \
    http://localhost:3000/uni-v2-estimate-sell-cost

  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{"chain":"polygon","tokenAddress":"0x311434160D7537be358930def317AfB606C0D737","amountInTokens":"10","slippagePercent":3}' \
    http://localhost:3000/uni-v2-estimate-sell-cost
  ```

- **Estimate Token → Token Sell (Polygon):**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{
          "chain":"polygon",
          "tokenAddress":"0xYourInputTokenOnPolygon",
          "amountInTokens":"200",
          "slippagePercent":3,
          "path":["0xYourInputTokenOnPolygon","0xIntermediateTokenOnPolygon","0xYourOutputTokenOnPolygon"]
        }' \
    http://localhost:3000/uni-v2-estimate-sell-cost
  ```

**Expected Response:**

```json
{
  "message": "Estimated Uniswap V2 Sell cost",
  "estimate": {
    "gasEstimate": "200000",
    "gasPrice": "50000000000",
    "totalCostWei": "10000000000000000",
    "amountOutMin": "0.95",
    "amountOutEstimate": "0.95",
    "totalCostEth": "0.01"
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

- Replace `"0x311434160D7537be358930def317AfB606C0D737"` with the token you intend to sell.
- Ensure that the `path` array starts with your input token and ends with WETH.
- Adjust `slippagePercent` based on your tolerance for price movement.

---

### 2.6 **Swap Tokens (`/uni-v2-swap`)**

**Endpoint:**

```
POST /uni-v2-swap
```

**Description:**
Performs a token-to-token swap on Uniswap V2, exchanging a specified amount of input tokens for output tokens, considering slippage and gas estimates.

**Request Payload:**

```json
{
  "chain": "polygon",
  "tokenIn": "0xYourInputTokenOnPolygon",
  "tokenOut": "0xYourOutputTokenOnPolygon",
  "amountInTokens": "200",
  "slippagePercent": 3,
  "path": [
    "0xYourInputTokenOnPolygon",
    "0xIntermediateTokenOnPolygon",
    "0xYourOutputTokenOnPolygon"
  ]
}
```

**Parameters:**

- **`chain`** (string, required): The blockchain network (e.g., `"ethereum"`, `"polygon"`, `"bsc"`).
- **`tokenIn`** (string, required): The address of the input ERC20 token.
- **`tokenOut`** (string, required): The address of the output ERC20 token.
- **`amountInTokens`** (string or number, required): The amount of input tokens to swap.
- **`slippagePercent`** (number, optional): Maximum acceptable slippage percentage (default: `3`).
- **`path`** (array of strings, optional): Custom swap path array. If omitted, defaults to `[tokenIn, tokenOut]`.

**🔹 Example cURL Command:**

- **Token-to-Token Swap on Polygon:**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{
          "chain": "polygon",
          "tokenIn": "0xYourInputTokenOnPolygon",
          "tokenOut": "0xYourOutputTokenOnPolygon",
          "amountInTokens": "200",
          "slippagePercent": 3,
          "path":["0xYourInputTokenOnPolygon","0xIntermediateTokenOnPolygon","0xYourOutputTokenOnPolygon"]
        }' \
    http://localhost:3000/uni-v2-swap
  ```

**Expected Response:**

```json
{
  "message": "V2 Token-to-Token Swap successful",
  "txHash": "0xYourTransactionHash",
  "amountReceived": "0.95"
}
```

**Notes:**

- **Path:**

  - Ensure the `path` array starts with `tokenIn` and ends with `tokenOut`, including any intermediary tokens if necessary.

- **Slippage:**

  - A slippage of `3%` is standard, but adjust based on market conditions.

- **Gas Limit:**

  - The service sets a default gas limit (e.g., `500,000`). Depending on the tokens and network conditions, you might need to adjust this value.

- **Transaction Hash:**
  - The `txHash` can be used to track the transaction on a blockchain explorer (e.g., [Etherscan](https://etherscan.io/) for Ethereum, [PolygonScan](https://polygonscan.com/) for Polygon).

---

### 2.7 **Estimate Swap Cost (`/uni-v2-estimate-swap-cost`)**

**Endpoint:**

```
POST /uni-v2-estimate-swap-cost
```

**Description:**
Estimates the gas cost and expected output for a token-to-token swap on Uniswap V2 without executing the transaction.

**Request Payload:**

```json
{
  "chain": "polygon",
  "tokenIn": "0xYourInputTokenOnPolygon",
  "tokenOut": "0xYourOutputTokenOnPolygon",
  "amountInTokens": "200",
  "slippagePercent": 3,
  "path": [
    "0xYourInputTokenOnPolygon",
    "0xIntermediateTokenOnPolygon",
    "0xYourOutputTokenOnPolygon"
  ]
}
```

**Parameters:**

- **`chain`** (string, required): The blockchain network (e.g., `"ethereum"`, `"polygon"`, `"bsc"`).
- **`tokenIn`** (string, required): The address of the input ERC20 token.
- **`tokenOut`** (string, required): The address of the output ERC20 token.
- **`amountInTokens`** (string or number, required): The amount of input tokens to swap.
- **`slippagePercent`** (number, optional): Maximum acceptable slippage percentage (default: `3`).
- **`path`** (array of strings, optional): Custom swap path array. If omitted, defaults to `[tokenIn, tokenOut]`.

**🔹 Example cURL Command:**

- **Estimate Swap Cost on Polygon:**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{
          "chain": "polygon",
          "tokenIn": "0xYourInputTokenOnPolygon",
          "tokenOut": "0xYourOutputTokenOnPolygon",
          "amountInTokens": "200",
          "slippagePercent": 3,
          "path":["0xYourInputTokenOnPolygon","0xIntermediateTokenOnPolygon","0xYourOutputTokenOnPolygon"]
        }' \
    http://localhost:3000/uni-v2-estimate-swap-cost
  ```

**Expected Response:**

```json
{
  "message": "Estimated swap cost",
  "estimate": {
    "gasEstimate": "200000",
    "gasPrice": "50000000000",
    "totalCostWei": "10000000000000000",
    "amountOutMin": "0.95",
    "amountOutEstimate": "0.95",
    "totalCostEth": "0.01"
  }
}
```

**Response Fields:**

- **`gasEstimate`**: Estimated gas units required for the transaction.
- **`gasPrice`**: Current gas price in wei.
- **`totalCostWei`**: Total gas cost in wei (`gasEstimate * gasPrice`).
- **`amountOutMin`**: Minimum output tokens expected after slippage.
- **`amountOutEstimate`**: Estimated output tokens to receive without considering slippage.
- **`totalCostEth`**: Total gas cost in ETH (converted from wei).

**Notes:**

- **Path:**

  - Ensure the `path` array starts with `tokenIn` and ends with `tokenOut`, including any intermediary tokens if necessary.

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
- **`0xYourTransactionHash`**: Transaction hashes will be returned after successful transactions. They can be used to track the transaction on a blockchain explorer (e.g., [Etherscan](https://etherscan.io/) for Ethereum, [PolygonScan](https://polygonscan.com/) for Polygon).
- **`YOUR_INFURA_PROJECT_ID`** and **`YOUR_PRIVATE_KEY`**: Ensure these are securely stored in your `.env` file and **never** exposed publicly.

### B. **Handling Decimals**

The current implementation assumes that tokens have **18 decimals**. If you're interacting with tokens that have different decimals, adjust the `amountInTokens` and related calculations accordingly.

### C. **Gas Management**

- **Gas Limit:**
  The service sets a default gas limit (e.g., `500,000`). Depending on the tokens and network conditions, you might need to adjust this value in your service configuration.

- **Gas Price:**
  Monitor the current gas prices on the network to ensure transactions are processed promptly without overpaying.

### D. **Slippage Considerations**

- **Market Conditions:**
  High volatility tokens might require higher slippage percentages to execute transactions successfully.

- **Liquidity Pools:**
  Ensure that sufficient liquidity exists in the pools to handle your swap amounts, reducing the impact of slippage.

### E. **Fee Management**

- **Approval Steps:**
  Always ensure that the tokens you're swapping are approved for the Uniswap V2 router. Use the `/approve` endpoint before attempting to buy or sell tokens.

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

---

## 🚀 **Getting Started**

1. **Ensure Environment Variables are Set:**

   Your `.env` file should include configurations for all supported chains. For example:

   ```env
   # Uniswap V2 Configurations
   UNI_V2_RPC_URL_ETHEREUM=your_ethereum_rpc_url
   UNI_V2_PRIVATE_KEY_ETHEREUM=your_ethereum_private_key
   UNI_V2_WETH_ADDRESS_ETHEREUM=0xWETHAddress
   UNI_V2_ROUTER_ADDRESS_ETHEREUM=0xUniswapRouterAddress
   UNI_V2_PORT=3000

   UNI_V2_RPC_URL_POLYGON=your_polygon_rpc_url
   UNI_V2_PRIVATE_KEY_POLYGON=your_polygon_private_key
   UNI_V2_WETH_ADDRESS_POLYGON=0xWMATICAddress
   UNI_V2_ROUTER_ADDRESS_POLYGON=0xUniswapRouterAddress
   UNI_V2_RPC_URL_BASE=your_base_rpc_url
   UNI_V2_PRIVATE_KEY_BASE=your_base_private_key
   UNI_V2_WETH_ADDRESS_BASE=0xWETHAddressBase
   UNI_V2_ROUTER_ADDRESS_BASE=0xUniswapRouterAddressBase
   # Add more Uniswap configurations as needed

   GAS_BUFFER_PERCENT=100
   MAX_GAS_ETHEREUM=200000
   ```

2. **Start the Server:**

   ```bash
   node src/uni-v2.js
   ```

   You should see output similar to:

   ```
   Uniswap V2 Service running on port 3000
   Endpoints:
     - POST /approve
     - POST /uni-v2-buy
     - POST /uni-v2-sell
     - POST /uni-v2-estimate-buy-cost
     - POST /uni-v2-estimate-sell-cost
     - POST /uni-v2-swap
     - POST /uni-v2-estimate-swap-cost
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

---
