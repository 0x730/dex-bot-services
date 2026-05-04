# 🥞 **PancakeSwap V3 Multi-Chain DEX Bot Documentation**

This documentation provides `cURL` examples and detailed explanations for all endpoints defined in the **PancakeSwap V3** bot. Adjust `localhost:3003` and the parameters as needed based on your deployment setup.

---

## 📢 **Important Notes**

- **Chain Parameter:** Each request requires a `"chain"` parameter (e.g., `"BSC"`) to select the desired blockchain network's configuration.

- **Environment Setup:** Ensure that your `.env` file and chain configurations are correctly set up. The tokens involved in the swaps must exist on the chosen chain.

- **Approval Requirement:** Before performing any token swaps or sells, ensure that the router has sufficient allowance to spend the tokens. Use the respective `/pancake-v3-approve` endpoint as needed.

---

## 📝 **Table of Contents**

1. [Prerequisites](#1-prerequisites)
2. [Endpoints](#2-endpoints)
   - [1. Approve Token (`/pancake-v3-approve`)](#1-approve-token-pancake-v3-approve)
   - [2. Buy Token (`/pancake-v3-buy`)](#2-buy-token-pancake-v3-buy)
   - [3. Sell Token (`/pancake-v3-sell`)](#3-sell-token-pancake-v3-sell)
   - [4. Estimate Buy Transaction Cost (`/pancake-v3-estimate-buy-cost`)](#4-estimate-buy-transaction-cost-pancake-v3-estimate-buy-cost)
   - [5. Estimate Sell Transaction Cost (`/pancake-v3-estimate-sell-cost`)](#5-estimate-sell-transaction-cost-pancake-v3-estimate-sell-cost)
   - [6. Swap Tokens (`/pancake-v3-swap`)](#6-swap-tokens-pancake-v3-swap)
   - [7. Estimate Swap Cost (`/pancake-v3-estimate-swap-cost`)](#7-estimate-swap-cost-pancake-v3-estimate-swap-cost)
3. [Additional Tips](#3-additional-tips)
4. [Security Best Practices](#4-security-best-practices)
5. [Troubleshooting](#5-troubleshooting)
6. [Support](#6-support)

---

## 🛠️ **1. Prerequisites**

Before interacting with the PancakeSwap V3 endpoints, ensure the following:

1. **cURL Installed:**
   Ensure that you have `cURL` installed on your system. Verify by running:

   ```bash
   curl --version
   ```

   If not installed, download it from [cURL's official website](https://curl.se/download.html) or install via your package manager.

2. **Service Running:**
   Make sure your PancakeSwap V3 service (`pancake-v3.js`) is running and accessible at the specified port (e.g., `http://localhost:3003`).

3. **Valid Environment Configuration:**
   Ensure your `.env` file is correctly configured with all necessary variables for the supported chains (e.g., `BSC`). Example:

   ```env
   # PancakeSwap V3 Configurations
   PANCAKE_V3_RPC_URL_BSC=your_bsc_rpc_url
   PANCAKE_V3_PRIVATE_KEY_BSC=your_bsc_private_key
   PANCAKE_V3_WBNB_ADDRESS_BSC=0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c
   PANCAKE_V3_ROUTER_ADDRESS_BSC=0xYourPancakeV3RouterAddress
   PANCAKE_V3_QUOTER_ADDRESS_BSC=0xYourPancakeV3QuoterAddress
   PANCAKE_V3_MAX_GAS_BSC=200000
   PANCAKE_V3_PORT=3003

   GAS_BUFFER_PERCENT=10
   ```

---

## 🚀 **2. Endpoints**

### 2.1 **1. Approve Token (`/pancake-v3-approve`)**

**Endpoint:**

```
POST /pancake-v3-approve
```

**Description:**
Approves the PancakeSwap V3 router to spend a specified amount of a token on behalf of your wallet.

**Request Payload:**

```json
{
  "chain": "BSC",
  "tokenAddress": "0xYourTokenAddressHere",
  "amount": "1000"
}
```

**Parameters:**

| Field            | Description                                                                             |
| ---------------- | --------------------------------------------------------------------------------------- |
| **chain**        | Blockchain network, e.g., `"BSC"`.                                                      |
| **tokenAddress** | The contract address of the ERC20 token to approve.                                     |
| **amount**       | The amount to approve (in decimal units, e.g., `"1000"` if the token uses 18 decimals). |

**🔹 Example cURL Command:**

- **Approve WBNB on BSC:**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{
          "chain": "BSC",
          "tokenAddress": "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
          "amount": "5000"
        }' \
    http://localhost:3003/pancake-v3-approve
  ```

**Expected Response:**

```json
{
  "message": "Pancake V3 Approve successful"
}
```

**Notes:**

- Replace `"0xYourTokenAddressHere"` with the actual token contract address you intend to approve.
- Ensure that the `amount` is specified in the token's standard units (the service handles decimal conversions based on the token's decimals).
- You **must** approve the router before attempting to buy, sell, or swap tokens.

---

### 2.2 **2. Buy Token (`/pancake-v3-buy`)**

**Endpoint:**

```
POST /pancake-v3-buy
```

**Description:**
Swaps BNB for a specified token using PancakeSwap V3’s `exactInputSingle` method.

**Request Payload:**

```json
{
  "chain": "BSC",
  "tokenAddress": "0xYourTokenAddressHere",
  "amountInBnb": "0.3",
  "slippagePercent": 3,
  "fee": 500,
  "path": [
    "0xBB4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    "0xYourTokenAddressHere"
  ]
}
```

**Parameters:**

| Field               | Description                                                                             |
| ------------------- | --------------------------------------------------------------------------------------- |
| **chain**           | Blockchain network, e.g., `"BSC"`.                                                      |
| **tokenAddress**    | The token contract address you want to purchase.                                        |
| **amountInBnb**     | Amount of BNB to spend (in decimal form).                                               |
| **slippagePercent** | Maximum acceptable slippage, e.g., `3` means up to 3% slippage.                         |
| **fee**             | The fee tier for the pool, e.g., `500` for 0.05%. Default is typically `3000` for 0.3%. |
| **path**            | Swap path array. Typically `[WBNB, tokenAddress]` for a direct BNB→Token swap.          |

**🔹 Example cURL Commands:**

- **Buy Token with Default Path and Fee on BSC:**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{
          "chain": "BSC",
          "tokenAddress": "0xYourTokenAddressHere",
          "amountInBnb": "0.3",
          "slippagePercent": 3,
          "fee": 500,
          "path": [
            "0xBB4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
            "0xYourTokenAddressHere"
          ]
        }' \
    http://localhost:3003/pancake-v3-buy
  ```

- **Buy Token with Custom Fee on BSC:**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{
          "chain": "BSC",
          "tokenAddress": "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
          "amountInBnb": "0.003",
          "slippagePercent": 0.2,
          "fee": 500,
          "path": [
            "0xBB4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
            "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82"
          ]
        }' \
    http://localhost:3003/pancake-v3-buy
  ```

**Expected Response:**

```json
{
  "message": "Pancake V3 Buy successful",
  "txHash": "0xYourTransactionHash",
  "finalBalance": "1050.000000000000000000",
  "amount": "1050.000000000000000000"
}
```

**Response Fields:**

| Field            | Description                                                   |
| ---------------- | ------------------------------------------------------------- |
| **message**      | Confirmation message indicating success.                      |
| **txHash**       | Transaction hash, usable to track the transaction on BscScan. |
| **finalBalance** | The final balance of the purchased token after the swap.      |
| **amount**       | The amount of tokens received from the swap.                  |

**Notes:**

- **Path:** Ensure that the first address is WBNB (`0xBB4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c` on BSC) and the second is the token you wish to buy.
- **Slippage:** A slippage of `3%` is standard, but adjust based on market conditions and your tolerance for price movement.
- **Fee Tier:** Select the appropriate fee tier (`500`, `3000`, `10000`) based on pool liquidity and desired price impact. Lower fees are suitable for stablecoin pairs or highly liquid tokens.
- **Gas Limit:** The service sets a default gas limit (`200000`). Depending on the token and network conditions, you might need to adjust this value in your `.env` file.

---

### 2.3 **3. Sell Token (`/pancake-v3-sell`)**

**Endpoint:**

```
POST /pancake-v3-sell
```

**Description:**
Swaps a specified ERC20 token for BNB using PancakeSwap V3’s `exactInputSingle` method.

**Request Payload:**

```json
{
  "chain": "BSC",
  "tokenAddress": "0xYourTokenAddressHere",
  "amountInTokens": "500",
  "slippagePercent": 3,
  "fee": 500,
  "path": [
    "0xYourTokenAddressHere",
    "0xBB4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c"
  ]
}
```

**Parameters:**

| Field               | Description                                                                             |
| ------------------- | --------------------------------------------------------------------------------------- |
| **chain**           | Blockchain network, e.g., `"BSC"`.                                                      |
| **tokenAddress**    | The token contract address you want to sell.                                            |
| **amountInTokens**  | Amount of the token to sell (in decimal units, considering decimals).                   |
| **slippagePercent** | Maximum acceptable slippage, e.g., `3` means up to 3% slippage.                         |
| **fee**             | The fee tier for the pool, e.g., `500` for 0.05%. Default is typically `3000` for 0.3%. |
| **path**            | Swap path array. Typically `[tokenAddress, WBNB]` for a direct Token→BNB swap.          |

**🔹 Example cURL Commands:**

- **Sell Token with Default Path and Fee on BSC:**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{
          "chain": "BSC",
          "tokenAddress": "0xYourTokenAddressHere",
          "amountInTokens": "500",
          "slippagePercent": 3,
          "fee": 500,
          "path": [
            "0xYourTokenAddressHere",
            "0xBB4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c"
          ]
        }' \
    http://localhost:3003/pancake-v3-sell
  ```

- **Sell Token with Custom Fee on BSC:**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{
          "chain": "BSC",
          "tokenAddress": "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
          "amountInTokens": "0.75",
          "slippagePercent": 3,
          "fee": 500,
          "path": [
            "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
            "0xBB4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c"
          ]
        }' \
    http://localhost:3003/pancake-v3-sell
  ```

**Expected Response:**

```json
{
  "message": "Pancake V3 Sell successful",
  "txHash": "0xYourTransactionHash",
  "amount": "0.515000000000000000"
}
```

**Response Fields:**

| Field       | Description                                                   |
| ----------- | ------------------------------------------------------------- |
| **message** | Confirmation message indicating success.                      |
| **txHash**  | Transaction hash, usable to track the transaction on BscScan. |
| **amount**  | The amount of BNB received from the swap.                     |

**Notes:**

- **Path:** Ensure that the first address is the token you wish to sell and the second is WBNB.
- **Slippage:** A slippage of `3%` is standard, but adjust based on market conditions and your tolerance for price movement.
- **Fee Tier:** Select the appropriate fee tier (`500`, `3000`, `10000`) based on pool liquidity and desired price impact. Lower fees are suitable for stablecoin pairs or highly liquid tokens.
- **Gas Limit:** The service sets a default gas limit (`200000`). Depending on the token and network conditions, you might need to adjust this value in your `.env` file.

---

### 2.4 **4. Estimate Buy Transaction Cost (`/pancake-v3-estimate-buy-cost`)**

**Endpoint:**

```
POST /pancake-v3-estimate-buy-cost
```

**Description:**
Estimates the gas cost and potential output for a buy operation on PancakeSwap V3 without executing the transaction.

**Request Payload:**

```json
{
  "chain": "BSC",
  "tokenAddress": "0xYourTokenAddressHere",
  "amountInBnb": "0.3",
  "slippagePercent": 3,
  "fee": 500,
  "path": [
    "0xBB4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    "0xYourTokenAddressHere"
  ]
}
```

**Parameters:**

| Field               | Description                                                                             |
| ------------------- | --------------------------------------------------------------------------------------- |
| **chain**           | Blockchain network, e.g., `"BSC"`.                                                      |
| **tokenAddress**    | The ERC20 token contract address you intend to buy.                                     |
| **amountInBnb**     | Amount of BNB to spend (in decimal units).                                              |
| **slippagePercent** | Desired slippage percentage, e.g., `3` for 3%.                                          |
| **fee**             | The fee tier for the pool, e.g., `500` for 0.05%. Default is typically `3000` for 0.3%. |
| **path**            | Swap path array. Typically `[WBNB, tokenAddress]` for a direct BNB→Token swap.          |

**🔹 Example cURL Commands:**

- **Estimate BNB → Token Buy on BSC:**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{
          "chain": "BSC",
          "tokenAddress": "0x477bC8d23c634C154061869478bce96BE6045D12",
          "amountInBnb": "0.3",
          "slippagePercent": 3,
          "fee": 500,
          "path": [
            "0xBB4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
            "0x477bC8d23c634C154061869478bce96BE6045D12"
          ]
        }' \
    http://localhost:3003/pancake-v3-estimate-buy-cost
  ```

- **Estimate BNB → Token Buy on BSC with Custom Fee:**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{
          "chain": "BSC",
          "tokenAddress": "0x477bC8d23c634C154061869478bce96BE6045D12",
          "amountInBnb": "0.005",
          "slippagePercent": 3,
          "fee": 100,
          "path": [
            "0xBB4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
            "0x477bC8d23c634C154061869478bce96BE6045D12"
          ]
        }' \
    http://localhost:3003/pancake-v3-estimate-buy-cost
  ```

**Expected Response:**

```json
{
  "message": "Estimated PancakeSwap V3 Buy cost",
  "estimate": {
    "gasEstimate": "200000",
    "gasPrice": "5000000000",
    "totalCostWei": "1000000000000000",
    "amountOutMin": "12.345678",
    "amountOutEstimate": "12.765432",
    "totalCostBnb": "0.001"
  }
}
```

**Response Fields:**

| Field                 | Description                                               |
| --------------------- | --------------------------------------------------------- |
| **gasEstimate**       | Estimated gas units required for the transaction.         |
| **gasPrice**          | Current gas price in wei.                                 |
| **totalCostWei**      | Total gas cost in wei (`gasEstimate * gasPrice`).         |
| **amountOutMin**      | Minimum tokens expected after slippage.                   |
| **amountOutEstimate** | Estimated tokens to receive without considering slippage. |
| **totalCostBnb**      | Total gas cost in BNB (converted from wei).               |

**Notes:**

- Replace `"0x477bC8d23c634C154061869478bce96BE6045D12"` with your target token's contract address.
- Ensure that the `path` array starts with WBNB and ends with the target token.
- Adjust `slippagePercent` based on your tolerance for price movement.
- The `fee` parameter should match the fee tier of the liquidity pool you intend to interact with.
- **Gas Estimates:** The current implementation may use placeholder values for `gasEstimate`, `gasPrice`, and `totalCostBnb`. For accurate estimations, ensure your service dynamically calculates these based on current network conditions.

---

### 2.5 **5. Estimate Sell Transaction Cost (`/pancake-v3-estimate-sell-cost`)**

**Endpoint:**

```
POST /pancake-v3-estimate-sell-cost
```

**Description:**
Estimates the gas cost and potential output for a sell operation on PancakeSwap V3 without executing the transaction.

**Request Payload:**

```json
{
  "chain": "BSC",
  "tokenAddress": "0xYourTokenAddressHere",
  "amountInTokens": "500",
  "slippagePercent": 3,
  "fee": 500,
  "path": [
    "0xYourTokenAddressHere",
    "0xBB4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c"
  ]
}
```

**Parameters:**

| Field               | Description                                                                             |
| ------------------- | --------------------------------------------------------------------------------------- |
| **chain**           | Blockchain network, e.g., `"BSC"`.                                                      |
| **tokenAddress**    | The ERC20 token contract address you intend to sell.                                    |
| **amountInTokens**  | The amount of tokens to sell (in decimal units, considering decimals).                  |
| **slippagePercent** | Desired slippage percentage, e.g., `3` for 3%.                                          |
| **fee**             | The fee tier for the pool, e.g., `500` for 0.05%. Default is typically `3000` for 0.3%. |
| **path**            | Swap path array. Typically `[tokenAddress, WBNB]` for a direct Token→BNB swap.          |

**🔹 Example cURL Commands:**

- **Estimate Token → BNB Sell on BSC:**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{
          "chain": "BSC",
          "tokenAddress": "0xYourTokenAddressHere",
          "amountInTokens": "500",
          "slippagePercent": 3,
          "fee": 500,
          "path": [
            "0xYourTokenAddressHere",
            "0xBB4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c"
          ]
        }' \
    http://localhost:3003/pancake-v3-estimate-sell-cost
  ```

- **Estimate Token → BNB Sell on BSC with Custom Fee:**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{
          "chain": "BSC",
          "tokenAddress": "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
          "amountInTokens": "0.75",
          "slippagePercent": 3,
          "fee": 500,
          "path": [
            "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
            "0xBB4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c"
          ]
        }' \
    http://localhost:3003/pancake-v3-estimate-sell-cost
  ```

**Expected Response:**

```json
{
  "message": "Estimated PancakeSwap V3 Sell cost",
  "estimate": {
    "gasEstimate": "200000",
    "gasPrice": "5000000000",
    "totalCostWei": "1000000000000000",
    "amountOutMin": "0.299000",
    "amountOutEstimate": "0.300000",
    "totalCostBnb": "0.001"
  }
}
```

**Response Fields:**

| Field                 | Description                                            |
| --------------------- | ------------------------------------------------------ |
| **gasEstimate**       | Estimated gas units required for the transaction.      |
| **gasPrice**          | Current gas price in wei.                              |
| **totalCostWei**      | Total gas cost in wei (`gasEstimate * gasPrice`).      |
| **amountOutMin**      | Minimum BNB expected after slippage.                   |
| **amountOutEstimate** | Estimated BNB to receive without considering slippage. |
| **totalCostBnb**      | Total gas cost in BNB (converted from wei).            |

**Notes:**

- Replace `"0xYourTokenAddressHere"` with the token you intend to sell.
- Ensure that the `path` array starts with your input token and ends with WBNB.
- Adjust `slippagePercent` based on your tolerance for price movement.
- The `fee` parameter should match the fee tier of the liquidity pool you intend to interact with.
- **Gas Estimates:** The current implementation may use placeholder values for `gasEstimate`, `gasPrice`, and `totalCostBnb`. For accurate estimations, ensure your service dynamically calculates these based on current network conditions.

---

### 2.6 **6. Swap Tokens (`/pancake-v3-swap`)**

**Endpoint:**

```
POST /pancake-v3-swap
```

**Description:**
Performs a token-to-token swap on PancakeSwap V3, exchanging a specified amount of input tokens for output tokens, considering slippage.

**Request Payload:**

```json
{
  "chain": "BSC",
  "tokenIn": "0xYourInputTokenOnBSC",
  "tokenOut": "0xYourOutputTokenOnBSC",
  "amountInTokens": "200",
  "slippagePercent": 3,
  "fee": 500,
  "path": [
    "0xYourInputTokenOnBSC",
    "0xIntermediateTokenOnBSC",
    "0xYourOutputTokenOnBSC"
  ]
}
```

**Parameters:**

| Field               | Description                                                                               |
| ------------------- | ----------------------------------------------------------------------------------------- |
| **chain**           | Blockchain network, e.g., `"BSC"`.                                                        |
| **tokenIn**         | The address of the input ERC20 token.                                                     |
| **tokenOut**        | The address of the output ERC20 token.                                                    |
| **amountInTokens**  | The amount of input tokens to swap (in decimal units, considering decimals).              |
| **slippagePercent** | Maximum acceptable slippage, e.g., `3` means up to 3% slippage.                           |
| **fee**             | The fee tier for the pool, e.g., `500` for 0.05%. Default is typically `3000` for 0.3%.   |
| **path**            | Swap path array. Typically `[tokenIn, intermediateToken, tokenOut]` for a multi-hop swap. |

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
          "fee": 500,
          "path": [
            "0xYourInputTokenOnBSC",
            "0xIntermediateTokenOnBSC",
            "0xYourOutputTokenOnBSC"
          ]
        }' \
    http://localhost:3003/pancake-v3-swap
  ```

- **Token-to-Token Swap on BSC with Custom Fee and Path:**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{
          "chain": "BSC",
          "tokenIn": "0xYourInputTokenOnBSC",
          "tokenOut": "0xYourOutputTokenOnBSC",
          "amountInTokens": "50",
          "slippagePercent": 5,
          "fee": 3000,
          "path": [
            "0xYourInputTokenOnBSC",
            "0xIntermediateTokenAddress",
            "0xYourOutputTokenOnBSC"
          ]
        }' \
    http://localhost:3003/pancake-v3-swap
  ```

**Expected Response:**

```json
{
  "message": "Pancake V3 Swap successful",
  "txHash": "0xYourTransactionHash",
  "amountOutMin": "12.345678",
  "amountOutEstimate": "12.765432",
  "amountReceived": "12.765432"
}
```

**Response Fields:**

| Field                 | Description                                                   |
| --------------------- | ------------------------------------------------------------- |
| **message**           | Confirmation message indicating success.                      |
| **txHash**            | Transaction hash, usable to track the transaction on BscScan. |
| **amountOutMin**      | Minimum tokens expected after slippage.                       |
| **amountOutEstimate** | Estimated tokens to receive without considering slippage.     |
| **amountReceived**    | The actual amount of tokens received from the swap.           |

**Notes:**

- **Path:**

  - Ensure the `path` array starts with `tokenIn` and ends with `tokenOut`, including any intermediary tokens if necessary.

- **Slippage:**

  - A slippage of `3%` is standard, but adjust based on market conditions and your tolerance for price movement.

- **Fee Tier:**

  - Select the appropriate fee tier (`500`, `3000`, `10000`) based on pool liquidity and desired price impact. Lower fees are suitable for stablecoin pairs or highly liquid tokens.

- **Gas Limit:**

  - The service sets a default gas limit (`200000`). Depending on the tokens and network conditions, you might need to adjust this value in your `.env` file.

- **Transaction Hash:**
  - The `txHash` can be used to track the transaction on a blockchain explorer (e.g., [BscScan](https://bscscan.com/)).

---

### 2.7 **7. Estimate Swap Cost (`/pancake-v3-estimate-swap-cost`)**

**Endpoint:**

```
POST /pancake-v3-estimate-swap-cost
```

**Description:**
Estimates the gas cost and expected output for a token-to-token swap on PancakeSwap V3 without executing the transaction.

**Request Payload:**

```json
{
  "chain": "BSC",
  "tokenIn": "0xYourInputTokenOnBSC",
  "tokenOut": "0xYourOutputTokenOnBSC",
  "amountInTokens": "200",
  "slippagePercent": 3,
  "fee": 500,
  "path": [
    "0xYourInputTokenOnBSC",
    "0xIntermediateTokenOnBSC",
    "0xYourOutputTokenOnBSC"
  ]
}
```

**Parameters:**

| Field               | Description                                                                               |
| ------------------- | ----------------------------------------------------------------------------------------- |
| **chain**           | Blockchain network, e.g., `"BSC"`.                                                        |
| **tokenIn**         | The address of the input ERC20 token.                                                     |
| **tokenOut**        | The address of the output ERC20 token.                                                    |
| **amountInTokens**  | The amount of input tokens to swap (in decimal units, considering decimals).              |
| **slippagePercent** | Maximum acceptable slippage, e.g., `3` means up to 3% slippage.                           |
| **fee**             | The fee tier for the pool, e.g., `500` for 0.05%. Default is typically `3000` for 0.3%.   |
| **path**            | Swap path array. Typically `[tokenIn, intermediateToken, tokenOut]` for a multi-hop swap. |

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
          "fee": 500,
          "path": [
            "0xYourInputTokenOnBSC",
            "0xIntermediateTokenOnBSC",
            "0xYourOutputTokenOnBSC"
          ]
        }' \
    http://localhost:3003/pancake-v3-estimate-swap-cost
  ```

- **Estimate Token-to-Token Swap on BSC with Custom Fee and Path:**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{
          "chain": "BSC",
          "tokenIn": "0xYourInputTokenOnBSC",
          "tokenOut": "0xYourOutputTokenOnBSC",
          "amountInTokens": "50",
          "slippagePercent": 5,
          "fee": 3000,
          "path": [
            "0xYourInputTokenOnBSC",
            "0xIntermediateTokenAddress",
            "0xYourOutputTokenOnBSC"
          ]
        }' \
    http://localhost:3003/pancake-v3-estimate-swap-cost
  ```

**Expected Response:**

```json
{
  "message": "Estimated PancakeSwap V3 Swap outcome",
  "estimate": {
    "gasEstimate": "200000",
    "gasPrice": "5000000000",
    "totalCostWei": "1000000000000000",
    "amountOutMin": "12.345678",
    "amountOutEstimate": "12.765432",
    "totalCostBnb": "0.001"
  }
}
```

**Response Fields:**

| Field                 | Description                                                      |
| --------------------- | ---------------------------------------------------------------- |
| **gasEstimate**       | Estimated gas units required for the transaction.                |
| **gasPrice**          | Current gas price in wei.                                        |
| **totalCostWei**      | Total gas cost in wei (`gasEstimate * gasPrice`).                |
| **amountOutMin**      | Minimum output tokens expected after slippage.                   |
| **amountOutEstimate** | Estimated output tokens to receive without considering slippage. |
| **totalCostBnb**      | Total gas cost in BNB (converted from wei).                      |

**Notes:**

- **Path:**

  - Ensure the `path` array starts with `tokenIn` and ends with `tokenOut`, including any intermediary tokens if necessary.

- **Slippage:**

  - A slippage of `3%` is standard, but adjust based on your tolerance for price movement.

- **Fee Tier:**

  - Select the appropriate fee tier (`500`, `3000`, `10000`) based on pool liquidity and desired price impact. Lower fees are suitable for stablecoin pairs or highly liquid tokens.

- **Gas Management:**

  - Monitor current gas prices to ensure accurate estimations.

- **Transaction Limits:**
  - The service sets a default gas limit (`200000`). Ensure that the estimated gas does not exceed the `PANCAKE_V3_MAX_GAS_BSC` defined in your `.env` file to prevent transaction failures.

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

The current implementation assumes that tokens have **18 decimals**. If you're interacting with tokens that have different decimals, adjust the `amountIn`, `amountInTokens`, and related calculations accordingly. The service dynamically fetches token decimals, but ensure your input values correspond to standard decimal representations.

### C. **Fee Tiers**

PancakeSwap V3 introduces multiple fee tiers (e.g., `500` for 0.05%, `3000` for 0.3%, `10000` for 1%). Select the appropriate fee tier based on:

- **Pool Liquidity:** Higher liquidity pools often have lower fees.
- **Token Volatility:** More volatile tokens might benefit from higher fee tiers to compensate liquidity providers.

### D. **Gas Management**

- **Gas Limit:**
  The service sets a default gas limit (e.g., `200000`). Depending on the tokens and network conditions, you might need to adjust this value in your `.env` file (`PANCAKE_V3_MAX_GAS_BSC`).

- **Gas Price:**
  Monitor the current gas prices on the network to ensure transactions are processed promptly without overpaying.

### E. **Slippage Considerations**

- **Market Conditions:**
  High volatility tokens might require higher slippage percentages to execute transactions successfully.

- **Liquidity Pools:**
  Ensure that sufficient liquidity exists in the pools to handle your swap amounts, reducing the impact of slippage.

### F. **Approval Steps**

- **Approval Steps:**
  Always ensure that the tokens you're swapping are approved for the PancakeSwap V3 router. Use the `/pancake-v3-approve` endpoint before attempting to buy, sell, or swap tokens.

- **Transaction Tracking:**
  Use the returned `txHash` to monitor your transactions on blockchain explorers.

### G. **Using Multi-Hop Swaps**

Including intermediary tokens in your swap path can sometimes provide better rates or access to pools with higher liquidity. However, this can also increase gas costs and potential points of failure. Always verify the swap path and ensure that each step in the path has sufficient liquidity.

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
  - **Solution:** Adjust the `PANCAKE_V3_MAX_GAS_BSC` in your `.env` file or review the swap parameters to reduce gas consumption.

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
    - Verify that the pool exists for the specified path and fee tier.
    - Ensure that the `amountInTokens` does not exceed your token balance.

### H. **Timeouts and Delays**

- **Issue:** Transactions taking longer than expected.
  - **Solution:**
    - Check network congestion and adjust gas prices accordingly.
    - Ensure that the deadline parameter is sufficiently extended to accommodate slower block times.

### I. **Quoter Errors**

- **Error:** `Quoter call failed` or similar.
  - **Solution:** Ensure that the quoter address is correct and that the tokens and fee tier specified are supported by existing pools.

---

## 🚀 **Getting Started**

1. **Ensure Environment Variables are Set:**

   Your `.env` file should include configurations for all supported chains. For example:

   ```env
   # PancakeSwap V3 Configurations
   PANCAKE_V3_RPC_URL_BSC=your_bsc_rpc_url
   PANCAKE_V3_PRIVATE_KEY_BSC=your_bsc_private_key
   PANCAKE_V3_WBNB_ADDRESS_BSC=0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c
   PANCAKE_V3_ROUTER_ADDRESS_BSC=0xYourPancakeV3RouterAddress
   PANCAKE_V3_QUOTER_ADDRESS_BSC=0xYourPancakeV3QuoterAddress
   PANCAKE_V3_MAX_GAS_BSC=200000
   PANCAKE_V3_PORT=3003

   GAS_BUFFER_PERCENT=10
   ```

2. **Start the Server:**

   ```bash
   node pancake-v3.js
   ```

   You should see output similar to:

   ```
   Initialized Pancake V3 for chain=bsc
   Pancake V3 Service running on port 3003
   Endpoints:
     - POST /pancake-v3-approve
     - POST /pancake-v3-buy
     - POST /pancake-v3-sell
     - POST /pancake-v3-estimate-buy-cost
     - POST /pancake-v3-estimate-sell-cost
     - POST /pancake-v3-swap
     - POST /pancake-v3-estimate-swap-cost
   ```

3. **Perform Swaps and Estimates:**

   Use the provided `cURL` commands to interact with the endpoints. Ensure that you replace placeholder addresses (e.g., `"0xYourTokenAddressHere"`) with actual token contract addresses relevant to your swaps.

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
