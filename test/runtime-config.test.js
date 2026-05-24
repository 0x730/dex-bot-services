const assert = require('assert');

const {
  getWalletPrivateKey,
  readFirstIntEnv,
  readIntEnv,
} = require('../src/utils/runtimeConfig');

function assertWalletPrivateKeyLookup() {
  const env = {
    UNI_V3_PRIVATE_KEY_MAIN_ETHEREUM: 'private-key',
    PANCAKE_V4_PRIVATE_KEY_TRADER_BSC: 'pancake-key',
  };

  assert.equal(
    getWalletPrivateKey('UNI_V3', 'MAIN', 'ethereum', env),
    'private-key'
  );
  assert.equal(
    getWalletPrivateKey('PANCAKE_V4', 'trader', 'bsc', env),
    'pancake-key'
  );
  assert.throws(
    () => getWalletPrivateKey('UNI_V3', 'MISSING', 'ethereum', env),
    /Private key not found for label "MISSING" on chain "ethereum"/
  );
}

function assertIntEnvCompatibility() {
  assert.equal(readIntEnv('GAS_BUFFER_PERCENT', 10, {}), 10);
  assert.equal(
    readIntEnv('GAS_BUFFER_PERCENT', 10, { GAS_BUFFER_PERCENT: '0' }),
    10
  );
  assert.equal(
    readIntEnv('GAS_BUFFER_PERCENT', 10, { GAS_BUFFER_PERCENT: '-5' }),
    -5
  );
  assert.equal(
    readIntEnv('GAS_BUFFER_PERCENT', 10, { GAS_BUFFER_PERCENT: '25' }),
    25
  );

  assert.equal(
    readFirstIntEnv(['CHAIN_MAX_GAS', 'MAX_GAS_ETHEREUM'], 1000000, {
      MAX_GAS_ETHEREUM: '200000',
    }),
    200000
  );
  assert.equal(
    readFirstIntEnv(['CHAIN_MAX_GAS', 'MAX_GAS_ETHEREUM'], 1000000, {
      CHAIN_MAX_GAS: '500000',
      MAX_GAS_ETHEREUM: '200000',
    }),
    500000
  );
}

assertWalletPrivateKeyLookup();
assertIntEnvCompatibility();

console.log('Runtime config contracts passed.');
