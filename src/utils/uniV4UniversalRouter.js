const { ethers } = require('ethers');
const { CommandType, RoutePlanner } = require('@uniswap/universal-router-sdk');

const UNIVERSAL_ROUTER_EXECUTE_ABI = [
  'function execute(bytes commands, bytes[] inputs, uint256 deadline)',
];

function encodeV4SwapExecute(v4SwapInput, deadline) {
  if (
    !v4SwapInput ||
    typeof v4SwapInput !== 'string' ||
    !v4SwapInput.startsWith('0x')
  ) {
    throw new Error('Invalid V4 swap input.');
  }

  const routePlanner = new RoutePlanner();
  routePlanner.addCommand(CommandType.V4_SWAP, [v4SwapInput]);

  const universalRouter = new ethers.Interface(UNIVERSAL_ROUTER_EXECUTE_ABI);
  return universalRouter.encodeFunctionData('execute', [
    routePlanner.commands,
    routePlanner.inputs,
    deadline,
  ]);
}

module.exports = {
  UNIVERSAL_ROUTER_EXECUTE_ABI,
  encodeV4SwapExecute,
};
