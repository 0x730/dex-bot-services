const envPath = process.env.ENV_PATH || '.env.dexy.dev';
require('dotenv').config({ path: envPath });
const express = require('express');
const { ethers } = require('ethers');
const rateLimit = require('express-rate-limit');
const { Actions, V4Planner } = require('@uniswap/v4-sdk');
const { sendTransactionWithNonce } = require('./utils/nonceManager');
const { encodeV4SwapExecute } = require('./utils/uniV4UniversalRouter');
const {
  createBotApiTokenMiddleware,
  normalizeHost,
  registerServiceHealth,
  reportServiceBind,
} = require('./utils/serviceRuntime');
const { getWalletPrivateKey, readIntEnv } = require('./utils/runtimeConfig');
const logger = require('./utils/logger');

// -----------------------
// Constants
// -----------------------
const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3';
const ETH_ADDRESS = '0x0000000000000000000000000000000000000000'; // Universal Router uses 0x0 for ETH
const MSG_SENDER = '0x0000000000000000000000000000000000000001';
const ADDRESS_THIS = '0x0000000000000000000000000000000000000002';

// Command Types for Universal Router
const V4_SWAP = 0x10;
const WRAP_ETH = 0x0b;
const UNWRAP_WETH = 0x0c;

// Actions for V4Router
// See `@uniswap/v4-sdk` `Actions` enum.
const SWAP_EXACT_IN_SINGLE = 0x06;
const SETTLE_ALL = 0x0c;
const TAKE_ALL = 0x0f;

// -----------------------
// ABIs
// -----------------------

const erc20Abi = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address owner) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
];

const permit2Abi = [
  // https://docs.uniswap.org/contracts/permit2/reference/allowance
  'function allowance(address owner, address token, address spender) external view returns (uint160 amount, uint48 expiration, uint48 nonce)',
  // https://docs.uniswap.org/contracts/permit2/reference/allowance#approve
  'function approve(address token, address spender, uint160 amount, uint48 expiration) external',
];

// -----------------------
// Helper Functions
// -----------------------

// Helper function to get private key with "MAIN" as default
function getPrivateKey(label = 'MAIN', chain) {
  return getWalletPrivateKey('UNI_V4', label, chain);
}

function initializeUniV4TxContext(chain, walletLabel = 'MAIN') {
  const upper = chain.toUpperCase();
  const rpcUrl = process.env[`UNI_V4_RPC_URL_${upper}`];
  const routerAddress = process.env[`UNI_V4_ROUTER_ADDRESS_${upper}`];
  const quoterAddress = process.env[`UNI_V4_QUOTER_ADDRESS_${upper}`];
  const wethAddress =
    process.env[`UNI_V4_WETH_ADDRESS_${upper}`] ||
    process.env[`UNI_V4_WRAPPED_ADDRESS_${upper}`];
  const maxGas = readIntEnv('MAX_GAS_ETHEREUM', 1000000);

  if (!rpcUrl || !routerAddress) {
    throw new Error(`Missing Uniswap V4 tx config for chain: ${chain}`);
  }

  const privateKey = getPrivateKey(walletLabel, chain);
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);
  return {
    provider,
    signer,
    routerAddress,
    quoterAddress,
    wethAddress,
    maxGas,
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
            `[NonceManager] Using nonce ${nonce} (attempt ${attempt}) for UniV4 approve ${tokenAddress} -> ${spenderAddress}`
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

async function approvePermit2SpenderIfNeeded(
  provider,
  signer,
  tokenAddress,
  spenderAddress,
  amountInWei,
  expirationSecondsFromNow = 3600
) {
  const permit2 = new ethers.Contract(PERMIT2_ADDRESS, permit2Abi, provider);

  const allowance = await permit2.allowance(
    signer.address,
    tokenAddress,
    spenderAddress
  );

  const currentAmount = allowance?.amount ?? allowance?.[0];
  const currentExpiration = allowance?.expiration ?? allowance?.[1];

  const needsAmount =
    currentAmount === undefined || BigInt(currentAmount) < BigInt(amountInWei);
  const now = Math.floor(Date.now() / 1000);
  const minExpiration = now + Math.max(60, Number(expirationSecondsFromNow));
  const needsExpiration =
    currentExpiration === undefined ||
    Number(currentExpiration) < minExpiration;

  if (!needsAmount && !needsExpiration) {
    logger.info(`Permit2 allowance already set for spender ${spenderAddress}`);
    return;
  }

  // Permit2 uses uint160 for amounts.
  const MAX_UINT160 = (1n << 160n) - 1n;
  const deadline = BigInt(minExpiration);

  const iface = new ethers.Interface(permit2Abi);
  const data = iface.encodeFunctionData('approve', [
    tokenAddress,
    spenderAddress,
    MAX_UINT160,
    deadline,
  ]);

  const txData = {
    to: PERMIT2_ADDRESS,
    from: signer.address,
    data,
  };

  logger.info(
    `Setting Permit2 allowance: token=${tokenAddress} spender=${spenderAddress} amount=MAX_UINT160 exp=${minExpiration}`
  );

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
          `[NonceManager] Using nonce ${nonce} (attempt ${attempt}) for Permit2 approve`
        ),
    }
  );
  await tx.wait();
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

function parseTxValue({ valueWei, valueEth }) {
  if (valueWei !== undefined && valueWei !== null && valueWei !== '') {
    return BigInt(valueWei);
  }
  if (valueEth !== undefined && valueEth !== null && valueEth !== '') {
    return ethers.parseEther(valueEth.toString());
  }
  return 0n;
}

// -----------------------
// Express Server Setup
// -----------------------

const app = express();
app.use(express.json());
registerServiceHealth(app, 'uni-v4');
app.use(createBotApiTokenMiddleware());

const limiter = rateLimit({
  windowMs: 2 * 60 * 1000,
  max: 60,
  message: 'Too many requests from this IP, please try again after 1 minute.',
});
app.use(limiter);

// -----------------------
// Uniswap V4 Router Action Encoding
// -----------------------

const v4RouterIface = new ethers.Interface([
  'function swapExactInSingle((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, bool zeroForOne, uint128 amountIn, uint128 amountOutMinimum, bytes hookData)',
  'function settleAll(address currency, uint256 maxAmount)',
  'function takeAll(address currency, uint256 minAmount)',
]);

// Minimal Uniswap v4 Quoter ABI (quote functions are typically non-view but callable via eth_call)
const v4QuoterIface = new ethers.Interface([
  // NOTE: Deployed v4 quoter contracts often use a single-tuple parameter.
  // Using this signature produces revert payloads that can be decoded for quote results.
  'function quoteExactInputSingle(((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, bool zeroForOne, uint128 exactAmount, bytes hookData) params) external returns (uint256 amountOut, uint256 gasEstimate)',
]);

function decodeV4QuoterQuoteFromCallException(err) {
  const revertData = err?.data || err?.info?.error?.data;
  if (
    !revertData ||
    typeof revertData !== 'string' ||
    !revertData.startsWith('0x')
  ) {
    return null;
  }

  // Common pattern observed on-chain for v4 quoters:
  // - the call reverts with a custom error that wraps a `bytes` payload
  // - that inner payload may itself be a custom error encoding the quote result
  const abi = ethers.AbiCoder.defaultAbiCoder();

  const tryDecodeInner = (innerHex) => {
    if (
      !innerHex ||
      typeof innerHex !== 'string' ||
      !innerHex.startsWith('0x')
    ) {
      return null;
    }

    // If inner is exactly 4 selector bytes + 32 bytes data, treat the data as amountOut.
    // (We don't need the error name to extract the value.)
    if (innerHex.length === 2 + (4 + 32) * 2) {
      const amountOutHex = '0x' + innerHex.slice(10);
      return {
        amountOut: abi.decode(['uint256'], amountOutHex)[0],
        gasEstimate: null,
      };
    }

    // Try common tuple layouts.
    try {
      const [amountOut, gasEstimate] = abi.decode(
        ['uint256', 'uint256'],
        innerHex
      );
      return { amountOut, gasEstimate };
    } catch {
      // ignore
    }
    try {
      const [amountOut] = abi.decode(['uint256'], innerHex);
      return { amountOut, gasEstimate: null };
    } catch {
      // ignore
    }

    return null;
  };

  // First, try to decode outer revertData as `bytes`.
  try {
    const inner = abi.decode(['bytes'], revertData)[0];
    const decoded = tryDecodeInner(inner);
    if (decoded) return decoded;
  } catch {
    // ignore
  }

  // If not wrapped, try to decode the revert data directly.
  return tryDecodeInner(revertData);
}

function getTickSpacingForFee(feeTier) {
  if (feeTier === 100) return 1;
  if (feeTier === 500) return 10;
  if (feeTier === 3000) return 60;
  if (feeTier === 10000) return 200;
  // Fallback to the most common spacing.
  return 60;
}

function sortCurrencies(a, b) {
  // PoolKey sorting is numerical by uint160, not lexicographic.
  const A = BigInt(a);
  const B = BigInt(b);
  return A < B ? [a, b] : [b, a];
}

function clampSlippagePercent(slippagePercent) {
  const x = slippagePercent == null ? 1 : Number(slippagePercent); // default 1%
  return Math.max(0, Math.min(100, x));
}

function applySlippage(amountOut, slippagePercent) {
  const s = clampSlippagePercent(slippagePercent);
  const bps = BigInt(Math.round(s * 100)); // 1% => 100 bps
  const denom = 10000n;
  const factor = denom - bps;
  return (BigInt(amountOut) * factor) / denom;
}

const V4_QUOTER_ABI = [
  'function quoteExactInputSingle(((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) poolKey,bool zeroForOne,uint128 exactAmount,bytes hookData) params) external returns (uint256 amountOut,uint256 gasEstimate)',
];

async function quoteExactInputSingle({
  provider,
  quoterAddress,
  poolKey,
  zeroForOne,
  amountIn,
  hookData = '0x',
}) {
  const quoter = new ethers.Contract(quoterAddress, V4_QUOTER_ABI, provider);
  logger.info(
    `[DEBUG] Quoting: poolKey=${JSON.stringify(poolKey)} zeroForOne=${zeroForOne} amountIn=${amountIn}`
  );
  // ethers v6: staticCall performs eth_call
  try {
    const [amountOut, gasEstimate] =
      await quoter.quoteExactInputSingle.staticCall({
        poolKey,
        zeroForOne,
        exactAmount: amountIn,
        hookData,
      });
    logger.info(
      `[DEBUG] Quote OK: amountOut=${amountOut} gasEstimate=${gasEstimate}`
    );
    return { amountOut, gasEstimate };
  } catch (err) {
    logger.error(`[DEBUG] Quote failed: ${err.message}`);
    throw err;
  }
}

// Optional: try common tickSpacings if yours is wrong.
async function findPoolKeyByTrial({
  provider,
  quoterAddress,
  currencyIn,
  currencyOut,
  feeTier,
  hooks = '0x0000000000000000000000000000000000000000',
  amountIn,
  hookData = '0x',
  preferredTickSpacing,
}) {
  const [currency0, currency1] = sortCurrencies(currencyIn, currencyOut);
  const zeroForOne = currencyIn.toLowerCase() === currency0.toLowerCase();

  const candidates = Array.from(
    new Set(
      [
        preferredTickSpacing,
        getTickSpacingForFee(feeTier),
        1,
        10,
        60,
        200, // common values
      ].filter((x) => Number.isFinite(x))
    )
  );

  let lastErr;
  for (const tickSpacing of candidates) {
    const poolKey = { currency0, currency1, fee: feeTier, tickSpacing, hooks };
    try {
      const q = await quoteExactInputSingle({
        provider,
        quoterAddress,
        poolKey,
        zeroForOne,
        amountIn,
        hookData,
      });
      return { poolKey, zeroForOne, quote: q };
    } catch (e) {
      lastErr = e;
    }
  }

  throw new Error(
    `No working pool found for fee=${feeTier}. Likely wrong tickSpacing and/or hooks address. Last error: ${lastErr?.shortMessage || lastErr?.message || lastErr}`
  );
}

async function buildUniV4UniversalRouterCalldata({
  chain,
  walletLabel,
  tokenAddress,
  amountInEth,
  amountInTokens,
  fee,
  side,
  slippagePercent,
  tickSpacing, // optional override
  hooks, // optional override (defaults to hookless)
  hookData, // optional override
}) {
  if (!chain || typeof chain !== 'string')
    throw new Error('Invalid or missing "chain".');

  const ctx = initializeUniV4TxContext(chain.toLowerCase(), walletLabel);
  const { provider, signer, quoterAddress } = ctx;

  const isBuy = side === 'buy';
  const isSell = side === 'sell';
  if (!isBuy && !isSell)
    throw new Error('Invalid "side". Expected "buy" or "sell".');
  if (!tokenAddress) throw new Error('Missing "tokenAddress".');

  // v4 native ETH currency is address(0) in PoolKey.
  const currencyIn = isBuy ? ETH_ADDRESS : tokenAddress;
  const currencyOut = isBuy ? tokenAddress : ETH_ADDRESS;

  let amountIn;
  if (isBuy) {
    if (amountInEth == null) throw new Error('Missing "amountInEth".');
    amountIn = ethers.parseEther(amountInEth.toString());
  } else {
    if (amountInTokens == null) throw new Error('Missing "amountInTokens".');
    const decimals = await getTokenDecimals(provider, tokenAddress);
    amountIn = ethers.parseUnits(amountInTokens.toString(), decimals);
  }

  const feeTier = parseInt(fee) || 3000;
  const hooksAddr = hooks || '0x0000000000000000000000000000000000000000';
  const hookBytes = hookData || '0x';

  // Find correct (poolKey, zeroForOne) and also get a quote to set amountOutMinimum.
  if (!quoterAddress)
    throw new Error(`Missing UNI_V4_QUOTER_ADDRESS for chain: ${chain}`);

  const found = await findPoolKeyByTrial({
    provider,
    quoterAddress,
    currencyIn,
    currencyOut,
    feeTier,
    hooks: hooksAddr,
    amountIn,
    hookData: hookBytes,
    preferredTickSpacing:
      tickSpacing != null ? parseInt(tickSpacing) : undefined,
  });

  const { poolKey, zeroForOne, quote } = found;

  const amountOutMinimum = applySlippage(quote.amountOut, slippagePercent ?? 1);

  // Encode the v4 swap command using the SDK planner output.
  const v4Planner = new V4Planner();

  const swapConfig = {
    poolKey,
    zeroForOne,
    amountIn: amountIn.toString(),
    amountOutMinimum: amountOutMinimum.toString(),
    hookData: hookBytes,
  };

  v4Planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, [swapConfig]);
  v4Planner.addAction(Actions.SETTLE_ALL, [currencyIn, amountIn.toString()]);
  v4Planner.addAction(Actions.TAKE_ALL, [
    currencyOut,
    amountOutMinimum.toString(),
  ]);

  const deadline = Math.floor(Date.now() / 1000) + 1200;
  const calldata = encodeV4SwapExecute(v4Planner.finalize(), deadline);

  // For native ETH input swaps, only set tx.value (no WRAP_ETH command needed).
  const valueWei =
    currencyIn.toLowerCase() === ETH_ADDRESS.toLowerCase() ? amountIn : 0n;

  return {
    calldata,
    valueWei: valueWei.toString(),
    tokenIn: currencyIn,
    tokenOut: currencyOut,
    feeTier,
    tickSpacing: poolKey.tickSpacing,
    zeroForOne,
    poolKey,
    quotedAmountOut: quote.amountOut.toString(),
    amountOutMinimum: amountOutMinimum.toString(),
  };
}

async function handleUniV4ExecuteLike(req, res, { mode, message }) {
  let {
    chain,
    walletLabel,
    calldata,
    valueWei,
    valueEth,
    tokenAddress,
    amountInEth,
    amountInTokens,
    fee,
    path,
    slippagePercent,
  } = req.body;
  if (!walletLabel) walletLabel = 'MAIN';

  if (!chain || typeof chain !== 'string') {
    return res
      .status(400)
      .json({ error: 'Invalid or missing "chain" parameter.' });
  }

  try {
    const ctx = initializeUniV4TxContext(chain.toLowerCase(), walletLabel);
    const { provider, signer, routerAddress, wethAddress } = ctx;

    let finalCalldata = calldata;
    let finalValue = parseTxValue({ valueWei, valueEth });

    // Internal Route Building if calldata is missing
    if (
      !finalCalldata ||
      typeof finalCalldata !== 'string' ||
      !finalCalldata.startsWith('0x')
    ) {
      const isBuy = message.toLowerCase().includes('buy');
      const isSell = message.toLowerCase().includes('sell');

      if (!isBuy && !isSell) {
        return res.status(400).json({
          error:
            'Missing "calldata". Internal route building only supported for buy/sell.',
        });
      }

      // NOTE: In estimate mode we avoid sending approvals; caller should ensure allowances for sell paths.
      if (isSell && mode !== 'estimate') {
        const decimals = await getTokenDecimals(provider, tokenAddress);
        const amountInWei = ethers.parseUnits(
          amountInTokens.toString(),
          decimals
        );
        await approveToken(
          provider,
          signer,
          tokenAddress,
          PERMIT2_ADDRESS,
          amountInWei
        );

        // Permit2 has its own allowance table; Universal Router must be approved as a spender inside Permit2.
        await approvePermit2SpenderIfNeeded(
          provider,
          signer,
          tokenAddress,
          routerAddress,
          amountInWei
        );
      }

      const built = await buildUniV4UniversalRouterCalldata({
        chain,
        walletLabel,
        tokenAddress,
        amountInEth,
        amountInTokens,
        fee,
        side: isBuy ? 'buy' : 'sell',
        slippagePercent,
      });
      finalCalldata = built.calldata;
      if (isBuy) {
        finalValue = BigInt(built.valueWei);
      }
    }

    const txData = {
      to: routerAddress,
      from: signer.address,
      data: finalCalldata,
      value: finalValue,
    };

    let gasEstimate;
    let gasLimitWithBuffer;
    try {
      gasEstimate = await provider.estimateGas(txData);
      const gasBufferPercent = readIntEnv('GAS_BUFFER_PERCENT', 10);
      gasLimitWithBuffer =
        (gasEstimate * BigInt(100 + gasBufferPercent)) / BigInt(100);
    } catch (estErr) {
      logger.warn(
        '[UniV4] Gas estimation failed:',
        estErr?.shortMessage || estErr?.message || estErr
      );
      if (mode === 'estimate') {
        const revertData = estErr?.data || estErr?.info?.error?.data;
        return res.status(500).json({
          error: `Gas estimation failed: ${estErr?.shortMessage || estErr?.message || estErr}`,
          revertData,
          txData: {
            ...txData,
            value: txData.value.toString(),
          },
        });
      }
    }

    let gasPrice;
    let totalCostEth;
    if (gasEstimate) {
      try {
        const feeData = await provider.getFeeData();
        gasPrice = feeData.maxFeePerGas || feeData.gasPrice;
        if (gasPrice) {
          const totalCostWei = gasEstimate * gasPrice;
          totalCostEth = ethers.formatEther(totalCostWei);
        }
      } catch (feeErr) {
        logger.warn(
          '[UniV4] Fee data fetch failed:',
          feeErr?.shortMessage || feeErr?.message || feeErr
        );
      }
    }

    if (mode === 'estimate') {
      if (!gasEstimate) {
        return res.status(500).json({
          error:
            'Gas estimation failed. Ensure calldata/value are correct for the selected chain/router.',
        });
      }

      return res.json({
        message,
        gasEstimate: gasEstimate.toString(),
        gasLimitWithBuffer: gasLimitWithBuffer
          ? gasLimitWithBuffer.toString()
          : undefined,
        gasPriceWei: gasPrice ? gasPrice.toString() : undefined,
        totalCostEth,
      });
    }

    const tx = await sendTransactionWithNonce(
      signer,
      {
        ...txData,
        ...(gasLimitWithBuffer
          ? { gasLimit: ethers.toBeHex(gasLimitWithBuffer) }
          : {}),
      },
      provider,
      {
        onNonce: (nonce, attempt) =>
          logger.info(
            `[NonceManager] Using nonce ${nonce} (attempt ${attempt}) for ${message}`
          ),
      }
    );
    const receipt = await tx.wait();

    return res.json({
      message,
      txHash: receipt.hash,
      gasEstimate: gasEstimate ? gasEstimate.toString() : undefined,
      totalCostEth,
    });
  } catch (error) {
    logger.error(`${message} failed:`, error);
    return res
      .status(500)
      .json({ error: `${message} failed: ${error.message}` });
  }
}

// -----------------------
// Quote + Calldata Builder Endpoints (for route/fee discovery + testing)
// -----------------------

app.post('/uni-v4-quote-exact-in-single', async (req, res) => {
  let { chain, walletLabel, tokenIn, tokenOut, amountInWei, amountInEth, fee } =
    req.body;
  if (!walletLabel) walletLabel = 'MAIN';

  if (!chain || typeof chain !== 'string') {
    return res
      .status(400)
      .json({ error: 'Invalid or missing "chain" parameter.' });
  }

  try {
    const ctx = initializeUniV4TxContext(chain.toLowerCase(), walletLabel);
    const { provider, quoterAddress, wethAddress } = ctx;
    if (!quoterAddress) {
      return res
        .status(400)
        .json({ error: `Missing UNI_V4_QUOTER_ADDRESS for chain: ${chain}` });
    }

    const feeTier = parseInt(fee) || 3000;
    const tickSpacing = getTickSpacingForFee(feeTier);

    // Allow "ETH" alias by letting callers omit tokenIn/tokenOut and provide amountInEth.
    if (!tokenIn && amountInEth !== undefined && amountInEth !== null) {
      tokenIn = ETH_ADDRESS; // v4 native ETH is address(0)
    }
    if (!tokenIn || !tokenOut) {
      return res.status(400).json({
        error:
          'Missing token pair. Provide "tokenIn" and "tokenOut" (and either "amountInWei" or "amountInEth").',
      });
    }

    let exactAmount;
    if (
      amountInWei !== undefined &&
      amountInWei !== null &&
      amountInWei !== ''
    ) {
      exactAmount = BigInt(amountInWei);
    } else if (
      amountInEth !== undefined &&
      amountInEth !== null &&
      amountInEth !== ''
    ) {
      exactAmount = ethers.parseEther(amountInEth.toString());
    } else {
      return res
        .status(400)
        .json({ error: 'Missing "amountInWei" or "amountInEth".' });
    }

    const [currency0, currency1] = sortCurrencies(tokenIn, tokenOut);
    const zeroForOne = tokenIn.toLowerCase() === currency0.toLowerCase();
    const poolKey = {
      currency0,
      currency1,
      fee: feeTier,
      tickSpacing,
      hooks: '0x0000000000000000000000000000000000000000',
    };

    const callData = v4QuoterIface.encodeFunctionData('quoteExactInputSingle', [
      [
        [
          poolKey.currency0,
          poolKey.currency1,
          poolKey.fee,
          poolKey.tickSpacing,
          poolKey.hooks,
        ],
        zeroForOne,
        exactAmount,
        '0x',
      ],
    ]);

    let amountOut;
    let gasEstimate;
    try {
      const raw = await provider.call({ to: quoterAddress, data: callData });
      const decoded = v4QuoterIface.decodeFunctionResult(
        'quoteExactInputSingle',
        raw
      );
      amountOut = decoded[0];
      gasEstimate = decoded[1];
    } catch (callErr) {
      const decoded = decodeV4QuoterQuoteFromCallException(callErr);
      if (!decoded) throw callErr;
      amountOut = decoded.amountOut;
      gasEstimate = decoded.gasEstimate;
    }

    return res.json({
      chain,
      tokenIn,
      tokenOut,
      feeTier,
      tickSpacing,
      zeroForOne,
      amountIn: exactAmount.toString(),
      amountOut: amountOut.toString(),
      quoterGasEstimate: gasEstimate?.toString?.(),
    });
  } catch (error) {
    logger.error('Uni v4 quote failed:', error);
    return res.status(500).json({
      error: `Uni v4 quote failed: ${error?.shortMessage || error?.message || error}`,
    });
  }
});

app.post('/uni-v4-build-calldata', async (req, res) => {
  let {
    chain,
    walletLabel,
    tokenAddress,
    amountInEth,
    amountInTokens,
    fee,
    side,
  } = req.body;
  if (!walletLabel) walletLabel = 'MAIN';

  try {
    const built = await buildUniV4UniversalRouterCalldata({
      chain,
      walletLabel,
      tokenAddress,
      amountInEth,
      amountInTokens,
      fee,
      side,
    });
    return res.json({
      chain,
      side,
      feeTier: built.feeTier,
      tickSpacing: built.tickSpacing,
      zeroForOne: built.zeroForOne,
      poolKey: built.poolKey,
      calldata: built.calldata,
      valueWei: built.valueWei,
    });
  } catch (error) {
    logger.error('Uni v4 build calldata failed:', error);
    return res.status(500).json({
      error: `Uni v4 build calldata failed: ${error?.message || error}`,
    });
  }
});

app.post('/uni-v4-buy', async (req, res) =>
  handleUniV4ExecuteLike(req, res, {
    mode: 'send',
    message: 'Uniswap V4 Buy successful',
  })
);
app.post('/uni-v4-sell', async (req, res) =>
  handleUniV4ExecuteLike(req, res, {
    mode: 'send',
    message: 'Uniswap V4 Sell successful',
  })
);
app.post('/uni-v4-swap', async (req, res) =>
  handleUniV4ExecuteLike(req, res, {
    mode: 'send',
    message: 'Uniswap V4 Swap successful',
  })
);
app.post('/uni-v4-estimate-buy-cost', async (req, res) =>
  handleUniV4ExecuteLike(req, res, {
    mode: 'estimate',
    message: 'Uniswap V4 Buy estimate',
  })
);
app.post('/uni-v4-estimate-sell-cost', async (req, res) =>
  handleUniV4ExecuteLike(req, res, {
    mode: 'estimate',
    message: 'Uniswap V4 Sell estimate',
  })
);
app.post('/uni-v4-estimate-swap-cost', async (req, res) =>
  handleUniV4ExecuteLike(req, res, {
    mode: 'estimate',
    message: 'Uniswap V4 Swap estimate',
  })
);

app.post('/approve', async (req, res) => {
  let { chain, walletLabel, tokenAddress, amount, spenderAddress } = req.body;
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
    const chainObj = initializeUniV4TxContext(chain.toLowerCase(), walletLabel);
    const { provider, signer } = chainObj;

    const spender = spenderAddress || PERMIT2_ADDRESS;

    const tokenDecimals = await getTokenDecimals(provider, tokenAddress);
    const amountInWei = ethers.parseUnits(amount.toString(), tokenDecimals);

    await approveToken(provider, signer, tokenAddress, spender, amountInWei);

    return res.json({
      message: 'Approval successful.',
      spender,
    });
  } catch (error) {
    logger.error('Approval failed:', error);
    return res.status(500).json({ error: `Approval failed: ${error.message}` });
  }
});

// POST /uni-v4-execute
// Broadcasts a pre-built Universal Router calldata + value.
// This keeps the service minimal and lets upstream routing logic (your 3rd-party app) handle v4 route construction.
app.post('/uni-v4-execute', async (req, res) => {
  return handleUniV4ExecuteLike(req, res, {
    mode: 'send',
    message: 'Uniswap V4 execute successful',
  });
});

// -----------------------
// Start the Server
// -----------------------
function startServer() {
  const PORT = process.env.UNI_V4_PORT || 3004;
  const HOST = normalizeHost(process.env.HOST);
  reportServiceBind('uni-v4', HOST, PORT);
  app.listen(PORT, HOST, () => {
    logger.info(`\nUniswap V4 Service running on ${HOST}:${PORT}`);
    logger.info(`Endpoints:
    - POST /approve
    - POST /uni-v4-buy
    - POST /uni-v4-sell
    - POST /uni-v4-swap
    - POST /uni-v4-estimate-buy-cost
    - POST /uni-v4-estimate-sell-cost
    - POST /uni-v4-estimate-swap-cost
    - POST /uni-v4-execute
  `);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  buildUniV4UniversalRouterCalldata,
  handleUniV4ExecuteLike,
  parseTxValue,
  startServer,
};
