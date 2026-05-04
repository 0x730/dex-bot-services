require('dotenv').config();
const express = require('express');
const { ethers } = require('ethers');
const { sendTransactionWithNonce } = require('./utils/nonceManager');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');

// -----------------------
// ABIs
// -----------------------

// Load PancakeRouter02 ABI
const pancakeRouterAbi = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../abis/PancakeRouter02.json'), 'utf8')
);

// Load PancakeFactory ABI
const pancakeFactoryAbi = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../abis/PancakeFactory.json'), 'utf8')
);

// ERC20 ABI (Minimal)
const erc20Abi = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address owner) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
];

// -----------------------
// Helper Functions
// -----------------------

// Helper function to get private key with "MAIN" as default
function getPrivateKey(label = 'MAIN', chain) {
  const envVar = `PANCAKE_PRIVATE_KEY_${label.toUpperCase()}_${chain.toUpperCase()}`;
  const privateKey = process.env[envVar];
  if (!privateKey) {
    throw new Error(
      `Private key not found for label "${label}" on chain "${chain}"`
    );
  }
  return privateKey;
}

// Initialize PancakeSwap Router and Factory Contracts
function initializePancakeSwap(chain, walletLabel = 'MAIN') {
  const routerAddress =
    process.env[`PANCAKE_ROUTER_ADDRESS_${chain.toUpperCase()}`];
  const factoryAddress =
    process.env[`PANCAKE_FACTORY_ADDRESS_${chain.toUpperCase()}`];
  const rpcUrl = process.env[`PANCAKE_RPC_URL_${chain.toUpperCase()}`];
  const wethAddress =
    process.env[`PANCAKE_WRAPPED_ADDRESS_${chain.toUpperCase()}`] ||
    process.env[`PANCAKE_WETH_ADDRESS_${chain.toUpperCase()}`] ||
    process.env[`PANCAKE_WBNB_ADDRESS_${chain.toUpperCase()}`];

  if (!routerAddress || !factoryAddress || !rpcUrl || !wethAddress) {
    throw new Error(`Missing PancakeSwap configuration for chain: ${chain}`);
  }

  const privateKey = getPrivateKey(walletLabel, chain);
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);

  const router = new ethers.Contract(routerAddress, pancakeRouterAbi, signer);
  const factory = new ethers.Contract(
    factoryAddress,
    pancakeFactoryAbi,
    provider
  );

  return {
    provider,
    signer,
    router,
    factory,
    wethAddress,
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
    const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, signer);
    const currentAllowance = await tokenContract.allowance(
      signer.address,
      spenderAddress
    );

    console.log('Current Allowance:', currentAllowance.toString());

    if (currentAllowance.gte(amountInWei)) {
      console.log(`Already approved for ${spenderAddress}`);
      return;
    }

    const tx = await tokenContract.approve(spenderAddress, amountInWei);
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

const getBalance = async (address, provider) => {
  console.log(`Fetching balance for address: ${address}`);
  try {
    const balanceWei = await provider.getBalance(address);
    const balanceEther = ethers.formatEther(balanceWei);
    console.log(`Balance of ${address}: ${balanceEther} BNB/ETH`);
    return balanceEther;
  } catch (error) {
    console.error(`Error fetching balance for ${address}:`, error);
    throw error;
  }
};

async function getTokenDecimals(provider, tokenAddress) {
  try {
    const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, provider);
    const decimals = await tokenContract.decimals();
    return Number(decimals);
  } catch (error) {
    console.error(`Error getting token decimals for ${tokenAddress}:`, error);
    throw error;
  }
}

async function getTokenBalance(provider, tokenAddress, ownerAddress) {
  try {
    const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, provider);
    const balance = await tokenContract.balanceOf(ownerAddress);
    return balance;
  } catch (error) {
    console.error(
      `Error getting token balance for ${ownerAddress} of token ${tokenAddress}:`,
      error
    );
    throw error;
  }
}

async function getV2Quote(router, path, amountInWei) {
  try {
    console.log('Path: ', path);
    console.log('Amount In (wei): ', amountInWei);
    const amountsOut = await router.getAmountsOut(amountInWei, path);
    return amountsOut[amountsOut.length - 1];
  } catch (error) {
    console.error(`Error getting quote for path ${path}:`, error);
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

async function checkAllowance(
  provider,
  tokenAddress,
  signer,
  tokenDecimals,
  amountInWei,
  router
) {
  try {
    const balance = await getTokenBalance(
      provider,
      tokenAddress,
      signer.address
    );
    console.log(
      `Current Token Balance: ${ethers.formatUnits(balance, tokenDecimals)}`
    );

    const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, provider);
    const currentAllowance = await tokenContract.allowance(
      signer.address,
      router.target
    );
    console.log(
      `Current Allowance: ${ethers.formatUnits(currentAllowance, tokenDecimals)}`
    );

    if (currentAllowance < amountInWei) {
      console.log(
        `Insufficient allowance. Current allowance: ${ethers.formatUnits(currentAllowance, tokenDecimals)}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.error(`Error checking allowance for token ${tokenAddress}:`, error);
    throw error;
  }
}

// -----------------------
// Express Server Setup
// -----------------------

const app = express();
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again after 15 minutes.',
});
app.use(limiter);

// -----------------------
// PancakeSwap Endpoints
// -----------------------

app.post('/pancake-buy', async (req, res) => {
  let { chain, walletLabel, tokenAddress, amountInBnb, slippagePercent, path } =
    req.body;
  if (!walletLabel) walletLabel = 'MAIN';

  if (!chain || typeof chain !== 'string') {
    return res.status(400).json({ error: 'Invalid or missing "chain".' });
  }
  if (!tokenAddress) {
    return res
      .status(400)
      .json({ error: 'Invalid or missing "tokenAddress".' });
  }
  if (!amountInBnb || isNaN(amountInBnb) || Number(amountInBnb) <= 0) {
    return res.status(400).json({ error: 'Invalid or missing "amountInBnb".' });
  }

  try {
    const chainObj = initializePancakeSwap(chain.toLowerCase(), walletLabel);
    const { provider, signer, router, wethAddress } = chainObj;
    const amountInWei = ethers.parseEther(amountInBnb.toString());

    let swapPath = path || [wethAddress, tokenAddress];

    if (swapPath[0].toLowerCase() !== wethAddress.toLowerCase()) {
      throw new Error('Path must start with WBNB address for buy operations.');
    }

    const amountsOut = await router.getAmountsOut(amountInWei, swapPath);
    const estimatedAmountOut = amountsOut[amountsOut.length - 1];

    const slip = slippagePercent || 3;
    const sp = BigInt(100 - slip);
    const hundred = BigInt(100);
    const amountOutMin = (estimatedAmountOut * sp) / hundred;

    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

    const balance0 = await getTokenBalance(
      provider,
      tokenAddress,
      signer.address
    );

    const funcData = router.interface.encodeFunctionData(
      'swapExactETHForTokensSupportingFeeOnTransferTokens',
      [amountOutMin, swapPath, signer.address, deadline]
    );
    const txData = {
      to: router.target,
      data: funcData,
      value: amountInWei,
      from: signer.address,
    };

    const gasEstimate = await provider.estimateGas(txData);
    const feeDataObj = await provider.getFeeData();
    const gasPrice = feeDataObj.gasPrice || feeDataObj.maxFeePerGas;

    const gasBufferPercent = parseInt(process.env.GAS_BUFFER_PERCENT) || 100;
    const gasLimitWithBuffer =
      (gasEstimate * BigInt(100 + gasBufferPercent)) / BigInt(100);

    console.log('Gas Estimate:', gasEstimate.toString());
    console.log('Gas Limit with Buffer:', gasLimitWithBuffer.toString());

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
            `[NonceManager] Using nonce ${nonce} (attempt ${attempt}) for Pancake Buy`
          ),
      }
    );

    console.log(`Buy transaction sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`Buy transaction confirmed: ${receipt.hash}`);

    const tokenDecimals = await getTokenDecimals(provider, tokenAddress);
    const balance1 = await getTokenBalance(
      provider,
      tokenAddress,
      signer.address
    );
    const receivedAmountRaw = BigInt(balance1) - BigInt(balance0);
    const receivedAmount = ethers.formatUnits(
      receivedAmountRaw.toString(),
      tokenDecimals
    );

    return res.json({
      message: 'PancakeSwap Buy successful',
      txHash: receipt.hash,
      amountOutMin: ethers.formatUnits(amountOutMin, tokenDecimals),
      amountOutEstimate: ethers.formatUnits(estimatedAmountOut, tokenDecimals),
      amount: receivedAmount,
    });
  } catch (error) {
    console.error('PancakeSwap Buy failed:', error);
    return res
      .status(500)
      .json({ error: `PancakeSwap Buy transaction failed: ${error.message}` });
  }
});

app.post('/pancake-sell', async (req, res) => {
  let {
    chain,
    walletLabel,
    tokenAddress,
    amountInTokens,
    slippagePercent,
    path,
  } = req.body;
  if (!walletLabel) walletLabel = 'MAIN';

  if (!chain || typeof chain !== 'string') {
    return res.status(400).json({ error: 'Invalid or missing "chain".' });
  }
  if (!tokenAddress) {
    return res
      .status(400)
      .json({ error: 'Invalid or missing "tokenAddress".' });
  }
  if (!amountInTokens || isNaN(amountInTokens) || Number(amountInTokens) <= 0) {
    return res
      .status(400)
      .json({ error: 'Invalid or missing "amountInTokens".' });
  }

  try {
    const chainObj = initializePancakeSwap(chain.toLowerCase(), walletLabel);
    const { provider, signer, router, wethAddress } = chainObj;

    const tokenDecimals = await getTokenDecimals(provider, tokenAddress);
    const amount = amountInTokens - 0.0002 * amountInTokens;
    const amountInWei = ethers.parseUnits(amount.toString(), tokenDecimals);

    let swapPath = path || [tokenAddress, wethAddress];

    if (
      swapPath[swapPath.length - 1].toLowerCase() !== wethAddress.toLowerCase()
    ) {
      throw new Error('Path must end with WBNB address for sell operations.');
    }

    await approveToken(
      provider,
      signer,
      tokenAddress,
      router.target,
      amountInWei
    );

    const amountsOut = await router.getAmountsOut(amountInWei, swapPath);
    const estimatedAmountOut = amountsOut[amountsOut.length - 1];

    const slip = slippagePercent || 3;
    const sp = BigInt(100 - slip);
    const hundred = BigInt(100);
    const amountOutMin = (estimatedAmountOut * sp) / hundred;

    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

    const balance0 = await getBalance(signer.address, provider);

    const funcData = router.interface.encodeFunctionData(
      'swapExactTokensForETHSupportingFeeOnTransferTokens',
      [amountInWei, amountOutMin, swapPath, signer.address, deadline]
    );
    const txData = {
      to: router.target,
      data: funcData,
      from: signer.address,
    };

    const gasEstimate = await provider.estimateGas(txData);
    const feeDataObj = await provider.getFeeData();
    const gasPrice = feeDataObj.gasPrice || feeDataObj.maxFeePerGas;

    const gasBufferPercent = parseInt(process.env.GAS_BUFFER_PERCENT) || 100;
    const gasLimitWithBuffer =
      (gasEstimate * BigInt(100 + gasBufferPercent)) / BigInt(100);

    console.log('Gas Estimate:', gasEstimate.toString());
    console.log('Gas Limit with Buffer:', gasLimitWithBuffer.toString());

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
            `[NonceManager] Using nonce ${nonce} (attempt ${attempt}) for Pancake Sell`
          ),
      }
    );

    console.log(`Sell transaction sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`Sell transaction confirmed: ${receipt.hash}`);

    const balance1 = await getBalance(signer.address, provider);
    const receivedAmountRaw = parseFloat(balance1) - parseFloat(balance0);

    return res.json({
      message: 'PancakeSwap Sell successful',
      txHash: receipt.hash,
      amountOutMin: ethers.formatUnits(amountOutMin, 18),
      amountOutEstimate: ethers.formatUnits(estimatedAmountOut, 18),
      amount: receivedAmountRaw,
    });
  } catch (error) {
    console.error('PancakeSwap Sell failed:', error);
    return res
      .status(500)
      .json({ error: `PancakeSwap Sell transaction failed: ${error.message}` });
  }
});

app.post('/pancake-estimate-buy-cost', async (req, res) => {
  let { chain, walletLabel, tokenAddress, amountInBnb, slippagePercent, path } =
    req.body;
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
  if (!amountInBnb || isNaN(amountInBnb) || Number(amountInBnb) <= 0) {
    return res
      .status(400)
      .json({ error: 'Invalid or missing "amountInBnb" parameter.' });
  }

  try {
    const chainObj = initializePancakeSwap(chain.toLowerCase(), walletLabel);
    const { provider, signer, router, wethAddress } = chainObj;

    const amountInWei = ethers.parseEther(amountInBnb.toString());
    let swapPath = path || [wethAddress, tokenAddress];

    if (swapPath[0].toLowerCase() !== wethAddress.toLowerCase()) {
      throw new Error('Path must start with WBNB address for buy estimations.');
    }

    const amountsOut = await router.getAmountsOut(amountInWei, swapPath);
    const estimatedAmountOut = amountsOut[amountsOut.length - 1];
    console.log(
      'PancakeSwap Amount Out Estimate:',
      ethers.formatUnits(estimatedAmountOut, 18)
    );

    const slippage = slippagePercent || 3;
    const sp = BigInt(100 - slippage);
    const hundred = BigInt(100);
    const amountOutMinAdjusted = (estimatedAmountOut * sp) / hundred;
    console.log(
      'PancakeSwap Amount Out Min (Adjusted for Slippage):',
      ethers.formatUnits(amountOutMinAdjusted, 18)
    );

    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

    const txData = {
      to: router.target,
      from: signer.address,
      data: router.interface.encodeFunctionData(
        'swapExactETHForTokensSupportingFeeOnTransferTokens',
        [amountOutMinAdjusted, swapPath, signer.address, deadline]
      ),
      value: amountInWei,
    };

    const gasEstimate = await provider.estimateGas(txData);
    const feeDataObj = await provider.getFeeData();
    const gasPrice = feeDataObj.gasPrice || feeDataObj.maxFeePerGas;

    const totalCostWei = gasEstimate * gasPrice;
    const totalCostBnb = ethers.formatEther(totalCostWei);

    return res.json({
      message: 'Estimated PancakeSwap Buy cost',
      estimate: {
        gasEstimate: gasEstimate.toString(),
        gasPrice: gasPrice.toString(),
        totalCostWei: totalCostWei.toString(),
        amountOutMin: ethers.formatUnits(amountOutMinAdjusted, 18),
        amountOutEstimate: ethers.formatUnits(estimatedAmountOut, 18),
        totalCostBnb,
      },
    });
  } catch (error) {
    console.error('Estimate PancakeSwap Buy cost failed:', error);
    return res.status(500).json({
      error: `Failed to estimate PancakeSwap buy cost: ${error.message}`,
    });
  }
});

app.post('/pancake-estimate-sell-cost', async (req, res) => {
  let {
    chain,
    walletLabel,
    tokenAddress,
    amountInTokens,
    slippagePercent,
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
    const chainObj = initializePancakeSwap(chain.toLowerCase(), walletLabel);
    const { provider, signer, router, wethAddress } = chainObj;

    const tokenDecimals = await getTokenDecimals(provider, tokenAddress);
    const amountInWei = ethers.parseUnits(
      amountInTokens.toString(),
      tokenDecimals
    );

    let swapPath = path || [tokenAddress, wethAddress];

    if (
      swapPath[swapPath.length - 1].toLowerCase() !== wethAddress.toLowerCase()
    ) {
      throw new Error('Path must end with WBNB address for sell estimations.');
    }

    const amountsOut = await router.getAmountsOut(amountInWei, swapPath);
    const estimatedAmountOut = amountsOut[amountsOut.length - 1];
    console.log(
      'PancakeSwap Amount Out Estimate:',
      ethers.formatUnits(estimatedAmountOut, 18)
    );

    const slippage = slippagePercent || 3;
    const sp = BigInt(100 - slippage);
    const hundred = BigInt(100);
    const amountOutMinAdjusted = (estimatedAmountOut * sp) / hundred;
    console.log(
      'PancakeSwap Amount Out Min (Adjusted for Slippage):',
      ethers.formatUnits(amountOutMinAdjusted, 18)
    );

    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

    const txData = {
      to: router.target,
      from: signer.address,
      data: router.interface.encodeFunctionData(
        'swapExactTokensForETHSupportingFeeOnTransferTokens',
        [amountInWei, amountOutMinAdjusted, swapPath, signer.address, deadline]
      ),
      value: 0,
    };

    const gasEstimate = await provider.estimateGas(txData);
    const feeDataObj = await provider.getFeeData();
    const gasPrice = feeDataObj.gasPrice || feeDataObj.maxFeePerGas;

    const totalCostWei = gasEstimate * gasPrice;
    const totalCostBnb = ethers.formatEther(totalCostWei);

    return res.json({
      message: 'Estimated PancakeSwap Sell cost',
      estimate: {
        gasEstimate: gasEstimate.toString(),
        gasPrice: gasPrice.toString(),
        totalCostWei: totalCostWei.toString(),
        amountOutMin: ethers.formatUnits(amountOutMinAdjusted, 18),
        amountOutEstimate: ethers.formatUnits(estimatedAmountOut, 18),
        totalCostBnb,
      },
    });
  } catch (error) {
    console.error('Estimate PancakeSwap Sell cost failed:', error);
    return res.status(500).json({
      error: `Failed to estimate PancakeSwap sell cost: ${error.message}`,
    });
  }
});

app.post('/pancake-approve', async (req, res) => {
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
    const chainObj = initializePancakeSwap(chain.toLowerCase(), walletLabel);
    const { provider, signer, router } = chainObj;

    const tokenDecimals = await getTokenDecimals(provider, tokenAddress);
    const amountInWei = ethers.parseUnits(amount.toString(), tokenDecimals);

    await approveToken(
      provider,
      signer,
      tokenAddress,
      router.target,
      amountInWei * 10n
    );

    return res.json({ message: 'Approval successful for PancakeSwap router.' });
  } catch (error) {
    console.error('PancakeSwap Approval failed:', error);
    return res.status(500).json({ error: `Approval failed: ${error.message}` });
  }
});

async function swapTokensV2(
  chain,
  walletLabel = 'MAIN',
  tokenIn,
  tokenOut,
  amountInTokens,
  slippagePercent = 3,
  path = null
) {
  const chainObj = initializePancakeSwap(chain.toLowerCase(), walletLabel);
  const { provider, signer, router, wethAddress } = chainObj;

  if (!chain) throw new Error('Chain is required.');
  if (!tokenIn || !tokenOut || !amountInTokens)
    throw new Error('tokenIn, tokenOut, and amountInTokens are required.');

  console.log(
    `Attempting to swap ${amountInTokens} tokens from ${tokenIn} to ${tokenOut} on ${chain} chain.`
  );

  try {
    const tokenInDecimals = await getTokenDecimals(provider, tokenIn);
    const tokenOutDecimals = await getTokenDecimals(provider, tokenOut);

    let amount = amountInTokens - 0.0002 * amountInTokens;
    const roundedAmountStr = Number(amount).toFixed(tokenInDecimals);
    console.log('roundedAmountStr:', roundedAmountStr);

    const amountInParsed = ethers.parseUnits(
      roundedAmountStr.toString(),
      tokenInDecimals
    );

    if (!path) {
      path = [tokenIn, tokenOut];
    }

    console.log('Swap Path:', path);
    if (
      path[0].toLowerCase() !== tokenIn.toLowerCase() ||
      path[path.length - 1].toLowerCase() !== tokenOut.toLowerCase()
    ) {
      throw new Error(
        'Path must start with "tokenIn" and end with "tokenOut".'
      );
    }

    const balance0 = await getTokenBalance(provider, tokenOut, signer.address);

    const hasSufficientAllowance = await checkAllowance(
      provider,
      tokenIn,
      signer,
      tokenInDecimals,
      amountInParsed,
      router
    );
    if (!hasSufficientAllowance) {
      await approveToken(
        provider,
        signer,
        tokenIn,
        router.target,
        amountInParsed * 10n
      );
      console.log(`Approved router ${router.target} to spend tokens.`);
    } else {
      console.log('Sufficient allowance detected.');
    }

    const amountOutEstimate = await getV2Quote(router, path, amountInParsed);
    const amountOutMin = calculateAmountOutMinBigNumber(
      amountOutEstimate.toString(),
      slippagePercent
    );
    console.log(
      `Amount Out Min (after ${slippagePercent}% slippage): ${amountOutMin.toString()}`
    );

    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

    const txData = {
      to: router.target,
      from: signer.address,
      data: router.interface.encodeFunctionData(
        'swapExactTokensForTokensSupportingFeeOnTransferTokens',
        [
          ethers.toBeHex(amountInParsed),
          ethers.toBeHex(amountOutMin),
          path,
          signer.address,
          deadline,
        ]
      ),
    };

    console.log('Transaction Data:', txData);

    const estimatedGas = await provider.estimateGas(txData);
    console.log(`Estimated Gas: ${estimatedGas.toString()}`);

    const gasBufferPercent = parseInt(process.env.GAS_BUFFER_PERCENT) || 100;
    const gasLimitWithBuffer =
      (estimatedGas * BigInt(100 + gasBufferPercent)) / BigInt(100);
    console.log(
      `Gas Limit with Buffer (${gasBufferPercent}%): ${gasLimitWithBuffer.toString()}`
    );

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
            `[NonceManager] Using nonce ${nonce} (attempt ${attempt}) for Pancake Token-Token Swap`
          ),
      }
    );

    console.log('Transaction Sent:', tx.hash);
    const receipt = await tx.wait();
    console.log('Transaction Confirmed:', receipt.hash);

    const balance1 = await getTokenBalance(provider, tokenOut, signer.address);
    const receivedAmountRaw = BigInt(balance1) - BigInt(balance0);
    const receivedAmount = ethers.formatUnits(
      receivedAmountRaw.toString(),
      tokenOutDecimals
    );
    console.log(`Received Amount: ${receivedAmount}`);

    return { receipt, receivedAmount };
  } catch (error) {
    console.error('Token-to-Token Swap Transaction Failed:', error);
    throw error;
  }
}

async function estimateSwapV2Cost(
  chain,
  walletLabel = 'MAIN',
  tokenIn,
  tokenOut,
  amountInTokens,
  slippagePercent = 3,
  path = null
) {
  const chainObj = initializePancakeSwap(chain.toLowerCase(), walletLabel);
  const { provider, signer, router, wethAddress } = chainObj;

  if (!chain) throw new Error('Chain is required.');
  if (!tokenIn || !tokenOut || !amountInTokens)
    throw new Error('tokenIn, tokenOut, and amountInTokens are required.');

  console.log(
    `Estimating swap of ${amountInTokens} tokens from ${tokenIn} to ${tokenOut} on ${chain} chain.`
  );

  try {
    const tokenInDecimals = await getTokenDecimals(provider, tokenIn);
    const tokenOutDecimals = await getTokenDecimals(provider, tokenOut);

    let amount = amountInTokens - 0.0002 * amountInTokens;
    const roundedAmountStr = Number(amount).toFixed(tokenInDecimals);
    console.log('roundedAmountStr:', roundedAmountStr);

    const amountInParsed = ethers.parseUnits(
      roundedAmountStr.toString(),
      tokenInDecimals
    );

    if (!path) {
      path = [tokenIn, tokenOut];
    }

    if (
      path[0].toLowerCase() !== tokenIn.toLowerCase() ||
      path[path.length - 1].toLowerCase() !== tokenOut.toLowerCase()
    ) {
      throw new Error(
        'Path must start with "tokenIn" and end with "tokenOut".'
      );
    }

    const amountOutEstimate = await getV2Quote(router, path, amountInParsed);
    const amountOutMin = calculateAmountOutMinBigNumber(
      amountOutEstimate.toString(),
      slippagePercent
    );
    console.log(
      `Amount Out Min (after ${slippagePercent}% slippage): ${amountOutMin.toString()}`
    );

    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

    const txData = {
      to: router.target,
      from: signer.address,
      data: router.interface.encodeFunctionData(
        'swapExactTokensForTokensSupportingFeeOnTransferTokens',
        [
          ethers.toBeHex(amountInParsed),
          ethers.toBeHex(amountOutMin),
          path,
          signer.address,
          deadline,
        ]
      ),
    };

    const gasEstimate = await provider.estimateGas(txData);
    console.log(`Estimated Gas: ${gasEstimate.toString()}`);

    const feeDataObj = await provider.getFeeData();
    const gasPrice = feeDataObj.gasPrice || feeDataObj.maxFeePerGas;
    const totalCostWei = gasEstimate * gasPrice;
    const totalCostBnb = ethers.formatEther(totalCostWei);
    console.log(`Total Cost (BNB/ETH): ${totalCostBnb}`);

    return {
      gasEstimate: gasEstimate.toString(),
      gasPrice: gasPrice.toString(),
      totalCostWei: totalCostWei.toString(),
      amountOutMin: ethers.formatUnits(amountOutMin, tokenOutDecimals),
      amountOutEstimate: ethers.formatUnits(
        amountOutEstimate,
        tokenOutDecimals
      ),
      totalCostBnb,
    };
  } catch (error) {
    console.error('Gas estimation failed:', error);
    throw new Error(`Gas estimation failed: ${error.message}`);
  }
}

app.post('/pancake-swap', async (req, res) => {
  let {
    chain,
    walletLabel,
    tokenIn,
    tokenOut,
    amountInTokens,
    slippagePercent,
    path,
  } = req.body;
  if (!walletLabel) walletLabel = 'MAIN';

  if (!chain || typeof chain !== 'string') {
    return res
      .status(400)
      .json({ error: 'Invalid or missing "chain" parameter.' });
  }
  if (!tokenIn || !tokenOut || !amountInTokens) {
    return res
      .status(400)
      .json({ error: 'Missing chain, tokenIn, tokenOut, or amountInTokens.' });
  }

  try {
    const { receipt, receivedAmount } = await swapTokensV2(
      chain,
      walletLabel,
      tokenIn,
      tokenOut,
      amountInTokens,
      slippagePercent || 3,
      path
    );

    return res.json({
      message: 'PancakeSwap Token-to-Token Swap successful',
      txHash: receipt.hash,
      amount: receivedAmount,
    });
  } catch (error) {
    console.error('PancakeSwap Token-to-Token Swap failed:', error);
    if (
      error.message.includes('exceeds the maximum allowed gas') ||
      error.code === 'INSUFFICIENT_FUNDS'
    ) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({
      error: `PancakeSwap Token-to-Token Swap transaction failed: ${error.message}`,
    });
  }
});

app.post('/pancake-estimate-swap-cost', async (req, res) => {
  let {
    chain,
    walletLabel,
    tokenIn,
    tokenOut,
    amountInTokens,
    slippagePercent,
    path,
  } = req.body;
  if (!walletLabel) walletLabel = 'MAIN';

  if (!chain || typeof chain !== 'string') {
    return res
      .status(400)
      .json({ error: 'Invalid or missing "chain" parameter.' });
  }
  if (!tokenIn || !tokenOut || !amountInTokens) {
    return res
      .status(400)
      .json({ error: 'Missing tokenIn, tokenOut, or amountInTokens.' });
  }

  try {
    const estimate = await estimateSwapV2Cost(
      chain,
      walletLabel,
      tokenIn,
      tokenOut,
      amountInTokens,
      slippagePercent || 3,
      path
    );
    return res.json({
      message: 'Estimated PancakeSwap Swap cost',
      estimate,
    });
  } catch (error) {
    console.error('Estimate PancakeSwap Swap cost failed:', error);
    return res.status(500).json({
      error: `Failed to estimate PancakeSwap swap cost: ${error.message}`,
    });
  }
});

// -----------------------
// Start the Server
// -----------------------
const PORT = process.env.PANCAKE_PORT || 3002;
const HOST = process.env.HOST || '127.0.0.1';
app.listen(PORT, HOST, () => {
  console.log(`\nPancakeSwap Service running on ${HOST}:${PORT}`);
  console.log(`Endpoints:
    - POST /pancake-approve
    - POST /pancake-buy
    - POST /pancake-sell
    - POST /pancake-estimate-buy-cost
    - POST /pancake-estimate-sell-cost
    - POST /pancake-swap
    - POST /pancake-estimate-swap-cost
  `);
});
