const envPath = process.env.ENV_PATH || '.env.dexy.dev';
require('dotenv').config({ path: envPath });
const express = require('express');
const { ethers } = require('ethers');
const rateLimit = require('express-rate-limit');
const { sendTransactionWithNonce } = require('./utils/nonceManager');
const {
  requirePrebuiltPancakeV4Calldata,
} = require('./utils/pancakeV4Calldata');

// -----------------------
// Constants
// -----------------------
const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3';
// -----------------------
// ABIs
// -----------------------

const erc20Abi = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address owner) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
];

// -----------------------
// Helper Functions
// -----------------------

function getPrivateKey(label = 'MAIN', chain) {
  const envVar = `PANCAKE_V4_PRIVATE_KEY_${label.toUpperCase()}_${chain.toUpperCase()}`;
  const privateKey = process.env[envVar];
  if (!privateKey) {
    throw new Error(
      `Private key not found for label "${label}" on chain "${chain}"`
    );
  }
  return privateKey;
}

function initializePancakeV4TxContext(chain, walletLabel = 'MAIN') {
  const upper = chain.toUpperCase();
  const rpcUrl = process.env[`PANCAKE_V4_RPC_URL_${upper}`];
  const routerAddress = process.env[`PANCAKE_V4_ROUTER_ADDRESS_${upper}`];
  const quoterAddress = process.env[`PANCAKE_V4_QUOTER_ADDRESS_${upper}`];
  const wethAddress =
    process.env[`PANCAKE_V4_WETH_ADDRESS_${upper}`] ||
    process.env[`PANCAKE_V4_WBNB_ADDRESS_${upper}`] ||
    process.env[`PANCAKE_V4_WRAPPED_ADDRESS_${upper}`];
  const maxGas =
    parseInt(process.env[`PANCAKE_V4_MAX_GAS_${upper}`]) ||
    parseInt(process.env.MAX_GAS_ETHEREUM) ||
    1000000;

  if (!rpcUrl || !routerAddress) {
    throw new Error(`Missing Pancake V4 tx config for chain: ${chain}`);
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
      console.log(`Already approved for ${spenderAddress}`);
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
    const gasBufferPercent = parseInt(process.env.GAS_BUFFER_PERCENT) || 10;
    const gasLimitWithBuffer =
      (gasEstimate * BigInt(100 + gasBufferPercent)) / BigInt(100);

    const tx = await sendTransactionWithNonce(
      signer,
      { ...txData, gasLimit: ethers.toBeHex(gasLimitWithBuffer) },
      provider,
      {
        onNonce: (nonce, attempt) =>
          console.log(
            `[NonceManager] Using nonce ${nonce} (attempt ${attempt}) for PancakeV4 approve ${tokenAddress} -> ${spenderAddress}`
          ),
      }
    );
    await tx.wait();
    console.log(`Approved ${spenderAddress} to spend tokens.`);
  } catch (error) {
    console.error(
      `Error approving token ${tokenAddress} for spender ${spenderAddress}:`,
      error
    );
    throw error;
  }
}

async function getTokenDecimals(provider, tokenAddress) {
  try {
    const contract = new ethers.Contract(tokenAddress, erc20Abi, provider);
    const decimals = await contract.decimals();
    return Number(decimals);
  } catch (error) {
    console.error(`Error getting token decimals for ${tokenAddress}:`, error);
    throw error;
  }
}

// -----------------------
// Express Setup
// -----------------------
const app = express();
app.use(express.json());

const limiter = rateLimit({
  windowMs: 2 * 60 * 1000,
  max: 60,
  message: 'Too many requests from this IP, please try again after 2 minutes.',
});
app.use(limiter);

// -----------------------
// Endpoints
// -----------------------

// Pancake Infinity route construction is not compatible with the Uniswap V4 planner.
// This service only relays pre-built Universal Router calldata/value generated upstream.

function parseTxValue({ valueWei, valueEth }) {
  if (valueWei !== undefined && valueWei !== null && valueWei !== '') {
    return BigInt(valueWei);
  }
  if (valueEth !== undefined && valueEth !== null && valueEth !== '') {
    return ethers.parseEther(valueEth.toString());
  }
  return 0n;
}

async function handlePancakeV4ExecuteLike(req, res, { mode, message }) {
  let { chain, walletLabel, calldata, valueWei, valueEth } = req.body;
  if (!walletLabel) walletLabel = 'MAIN';

  if (!chain || typeof chain !== 'string') {
    return res
      .status(400)
      .json({ error: 'Invalid or missing "chain" parameter.' });
  }

  let finalCalldata;
  let finalValue;
  try {
    finalCalldata = requirePrebuiltPancakeV4Calldata(calldata);
    finalValue = parseTxValue({ valueWei, valueEth });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  try {
    const ctx = initializePancakeV4TxContext(chain.toLowerCase(), walletLabel);
    const { provider, signer, routerAddress, maxGas } = ctx;

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
      const gasBufferPercent = parseInt(process.env.GAS_BUFFER_PERCENT) || 10;
      gasLimitWithBuffer =
        (gasEstimate * BigInt(100 + gasBufferPercent)) / BigInt(100);
    } catch (estErr) {
      console.warn(
        '[PancakeV4] Gas estimation failed:',
        estErr?.shortMessage || estErr?.message || estErr
      );
    }

    if (gasEstimate && maxGas && gasEstimate > BigInt(maxGas)) {
      throw new Error(
        `Estimated gas (${gasEstimate.toString()}) exceeds the maximum allowed gas (${maxGas})`
      );
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
        console.warn(
          '[PancakeV4] Fee data fetch failed:',
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
          console.log(
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
    console.error(`${message} failed:`, error);
    return res
      .status(500)
      .json({ error: `${message} failed: ${error.message}` });
  }
}

app.post('/pancake-v4-buy', async (req, res) =>
  handlePancakeV4ExecuteLike(req, res, {
    mode: 'send',
    message: 'Pancake V4 Buy successful',
  })
);
app.post('/pancake-v4-sell', async (req, res) =>
  handlePancakeV4ExecuteLike(req, res, {
    mode: 'send',
    message: 'Pancake V4 Sell successful',
  })
);
app.post('/pancake-v4-swap', async (req, res) =>
  handlePancakeV4ExecuteLike(req, res, {
    mode: 'send',
    message: 'Pancake V4 Swap successful',
  })
);
app.post('/pancake-v4-estimate-buy-cost', async (req, res) =>
  handlePancakeV4ExecuteLike(req, res, {
    mode: 'estimate',
    message: 'Pancake V4 Buy estimate',
  })
);
app.post('/pancake-v4-estimate-sell-cost', async (req, res) =>
  handlePancakeV4ExecuteLike(req, res, {
    mode: 'estimate',
    message: 'Pancake V4 Sell estimate',
  })
);
app.post('/pancake-v4-estimate-swap-cost', async (req, res) =>
  handlePancakeV4ExecuteLike(req, res, {
    mode: 'estimate',
    message: 'Pancake V4 Swap estimate',
  })
);

app.post('/pancake-v4-approve', async (req, res) => {
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
    const chainObj = initializePancakeV4TxContext(
      chain.toLowerCase(),
      walletLabel
    );
    const { provider, signer } = chainObj;
    const spender = spenderAddress || PERMIT2_ADDRESS;
    const decimals = await getTokenDecimals(provider, tokenAddress);
    const amountWei = ethers.parseUnits(amount.toString(), decimals);

    await approveToken(provider, signer, tokenAddress, spender, amountWei);

    return res.json({
      message: 'Approval successful.',
      spender,
    });
  } catch (error) {
    console.error('pancake-v4-approve failed:', error);
    return res.status(500).json({ error: `Approval failed: ${error.message}` });
  }
});

// POST /pancake-v4-execute
app.post('/pancake-v4-execute', async (req, res) => {
  return handlePancakeV4ExecuteLike(req, res, {
    mode: 'send',
    message: 'Pancake V4 execute successful',
  });
});

function startServer() {
  const PORT = process.env.PANCAKE_V4_PORT || 3005;
  const HOST = process.env.HOST || '127.0.0.1';
  app.listen(PORT, HOST, () => {
    console.log(`\nPancake V4 Service running on ${HOST}:${PORT}`);
    console.log(`
    Endpoints:
      - POST /pancake-v4-approve
      - POST /pancake-v4-buy
      - POST /pancake-v4-sell
      - POST /pancake-v4-swap
      - POST /pancake-v4-estimate-buy-cost
      - POST /pancake-v4-estimate-sell-cost
      - POST /pancake-v4-estimate-swap-cost
      - POST /pancake-v4-execute
  `);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  handlePancakeV4ExecuteLike,
  parseTxValue,
  startServer,
};
