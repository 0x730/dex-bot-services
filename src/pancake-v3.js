require('dotenv').config();
const express = require('express');
const { ethers } = require('ethers');
const rateLimit = require('express-rate-limit');
const { sendTransactionWithNonce } = require('./utils/nonceManager');

// -----------------------
// ABIs
// -----------------------

const erc20Abi = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address owner) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
];

const pancakeV3RouterAbi = [
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
        internalType: 'struct IPancakeV3Router.ExactInputSingleParams',
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

const pancakeV3QuoterAbi = [
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

const wbnbAbi = [
  'function withdraw(uint256 amount) external',
  'function balanceOf(address owner) external view returns (uint256)',
];

// -----------------------
// Helper Functions
// -----------------------

function getPrivateKey(label = 'MAIN', chain) {
  const envVar = `PANCAKE_V3_PRIVATE_KEY_${label.toUpperCase()}_${chain.toUpperCase()}`;
  const privateKey = process.env[envVar];
  if (!privateKey) {
    throw new Error(
      `Private key not found for label "${label}" on chain "${chain}"`
    );
  }
  return privateKey;
}

function initializePancakeV3(chain, walletLabel = 'MAIN') {
  const config = {
    rpcUrl: process.env[`PANCAKE_V3_RPC_URL_${chain.toUpperCase()}`],
    wbnbAddress:
      process.env[`PANCAKE_V3_WRAPPED_ADDRESS_${chain.toUpperCase()}`] ||
      process.env[`PANCAKE_V3_WETH_ADDRESS_${chain.toUpperCase()}`] ||
      process.env[`PANCAKE_V3_WBNB_ADDRESS_${chain.toUpperCase()}`],
    routerAddress:
      process.env[`PANCAKE_V3_ROUTER_ADDRESS_${chain.toUpperCase()}`],
    quoterAddress:
      process.env[`PANCAKE_V3_QUOTER_ADDRESS_${chain.toUpperCase()}`],
    maxGas:
      parseInt(process.env[`PANCAKE_V3_MAX_GAS_${chain.toUpperCase()}`]) ||
      200000,
  };

  if (
    !config.rpcUrl ||
    !config.wbnbAddress ||
    !config.routerAddress ||
    !config.quoterAddress
  ) {
    throw new Error(`Missing Pancake V3 config for chain: ${chain}`);
  }

  const privateKey = getPrivateKey(walletLabel, chain);
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);

  const router = new ethers.Contract(
    config.routerAddress,
    pancakeV3RouterAbi,
    signer
  );
  const quoter = new ethers.Contract(
    config.quoterAddress,
    pancakeV3QuoterAbi,
    provider
  );

  return {
    provider,
    signer,
    router,
    quoter,
    wbnbAddress: config.wbnbAddress,
    maxGas: config.maxGas,
  };
}

async function approveToken(
  provider,
  signer,
  tokenAddress,
  spenderAddress,
  amountWei
) {
  try {
    const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, provider);
    const allowance = await tokenContract.allowance(
      signer.address,
      spenderAddress
    );

    if (allowance >= amountWei) {
      console.log(
        `Already approved enough tokens for spender=${spenderAddress}`
      );
      return;
    }
    const tx = await tokenContract
      .connect(signer)
      .approve(spenderAddress, amountWei);
    await tx.wait();
    console.log(
      `Approved spender=${spenderAddress}, amountWei=${amountWei.toString()}`
    );
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

async function getTokenBalance(provider, tokenAddress, owner) {
  try {
    const contract = new ethers.Contract(tokenAddress, erc20Abi, provider);
    return contract.balanceOf(owner);
  } catch (error) {
    console.error(
      `Error getting token balance for ${owner} of token ${tokenAddress}:`,
      error
    );
    throw error;
  }
}

async function getBnbBalance(provider, address) {
  try {
    return provider.getBalance(address);
  } catch (error) {
    console.error(`Error getting BNB balance for ${address}:`, error);
    throw error;
  }
}

async function unwrapWBNB(provider, signer, wbnbAddress) {
  try {
    const wbnbContract = new ethers.Contract(wbnbAddress, wbnbAbi, signer);
    const wbnbBalance = await wbnbContract.balanceOf(signer.address);

    if (wbnbBalance === 0n) {
      console.log('No WBNB balance to unwrap.');
      return;
    }

    const tx = await wbnbContract.withdraw(wbnbBalance);
    await tx.wait();
    console.log(
      `Unwrapped ${ethers.formatUnits(wbnbBalance, 18)} WBNB to BNB.`
    );
  } catch (error) {
    console.error(`Error unwrapping WBNB to BNB:`, error);
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

app.post('/pancake-v3-approve', async (req, res) => {
  let { chain, walletLabel, tokenAddress, amount } = req.body;
  if (!walletLabel) walletLabel = 'MAIN';

  if (!chain || !tokenAddress || !amount) {
    return res.status(400).json({ error: 'Missing chain/tokenAddress/amount' });
  }

  try {
    const chainObj = initializePancakeV3(chain.toLowerCase(), walletLabel);
    const { provider, signer, router } = chainObj;
    const decimals = await getTokenDecimals(provider, tokenAddress);
    const amountWei = ethers.parseUnits(amount.toString(), decimals);

    await approveToken(
      provider,
      signer,
      tokenAddress,
      router.target,
      amountWei * 10n
    );

    res.json({ message: 'Pancake V3 Approve successful' });
  } catch (error) {
    console.error('pancake-v3-approve failed:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/pancake-v3-buy', async (req, res) => {
  let { chain, walletLabel, tokenAddress, amountInBnb, slippagePercent, fee } =
    req.body;
  if (!walletLabel) walletLabel = 'MAIN';

  if (!chain || !tokenAddress || !amountInBnb) {
    return res
      .status(400)
      .json({ error: 'Missing chain/tokenAddress/amountInBnb' });
  }

  try {
    const chainObj = initializePancakeV3(chain.toLowerCase(), walletLabel);
    const { provider, signer, router, quoter, wbnbAddress, maxGas } = chainObj;

    const amountInWei = ethers.parseEther(amountInBnb.toString());

    await approveToken(
      provider,
      signer,
      wbnbAddress,
      router.target,
      amountInWei * 10n
    );

    const feeTier = parseInt(fee) || 3000;
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

    const params = {
      tokenIn: wbnbAddress,
      tokenOut: tokenAddress,
      fee: feeTier,
      recipient: signer.address,
      deadline,
      amountIn: amountInWei,
      amountOutMinimum: 0,
      sqrtPriceLimitX96: 0,
    };

    const funcData = router.interface.encodeFunctionData('exactInputSingle', [
      params,
    ]);
    const txData = {
      to: router.target,
      data: funcData,
      value: amountInWei,
      from: signer.address,
    };

    const gasEstimate = await provider.estimateGas(txData);
    console.log(`Estimated Gas: ${gasEstimate.toString()}`);
    if (chain.toLowerCase() === 'bsc' && maxGas && gasEstimate > maxGas) {
      throw new Error(
        `Estimated gas (${gasEstimate.toString()}) exceeds maxGas (${maxGas})`
      );
    }

    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || feeData.maxFeePerGas;

    const gasBufferPercent = parseInt(process.env.GAS_BUFFER_PERCENT) || 10;
    const gasLimitWithBuffer =
      (gasEstimate * BigInt(100 + gasBufferPercent)) / BigInt(100);
    console.log(
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
        gasLimit: gasLimitWithBuffer,
        gasPrice,
      },
      provider,
      {
        onNonce: (nonce, attempt) =>
          console.log(
            `[NonceManager] Using nonce ${nonce} (attempt ${attempt}) for Pancake V3 Buy`
          ),
      }
    );
    console.log('Buy TX sent:', tx.hash);
    const receipt = await tx.wait();
    console.log('Buy TX confirmed:', receipt.hash);

    const decimals = await getTokenDecimals(provider, tokenAddress);
    const finalBal = await getTokenBalance(
      provider,
      tokenAddress,
      signer.address
    );
    const receivedAmountRaw = BigInt(finalBal) - BigInt(balance0);
    const receivedAmount = ethers.formatUnits(
      receivedAmountRaw.toString(),
      decimals
    );

    res.json({
      message: 'Pancake V3 Buy successful',
      txHash: receipt.hash,
      finalBalance: ethers.formatUnits(finalBal, decimals),
      amount: receivedAmount,
    });
  } catch (error) {
    console.error('pancake-v3-buy failed:', error);
    res
      .status(500)
      .json({ error: `PancakeSwap V3 buy failed: ${error.message}` });
  }
});

app.post('/pancake-v3-sell', async (req, res) => {
  let {
    chain,
    walletLabel,
    tokenAddress,
    amountInTokens,
    slippagePercent,
    fee,
  } = req.body;
  if (!walletLabel) walletLabel = 'MAIN';

  if (!chain || !tokenAddress || !amountInTokens) {
    return res
      .status(400)
      .json({ error: 'Missing chain/tokenAddress/amountInTokens' });
  }

  try {
    const chainObj = initializePancakeV3(chain.toLowerCase(), walletLabel);
    const { provider, signer, router, quoter, wbnbAddress } = chainObj;

    const decimals = await getTokenDecimals(provider, tokenAddress);
    const amount = amountInTokens - 0.0002 * amountInTokens;
    const amountInWei = ethers.parseUnits(amount.toString(), decimals);

    await approveToken(
      provider,
      signer,
      tokenAddress,
      router.target,
      amountInWei
    );

    const feeTier = parseInt(fee) || 3000;
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

    const params = {
      tokenIn: tokenAddress,
      tokenOut: wbnbAddress,
      fee: feeTier,
      recipient: signer.address,
      deadline,
      amountIn: amountInWei,
      amountOutMinimum: 0,
      sqrtPriceLimitX96: 0,
    };

    const funcData = router.interface.encodeFunctionData('exactInputSingle', [
      params,
    ]);
    const txData = {
      to: router.target,
      data: funcData,
      value: 0,
      from: signer.address,
    };

    const gasEstimate = await provider.estimateGas(txData);
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || feeData.maxFeePerGas;

    const gasBufferPercent = parseInt(process.env.GAS_BUFFER_PERCENT) || 10;
    const gasLimitWithBuffer =
      (gasEstimate * BigInt(100 + gasBufferPercent)) / BigInt(100);
    console.log(
      `Gas Limit with Buffer (${gasBufferPercent}%): ${gasLimitWithBuffer.toString()}`
    );

    const bnbBefore = await getBnbBalance(provider, signer.address);

    const tx = await sendTransactionWithNonce(
      signer,
      {
        ...txData,
        gasLimit: gasLimitWithBuffer,
      },
      provider,
      {
        onNonce: (nonce, attempt) =>
          console.log(
            `[NonceManager] Using nonce ${nonce} (attempt ${attempt}) for Pancake V3 Sell`
          ),
      }
    );
    console.log('Sell TX sent:', tx.hash);
    const receipt = await tx.wait();
    console.log('Sell TX confirmed:', receipt.hash);

    const wbnbBalance = await getTokenBalance(
      provider,
      wbnbAddress,
      signer.address
    );
    if (chain.toLowerCase() === 'bsc' && wbnbBalance > 0) {
      await unwrapWBNB(provider, signer, wbnbAddress);
    }

    const bnbAfter = await getBnbBalance(provider, signer.address);
    const gainedBnb = bnbAfter - bnbBefore;

    res.json({
      message: 'Pancake V3 Sell successful',
      txHash: receipt.hash,
      amount: ethers.formatEther(gainedBnb),
    });
  } catch (error) {
    console.error('pancake-v3-sell failed:', error);
    res
      .status(500)
      .json({ error: `PancakeSwap V3 sell failed: ${error.message}` });
  }
});

app.post('/pancake-v3-swap', async (req, res) => {
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
    const chainObj = initializePancakeV3(chain.toLowerCase(), walletLabel);
    const { provider, signer, router, quoter, wbnbAddress, maxGas } = chainObj;

    const isBNB = tokenIn.toLowerCase() === wbnbAddress.toLowerCase();
    const amount = amountInTokens - 0.0002 * amountInTokens;
    let amountInParsed;
    if (isBNB) {
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

    if (!isBNB) {
      await approveToken(
        provider,
        signer,
        tokenIn,
        router.target,
        amountInParsed * 10n
      );
    }

    const feeTier = parseInt(fee) || 3000;
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

    const params = {
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
      value: isBNB ? amountInParsed : 0,
    };

    const gasEstimate = await provider.estimateGas(txData);
    if (chain.toLowerCase() === 'bsc' && maxGas && gasEstimate > maxGas) {
      throw new Error(
        `Estimated gas (${gasEstimate.toString()}) exceeds maxGas (${maxGas})`
      );
    }

    const feeDataObj = await provider.getFeeData();
    const gasPrice = feeDataObj.gasPrice || feeDataObj.maxFeePerGas;

    const gasBufferPercent = parseInt(process.env.GAS_BUFFER_PERCENT) || 10;
    const gasLimitWithBuffer =
      (gasEstimate * BigInt(100 + gasBufferPercent)) / BigInt(100);

    const balance0 = await getTokenBalance(provider, tokenOut, signer.address);
    const tx = await sendTransactionWithNonce(
      signer,
      {
        ...txData,
        gasLimit: gasLimitWithBuffer,
        gasPrice,
      },
      provider,
      {
        onNonce: (nonce, attempt) =>
          console.log(
            `[NonceManager] Using nonce ${nonce} (attempt ${attempt}) for Pancake V3 Token-Token Swap`
          ),
      }
    );
    console.log(`Transaction sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`Transaction confirmed: ${tx.hash}`);

    const balance1 = await getTokenBalance(provider, tokenOut, signer.address);
    const tokenOutDecimals = await getTokenDecimals(provider, tokenOut);
    const receivedAmountRaw = BigInt(balance1) - BigInt(balance0);
    const receivedAmount = ethers.formatUnits(
      receivedAmountRaw.toString(),
      tokenOutDecimals
    );

    return res.json({
      message: 'Pancake V3 Swap successful',
      txHash: receipt.hash,
      amount: receivedAmount,
    });
  } catch (error) {
    console.error('Pancake V3 Swap failed:', error);
    return res.status(500).json({
      error: `PancakeSwap V3 Swap transaction failed: ${error.message}`,
    });
  }
});

app.post('/pancake-v3-estimate-buy-cost', async (req, res) => {
  let { chain, walletLabel, tokenAddress, amountInBnb, slippagePercent, fee } =
    req.body;
  if (!walletLabel) walletLabel = 'MAIN';

  if (!chain || !tokenAddress || !amountInBnb) {
    return res
      .status(400)
      .json({ error: 'Missing chain/tokenAddress/amountInBnb' });
  }

  try {
    const chainObj = initializePancakeV3(chain.toLowerCase(), walletLabel);
    const { provider, signer, router, quoter, wbnbAddress } = chainObj;

    const amountInWei = ethers.parseEther(amountInBnb.toString());

    const feeTier = parseInt(fee) || 3000;
    const amountOutEstimate = await quoter.quoteExactInputSingle(
      wbnbAddress,
      tokenAddress,
      feeTier,
      amountInWei,
      0
    );
    console.log(
      'V3 Amount Out Estimate:',
      ethers.formatUnits(amountOutEstimate, 18)
    );

    const slippage = slippagePercent || 3;
    const amountOutMin = calculateAmountOutMinBigNumber(
      amountOutEstimate.toString(),
      slippage
    );
    console.log(
      `Amount Out Min (after ${slippage}% slippage): ${amountOutMin.toString()}`
    );

    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
    const params = {
      tokenIn: wbnbAddress,
      tokenOut: tokenAddress,
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
    const gasPrice = feeDataObj.gasPrice || feeDataObj.maxFeePerGas;
    const totalCostWei = gasEstimate * gasPrice;
    const totalCostBnb = ethers.formatEther(totalCostWei);

    return res.json({
      message: 'Estimated Pancake V3 Buy cost',
      estimate: {
        gasEstimate: gasEstimate.toString(),
        gasPrice: gasPrice.toString(),
        totalCostWei: totalCostWei.toString(),
        amountOutMin: ethers.formatUnits(amountOutMin, 18),
        amountOutEstimate: ethers.formatUnits(amountOutEstimate, 18),
        totalCostBnb,
      },
    });
  } catch (error) {
    console.error('Estimate Pancake V3 Buy cost failed:', error);
    return res.status(500).json({
      error: `Failed to estimate Pancake V3 buy cost: ${error.message}`,
    });
  }
});

app.post('/pancake-v3-estimate-sell-cost', async (req, res) => {
  let {
    chain,
    walletLabel,
    tokenAddress,
    amountInTokens,
    slippagePercent,
    fee,
  } = req.body;
  if (!walletLabel) walletLabel = 'MAIN';

  if (!chain || !tokenAddress || !amountInTokens) {
    return res
      .status(400)
      .json({ error: 'Missing chain/tokenAddress/amountInTokens' });
  }

  try {
    const chainObj = initializePancakeV3(chain.toLowerCase(), walletLabel);
    const { provider, signer, router, quoter, wbnbAddress } = chainObj;

    const decimals = await getTokenDecimals(provider, tokenAddress);
    const amount = amountInTokens - 0.0002 * amountInTokens;
    const amountInWei = ethers.parseUnits(amount.toString(), decimals);

    const feeTier = parseInt(fee) || 3000;
    const amountOutEstimate = await quoter.quoteExactInputSingle(
      tokenAddress,
      wbnbAddress,
      feeTier,
      amountInWei,
      0
    );
    console.log(
      'V3 Amount Out Estimate:',
      ethers.formatUnits(amountOutEstimate, 18)
    );

    const slippage = slippagePercent || 3;
    const amountOutMin = calculateAmountOutMinBigNumber(
      amountOutEstimate.toString(),
      slippage
    );
    console.log(
      `Amount Out Min (after ${slippage}% slippage): ${amountOutMin.toString()}`
    );

    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
    const params = {
      tokenIn: tokenAddress,
      tokenOut: wbnbAddress,
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
    const gasPrice = feeDataObj.gasPrice || feeDataObj.maxFeePerGas;
    const totalCostWei = gasEstimate * gasPrice;
    const totalCostBnb = ethers.formatEther(totalCostWei);

    return res.json({
      message: 'Estimated Pancake V3 Sell cost',
      estimate: {
        gasEstimate: gasEstimate.toString(),
        gasPrice: gasPrice.toString(),
        totalCostWei: totalCostWei.toString(),
        amountOutMin: ethers.formatUnits(amountOutMin, 18),
        amountOutEstimate: ethers.formatUnits(amountOutEstimate, 18),
        totalCostBnb,
      },
    });
  } catch (error) {
    console.error('Estimate Pancake V3 Sell cost failed:', error);
    return res.status(500).json({
      error: `Failed to estimate Pancake V3 sell cost: ${error.message}`,
    });
  }
});

app.post('/pancake-v3-estimate-swap-cost', async (req, res) => {
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
      .json({ error: 'Invalid or missing "amountIn" parameter.' });
  }

  try {
    const chainObj = initializePancakeV3(chain.toLowerCase(), walletLabel);
    const { provider, quoter, wbnbAddress } = chainObj;

    const isBNB = tokenIn.toLowerCase() === wbnbAddress.toLowerCase();
    const amount = amountInTokens - 0.0002 * amountInTokens;
    let amountInParsed;
    if (isBNB) {
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

    const feeTier = parseInt(fee) || 3000;
    const amountOutEstimate = await quoter.quoteExactInputSingle(
      swapPath[0],
      swapPath[1],
      feeTier,
      amountInParsed,
      0
    );
    console.log(
      'Amount Out Estimate:',
      ethers.formatUnits(amountOutEstimate, 18)
    );

    const slippage = slippagePercent || 3;
    const amountOutMin = calculateAmountOutMinBigNumber(
      amountOutEstimate.toString(),
      slippage
    );

    const tokenOutDecimals = await getTokenDecimals(provider, tokenOut);

    return res.json({
      message: 'Estimated Pancake V3 Swap outcome',
      estimate: {
        amountOutMin: ethers.formatUnits(amountOutMin, tokenOutDecimals),
        amountOutEstimate: ethers.formatUnits(
          amountOutEstimate,
          tokenOutDecimals
        ),
      },
    });
  } catch (error) {
    console.error('Estimate Pancake V3 Swap failed:', error);
    return res.status(500).json({
      error: `PancakeSwap V3 Swap estimation failed: ${error.message}`,
    });
  }
});

// -----------------------
// Start the Server
// -----------------------
const PORT = process.env.PANCAKE_V3_PORT || 3001;
const HOST = process.env.HOST || '127.0.0.1';
app.listen(PORT, HOST, () => {
  console.log(`\nPancake V3 Service running on ${HOST}:${PORT}`);
  console.log(`
    Endpoints:
      - POST /pancake-v3-approve
      - POST /pancake-v3-buy
      - POST /pancake-v3-sell
      - POST /pancake-v3-estimate-buy-cost
      - POST /pancake-v3-estimate-sell-cost
      - POST /pancake-v3-swap
      - POST /pancake-v3-estimate-swap-cost
  `);
});
