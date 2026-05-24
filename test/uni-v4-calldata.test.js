require('../ethers-compat');

const assert = require('assert');
const { ethers } = require('ethers');
const {
  UNIVERSAL_ROUTER_EXECUTE_ABI,
  encodeV4SwapExecute,
} = require('../src/utils/uniV4UniversalRouter');

const deadline = 1234567890;
const v4SwapInput = ethers.AbiCoder.defaultAbiCoder().encode(
  ['bytes', 'bytes[]'],
  ['0x060c0f', ['0x01', '0x02', '0x03']]
);

const calldata = encodeV4SwapExecute(v4SwapInput, deadline);
const iface = new ethers.Interface(UNIVERSAL_ROUTER_EXECUTE_ABI);
const decoded = iface.decodeFunctionData('execute', calldata);

assert.equal(decoded.commands, '0x10');
assert.equal(decoded.inputs.length, 1);
assert.equal(decoded.inputs[0], v4SwapInput);
assert.equal(decoded.deadline.toString(), deadline.toString());

assert.throws(() => encodeV4SwapExecute('', deadline), /Invalid V4 swap input/);

console.log('Uni V4 calldata contract passed.');
