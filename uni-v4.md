# 🌐 **Uniswap V4 Multi-Chain DEX Bot Documentation**

This documentation provides `curl` examples and detailed explanations for all endpoints defined in the multi-chain **Uniswap V4** bot. Adjust `localhost:3004` and the parameters as needed based on your deployment setup.

---

## 📢 **Important Notes**

- **Chain Parameter:** Each request requires a `"chain"` parameter (e.g., `"ethereum"`, `"polygon"`, or `"base"`) to select the desired blockchain network's configuration.

- **Environment Setup:** Ensure that your `.env` file and chain configurations are correctly set up. The tokens involved in the swaps must exist on the chosen chain.

- **Uniswap v4 execution model:** Uniswap v4 swaps are executed via the **Universal Router** (commands/actions) and typically use **Permit2** as the token spender.

- **This service's v4 approach:** This service supports **both** internal route building and relaying pre-built **Universal Router calldata** generated upstream. For standard single-hop swaps (ETH/BNB ↔ Token), you can simply provide parameters like `tokenAddress`, `amountInEth`/`amountInBnb`, and `fee`. For complex paths, provide `calldata`.

---

## 📝 **Table of Contents**

1. [Prerequisites](#1-prerequisites)
2. [Endpoints](#2-endpoints)
   - [1. Approve Tokens (`/approve`)](#1-approve-tokens-approve)
   - [2. Execute Universal Router calldata (`/uni-v4-execute`)](#2-execute-universal-router-calldata-uni-v4-execute)
   - [3. Buy Token (`/uni-v4-buy`)](#23-buy-token-uni-v4-buy)
   - [4. Sell Token (`/uni-v4-sell`)](#24-sell-token-uni-v4-sell)
   - [5. Swap Tokens (`/uni-v4-swap`)](#25-swap-tokens-uni-v4-swap)
   - [6. Estimate Buy Transaction Cost (`/uni-v4-estimate-buy-cost`)](#26-estimate-buy-transaction-cost-uni-v4-estimate-buy-cost)
   - [7. Estimate Sell Transaction Cost (`/uni-v4-estimate-sell-cost`)](#27-estimate-sell-transaction-cost-uni-v4-estimate-sell-cost)
   - [8. Estimate Swap Cost (`/uni-v4-estimate-swap-cost`)](#28-estimate-swap-cost-uni-v4-estimate-swap-cost)
3. [Additional Tips](#3-additional-tips)
4. [Security Best Practices](#4-security-best-practices)
5. [Troubleshooting](#5-troubleshooting)
6. [Support](#6-support)

---

## 🛠️ **1. Prerequisites**

Before interacting with the Uniswap V4 endpoints, ensure the following:

1. **cURL Installed:**
   Ensure that you have `cURL` installed on your system. Verify by running:

   ```bash
   curl --version
   ```

   If not installed, download it from [cURL's official website](https://curl.se/download.html) or install via your package manager.

2. **Service Running:**
   Make sure your Uniswap V4 service (`src/uni-v4.js`) is running and accessible at the specified port (e.g., `http://localhost:3004`).

3. **Valid Environment Configuration:**
   Ensure your `.env` file is correctly configured with all necessary variables for the supported chains (e.g., `ethereum`, `polygon`, `base`). Example:

   ```env
   # Uniswap V4 Configurations
   UNI_V4_RPC_URL_ETHEREUM=your_ethereum_rpc_url
   UNI_V4_PRIVATE_KEY_MAIN_ETHEREUM=your_ethereum_private_key
   # Uniswap Universal Router (used for v4 swaps)
   UNI_V4_ROUTER_ADDRESS_ETHEREUM=0xUniswapUniversalRouterAddress
   UNI_V4_PORT=3004

   UNI_V4_RPC_URL_POLYGON=your_polygon_rpc_url
   UNI_V4_PRIVATE_KEY_MAIN_POLYGON=your_polygon_private_key
   UNI_V4_ROUTER_ADDRESS_POLYGON=0xUniswapUniversalRouterAddress

   UNI_V4_RPC_URL_BASE=your_base_rpc_url
   UNI_V4_PRIVATE_KEY_MAIN_BASE=your_base_private_key
   UNI_V4_ROUTER_ADDRESS_BASE=0xUniswapUniversalRouterAddress

   GAS_BUFFER_PERCENT=10
   ```

---

## 🚀 **2. Endpoints**

### 2.1 **Approve Tokens (`/approve`)**

**Endpoint:**

```
POST /approve
```

**Description:**
Approves a spender to spend a specified amount of a token on behalf of your wallet.

By default, this endpoint approves **Permit2** (`0x000000000022D473030F116dDEE9F6B43aC78BA3`), which is the recommended spender for Universal Router v4 flows.

**Request Payload:**

```json
{
  "chain": "polygon",
  "tokenAddress": "0xYourTokenAddress",
  "amount": "1000",
  "spenderAddress": "0x000000000022D473030F116dDEE9F6B43aC78BA3"
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
    http://localhost:3004/approve
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
    http://localhost:3004/approve
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
    http://localhost:3004/approve
  ```

**Expected Response:**

```json
{
  "message": "Approval successful.",
  "spender": "0x000000000022D473030F116dDEE9F6B43aC78BA3"
}
```

**Notes:**

- Replace `"0xYourTokenAddress"` with the actual token contract address you intend to approve.
- Ensure that the `amount` reflects the number of tokens you wish to approve, considering the token's decimals.

---

### 2.2 **Execute Universal Router calldata (`/uni-v4-execute`)**

**Endpoint:**

```
POST /uni-v4-execute
```

**Description:**
Broadcasts **pre-built** Universal Router calldata (and optional `value`) for Uniswap v4. Use this for complex routes or custom logic.

**Request Payload:**

```json
{
  "chain": "ethereum",
  "walletLabel": "MAIN",
  "calldata": "0x...",
  "valueWei": "0"
}
```

You can also pass `valueEth` instead of `valueWei`.

**Expected Response:**

```json
{
  "message": "Uniswap V4 execute successful",
  "txHash": "0xYourTransactionHash"
}
```

---

### 2.3 **Buy Token (`/uni-v4-buy`)**

**Endpoint:**

```
POST /uni-v4-buy
```

**Description:**
Executes a swap to buy a token using native ETH/MATIC.

**Request Payload (Internal Route Building):**

```json
{
  "chain": "polygon",
  "walletLabel": "MAIN",
  "tokenAddress": "0xYourTokenAddress",
  "amountInEth": "0.1",
  "fee": 3000,
  "slippagePercent": 1
}
```

**Request Payload (Pre-built Calldata):**

```json
{
  "chain": "polygon",
  "walletLabel": "MAIN",
  "calldata": "0x...",
  "valueEth": "0.1"
}
```

**Parameters:**

| Field            | Description                                                                   |
| ---------------- | ----------------------------------------------------------------------------- |
| **chain**        | Blockchain network (e.g., `"ethereum"`, `"polygon"`, `"base"`, `"arbitrum"`). |
| **tokenAddress** | The ERC20 token to buy (required for internal building).                      |
| **amountInEth**  | Amount of native asset to spend (required for internal building).             |
| **fee**          | Pool fee tier (e.g., `100`, `500`, `3000`, `10000`). Default `3000`.          |
| **calldata**     | (Optional) Pre-built Universal Router calldata.                               |

**Expected Response:**

```json
{
  "message": "Uniswap V4 Buy successful",
  "txHash": "0xYourTransactionHash",
  "gasEstimate": "123456",
  "totalCostEth": "0.00042"
}
```

---

### 2.4 **Sell Token (`/uni-v4-sell`)**

**Endpoint:**

```
POST /uni-v4-sell
```

**Description:**
Executes a swap to sell a token for native ETH/MATIC.

**Request Payload (Internal Route Building):**

```json
{
  "chain": "polygon",
  "walletLabel": "MAIN",
  "tokenAddress": "0xYourTokenAddress",
  "amountInTokens": "1000",
  "fee": 3000,
  "slippagePercent": 1
}
```

**Parameters:**

| Field              | Description               |
| ------------------ | ------------------------- |
| **chain**          | Blockchain network.       |
| **tokenAddress**   | The ERC20 token to sell.  |
| **amountInTokens** | Amount of tokens to sell. |
| **fee**            | Pool fee tier.            |

**Expected Response:**

```json
{
  "message": "Uniswap V4 Sell successful",
  "txHash": "0xYourTransactionHash",
  "gasEstimate": "123456",
  "totalCostEth": "0.00042"
}
```

---

### 2.5 **Swap Tokens (`/uni-v4-swap`)**

**Endpoint:**

```
POST /uni-v4-swap
```

**Description:**
Alias of **`POST /uni-v4-execute`**. Currently primarily intended for token-to-token swaps via pre-built `calldata`.

**Request Payload:**

```json
{
  "chain": "polygon",
  "walletLabel": "MAIN",
  "calldata": "0x...",
  "valueWei": "0"
}
```

---

### 2.6 **Estimate Endpoints**

- **`/uni-v4-estimate-buy-cost`**
- **`/uni-v4-estimate-sell-cost`**
- **`/uni-v4-estimate-swap-cost`**

These endpoints accept the same payloads as their non-estimate counterparts and return gas estimates without broadcasting.

**Example Response:**

```json
{
  "message": "Uniswap V4 Buy estimate",
  "gasEstimate": "123456",
  "gasLimitWithBuffer": "135801",
  "gasPriceWei": "1000000000",
  "totalCostEth": "0.00042"
}
```

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

Uniswap V4 introduces multiple fee tiers (e.g., `500` for 0.05%, `3000` for 0.3%, `10000` for 1%). Select the appropriate fee tier based on the liquidity and volatility of the token pair:

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
  Always ensure that the tokens you're swapping are approved for the Uniswap V4 router. Use the `/approve` endpoint before attempting to buy, sell, or swap tokens.

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
   # Uniswap V4 Configurations
   UNI_V4_RPC_URL_ETHEREUM=your_ethereum_rpc_url
   UNI_V4_PRIVATE_KEY_MAIN_ETHEREUM=your_ethereum_private_key
   UNI_V4_ROUTER_ADDRESS_ETHEREUM=0xUniswapUniversalRouterAddress
   UNI_V4_PORT=3004

   UNI_V4_RPC_URL_POLYGON=your_polygon_rpc_url
   UNI_V4_PRIVATE_KEY_MAIN_POLYGON=your_polygon_private_key
   UNI_V4_ROUTER_ADDRESS_POLYGON=0xUniswapUniversalRouterAddress

   UNI_V4_RPC_URL_BASE=your_base_rpc_url
   UNI_V4_PRIVATE_KEY_MAIN_BASE=your_base_private_key
   UNI_V4_ROUTER_ADDRESS_BASE=0xUniswapUniversalRouterAddress

   GAS_BUFFER_PERCENT=10
   ```

2. **Start the Server:**

   ```bash
   node src/uni-v4.js
   ```

   You should see output similar to:

   ```
   Uniswap V4 Service running on port 3004
   Endpoints:
     - POST /approve
     - POST /uni-v4-execute
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
  Select the appropriate Uniswap V4 fee tier based on the liquidity and volatility of the token pair to optimize swap efficiency and cost.

- **Implement Robust Error Handling:**
  Ensure that your application gracefully handles errors and provides meaningful feedback to users to facilitate troubleshooting.

---
