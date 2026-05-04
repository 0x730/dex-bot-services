const assert = require('assert');
const {
  requirePrebuiltPancakeV4Calldata,
} = require('../src/utils/pancakeV4Calldata');

assert.equal(requirePrebuiltPancakeV4Calldata('0x'), '0x');
assert.equal(requirePrebuiltPancakeV4Calldata('0x1234abcd'), '0x1234abcd');

assert.throws(
  () => requirePrebuiltPancakeV4Calldata(''),
  /Missing or invalid Pancake V4 calldata/
);
assert.throws(
  () => requirePrebuiltPancakeV4Calldata('1234'),
  /Missing or invalid Pancake V4 calldata/
);
assert.throws(
  () => requirePrebuiltPancakeV4Calldata('0xzz'),
  /Missing or invalid Pancake V4 calldata/
);

console.log('Pancake V4 calldata contract passed.');
