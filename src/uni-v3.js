require('dotenv').config();
const express = require('express');
const { ethers } = require('ethers');
const rateLimit = require('express-rate-limit');
const { sendTransactionWithNonce } = require('./utils/nonceManager');
const {
  createBotApiTokenMiddleware,
  normalizeHost,
  registerServiceHealth,
  reportServiceBind,
} = require('./utils/serviceRuntime');
const { getWalletPrivateKey, readIntEnv } = require('./utils/runtimeConfig');
const logger = require('./utils/logger');

// -----------------------
// ABIs
// -----------------------

// ERC20 ABI (Minimal)
const erc20Abi = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address owner) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
];

// Uniswap V3 Router ABI (Minimal)
const swapRouterV3Abi = [
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'tokenIn', type: 'address' },
          { internalType: 'address', name: 'tokenOut', type: 'address' },
          { internalType: 'uint24', name: 'fee', type: 'uint24' },
          { internalType: 'address', name: 'recipient', type: 'address' },
          { internalType: 'uint256', name: 'deadline', type: 'uint256' },
          { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
          {
            internalType: 'uint256',
            name: 'amountOutMinimum',
            type: 'uint256',
          },
          {
            internalType: 'uint160',
            name: 'sqrtPriceLimitX96',
            type: 'uint160',
          },
        ],
        internalType: 'struct ISwapRouter.ExactInputSingleParams',
        name: 'params',
        type: 'tuple',
      },
    ],
    name: 'exactInputSingle',
    outputs: [{ internalType: 'uint256', name: 'amountOut', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
];

const swapRouterV3AbiBase = [
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'tokenIn', type: 'address' },
          { internalType: 'address', name: 'tokenOut', type: 'address' },
          { internalType: 'uint24', name: 'fee', type: 'uint24' },
          { internalType: 'address', name: 'recipient', type: 'address' },
          { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
          {
            internalType: 'uint256',
            name: 'amountOutMinimum',
            type: 'uint256',
          },
          {
            internalType: 'uint160',
            name: 'sqrtPriceLimitX96',
            type: 'uint160',
          },
        ],
        internalType: 'struct ISwapRouter.ExactInputSingleParams',
        name: 'params',
        type: 'tuple',
      },
    ],
    name: 'exactInputSingle',
    outputs: [{ internalType: 'uint256', name: 'amountOut', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
];

// Uniswap V3 Quoter ABI (Minimal)
const quoterAbi = [
  {
    inputs: [
      { internalType: 'bytes', name: 'path', type: 'bytes' },
      { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
    ],
    name: 'quoteExactInput',
    outputs: [{ internalType: 'uint256', name: 'amountOut', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'tokenIn', type: 'address' },
      { internalType: 'address', name: 'tokenOut', type: 'address' },
      { internalType: 'uint24', name: 'fee', type: 'uint24' },
      { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
      { internalType: 'uint160', name: 'sqrtPriceLimitX96', type: 'uint160' },
    ],
    name: 'quoteExactInputSingle',
    outputs: [{ internalType: 'uint256', name: 'amountOut', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
];

// WETH ABI (Minimal)
const wethAbi = [
  'function withdraw(uint256 amount) external',
  'function balanceOf(address owner) external view returns (uint256)',
];

// -----------------------
// Helper Functions
// -----------------------

// Built-in defaults for known chains to reduce required env variables
// You can override any of these via environment variables UNI_V3_*_{CHAIN}
const UNISWAP_V3_DEFAULTS = {
  arbitrum: {
    // Arbitrum One
    wethAddress: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    // Uniswap V3 SwapRouter
    routerAddress: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    // Uniswap V3 Quoter V2
    quoterAddress: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
    // Wrapped native (same as WETH on Arbitrum)
    wmAddress: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  },
};

// Helper function to get private key with "MAIN" as default
function getPrivateKey(label = 'MAIN', chain) {
  return getWalletPrivateKey('UNI_V3', label, chain);
}

// Updated Initialize Contracts Function
function initializeContracts(chain, walletLabel = 'MAIN') {
  const upper = chain.toUpperCase();
  const envConfig = {
    rpcUrl: process.env[`UNI_V3_RPC_URL_${upper}`],
    wethAddress: process.env[`UNI_V3_WETH_ADDRESS_${upper}`],
    routerAddress: process.env[`UNI_V3_ROUTER_ADDRESS_${upper}`],
    quoterAddress: process.env[`UNI_V3_QUOTER_ADDRESS_${upper}`],
    wmAddress: process.env[`UNI_V3_WRAPPED_ADDRESS_${upper}`],
    maxGas: readIntEnv('MAX_GAS_ETHEREUM', 200000),
  };

  // Merge defaults for known chains where env vars are not provided
  const defaults = UNISWAP_V3_DEFAULTS[chain] || {};
  const v3Config = {
    rpcUrl: envConfig.rpcUrl, // we still require RPC via env
    wethAddress: envConfig.wethAddress || defaults.wethAddress,
    routerAddress: envConfig.routerAddress || defaults.routerAddress,
    quoterAddress: envConfig.quoterAddress || defaults.quoterAddress,
    wmAddress: envConfig.wmAddress || defaults.wmAddress,
    maxGas: envConfig.maxGas,
  };

  const missing = [];
  if (!v3Config.rpcUrl) missing.push('rpcUrl');
  if (!v3Config.wethAddress) missing.push('wethAddress');
  if (!v3Config.routerAddress) missing.push('routerAddress');
  if (!v3Config.quoterAddress) missing.push('quoterAddress');
  if (missing.length) {
    throw new Error(
      `Missing Uniswap V3 configuration for chain: ${chain}. Missing fields: ${missing.join(', ')}`
    );
  }

  const privateKey = getPrivateKey(walletLabel, chain);
  const provider = new ethers.JsonRpcProvider(v3Config.rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);
  const router = new ethers.Contract(
    v3Config.routerAddress,
    chain === 'base' ? swapRouterV3AbiBase : swapRouterV3Abi,
    signer
  );
  const quoter = new ethers.Contract(
    v3Config.quoterAddress,
    quoterAbi,
    provider
  );

  return {
    provider,
    signer,
    router,
    quoter,
    wethAddress: v3Config.wethAddress,
    wmAddress: v3Config.wmAddress,
    maxGas: v3Config.maxGas,
  };
}

async function approveToken(
  provider,
  signer,
  tokenAddress,
  spenderAddress,
  amountInWei
) {
  try {
    const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, provider);
    const currentAllowance = await tokenContract.allowance(
      signer.address,
      spenderAddress
    );

    if (currentAllowance >= amountInWei) {
      logger.info(`Already approved for ${spenderAddress}`);
      return;
    }

    // Build approve tx and send via nonce manager to avoid collisions
    const iface = new ethers.Interface(erc20Abi);
    const data = iface.encodeFunctionData('approve', [
      spenderAddress,
      amountInWei,
    ]);
    const txData = {
      to: tokenAddress,
      from: signer.address,
      data,
    };

    const gasEstimate = await provider.estimateGas(txData);
    const gasBufferPercent = readIntEnv('GAS_BUFFER_PERCENT', 10);
    const gasLimitWithBuffer =
      (gasEstimate * BigInt(100 + gasBufferPercent)) / BigInt(100);

    const tx = await sendTransactionWithNonce(
      signer,
      { ...txData, gasLimit: ethers.toBeHex(gasLimitWithBuffer) },
      provider,
      {
        onNonce: (nonce, attempt) =>
          logger.info(
            `[NonceManager] Using nonce ${nonce} (attempt ${attempt}) for UniV3 approve ${tokenAddress} -> ${spenderAddress}`
          ),
      }
    );
    await tx.wait();
    logger.info(`Approved ${spenderAddress} to spend tokens.`);
  } catch (error) {
    logger.error(
      `Error approving token ${tokenAddress} for spender ${spenderAddress}:`,
      error
    );
    throw error;
  }
}

async function getTokenDecimals(provider, tokenAddress) {
  try {
    const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, provider);
    const decimals = await tokenContract.decimals();
    return Number(decimals);
  } catch (error) {
    logger.error(`Error getting token decimals for ${tokenAddress}:`, error);
    throw error;
  }
}

async function getTokenBalance(provider, tokenAddress, ownerAddress) {
  try {
    const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, provider);
    const balance = await tokenContract.balanceOf(ownerAddress);
    return balance;
  } catch (error) {
    logger.error(
      `Error getting token balance for ${ownerAddress} of token ${tokenAddress}:`,
      error
    );
    throw error;
  }
}

const getBalance = async (address, provider) => {
  logger.info(`Fetching balance for: ${address}`);
  try {
    const balanceWei = await provider.getBalance(address);
    const balanceEther = ethers.formatEther(balanceWei);
    logger.info(`Balance of ${address}: ${balanceEther} ETH/MATIC`);
    return BigInt(Math.floor(parseFloat(balanceEther) * 1e18));
  } catch (error) {
    logger.error(`Error fetching balance for ${address}:`, error);
    throw error;
  }
};

async function unwrapWMATIC(provider, signer, wmAddress) {
  try {
    const wmTokenRead = new ethers.Contract(wmAddress, wethAbi, provider);
    const wmBalance = await wmTokenRead.balanceOf(signer.address);

    if (wmBalance === 0n) {
      logger.info('No WMATIC to unwrap.');
      return;
    }

    const iface = new ethers.Interface(wethAbi);
    const data = iface.encodeFunctionData('withdraw', [wmBalance]);
    const txData = { to: wmAddress, from: signer.address, data, value: '0x0' };

    let gasLimitWithBuffer = 120000n; // sensible default for withdraw
    try {
      const gasEstimate = await provider.estimateGas(txData);
      const gasBufferPercent = readIntEnv('GAS_BUFFER_PERCENT', 10);
      gasLimitWithBuffer =
        (gasEstimate * BigInt(100 + gasBufferPercent)) / BigInt(100);
    } catch (estErr) {
      logger.warn(
        '[UniV3] Gas estimation for WMATIC unwrap failed, using fallback gas limit:',
        estErr?.shortMessage || estErr?.message || estErr
      );
    }

    const tx = await sendTransactionWithNonce(
      signer,
      { ...txData, gasLimit: ethers.toBeHex(gasLimitWithBuffer) },
      provider,
      {
        onNonce: (nonce, attempt) =>
          logger.info(
            `[NonceManager] Using nonce ${nonce} (attempt ${attempt}) for UniV3 unwrap WMATIC`
          ),
      }
    );
    await tx.wait();
    logger.info(
      `Unwrapped ${ethers.formatUnits(wmBalance, 18)} WMATIC to MATIC.`
    );
  } catch (error) {
    logger.error(`Error unwrapping WMATIC to MATIC:`, error);
    throw error;
  }
}

async function unwrapWETH(provider, signer, wethAddress) {
  try {
    const wethRead = new ethers.Contract(wethAddress, wethAbi, provider);
    const wethBalance = await wethRead.balanceOf(signer.address);

    if (wethBalance === 0n) {
      logger.info('No WETH to unwrap.');
      return;
    }

    const iface = new ethers.Interface(wethAbi);
    const data = iface.encodeFunctionData('withdraw', [wethBalance]);
    const txData = {
      to: wethAddress,
      from: signer.address,
      data,
      value: '0x0',
    };

    let gasLimitWithBuffer = 120000n; // sensible default for withdraw
    try {
      const gasEstimate = await provider.estimateGas(txData);
      const gasBufferPercent = readIntEnv('GAS_BUFFER_PERCENT', 10);
      gasLimitWithBuffer =
        (gasEstimate * BigInt(100 + gasBufferPercent)) / BigInt(100);
    } catch (estErr) {
      logger.warn(
        '[UniV3] Gas estimation for WETH unwrap failed, using fallback gas limit:',
        estErr?.shortMessage || estErr?.message || estErr
      );
    }

    const tx = await sendTransactionWithNonce(
      signer,
      { ...txData, gasLimit: ethers.toBeHex(gasLimitWithBuffer) },
      provider,
      {
        onNonce: (nonce, attempt) =>
          logger.info(
            `[NonceManager] Using nonce ${nonce} (attempt ${attempt}) for UniV3 unwrap WETH`
          ),
      }
    );
    await tx.wait();
    logger.info(
      `Unwrapped ${ethers.formatUnits(wethBalance, 18)} WETH to ETH.`
    );
  } catch (error) {
    logger.error(`Error unwrapping WETH to ETH:`, error);
    throw error;
  }
}

async function unwrapBase(provider, signer, baseWethAddress) {
  try {
    const baseWethContract = new ethers.Contract(
      baseWethAddress,
      wethAbi,
      signer
    );
    const wethBalance = await baseWethContract.balanceOf(signer.address);
    const tx = await baseWethContract.withdraw(wethBalance);
    await tx.wait();
    logger.info(
      `Unwrapped ${ethers.formatUnits(wethBalance, 18)} WETH to BASE.`
    );
  } catch (error) {
    logger.error(`Error unwrapping WETH to BASE:`, error);
    throw error;
  }
}

function calculateAmountOutMinBigNumber(amountOutEstimate, slippagePercent) {
  const slippageBasisPoints = Math.round(slippagePercent * 100);
  const totalBasisPoints = 10000;
  const slippageMultiplier = BigInt(totalBasisPoints - slippageBasisPoints);
  const denominator = BigInt(totalBasisPoints);
  const amountOutMin =
    (BigInt(amountOutEstimate) * slippageMultiplier) / denominator;
  return amountOutMin;
}

// -----------------------
// Express Server Setup
// -----------------------

const app = express();
app.use(express.json());
registerServiceHealth(app, 'uni-v3');
app.use(createBotApiTokenMiddleware());

const limiter = rateLimit({
  windowMs: 2 * 60 * 1000,
  max: 60,
  message: 'Too many requests from this IP, please try again after 1 minute.',
});
app.use(limiter);

// -----------------------
// Initialize Chain Objects
// -----------------------

const supportedChains = ['ETHEREUM', 'POLYGON', 'BASE', 'ARBITRUM'];
const chainObjects = {};

supportedChains.forEach((chain) => {
  try {
    chainObjects[chain.toLowerCase()] = initializeContracts(
      chain.toLowerCase(),
      'MAIN'
    );
    logger.info(
      `Initialized Uniswap V3 contracts for ${chain} with default "MAIN" wallet`
    );
  } catch (error) {
    logger.error(`Failed to initialize contracts for ${chain}:`, error.message);
  }
});

// -----------------------
// Uniswap V3 Endpoints
// -----------------------

app.post('/uni-v3-buy', async (req, res) => {
  let {
    chain,
    walletLabel,
    tokenAddress,
    amountInEth,
    slippagePercent,
    fee,
    path,
  } = req.body;
  if (!walletLabel) walletLabel = 'MAIN';

  if (!chain || typeof chain !== 'string') {
    return res
      .status(400)
      .json({ error: 'Invalid or missing "chain" parameter.' });
  }
  if (!tokenAddress) {
    return res
      .status(400)
      .json({ error: 'Invalid or missing "tokenAddress" parameter.' });
  }
  if (!amountInEth || isNaN(amountInEth) || Number(amountInEth) <= 0) {
    return res
      .status(400)
      .json({ error: 'Invalid or missing "amountInEth" parameter.' });
  }

  try {
    const chainObj = initializeContracts(chain.toLowerCase(), walletLabel);
    const { provider, signer, router, quoter, wethAddress, maxGas } = chainObj;

    const amountInWei = ethers.parseEther(amountInEth.toString());
    let swapPath = path || [wethAddress, tokenAddress];

    if (swapPath[0].toLowerCase() !== wethAddress.toLowerCase()) {
      throw new Error(
        'Path must start with WETH/WMATIC address for buy operations.'
      );
    }

    await approveToken(
      provider,
      signer,
      swapPath[0],
      router.target,
      amountInWei * 10n
    );

    const feeTier =
      parseInt(fee) || readIntEnv('UNI_V3_FEE_TIER_DEFAULT', 3000);
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

    const params =
      chain === 'base'
        ? {
            tokenIn: swapPath[0],
            tokenOut: swapPath[1],
            fee: feeTier,
            recipient: signer.address,
            amountIn: amountInWei,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0,
          }
        : {
            tokenIn: swapPath[0],
            tokenOut: swapPath[1],
            fee: feeTier,
            recipient: signer.address,
            deadline,
            amountIn: amountInWei,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0,
          };

    const txData = {
      to: router.target,
      from: signer.address,
      data: router.interface.encodeFunctionData('exactInputSingle', [params]),
      value: amountInWei,
    };

    const gasEstimate = await provider.estimateGas(txData);
    logger.info(`Estimated Gas: ${gasEstimate.toString()}`);
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.maxFeePerGas || feeData.gasPrice;
    const totalCostWei = gasEstimate * gasPrice;
    const totalCostEth = ethers.formatEther(totalCostWei);

    if (chain.toLowerCase() === 'ethereum' && maxGas) {
      if (gasEstimate > maxGas) {
        throw new Error(
          `Estimated gas (${gasEstimate.toString()}) exceeds the maximum allowed gas (${maxGas})`
        );
      }
      logger.info(`Estimated gas is within the allowed limit (${maxGas})`);
    } else {
      logger.info(`No gas limit restrictions for ${chain} chain`);
    }

    const gasBufferPercent = readIntEnv('GAS_BUFFER_PERCENT', 10);
    const gasLimitWithBuffer =
      (gasEstimate * BigInt(100 + gasBufferPercent)) / BigInt(100);
    logger.info(
      `Gas Limit with Buffer (${gasBufferPercent}%): ${gasLimitWithBuffer.toString()}`
    );

    const balance0 = await getTokenBalance(
      provider,
      tokenAddress,
      signer.address
    );
    const tx = await sendTransactionWithNonce(
      signer,
      {
        ...txData,
        gasLimit: ethers.toBeHex(gasLimitWithBuffer),
      },
      provider,
      {
        onNonce: (nonce, attempt) =>
          logger.info(
            `[NonceManager] Using nonce ${nonce} (attempt ${attempt}) for Uniswap V3 Buy`
          ),
      }
    );
    logger.info(`Transaction sent: ${tx.hash}`);
    const receipt = await tx.wait();
    logger.info(`Transaction confirmed: ${tx.hash}`);

    const balance1 = await getTokenBalance(
      provider,
      tokenAddress,
      signer.address
    );
    const tokenDecimals = await getTokenDecimals(provider, tokenAddress);
    const receivedAmountRaw = BigInt(balance1) - BigInt(balance0);
    const receivedAmount = ethers.formatUnits(
      receivedAmountRaw.toString(),
      tokenDecimals
    );

    return res.json({
      message: 'Uniswap V3 Buy successful',
      txHash: receipt.hash,
      totalCostEth,
      amount: receivedAmount,
    });
  } catch (error) {
    logger.error('Uniswap V3 Buy failed:', error);
    return res
      .status(500)
      .json({ error: `Uniswap V3 Buy transaction failed: ${error.message}` });
  }
});

app.post('/uni-v3-sell', async (req, res) => {
  let {
    chain,
    walletLabel,
    tokenAddress,
    amountInTokens,
    slippagePercent,
    fee,
    path,
  } = req.body;
  if (!walletLabel) walletLabel = 'MAIN';

  if (!chain || typeof chain !== 'string') {
    return res
      .status(400)
      .json({ error: 'Invalid or missing "chain" parameter.' });
  }
  if (!tokenAddress) {
    return res
      .status(400)
      .json({ error: 'Invalid or missing "tokenAddress" parameter.' });
  }
  if (!amountInTokens || isNaN(amountInTokens) || Number(amountInTokens) <= 0) {
    return res
      .status(400)
      .json({ error: 'Invalid or missing "amountInTokens" parameter.' });
  }

  try {
    const chainObj = initializeContracts(chain.toLowerCase(), walletLabel);
    const { provider, signer, router, quoter, wethAddress, maxGas, wmAddress } =
      chainObj;

    const tokenDecimals = await getTokenDecimals(provider, tokenAddress);
    const amount = amountInTokens - 0.0002 * amountInTokens;

    const roundedAmount = Number(amount).toFixed(tokenDecimals);
    const amountInWei = ethers.parseUnits(roundedAmount, tokenDecimals);

    let swapPath = path || [tokenAddress, wethAddress];

    if (
      swapPath[swapPath.length - 1].toLowerCase() !== wethAddress.toLowerCase()
    ) {
      throw new Error(
        'Path must end with WETH/WMATIC address for sell operations.'
      );
    }

    await approveToken(
      provider,
      signer,
      swapPath[0],
      router.target,
      amountInWei * 10n
    );

    const feeTier =
      parseInt(fee) || readIntEnv('UNI_V3_FEE_TIER_DEFAULT', 3000);
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

    const params =
      chain === 'base'
        ? {
            tokenIn: swapPath[0],
            tokenOut: swapPath[1],
            fee: feeTier,
            recipient: signer.address,
            amountIn: amountInWei,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0,
          }
        : {
            tokenIn: swapPath[0],
            tokenOut: swapPath[1],
            fee: feeTier,
            recipient: signer.address,
            deadline,
            amountIn: amountInWei,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0,
          };

    const txData = {
      to: router.target,
      from: signer.address,
      data: router.interface.encodeFunctionData('exactInputSingle', [params]),
      value: 0,
    };

    const gasEstimate = await provider.estimateGas(txData);
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.maxFeePerGas || feeData.gasPrice;
    const totalCostWei = gasEstimate * gasPrice;
    const totalCostEth = ethers.formatEther(totalCostWei);

    const balance0 = await getBalance(signer.address, provider);

    const tx = await sendTransactionWithNonce(
      signer,
      {
        ...txData,
        gasLimit: gasEstimate * 2n,
      },
      provider,
      {
        onNonce: (nonce, attempt) =>
          logger.info(
            `[NonceManager] Using nonce ${nonce} (attempt ${attempt}) for Uniswap V3 Sell`
          ),
      }
    );
    logger.info(`Transaction sent: ${tx.hash}`);
    const receipt = await tx.wait();
    logger.info(`Transaction confirmed: ${tx.hash}`);

    // After selling, unwrap any wrapped native token we actually hold on this chain
    const lc = chain.toLowerCase();

    // Determine which wrapped token address and unwrap function to use per chain
    let wrappedAddrToCheck = null;
    let unwrapFn = null;
    if (lc === 'ethereum' || lc === 'arbitrum' || lc === 'base') {
      wrappedAddrToCheck = wethAddress;
      unwrapFn =
        lc === 'base'
          ? (addr) => unwrapBase(provider, signer, addr)
          : (addr) => unwrapWETH(provider, signer, addr);
    } else if (lc === 'polygon') {
      wrappedAddrToCheck = wmAddress || wethAddress; // prefer explicit WMATIC address, fallback to wethAddress if set that way in env
      unwrapFn = (addr) => unwrapWMATIC(provider, signer, addr);
    }

    if (wrappedAddrToCheck) {
      const wrappedBal = await getTokenBalance(
        provider,
        wrappedAddrToCheck,
        signer.address
      );
      if (wrappedBal > 0n) {
        try {
          await unwrapFn(wrappedAddrToCheck);
        } catch (unwrapErr) {
          logger.error('[UniV3] Unwrap failed:', unwrapErr);
        }
      } else {
        logger.info('[UniV3] No wrapped native balance to unwrap on chain', lc);
      }
    } else {
      logger.warn('[UniV3] Unknown chain for unwrap:', lc);
    }

    const balance1 = await getBalance(signer.address, provider);
    const receivedAmountRaw = balance1 - balance0;
    const receivedAmount = ethers.formatUnits(receivedAmountRaw, 18);

    return res.json({
      message: 'Uniswap V3 Sell successful',
      txHash: receipt.hash,
      totalCostEth,
      amount: receivedAmount,
    });
  } catch (error) {
    logger.error('Uniswap V3 Sell failed:', error);
    return res
      .status(500)
      .json({ error: `Uniswap V3 Sell transaction failed: ${error.message}` });
  }
});

app.post('/uni-v3-estimate-buy-cost', async (req, res) => {
  let {
    chain,
    walletLabel,
    tokenAddress,
    amountInEth,
    slippagePercent,
    fee,
    path,
  } = req.body;
  if (!walletLabel) walletLabel = 'MAIN';

  if (!chain || typeof chain !== 'string') {
    return res
      .status(400)
      .json({ error: 'Invalid or missing "chain" parameter.' });
  }
  if (!tokenAddress) {
    return res
      .status(400)
      .json({ error: 'Invalid or missing "tokenAddress" parameter.' });
  }
  if (!amountInEth || isNaN(amountInEth) || Number(amountInEth) <= 0) {
    return res
      .status(400)
      .json({ error: 'Invalid or missing "amountInEth" parameter.' });
  }

  try {
    const chainObj = initializeContracts(chain.toLowerCase(), walletLabel);
    const { provider, signer, router, quoter, wethAddress } = chainObj;

    const amountInWei = ethers.parseEther(amountInEth.toString());
    let swapPath = path || [wethAddress, tokenAddress];

    if (swapPath[0].toLowerCase() !== wethAddress.toLowerCase()) {
      throw new Error(
        'Path must start with WETH/WMATIC address for buy estimations.'
      );
    }

    const feeTier =
      parseInt(fee) || readIntEnv('UNI_V3_FEE_TIER_DEFAULT', 3000);
    const amountOutEstimate = await quoter.quoteExactInputSingle(
      swapPath[0],
      swapPath[1],
      feeTier,
      amountInWei,
      0
    );
    logger.info(
      'V3 Amount Out Estimate:',
      ethers.formatUnits(amountOutEstimate, 18)
    );

    const amountOutMin = calculateAmountOutMinBigNumber(
      amountOutEstimate.toString(),
      slippagePercent || 3
    );
    logger.info(
      `Amount Out Min (after ${slippagePercent || 3}% slippage): ${amountOutMin.toString()}`
    );

    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
    const params = {
      tokenIn: swapPath[0],
      tokenOut: swapPath[1],
      fee: feeTier,
      recipient: signer.address,
      deadline,
      amountIn: amountInWei,
      amountOutMinimum: amountOutMin,
      sqrtPriceLimitX96: 0,
    };

    const txData = {
      to: router.target,
      from: signer.address,
      data: router.interface.encodeFunctionData('exactInputSingle', [params]),
      value: amountInWei,
    };

    const gasEstimate = await provider.estimateGas(txData);
    const feeDataObj = await provider.getFeeData();
    const gasPrice = feeDataObj.maxFeePerGas || feeDataObj.gasPrice;
    const totalCostWei = gasEstimate * gasPrice;
    const totalCostEth = ethers.formatEther(totalCostWei);

    return res.json({
      message: 'Estimated Uniswap V3 Buy cost',
      estimate: {
        gasEstimate: gasEstimate.toString(),
        gasPrice: gasPrice.toString(),
        totalCostWei: totalCostWei.toString(),
        amountOutMin: ethers.formatUnits(amountOutMin, 18),
        amountOutEstimate: ethers.formatUnits(amountOutEstimate, 18),
        totalCostEth,
      },
    });
  } catch (error) {
    logger.error('Estimate Uniswap V3 Buy cost failed:', error);
    return res.status(500).json({
      error: `Failed to estimate Uniswap V3 buy cost: ${error.message}`,
    });
  }
});

app.post('/uni-v3-estimate-sell-cost', async (req, res) => {
  let {
    chain,
    walletLabel,
    tokenAddress,
    amountInTokens,
    slippagePercent,
    fee,
    path,
  } = req.body;
  if (!walletLabel) walletLabel = 'MAIN';

  if (!chain || typeof chain !== 'string') {
    return res
      .status(400)
      .json({ error: 'Invalid or missing "chain" parameter.' });
  }
  if (!tokenAddress) {
    return res
      .status(400)
      .json({ error: 'Invalid or missing "tokenAddress" parameter.' });
  }
  if (!amountInTokens || isNaN(amountInTokens) || Number(amountInTokens) <= 0) {
    return res
      .status(400)
      .json({ error: 'Invalid or missing "amountInTokens" parameter.' });
  }

  try {
    const chainObj = initializeContracts(chain.toLowerCase(), walletLabel);
    const { provider, signer, router, quoter, wethAddress } = chainObj;

    const tokenDecimals = await getTokenDecimals(provider, tokenAddress);
    const amountInWei = ethers.parseUnits(
      amountInTokens.toString(),
      tokenDecimals
    );
    let swapPath = path || [tokenAddress, wethAddress];

    if (
      swapPath[swapPath.length - 1].toLowerCase() !== wethAddress.toLowerCase()
    ) {
      throw new Error(
        'Path must end with WETH/WMATIC address for sell estimations.'
      );
    }

    const feeTier =
      parseInt(fee) || readIntEnv('UNI_V3_FEE_TIER_DEFAULT', 3000);
    const amountOutEstimate = await quoter.quoteExactInputSingle(
      swapPath[0],
      swapPath[1],
      feeTier,
      amountInWei,
      0
    );
    logger.info(
      'V3 Amount Out Estimate:',
      ethers.formatUnits(amountOutEstimate, 18)
    );

    const amountOutMin = calculateAmountOutMinBigNumber(
      amountOutEstimate.toString(),
      slippagePercent || 3
    );
    logger.info(
      `Amount Out Min (after ${slippagePercent || 3}% slippage): ${amountOutMin.toString()}`
    );

    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
    const params = {
      tokenIn: swapPath[0],
      tokenOut: swapPath[1],
      fee: feeTier,
      recipient: signer.address,
      deadline,
      amountIn: amountInWei,
      amountOutMinimum: amountOutMin,
      sqrtPriceLimitX96: 0,
    };

    const txData = {
      to: router.target,
      from: signer.address,
      data: router.interface.encodeFunctionData('exactInputSingle', [params]),
      value: 0,
    };

    const gasEstimate = await provider.estimateGas(txData);
    const feeDataObj = await provider.getFeeData();
    const gasPrice = feeDataObj.maxFeePerGas || feeDataObj.gasPrice;
    const totalCostWei = gasEstimate * gasPrice;
    const totalCostEth = ethers.formatEther(totalCostWei);

    return res.json({
      message: 'Estimated Uniswap V3 Sell cost',
      estimate: {
        gasEstimate: gasEstimate.toString(),
        gasPrice: gasPrice.toString(),
        totalCostWei: totalCostWei.toString(),
        amountOutMin: ethers.formatUnits(amountOutMin, 18),
        amountOutEstimate: ethers.formatUnits(amountOutEstimate, 18),
        totalCostEth,
      },
    });
  } catch (error) {
    logger.error('Estimate Uniswap V3 Sell cost failed:', error);
    return res.status(500).json({
      error: `Failed to estimate Uniswap V3 sell cost: ${error.message}`,
    });
  }
});

app.post('/approve', async (req, res) => {
  let { chain, walletLabel, tokenAddress, amount } = req.body;
  if (!walletLabel) walletLabel = 'MAIN';

  if (!chain || typeof chain !== 'string') {
    return res
      .status(400)
      .json({ error: 'Invalid or missing "chain" parameter.' });
  }
  if (!tokenAddress) {
    return res
      .status(400)
      .json({ error: 'Invalid or missing "tokenAddress" parameter.' });
  }
  if (!amount || isNaN(amount) || Number(amount) <= 0) {
    return res
      .status(400)
      .json({ error: 'Invalid or missing "amount" parameter.' });
  }

  try {
    const chainObj = initializeContracts(chain.toLowerCase(), walletLabel);
    const { provider, signer, router } = chainObj;

    const tokenDecimals = await getTokenDecimals(provider, tokenAddress);
    const amountInWei = ethers.parseUnits(amount.toString(), tokenDecimals);

    await approveToken(
      provider,
      signer,
      tokenAddress,
      router.target,
      amountInWei
    );

    return res.json({ message: 'Approval successful for Uniswap V3 router.' });
  } catch (error) {
    logger.error('Approval failed:', error);
    return res.status(500).json({ error: `Approval failed: ${error.message}` });
  }
});

app.post('/uni-v3-swap', async (req, res) => {
  let {
    chain,
    walletLabel,
    tokenIn,
    tokenOut,
    amountInTokens,
    slippagePercent,
    fee,
    path,
  } = req.body;
  if (!walletLabel) walletLabel = 'MAIN';

  if (!chain || typeof chain !== 'string') {
    return res
      .status(400)
      .json({ error: 'Invalid or missing "chain" parameter.' });
  }
  if (!tokenIn || !tokenOut) {
    return res
      .status(400)
      .json({ error: 'Invalid or missing "tokenIn" or "tokenOut" parameter.' });
  }
  if (!amountInTokens || isNaN(amountInTokens) || Number(amountInTokens) <= 0) {
    return res
      .status(400)
      .json({ error: 'Invalid or missing "amountInTokens" parameter.' });
  }

  try {
    const chainObj = initializeContracts(chain.toLowerCase(), walletLabel);
    const { provider, signer, router, quoter, wethAddress, maxGas } = chainObj;

    const isETH = tokenIn.toLowerCase() === wethAddress.toLowerCase();
    const amount = amountInTokens - 0.0002 * amountInTokens;
    let amountInParsed;
    if (isETH) {
      amountInParsed = ethers.parseEther(amount.toString());
    } else {
      const tokenDecimals = await getTokenDecimals(provider, tokenIn);
      amountInParsed = ethers.parseUnits(amount.toString(), tokenDecimals);
    }

    let swapPath = path || [tokenIn, tokenOut];

    if (
      swapPath[0].toLowerCase() !== tokenIn.toLowerCase() ||
      swapPath[swapPath.length - 1].toLowerCase() !== tokenOut.toLowerCase()
    ) {
      throw new Error(
        'Path must start with "tokenIn" and end with "tokenOut".'
      );
    }

    if (!isETH) {
      await approveToken(
        provider,
        signer,
        tokenIn,
        router.target,
        amountInParsed * 10n
      );
    }

    const feeTier =
      parseInt(fee) || readIntEnv('UNI_V3_FEE_TIER_DEFAULT', 3000);
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

    const params =
      chain === 'base'
        ? {
            tokenIn: swapPath[0],
            tokenOut: swapPath[1],
            fee: feeTier,
            recipient: signer.address,
            amountIn: amountInParsed,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0,
          }
        : {
            tokenIn: swapPath[0],
            tokenOut: swapPath[1],
            fee: feeTier,
            recipient: signer.address,
            deadline,
            amountIn: amountInParsed,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0,
          };

    const txData = {
      to: router.target,
      from: signer.address,
      data: router.interface.encodeFunctionData('exactInputSingle', [params]),
      value: isETH ? amountInParsed : 0,
    };

    const gasEstimate = await provider.estimateGas(txData);
    if (chain.toLowerCase() === 'ethereum' && maxGas) {
      if (gasEstimate > maxGas) {
        throw new Error(
          `Estimated gas (${gasEstimate.toString()}) exceeds the maximum allowed gas (${maxGas})`
        );
      }
      logger.info(`Estimated gas is within the allowed limit (${maxGas})`);
    } else {
      logger.info(`No gas limit restrictions for ${chain} chain`);
    }

    const gasBufferPercent = readIntEnv('GAS_BUFFER_PERCENT', 10);
    const gasLimitWithBuffer =
      (gasEstimate * BigInt(100 + gasBufferPercent)) / BigInt(100);

    const balance0 = await getTokenBalance(provider, tokenOut, signer.address);
    const tx = await sendTransactionWithNonce(
      signer,
      {
        ...txData,
        gasLimit: ethers.toBeHex(gasLimitWithBuffer),
      },
      provider,
      {
        onNonce: (nonce, attempt) =>
          logger.info(
            `[NonceManager] Using nonce ${nonce} (attempt ${attempt}) for Uniswap V3 Swap`
          ),
      }
    );
    logger.info(`Transaction sent: ${tx.hash}`);
    const receipt = await tx.wait();
    logger.info(`Transaction confirmed: ${tx.hash}`);

    const balance1 = await getTokenBalance(provider, tokenOut, signer.address);
    const tokenOutDecimals = await getTokenDecimals(provider, tokenOut);
    const receivedAmountRaw = BigInt(balance1) - BigInt(balance0);
    const receivedAmount = ethers.formatUnits(
      receivedAmountRaw.toString(),
      tokenOutDecimals
    );

    return res.json({
      message: 'Uniswap V3 Swap successful',
      txHash: receipt.hash,
      amount: receivedAmount,
    });
  } catch (error) {
    logger.error('Uniswap V3 Swap failed:', error);
    return res
      .status(500)
      .json({ error: `Uniswap V3 Swap transaction failed: ${error.message}` });
  }
});

app.post('/uni-v3-estimate-swap-cost', async (req, res) => {
  let {
    chain,
    walletLabel,
    tokenIn,
    tokenOut,
    amountInTokens,
    slippagePercent,
    fee,
    path,
  } = req.body;
  if (!walletLabel) walletLabel = 'MAIN';

  if (!chain || typeof chain !== 'string') {
    return res
      .status(400)
      .json({ error: 'Invalid or missing "chain" parameter.' });
  }
  if (!tokenIn || !tokenOut) {
    return res
      .status(400)
      .json({ error: 'Invalid or missing "tokenIn" or "tokenOut" parameter.' });
  }
  if (!amountInTokens || isNaN(amountInTokens) || Number(amountInTokens) <= 0) {
    return res
      .status(400)
      .json({ error: 'Invalid or missing "amountInTokens" parameter.' });
  }

  try {
    const chainObj = initializeContracts(chain.toLowerCase(), walletLabel);
    const { provider, quoter, wethAddress } = chainObj;

    const isETH = tokenIn.toLowerCase() === wethAddress.toLowerCase();
    const amount = amountInTokens - 0.0002 * amountInTokens;
    let amountInParsed;
    if (isETH) {
      amountInParsed = ethers.parseEther(amount.toString());
    } else {
      const tokenDecimals = await getTokenDecimals(provider, tokenIn);
      amountInParsed = ethers.parseUnits(amount.toString(), tokenDecimals);
    }

    let swapPath = path || [tokenIn, tokenOut];

    if (
      swapPath[0].toLowerCase() !== tokenIn.toLowerCase() ||
      swapPath[swapPath.length - 1].toLowerCase() !== tokenOut.toLowerCase()
    ) {
      throw new Error(
        'Path must start with "tokenIn" and end with "tokenOut".'
      );
    }

    const feeTier =
      parseInt(fee) || readIntEnv('UNI_V3_FEE_TIER_DEFAULT', 3000);
    const amountOutEstimate = await quoter.quoteExactInputSingle(
      swapPath[0],
      swapPath[1],
      feeTier,
      amountInParsed,
      0
    );
    logger.info(
      'Amount Out Estimate:',
      ethers.formatUnits(amountOutEstimate, 18)
    );

    const amountOutMin = calculateAmountOutMinBigNumber(
      amountOutEstimate.toString(),
      slippagePercent || 3
    );
    const tokenOutDecimals = await getTokenDecimals(provider, tokenOut);

    return res.json({
      message: 'Estimated Uniswap V3 Swap outcome',
      estimate: {
        amountOutMin: ethers.formatUnits(amountOutMin, tokenOutDecimals),
        amountOutEstimate: ethers.formatUnits(
          amountOutEstimate,
          tokenOutDecimals
        ),
      },
    });
  } catch (error) {
    logger.error('Estimate Uniswap V3 Swap cost failed:', error);
    return res
      .status(500)
      .json({ error: `Uniswap V3 Swap estimation failed: ${error.message}` });
  }
});

function startServer() {
  const PORT = process.env.UNI_V3_PORT || 3000;
  const HOST = normalizeHost(process.env.HOST);
  reportServiceBind('uni-v3', HOST, PORT);
  app.listen(PORT, HOST, () => {
    logger.info(`\nUniswap V3 Service running on ${HOST}:${PORT}`);
    logger.info(`Endpoints:
    - POST /approve
    - POST /uni-v3-buy
    - POST /uni-v3-sell
    - POST /uni-v3-swap
    - POST /uni-v3-estimate-buy-cost
    - POST /uni-v3-estimate-sell-cost
    - POST /uni-v3-estimate-swap-cost
  `);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  startServer,
};
