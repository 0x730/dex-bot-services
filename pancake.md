# 🥞 **PancakeSwap V2 Multi-Chain DEX Bot Documentation**

This documentation provides `curl` examples and detailed explanations for all endpoints defined in the multi-chain **PancakeSwap V2** bot. Adjust `localhost:3002` and the parameters as needed based on your deployment setup.

---

## 📢 **Important Notes**

- **Chain Parameter:** Each request requires a `"chain"` parameter (e.g., `"BSC"`) to select the desired blockchain network's configuration.

- **Environment Setup:** Ensure that your `.env` file and chain configurations are correctly set up. The tokens involved in the swaps must exist on the chosen chain.

- **Approval Requirement:** Before performing any token swaps or sells, ensure that the router has sufficient allowance to spend the tokens. Use the respective `/pancake-approve` endpoint as needed.

---

## 📝 **Table of Contents**

1. [Prerequisites](#1-prerequisites)
2. [Endpoints](#2-endpoints)

- [1. Approve Tokens (`/pancake-approve`)](#1-approve-tokens-pancake-approve)
- [2. Buy Token (`/pancake-buy`)](#2-buy-token-pancake-buy)
- [3. Sell Token (`/pancake-sell`)](#3-sell-token-pancake-sell)
- [4. Swap Tokens (`/pancake-swap`)](#4-swap-tokens-pancake-swap)
- [5. Estimate Buy Transaction Cost (`/pancake-estimate-buy-cost`)](#5-estimate-buy-transaction-cost-pancake-estimate-buy-cost)
- [6. Estimate Sell Transaction Cost (`/pancake-estimate-sell-cost`)](#6-estimate-sell-transaction-cost-pancake-estimate-sell-cost)
- [7. Estimate Swap Cost (`/pancake-estimate-swap-cost`)](#7-estimate-swap-cost-pancake-estimate-swap-cost)

3. [Additional Tips](#3-additional-tips)
4. [Security Best Practices](#4-security-best-practices)
5. [Troubleshooting](#5-troubleshooting)
6. [Support](#6-support)

---

## 🛠️ **1. Prerequisites**

Before interacting with the PancakeSwap V2 endpoints, ensure the following:

1. **cURL Installed:**
   Ensure that you have `cURL` installed on your system. Verify by running:

   ```bash
   curl --version
   ```

   If not installed, download it from [cURL's official website](https://curl.se/download.html) or install via your package manager.

2. **Service Running:**
   Make sure your PancakeSwap V2 service (`index.js`) is running and accessible at the specified port (e.g., `http://localhost:3002`).

3. **Valid Environment Configuration:**
   Ensure your `.env` file is correctly configured with all necessary variables for the supported chains (e.g., `BSC`). Example:

   ```env
   # PancakeSwap V2 Configurations
   PANCAKE_RPC_URL_BSC=your_bsc_rpc_url
   PANCAKE_PRIVATE_KEY_BSC=your_bsc_private_key
   PANCAKE_WBNB_ADDRESS_BSC=0xBB4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c
   PANCAKE_ROUTER_ADDRESS_BSC=0x10ED43C718714eb63d5aA57B78B54704E256024E
   PANCAKE_FACTORY_ADDRESS_BSC=0xBCfCcbde45cE874adCB698cC183deBcF17952812
   PANCAKE_PORT=3002

   GAS_BUFFER_PERCENT=100
   ```

---

## 🚀 **2. Endpoints**

### 2.1 **Approve Tokens (`/pancake-approve`)**

**Endpoint:**

```
POST /pancake-approve
```

**Description:**
Approves the PancakeSwap router to spend a specified amount of a token on behalf of your wallet. This is a prerequisite for performing buy, sell, or swap operations.

**Request Payload:**

```json
{
  "chain": "BSC",
  "tokenAddress": "0xYourTokenAddressHere",
  "amount": "1000"
}
```

**Parameters:**

- **`chain`** (string, required): The blockchain network identifier (e.g., `"BSC"`).
- **`tokenAddress`** (string, required): The ERC20 token contract address you want to approve.
- **`amount`** (string or number, required): The amount of tokens to approve (in token units, considering decimals).

**🔹 Example cURL Commands:**

- **Approve USDT on BSC:**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{
          "chain": "BSC",
          "tokenAddress": "0x55d398326f99059fF775485246999027B3197955",
          "amount": "1000"
        }' \
    http://localhost:3002/pancake-approve
  ```

**Expected Response:**

```json
{
  "message": "Approval successful for PancakeSwap router."
}
```

**Notes:**

- Replace `"0xYourTokenAddressHere"` with the actual token contract address you intend to approve.
- Ensure that the `amount` is specified in the token's smallest unit (e.g., for USDT with 18 decimals, `"1000"` represents `1000 * 10^-18` USDT).

---

### 2.2 **Buy Token (`/pancake-buy`)**

**Endpoint:**

```
POST /pancake-buy
```

**Description:**
Swaps BNB for a specified ERC20 token using PancakeSwap.

**Request Payload:**

```json
{
  "chain": "BSC",
  "tokenAddress": "0xYourTokenAddressHere",
  "amountInBnb": "0.5",
  "slippagePercent": 3,
  "path": [
    "0xBB4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    "0xYourTokenAddressHere"
  ]
}
```

**Parameters:**

- **`chain`** (string, required): The blockchain network identifier (e.g., `"BSC"`).
- **`tokenAddress`** (string, required): The ERC20 token contract address you wish to buy.
- **`amountInBnb`** (string or number, required): The amount of BNB to spend (in BNB units).
- **`slippagePercent`** (number, optional): Maximum acceptable slippage percentage (default is `3`).
- **`path`** (array of strings, optional): An array of token addresses representing the swap path. Typically starts with WBNB and ends with the desired token.

**🔹 Example cURL Commands:**

- **Buy Token with Default Path and Fee on BSC:**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{
          "chain": "BSC",
          "tokenAddress": "0xYourTokenAddressHere",
          "amountInBnb": "0.5",
          "slippagePercent": 3,
          "path": ["0xBB4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", "0xYourTokenAddressHere"]
        }' \
    http://localhost:3002/pancake-buy
  ```

**Expected Response:**

```json
{
  "message": "PancakeSwap Buy successful",
  "txHash": "0xYourTransactionHash",
  "amountOutMin": "1000.000000000000000000",
  "amountOutEstimate": "1050.000000000000000000",
  "amount": "1050.000000000000000000"
}
```

**Notes:**

- **Path:** Ensure that the first address is WBNB (`0xBB4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c` on BSC) and the second is the token you wish to buy.
- **Slippage:** A slippage of `3%` is standard, but adjust based on market conditions.
- **Gas Limit:** The service sets a default gas limit (`500000`). Depending on the token and network conditions, you might need to adjust this value.

---

### 2.3 **Sell Token (`/pancake-sell`)**

**Endpoint:**

```
POST /pancake-sell
```

**Description:**
Swaps a specified ERC20 token for BNB using PancakeSwap.

**Request Payload:**

```json
{
  "chain": "BSC",
  "tokenAddress": "0xYourTokenAddressHere",
  "amountInTokens": "1000",
  "slippagePercent": 3,
  "path": [
    "0xYourTokenAddressHere",
    "0xBB4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c"
  ]
}
```

**Parameters:**

- **`chain`** (string, required): The blockchain network identifier (e.g., `"BSC"`).
- **`tokenAddress`** (string, required): The ERC20 token contract address you wish to sell.
- **`amountInTokens`** (string or number, required): The amount of tokens to sell (in token units, considering decimals).
- **`slippagePercent`** (number, optional): Maximum acceptable slippage percentage (default is `3`).
- **`path`** (array of strings, optional): An array of token addresses representing the swap path. Typically starts with the token to sell and ends with WBNB.

**🔹 Example cURL Commands:**

- **Sell Token with Default Path and Fee on BSC:**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{
          "chain": "BSC",
          "tokenAddress": "0xYourTokenAddressHere",
          "amountInTokens": "1000",
          "slippagePercent": 3,
          "path": ["0xYourTokenAddressHere", "0xBB4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c"]
        }' \
    http://localhost:3002/pancake-sell
  ```

**Expected Response:**

```json
{
  "message": "PancakeSwap Sell successful",
  "txHash": "0xYourTransactionHash",
  "amountOutMin": "0.495000000000000000",
  "amountOutEstimate": "0.515000000000000000",
  "amount": "0.515000000000000000"
}
```

**Notes:**

- **Path:** Ensure that the first address is the token you wish to sell and the second is WBNB.
- **Slippage:** A slippage of `3%` is standard, but adjust based on market conditions.
- **Gas Limit:** The service sets a default gas limit (`500000`). Depending on the token and network conditions, you might need to adjust this value.

---

### 2.4 **Swap Tokens (`/pancake-swap`)**

**Endpoint:**

```
POST /pancake-swap
```

**Description:**
Performs a token-to-token swap on PancakeSwap, exchanging a specified amount of input tokens for output tokens, considering slippage.

**Request Payload:**

```json
{
  "chain": "BSC",
  "tokenIn": "0xYourInputTokenOnBSC",
  "tokenOut": "0xYourOutputTokenOnBSC",
  "amountInTokens": "200",
  "slippagePercent": 3,
  "path": [
    "0xYourInputTokenOnBSC",
    "0xIntermediateTokenOnBSC",
    "0xYourOutputTokenOnBSC"
  ]
}
```

**Parameters:**

- **`chain`** (string, required): The blockchain network identifier (e.g., `"BSC"`).
- **`tokenIn`** (string, required): The address of the input ERC20 token.
- **`tokenOut`** (string, required): The address of the output ERC20 token.
- **`amountInTokens`** (string or number, required): The amount of input tokens to swap.
- **`slippagePercent`** (number, optional): Maximum acceptable slippage percentage (default is `3`).
- **`path`** (array of strings, optional): An array of token addresses representing the swap path. Typically starts with the input token and ends with the output token, including any intermediary tokens.

**🔹 Example cURL Commands:**

- **Token-to-Token Swap on BSC with Default Path and Fee:**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{
          "chain": "BSC",
          "tokenIn": "0xYourInputTokenOnBSC",
          "tokenOut": "0xYourOutputTokenOnBSC",
          "amountInTokens": "200",
          "slippagePercent": 3,
          "path": ["0xYourInputTokenOnBSC", "0xIntermediateTokenOnBSC", "0xYourOutputTokenOnBSC"]
        }' \
    http://localhost:3002/pancake-swap
  ```

**Expected Response:**

```json
{
  "message": "PancakeSwap Token-to-Token Swap successful",
  "txHash": "0xYourTransactionHash",
  "amountReceived": "1050.000000000000000000"
}
```

**Notes:**

- **Path:**

  - Ensure the `path` array starts with `tokenIn` and ends with `tokenOut`, including any intermediary tokens if necessary.

- **Slippage:**

  - A slippage of `3%` is standard, but adjust based on market conditions.

- **Gas Limit:**

  - The service sets a default gas limit (`500000`). Depending on the tokens and network conditions, you might need to adjust this value.

- **Transaction Hash:**
  - The `txHash` can be used to track the transaction on a blockchain explorer (e.g., [BscScan](https://bscscan.com/)).

---

### 2.5 **Estimate Buy Transaction Cost (`/pancake-estimate-buy-cost`)**

**Endpoint:**

```
POST /pancake-estimate-buy-cost
```

**Description:**
Estimates the gas cost and potential output for a buy operation on PancakeSwap without executing the transaction.

**Request Payload:**

```json
{
  "chain": "BSC",
  "tokenAddress": "0xYourTokenAddressHere",
  "amountInBnb": "0.5",
  "slippagePercent": 3,
  "path": [
    "0xBB4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    "0xYourTokenAddressHere"
  ]
}
```

**Parameters:**

- **`chain`** (string, required): The blockchain network identifier (e.g., `"BSC"`).
- **`tokenAddress`** (string, required): The ERC20 token contract address you intend to buy.
- **`amountInBnb`** (string or number, required): The amount of BNB to spend (in BNB units).
- **`slippagePercent`** (number, optional): Maximum acceptable slippage percentage (default is `3`).
- **`path`** (array of strings, optional): An array of token addresses representing the swap path. Typically starts with WBNB and ends with the desired token.

**🔹 Example cURL Commands:**

- **Estimate BNB → Token Buy on BSC:**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{
          "chain": "BSC",
          "tokenAddress": "0x477bC8d23c634C154061869478bce96BE6045D12",
          "amountInBnb": "0.5",
          "slippagePercent": 3,
          "path": ["0xBB4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", "0x477bC8d23c634C154061869478bce96BE6045D12"]
        }' \
    http://localhost:3002/pancake-estimate-buy-cost
  ```

- **Estimate BNB → Token Buy on BSC with Shorter Path:**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{
          "chain": "BSC",
          "tokenAddress": "0x477bC8d23c634C154061869478bce96BE6045D12",
          "amountInBnb": "0.01",
          "slippagePercent": 3
        }' \
    http://localhost:3002/pancake-estimate-buy-cost
  ```

**Expected Response:**

```json
{
  "message": "Estimated PancakeSwap Buy cost",
  "estimate": {
    "gasEstimate": "200000",
    "gasPrice": "50000000000",
    "totalCostWei": "10000000000000",
    "amountOutMin": "1000.000000000000000000",
    "amountOutEstimate": "1050.000000000000000000",
    "totalCostBnb": "0.010000000000000000"
  }
}
```

**Response Fields:**

- **`gasEstimate`**: Estimated gas units required for the transaction.
- **`gasPrice`**: Current gas price in wei.
- **`totalCostWei`**: Total gas cost in wei (`gasEstimate * gasPrice`).
- **`amountOutMin`**: Minimum tokens expected after slippage.
- **`amountOutEstimate`**: Estimated tokens to receive without considering slippage.
- **`totalCostBnb`**: Total gas cost in BNB (converted from wei).

**Notes:**

- Replace `"0x477bC8d23c634C154061869478bce96BE6045D12"` with your target token's contract address.
- Ensure that the `path` array starts with WBNB and ends with the target token.
- Adjust `slippagePercent` based on your tolerance for price movement.

---

### 2.6 **Estimate Sell Transaction Cost (`/pancake-estimate-sell-cost`)**

**Endpoint:**

```
POST /pancake-estimate-sell-cost
```

**Description:**
Estimates the gas cost and potential output for a sell operation on PancakeSwap without executing the transaction.

**Request Payload:**

```json
{
  "chain": "BSC",
  "tokenAddress": "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
  "amountInTokens": "3.5",
  "slippagePercent": 3
}
```

**Parameters:**

- **`chain`** (string, required): The blockchain network identifier (e.g., `"BSC"`).
- **`tokenAddress`** (string, required): The ERC20 token contract address you intend to sell.
- **`amountInTokens`** (string or number, required): The amount of tokens to sell (in token units, considering decimals).
- **`slippagePercent`** (number, optional): Maximum acceptable slippage percentage (default is `3`).
- **`path`** (array of strings, optional): An array of token addresses representing the swap path. Typically starts with the token to sell and ends with WBNB.

**🔹 Example cURL Commands:**

- **Estimate Token → BNB Sell on BSC:**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{
          "chain": "BSC",
          "tokenAddress": "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
          "amountInTokens": "3.5",
          "slippagePercent": 3
        }' \
    http://localhost:3002/pancake-estimate-sell-cost
  ```

**Expected Response:**

```json
{
  "message": "Estimated PancakeSwap Sell cost",
  "estimate": {
    "gasEstimate": "200000",
    "gasPrice": "50000000000",
    "totalCostWei": "10000000000000",
    "amountOutMin": "0.495000000000000000",
    "amountOutEstimate": "0.515000000000000000",
    "totalCostBnb": "0.010000000000000000"
  }
}
```

**Response Fields:**

- **`gasEstimate`**: Estimated gas units required for the transaction.
- **`gasPrice`**: Current gas price in wei.
- **`totalCostWei`**: Total gas cost in wei (`gasEstimate * gasPrice`).
- **`amountOutMin`**: Minimum BNB expected after slippage.
- **`amountOutEstimate`**: Estimated BNB to receive without considering slippage.
- **`totalCostBnb`**: Total gas cost in BNB (converted from wei).

**Notes:**

- Replace `"0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82"` with the token you intend to sell.
- Ensure that the `path` array starts with your input token and ends with WBNB.
- Adjust `slippagePercent` based on your tolerance for price movement.

---

### 2.7 **Estimate Swap Cost (`/pancake-estimate-swap-cost`)**

**Endpoint:**

```
POST /pancake-estimate-swap-cost
```

**Description:**
Estimates the gas cost and expected output for a token-to-token swap on PancakeSwap without executing the transaction.

**Request Payload:**

```json
{
  "chain": "BSC",
  "tokenIn": "0xYourInputTokenOnBSC",
  "tokenOut": "0xYourOutputTokenOnBSC",
  "amountInTokens": "200",
  "slippagePercent": 3,
  "path": [
    "0xYourInputTokenOnBSC",
    "0xIntermediateTokenOnBSC",
    "0xYourOutputTokenOnBSC"
  ]
}
```

**Parameters:**

- **`chain`** (string, required): The blockchain network identifier (e.g., `"BSC"`).
- **`tokenIn`** (string, required): The address of the input ERC20 token.
- **`tokenOut`** (string, required): The address of the output ERC20 token.
- **`amountInTokens`** (string or number, required): The amount of input tokens to swap.
- **`slippagePercent`** (number, optional): Maximum acceptable slippage percentage (default is `3`).
- **`path`** (array of strings, optional): An array of token addresses representing the swap path. Typically starts with the input token and ends with the output token, including any intermediary tokens.

**🔹 Example cURL Commands:**

- **Estimate Token-to-Token Swap on BSC with Default Path and Fee:**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{
          "chain": "BSC",
          "tokenIn": "0xYourInputTokenOnBSC",
          "tokenOut": "0xYourOutputTokenOnBSC",
          "amountInTokens": "200",
          "slippagePercent": 3,
          "path": ["0xYourInputTokenOnBSC", "0xIntermediateTokenOnBSC", "0xYourOutputTokenOnBSC"]
        }' \
    http://localhost:3002/pancake-estimate-swap-cost
  ```

- **Estimate Token-to-Token Swap on BSC with Custom Path and Fee:**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{
          "chain": "BSC",
          "tokenIn": "0xYourInputTokenOnBSC",
          "tokenOut": "0xYourOutputTokenOnBSC",
          "amountInTokens": "50",
          "slippagePercent": 5,
          "path": ["0xYourInputTokenOnBSC", "0xIntermediateTokenAddress", "0xYourOutputTokenOnBSC"]
        }' \
    http://localhost:3002/pancake-estimate-swap-cost
  ```

**Expected Response:**

```json
{
  "message": "Estimated PancakeSwap Swap cost",
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

- **Slippage:**

  - A slippage of `3%` is standard, but adjust based on your tolerance for price movement.

- **Gas Management:**
  - Monitor current gas prices to ensure accurate estimations.

---

## 🔧 **3. Additional Tips**

### A. **Replace Placeholder Values**

Ensure you replace all placeholder values with actual data:

- **`0xYourTokenAddressHere`**: Replace with the actual contract address of the token you wish to interact with.
- **`0xYourOutputTokenAddressHere`**: Replace with the actual contract address of the token you wish to receive.
- **`0xYourInputTokenOnBSC`** and **`0xYourOutputTokenOnBSC`**: Replace with the actual contract addresses on BSC.
- **`0xIntermediateTokenOnBSC`**: If your swap path includes intermediary tokens, replace with their actual contract addresses.
- **`0xYourTransactionHash`**: Transaction hashes will be returned after successful transactions. They can be used to track the transaction on a blockchain explorer (e.g., [BscScan](https://bscscan.com/)).
- **`YOUR_RPC_URL`** and **`YOUR_PRIVATE_KEY`**: Ensure these are securely stored in your `.env` file and **never** exposed publicly.

### B. **Handling Decimals**

The current implementation assumes that tokens have **18 decimals**. If you're interacting with tokens that have different decimals, adjust the `amountInTokens` and related calculations accordingly.

### C. **Gas Management**

- **Gas Limit:**
  The service sets a default gas limit (e.g., `500000`). Depending on the tokens and network conditions, you might need to adjust this value in your service configuration.

- **Gas Price:**
  Monitor the current gas prices on the network to ensure transactions are processed promptly without overpaying.

### D. **Slippage Considerations**

- **Market Conditions:**
  High volatility tokens might require higher slippage percentages to execute transactions successfully.

- **Liquidity Pools:**
  Ensure that sufficient liquidity exists in the pools to handle your swap amounts, reducing the impact of slippage.

### E. **Approval Steps**

- **Approval Steps:**
  Always ensure that the tokens you're swapping are approved for the PancakeSwap router. Use the `/pancake-approve` endpoint before attempting to buy, sell, or swap tokens.

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

  - **Solution:** Ensure that the wallet has enough BNB or tokens to perform the swap, including gas fees.

- **Error:** `exceeds the maximum allowed gas`
  - **Solution:** Adjust the `GAS_BUFFER_PERCENT` in your `.env` file or review the swap parameters to reduce gas consumption.

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
    - Verify that the pool exists for the specified path.
    - Ensure that the `amountIn` does not exceed your token balance.

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
   # PancakeSwap V2 Configurations
   PANCAKE_RPC_URL_BSC=your_bsc_rpc_url
   PANCAKE_PRIVATE_KEY_BSC=your_bsc_private_key
   PANCAKE_WBNB_ADDRESS_BSC=0xBB4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c
   PANCAKE_ROUTER_ADDRESS_BSC=0x10ED43C718714eb63d5aA57B78B54704E256024E
   PANCAKE_FACTORY_ADDRESS_BSC=0xBCfCcbde45cE874adCB698cC183deBcF17952812
   PANCAKE_PORT=3002

   GAS_BUFFER_PERCENT=100
   ```

2. **Start the Server:**

   ```bash
   node index.js
   ```

   You should see output similar to:

   ```
   Initialized PancakeSwap contracts for BSC
   PancakeSwap Service running on port 3002
   Endpoints:
     - POST /pancake-approve
     - POST /pancake-buy
     - POST /pancake-sell
     - POST /pancake-estimate-buy-cost
     - POST /pancake-estimate-sell-cost
     - POST /pancake-swap
     - POST /pancake-estimate-swap-cost
   ```

3. **Perform Swaps and Estimates:**

   Use the provided `curl` commands to interact with the endpoints. Ensure that you replace placeholder addresses (e.g., `"0xYourTokenAddressHere"`) with actual token contract addresses relevant to your swaps.

---

## 📈 **Best Practices**

- **Start with Small Amounts:**
  When testing new swaps, begin with smaller amounts to ensure transactions execute as expected without incurring significant costs.

- **Monitor Gas Prices:**
  Gas prices can fluctuate significantly. Adjust your `gasPrice` settings or implement dynamic gas price fetching based on network conditions.

- **Handle Fees and Taxes:**
  Some tokens have transfer fees or taxes. Ensure your bot accounts for these by adjusting `slippagePercent` or implementing additional logic as needed.

- **Keep Dependencies Updated:**
  Regularly update your dependencies, especially `ethers.js`, to benefit from the latest features and security patches.

- **Secure Your Environment:**
  Always keep your `.env` file secure and avoid exposing sensitive information. Consider using secret management tools for enhanced security.

- **Use Appropriate Paths:**
  Select swap paths that optimize for liquidity and minimize slippage. Including intermediary tokens can sometimes provide better rates but may increase gas costs.

- **Implement Robust Error Handling:**
  Ensure that your application gracefully handles errors and provides meaningful feedback to users to facilitate troubleshooting.
