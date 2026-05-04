require('dotenv').config();
const express = require('express');
const { ethers } = require('ethers');
const { sendTransactionWithNonce } = require('./utils/nonceManager');

// Define chain configurations without privateKey
const chainConfigs = {
  ethereum: {
    rpcUrl: process.env.UNI_V2_RPC_URL_ETHEREUM,
    wethAddress: process.env.UNI_V2_WETH_ADDRESS_ETHEREUM,
    routerAddress: process.env.UNI_V2_ROUTER_ADDRESS_ETHEREUM,
    maxGas: parseInt(process.env.MAX_GAS_ETHEREUM) || 200000,
  },
  polygon: {
    rpcUrl: process.env.UNI_V2_RPC_URL_POLYGON,
    wethAddress: process.env.UNI_V2_WETH_ADDRESS_POLYGON,
    routerAddress: process.env.UNI_V2_ROUTER_ADDRESS_POLYGON,
  },
  base: {
    rpcUrl: process.env.UNI_V2_RPC_URL_BASE,
    wethAddress: process.env.UNI_V2_WETH_ADDRESS_BASE,
    routerAddress: process.env.UNI_V2_ROUTER_ADDRESS_BASE,
  },
  arbitrum: {
    rpcUrl: process.env.UNI_V2_RPC_URL_ARBITRUM,
    wethAddress: process.env.UNI_V2_WETH_ADDRESS_ARBITRUM,
    routerAddress: process.env.UNI_V2_ROUTER_ADDRESS_ARBITRUM,
  },
  // Add more chains as needed
};

// -----------------------
// ABIs
// -----------------------
const v2RouterAbi = [
  {
    inputs: [
      { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
      { internalType: 'address[]', name: 'path', type: 'address[]' },
    ],
    name: 'getAmountsOut',
    outputs: [
      { internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'amountOutMin', type: 'uint256' },
      { internalType: 'address[]', name: 'path', type: 'address[]' },
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'deadline', type: 'uint256' },
    ],
    name: 'swapExactETHForTokensSupportingFeeOnTransferTokens',
    outputs: [
      { internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
      { internalType: 'uint256', name: 'amountOutMin', type: 'uint256' },
      { internalType: 'address[]', name: 'path', type: 'address[]' },
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'deadline', type: 'uint256' },
    ],
    name: 'swapExactTokensForETHSupportingFeeOnTransferTokens',
    outputs: [
      { internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
      { internalType: 'uint256', name: 'amountOutMin', type: 'uint256' },
      { internalType: 'address[]', name: 'path', type: 'address[]' },
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'deadline', type: 'uint256' },
    ],
    name: 'swapExactTokensForTokensSupportingFeeOnTransferTokens',
    outputs: [
      { internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

const erc20Abi = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address owner) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
];

// Helper function to get private key based on label and chain with "MAIN" as default
function getPrivateKey(label = 'MAIN', chain) {
  const envVar = `UNI_V2_PRIVATE_KEY_${label.toUpperCase()}_${chain.toUpperCase()}`;
  const privateKey = process.env[envVar];
  if (!privateKey) {
    throw new Error(
      `Private key not found for label "${label}" on chain "${chain}"`
    );
  }
  return privateKey;
}

// Helper function to initialize chain-specific objects
function getChainObjects(chain, walletLabel = 'MAIN') {
  const config = chainConfigs[chain];
  if (!config) {
    throw new Error(`Unsupported chain: ${chain}`);
  }
  const privateKey = getPrivateKey(walletLabel, chain);
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);
  const v2Router = new ethers.Contract(
    config.routerAddress,
    v2RouterAbi,
    signer
  );

  console.log(`Initialized Router Address: ${v2Router.target}`);

  return {
    provider,
    signer,
    v2Router,
    wethAddress: config.wethAddress,
    maxGas: config.maxGas,
  };
}

// Helper Functions
const getBalance = async (address, provider) => {
  console.log(address);
  try {
    const balanceWei = await provider.getBalance(address);
    const balanceEther = ethers.formatEther(balanceWei);
    console.log(`Balance of ${address}: ${balanceEther} ETH/MATIC`);
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

async function getV2Quote(v2Router, path, amountInWei) {
  try {
    console.log('Path: ', path);
    console.log('Amount In (wei): ', amountInWei);
    const amountsOut = await v2Router.getAmountsOut(amountInWei, path);
    return amountsOut[amountsOut.length - 1];
  } catch (error) {
    console.error(`Error getting quote for path ${path}:`, error);
    throw error;
  }
}

async function approveToken(signer, tokenAddress, amountInWei, routerAddress) {
  try {
    const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, signer);

    const currentAllowance = await tokenContract.allowance(
      signer.address,
      routerAddress
    );
    if (currentAllowance >= amountInWei) {
      console.log(
        `Current allowance (${currentAllowance.toString()}) is sufficient for router ${routerAddress}`
      );
      return;
    }

    const tx = await tokenContract.approve(routerAddress, amountInWei);
    await tx.wait();
    console.log(
      `Approved router ${routerAddress} to spend ${amountInWei.toString()} of token ${tokenAddress}`
    );
  } catch (error) {
    console.error(
      `Error approving token ${tokenAddress} for router ${routerAddress}:`,
      error
    );
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
  v2Router
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
      v2Router.target
    );
    console.log(
      `Current Allowance: ${ethers.formatUnits(currentAllowance, tokenDecimals)}`
    );

    if (currentAllowance < amountInWei) {
      console.log(`Insufficient allowance. Approving router to spend tokens.`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`Error checking allowance for token ${tokenAddress}:`, error);
    throw error;
  }
}

// Transaction Functions
async function buyTokenV2(
  chain,
  walletLabel = 'MAIN',
  tokenAddress,
  amountInEth,
  slippagePercent = 3,
  path = null
) {
  const { provider, signer, v2Router, wethAddress, maxGas } = getChainObjects(
    chain,
    walletLabel
  );
  const tokenDecimals = await getTokenDecimals(provider, tokenAddress);
  const amountInWei = ethers.parseUnits(amountInEth.toString(), 18);

  if (!path) {
    path = [wethAddress, tokenAddress];
  }

  console.log(path);
  if (path[0].toLowerCase() !== wethAddress.toLowerCase()) {
    throw new Error(
      'Path must start with WETH/WMATIC address for buy operations.'
    );
  }

  const amountOutEstimate = await getV2Quote(v2Router, path, amountInWei);
  console.log(`Amount Out Estimate: ${amountOutEstimate.toString()}`);
  const amountOutMin = calculateAmountOutMinBigNumber(
    amountOutEstimate.toString(),
    slippagePercent
  );
  console.log(
    `Amount Out Min (after ${slippagePercent}% slippage): ${amountOutMin.toString()}`
  );
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

  const inputIsETH = path[0].toLowerCase() === wethAddress.toLowerCase();
  let txData;

  if (inputIsETH) {
    txData = {
      to: v2Router.target,
      from: signer.address,
      data: v2Router.interface.encodeFunctionData(
        'swapExactETHForTokensSupportingFeeOnTransferTokens',
        [ethers.toBeHex(amountOutMin), path, signer.address, deadline]
      ),
      value: amountInWei,
    };
  } else {
    await approveToken(signer, path[0], amountInWei * 10n, v2Router.target);
    txData = {
      to: v2Router.target,
      from: signer.address,
      data: v2Router.interface.encodeFunctionData(
        'swapExactTokensForTokensSupportingFeeOnTransferTokens',
        [
          ethers.toBeHex(amountInWei),
          ethers.toBeHex(amountOutMin),
          path,
          signer.address,
          deadline,
        ]
      ),
    };
  }

  try {
    const estimatedGas = await provider.estimateGas(txData);
    console.log(`Estimated Gas: ${estimatedGas.toString()}`);

    if (chain.toLowerCase() === 'ethereum' && maxGas) {
      if (estimatedGas > maxGas) {
        throw new Error(
          `Estimated gas (${estimatedGas.toString()}) exceeds the maximum allowed gas (${maxGas})`
        );
      } else {
        console.log(`Estimated gas is within the allowed limit (${maxGas})`);
      }
    } else {
      console.log(`No gas limit restrictions for ${chain} chain`);
    }

    const gasBufferPercent = parseInt(process.env.GAS_BUFFER_PERCENT) || 10;
    const gasLimitWithBuffer =
      (estimatedGas * BigInt(100 + gasBufferPercent)) / BigInt(100);
    console.log(
      `Gas Limit with Buffer (${gasBufferPercent}%): ${gasLimitWithBuffer.toString()}`
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
          console.log(
            `[NonceManager] Using nonce ${nonce} (attempt ${attempt}) for Uniswap V2 Buy`
          ),
      }
    );

    const receipt = await tx.wait();
    console.log('Transaction Confirmed:', receipt.hash);
    return receipt;
  } catch (error) {
    console.error('Buy Transaction Failed:', error);
    throw error;
  }
}

async function sellTokenV2(
  chain,
  walletLabel = 'MAIN',
  tokenAddress,
  amountInTokens,
  slippagePercent = 3,
  path = null
) {
  const { provider, signer, v2Router, wethAddress, maxGas } = getChainObjects(
    chain,
    walletLabel
  );

  if (!chain) throw new Error('Chain is required.');
  if (!tokenAddress || !amountInTokens)
    throw new Error('tokenAddress and amountInTokens are required.');

  console.log(`Attempting to sell ${amountInTokens} tokens on ${chain} chain.`);

  try {
    const tokenDecimals = await getTokenDecimals(provider, tokenAddress);
    let amount = amountInTokens - 0.0002 * amountInTokens;
    const roundedAmountStr = Number(amount).toFixed(tokenDecimals);
    console.log('roundedAmountStr:', roundedAmountStr);

    const amountInWei = ethers.parseUnits(roundedAmountStr, tokenDecimals);
    console.log(`Amount to Sell (wei): ${amountInWei.toString()}`);

    if (!path) {
      path = [tokenAddress, wethAddress];
    }

    if (path[path.length - 1].toLowerCase() !== wethAddress.toLowerCase()) {
      throw new Error(
        'Path must end with WETH/WMATIC address for sell operations.'
      );
    }

    const hasSufficientAllowance = await checkAllowance(
      provider,
      tokenAddress,
      signer,
      tokenDecimals,
      amountInWei,
      v2Router
    );
    if (!hasSufficientAllowance) {
      await approveToken(
        signer,
        tokenAddress,
        amountInWei * 10n,
        v2Router.target
      );
      console.log(`Approved router ${v2Router.target} to spend tokens.`);
    } else {
      console.log('Sufficient allowance detected.');
    }

    const amountOutEstimate = await getV2Quote(v2Router, path, amountInWei);
    console.log(`Amount Out Estimate: ${amountOutEstimate.toString()}`);
    const amountOutMin = calculateAmountOutMinBigNumber(
      amountOutEstimate.toString(),
      slippagePercent
    );
    console.log(
      `Amount Out Min (after ${slippagePercent}% slippage): ${amountOutMin.toString()}`
    );
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

    const outputIsETH =
      path[path.length - 1].toLowerCase() === wethAddress.toLowerCase();
    let txData = {
      to: v2Router.target,
      from: signer.address,
      data: null,
    };

    if (outputIsETH) {
      txData.data = v2Router.interface.encodeFunctionData(
        'swapExactTokensForETHSupportingFeeOnTransferTokens',
        [
          ethers.toBeHex(amountInWei),
          ethers.toBeHex(amountOutMin),
          path,
          signer.address,
          deadline,
        ]
      );
    } else {
      txData.data = v2Router.interface.encodeFunctionData(
        'swapExactTokensForTokensSupportingFeeOnTransferTokens',
        [
          ethers.toBeHex(amountInWei),
          ethers.toBeHex(amountOutMin),
          path,
          signer.address,
          deadline,
        ]
      );
    }

    const estimatedGas = await provider.estimateGas(txData);
    console.log(`Estimated Gas: ${estimatedGas.toString()}`);

    if (chain.toLowerCase() === 'ethereum' && maxGas) {
      if (estimatedGas > maxGas) {
        throw new Error(
          `Estimated gas (${estimatedGas.toString()}) exceeds the maximum allowed gas (${maxGas})`
        );
      } else {
        console.log(`Estimated gas is within the allowed limit (${maxGas})`);
      }
    } else {
      console.log(`No gas limit restrictions for ${chain} chain`);
    }

    const gasBufferPercent = parseInt(process.env.GAS_BUFFER_PERCENT) || 10;
    const gasLimitWithBuffer =
      (estimatedGas * BigInt(100 + gasBufferPercent)) / BigInt(100);
    console.log(
      `Gas Limit with Buffer (${gasBufferPercent}%): ${gasLimitWithBuffer.toString()}`
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
          console.log(
            `[NonceManager] Using nonce ${nonce} (attempt ${attempt}) for Uniswap V2 Sell`
          ),
      }
    );

    console.log('Transaction Sent:', tx.hash);
    const receipt = await tx.wait();
    console.log('Transaction Confirmed:', receipt.hash);
    return receipt;
  } catch (error) {
    console.error('Sell Transaction Failed:', error);
    throw error;
  }
}

async function swapTokensV2(
  chain,
  walletLabel = 'MAIN',
  tokenIn,
  tokenOut,
  amountInTokens,
  slippagePercent = 3,
  path = null
) {
  const { provider, signer, v2Router, wethAddress, maxGas } = getChainObjects(
    chain,
    walletLabel
  );

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
      v2Router
    );
    if (!hasSufficientAllowance) {
      await approveToken(
        signer,
        tokenIn,
        amountInParsed * 10n,
        v2Router.target
      );
      console.log(`Approved router ${v2Router.target} to spend tokens.`);
    } else {
      console.log('Sufficient allowance detected.');
    }

    const amountOutEstimate = await getV2Quote(v2Router, path, amountInParsed);
    const amountOutMin = calculateAmountOutMinBigNumber(
      amountOutEstimate.toString(),
      slippagePercent
    );
    console.log(
      `Amount Out Min (after ${slippagePercent}% slippage): ${amountOutMin.toString()}`
    );
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

    const txData = {
      to: v2Router.target,
      from: signer.address,
      data: v2Router.interface.encodeFunctionData(
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

    if (chain.toLowerCase() === 'ethereum' && maxGas) {
      if (estimatedGas > maxGas) {
        throw new Error(
          `Estimated gas (${estimatedGas.toString()}) exceeds the maximum allowed gas (${maxGas})`
        );
      } else {
        console.log(`Estimated gas is within the allowed limit (${maxGas})`);
      }
    } else {
      console.log(`No gas limit restrictions for ${chain} chain`);
    }

    const gasBufferPercent = parseInt(process.env.GAS_BUFFER_PERCENT) || 10;
    const gasLimitWithBuffer =
      (estimatedGas * BigInt(100 + gasBufferPercent)) / BigInt(100);
    console.log(
      `Gas Limit with Buffer (${gasBufferPercent}%): ${gasLimitWithBuffer.toString()}`
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
          console.log(
            `[NonceManager] Using nonce ${nonce} (attempt ${attempt}) for Uniswap V2 Token-Token Swap`
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

// Estimate Functions
async function estimateBuyV2Cost(
  chain,
  walletLabel = 'MAIN',
  tokenAddress,
  amountInEth,
  slippagePercent = 3,
  path = null
) {
  const { provider, signer, v2Router, wethAddress } = getChainObjects(
    chain,
    walletLabel
  );
  const tokenDecimals = await getTokenDecimals(provider, tokenAddress);
  const amountInWei = ethers.parseUnits(amountInEth.toString(), 18);

  if (!path) {
    path = [wethAddress, tokenAddress];
  }

  if (path[0].toLowerCase() !== wethAddress.toLowerCase()) {
    throw new Error(
      'Path must start with WETH/WMATIC address for buy estimations.'
    );
  }

  const amountOutEstimate = await getV2Quote(v2Router, path, amountInWei);
  const sp = BigInt(100 - slippagePercent);
  const hundred = BigInt(100);
  const amountOutMin = (BigInt(amountOutEstimate.toString()) * sp) / hundred;
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

  const inputIsETH = path[0].toLowerCase() === wethAddress.toLowerCase();
  let txData = { to: v2Router.target, from: signer.address };

  if (inputIsETH) {
    txData.data = v2Router.interface.encodeFunctionData(
      'swapExactETHForTokensSupportingFeeOnTransferTokens',
      [ethers.toBeHex(amountOutMin), path, signer.address, deadline]
    );
    txData.value = amountInWei;
  } else {
    txData.data = v2Router.interface.encodeFunctionData(
      'swapExactTokensForTokensSupportingFeeOnTransferTokens',
      [
        ethers.toBeHex(amountInWei),
        ethers.toBeHex(amountOutMin),
        path,
        signer.address,
        deadline,
      ]
    );
  }

  try {
    const gasEstimate = await provider.estimateGas(txData);
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice;

    const gasEstimateBigInt = gasEstimate;
    const gasPriceBigInt = gasPrice;
    const totalCostWei = gasEstimateBigInt * gasPriceBigInt;
    const totalCostEth = ethers.formatEther(totalCostWei);
    console.log(`Total Cost (ETH): ${totalCostEth}`);

    return {
      gasEstimate: gasEstimate.toString(),
      gasPrice: gasPrice?.toString(),
      totalCostWei: totalCostWei.toString(),
      amountOutMin: amountOutMin.toString(),
      amountOutEstimate: amountOutEstimate.toString(),
      totalCostEth,
    };
  } catch (error) {
    throw new Error(`Gas estimation failed: ${error.message}`);
  }
}

async function estimateSellV2Cost(
  chain,
  walletLabel = 'MAIN',
  tokenAddress,
  amountInTokens,
  slippagePercent = 3,
  path = null
) {
  const { provider, signer, v2Router, wethAddress } = getChainObjects(
    chain,
    walletLabel
  );
  const tokenDecimals = await getTokenDecimals(provider, tokenAddress);
  const amountInWei = ethers.parseUnits(
    amountInTokens.toString(),
    tokenDecimals
  );

  if (!path) {
    path = [tokenAddress, wethAddress];
  }

  if (path[path.length - 1].toLowerCase() !== wethAddress.toLowerCase()) {
    throw new Error(
      'Path must end with WETH/WMATIC address for sell estimations.'
    );
  }

  const amountOutEstimate = await getV2Quote(v2Router, path, amountInWei);
  console.log('amountOutEstimate: ', amountOutEstimate);
  const sp = BigInt(100 - slippagePercent);
  const hundred = BigInt(100);
  const amountOutMin = (BigInt(amountOutEstimate.toString()) * sp) / hundred;
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

  let txData = { to: v2Router.target, from: signer.address };
  const outputIsETH =
    path[path.length - 1].toLowerCase() === wethAddress.toLowerCase();
  console.log('outputIsETH: ', outputIsETH);

  if (outputIsETH) {
    txData.data = v2Router.interface.encodeFunctionData(
      'swapExactTokensForETHSupportingFeeOnTransferTokens',
      [
        ethers.toBeHex(amountInWei),
        ethers.toBeHex(amountOutMin),
        path,
        signer.address,
        deadline,
      ]
    );
  } else {
    txData.data = v2Router.interface.encodeFunctionData(
      'swapExactTokensForTokensSupportingFeeOnTransferTokens',
      [
        ethers.toBeHex(amountInWei),
        ethers.toBeHex(amountOutMin),
        path,
        signer.address,
        deadline,
      ]
    );
  }

  try {
    const gasEstimate = await provider.estimateGas(txData);
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice;

    const gasEstimateBigInt = gasEstimate;
    const gasPriceBigInt = gasPrice;
    const totalCostWei = gasEstimateBigInt * gasPriceBigInt;
    const totalCostEth = ethers.formatEther(totalCostWei);
    console.log(`Total Cost (ETH): ${totalCostEth}`);

    return {
      gasEstimate: gasEstimate.toString(),
      gasPrice: gasPrice?.toString(),
      totalCostWei: totalCostWei.toString(),
      amountOutMin: amountOutMin.toString(),
      amountOutEstimate: amountOutEstimate.toString(),
      totalCostEth,
    };
  } catch (error) {
    throw new Error(`Gas estimation failed: ${error.message}`);
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
  const { provider, signer, v2Router, wethAddress } = getChainObjects(
    chain,
    walletLabel
  );
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
      'Path must start with "tokenIn" and end with "tokenOut" for swap estimations.'
    );
  }

  const amountOutEstimate = await getV2Quote(v2Router, path, amountInParsed);
  const amountOutMin = calculateAmountOutMinBigNumber(
    amountOutEstimate.toString(),
    slippagePercent
  );
  console.log(
    `Amount Out Min (after ${slippagePercent}% slippage): ${amountOutMin.toString()}`
  );
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

  let txData = { to: v2Router.target, from: signer.address };
  txData.data = v2Router.interface.encodeFunctionData(
    'swapExactTokensForTokensSupportingFeeOnTransferTokens',
    [
      ethers.toBeHex(amountInParsed),
      ethers.toBeHex(amountOutMin),
      path,
      signer.address,
      deadline,
    ]
  );

  try {
    const gasEstimate = await provider.estimateGas(txData);
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice;

    const gasEstimateBigInt = gasEstimate;
    const gasPriceBigInt = gasPrice;
    const totalCostWei = gasEstimateBigInt * gasPriceBigInt;
    const totalCostEth = ethers.formatEther(totalCostWei);
    console.log(`Total Cost (ETH): ${totalCostEth}`);

    return {
      gasEstimate: gasEstimate.toString(),
      gasPrice: gasPrice?.toString(),
      totalCostWei: totalCostWei.toString(),
      amountOutMin: amountOutMin.toString(),
      amountOutEstimate: amountOutEstimate.toString(),
      totalCostEth,
    };
  } catch (error) {
    throw new Error(`Gas estimation failed: ${error.message}`);
  }
}

// Express Server Setup
const app = express();
app.use(express.json());

// POST /approve
app.post('/approve', async (req, res) => {
  let { chain, walletLabel, tokenAddress, amount } = req.body;
  if (!walletLabel) walletLabel = 'MAIN';
  if (!chain || !tokenAddress || !amount) {
    return res
      .status(400)
      .json({ error: 'chain, tokenAddress, and amount are required.' });
  }

  try {
    const { provider, signer, v2Router } = getChainObjects(chain, walletLabel);
    const tokenDecimals = await getTokenDecimals(provider, tokenAddress);
    const amountInWei = ethers.parseUnits(amount.toString(), tokenDecimals);

    await approveToken(
      signer,
      tokenAddress,
      amountInWei * 10n,
      v2Router.target
    );

    return res.json({ message: 'Approval successful.' });
  } catch (error) {
    console.error('Approval failed:', error);
    return res.status(500).json({ error: `Approval failed: ${error.message}` });
  }
});

// POST /uni-v2-buy
app.post('/uni-v2-buy', async (req, res) => {
  let { chain, walletLabel, tokenAddress, amountInEth, slippagePercent, path } =
    req.body;
  if (!walletLabel) walletLabel = 'MAIN';
  if (!chain || !tokenAddress || !amountInEth) {
    return res
      .status(400)
      .json({ error: 'chain, tokenAddress, and amountInEth are required.' });
  }

  try {
    const { provider, signer } = getChainObjects(chain, walletLabel);
    const tokenDecimals = await getTokenDecimals(provider, tokenAddress);
    const balance0 = await getTokenBalance(
      provider,
      tokenAddress,
      signer.address
    );
    const receipt = await buyTokenV2(
      chain,
      walletLabel,
      tokenAddress,
      amountInEth,
      slippagePercent || 3,
      path
    );
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
    console.log(`Received Amount: ${receivedAmount}`);
    return res.json({
      message: 'V2 Buy successful',
      txHash: receipt.hash,
      amount: receivedAmount,
    });
  } catch (error) {
    console.error('V2 Buy failed:', error);
    if (
      error.message.includes('exceeds the maximum allowed gas') ||
      error.code === 'INSUFFICIENT_FUNDS'
    ) {
      return res.status(400).json({ error: error.message });
    }
    return res
      .status(500)
      .json({ error: `V2 Buy transaction failed: ${error.message}` });
  }
});

// POST /uni-v2-sell
app.post('/uni-v2-sell', async (req, res) => {
  let {
    chain,
    walletLabel,
    tokenAddress,
    amountInTokens,
    slippagePercent,
    path,
  } = req.body;
  if (!walletLabel) walletLabel = 'MAIN';
  if (!chain || !tokenAddress || !amountInTokens) {
    return res
      .status(400)
      .json({ error: 'chain, tokenAddress, and amountInTokens are required.' });
  }

  console.log(amountInTokens);

  try {
    const { provider, signer } = getChainObjects(chain, walletLabel);
    const tokenDecimals = await getTokenDecimals(provider, tokenAddress);
    const balance0 = await getBalance(signer.address, provider);
    const receipt = await sellTokenV2(
      chain,
      walletLabel,
      tokenAddress,
      amountInTokens,
      slippagePercent || 3,
      path
    );
    const balance1 = await getBalance(signer.address, provider);

    const receivedAmountRaw = balance1 - balance0;
    console.log(`Received Amount: ${receivedAmountRaw}`);
    return res.json({
      message: 'V2 Sell successful',
      txHash: receipt.hash,
      amount: receivedAmountRaw,
    });
  } catch (error) {
    console.error('V2 Sell failed:', error);
    if (
      error.message.includes('exceeds the maximum allowed gas') ||
      error.code === 'INSUFFICIENT_FUNDS'
    ) {
      return res.status(400).json({ error: error.message });
    }
    return res
      .status(500)
      .json({ error: `V2 Sell transaction failed: ${error.message}` });
  }
});

// POST /uni-v2-swap
app.post('/uni-v2-swap', async (req, res) => {
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
  if (!chain || !tokenIn || !tokenOut || !amountInTokens) {
    return res.status(400).json({
      error: 'chain, tokenIn, tokenOut, and amountInTokens are required.',
    });
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
      message: 'V2 Token-to-Token Swap successful',
      txHash: receipt.hash,
      amount: receivedAmount,
    });
  } catch (error) {
    console.error('V2 Token-to-Token Swap failed:', error);
    if (
      error.message.includes('exceeds the maximum allowed gas') ||
      error.code === 'INSUFFICIENT_FUNDS'
    ) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({
      error: `V2 Token-to-Token Swap transaction failed: ${error.message}`,
    });
  }
});

// POST /uni-v2-estimate-buy-cost
app.post('/uni-v2-estimate-buy-cost', async (req, res) => {
  let { chain, walletLabel, tokenAddress, amountInEth, slippagePercent, path } =
    req.body;
  if (!walletLabel) walletLabel = 'MAIN';
  if (!chain || !tokenAddress || !amountInEth) {
    return res
      .status(400)
      .json({ error: 'chain, tokenAddress, and amountInEth are required.' });
  }

  try {
    const estimate = await estimateBuyV2Cost(
      chain,
      walletLabel,
      tokenAddress,
      amountInEth,
      slippagePercent || 3,
      path
    );
    return res.json({
      message: 'Estimated buy cost',
      estimate,
    });
  } catch (error) {
    console.error('Estimate buy cost failed:', error);
    return res
      .status(500)
      .json({ error: `Failed to estimate buy cost: ${error.message}` });
  }
});

// POST /uni-v2-estimate-sell-cost
app.post('/uni-v2-estimate-sell-cost', async (req, res) => {
  let {
    chain,
    walletLabel,
    tokenAddress,
    amountInTokens,
    slippagePercent,
    path,
  } = req.body;
  if (!walletLabel) walletLabel = 'MAIN';
  if (!chain || !tokenAddress || !amountInTokens) {
    return res
      .status(400)
      .json({ error: 'chain, tokenAddress, and amountInTokens are required.' });
  }

  try {
    const estimate = await estimateSellV2Cost(
      chain,
      walletLabel,
      tokenAddress,
      amountInTokens,
      slippagePercent || 3,
      path
    );
    return res.json({
      message: 'Estimated sell cost',
      estimate,
    });
  } catch (error) {
    console.error('Estimate sell cost failed:', error);
    return res
      .status(500)
      .json({ error: `Failed to estimate sell cost: ${error.message}` });
  }
});

// POST /uni-v2-estimate-swap-cost
app.post('/uni-v2-estimate-swap-cost', async (req, res) => {
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
  if (!chain || !tokenIn || !tokenOut || !amountInTokens) {
    return res.status(400).json({
      error: 'chain, tokenIn, tokenOut, and amountInTokens are required.',
    });
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
      message: 'Estimated swap cost',
      estimate,
    });
  } catch (error) {
    console.error('Estimate swap cost failed:', error);
    return res
      .status(500)
      .json({ error: `Failed to estimate swap cost: ${error.message}` });
  }
});

// Start the Server
const PORT = process.env.UNI_V2_PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';
app.listen(PORT, HOST, () => {
  console.log(`\nUniswap V2 Service running on ${HOST}:${PORT}`);
  console.log(`Endpoints:
    - POST /approve
    - POST /uni-v2-buy
    - POST /uni-v2-sell
    - POST /uni-v2-estimate-buy-cost
    - POST /uni-v2-estimate-sell-cost
    - POST /uni-v2-swap
    - POST /uni-v2-estimate-swap-cost
  `);
});
