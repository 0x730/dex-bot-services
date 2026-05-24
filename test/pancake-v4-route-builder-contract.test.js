const assert = require('assert');

const {
  ROUTE_BUILDER_UNSUPPORTED_MESSAGE,
  assertPancakeV4RouteBuilderInput,
  buildPancakeV4UniversalRouterCalldata,
  inspectPancakeV4SdkRouteBuilderSupport,
} = require('../src/utils/pancakeV4RouteBuilder');

const ZERO = '0x0000000000000000000000000000000000000000';
const TOKEN_A = '0x0000000000000000000000000000000000000001';
const TOKEN_B = '0x0000000000000000000000000000000000000002';
const POOL_MANAGER = '0x0000000000000000000000000000000000000003';
const RECIPIENT = '0x0000000000000000000000000000000000000004';

function validRouteInput(overrides = {}) {
  return {
    side: 'buy',
    currencyIn: TOKEN_A,
    currencyOut: TOKEN_B,
    amountIn: '1000000000000000000',
    amountOutMinimum: '1',
    recipient: RECIPIENT,
    deadline: '1893456000',
    poolKey: {
      currency0: TOKEN_A,
      currency1: TOKEN_B,
      hooks: ZERO,
      poolManager: POOL_MANAGER,
      fee: '3000',
      parameters: {
        tickSpacing: '60',
      },
    },
    ...overrides,
  };
}

const normalized = assertPancakeV4RouteBuilderInput(validRouteInput());
assert.equal(normalized.side, 'buy');
assert.equal(normalized.poolType, 'CL');
assert.equal(normalized.poolKey.poolManager, POOL_MANAGER);
assert.equal(normalized.encodedPoolKey.hooks, ZERO);
assert.equal(
  normalized.encodedPoolKey.parameters,
  '0x00000000000000000000000000000000000000000000000000000000003c0000'
);

assert.equal(
  assertPancakeV4RouteBuilderInput(
    validRouteInput({
      poolKey: {
        currency0: TOKEN_A,
        currency1: TOKEN_B,
        poolManager: POOL_MANAGER,
        fee: '100',
        parameters: {
          binStep: '10',
        },
      },
    })
  ).poolType,
  'Bin'
);

assert.throws(
  () =>
    assertPancakeV4RouteBuilderInput({
      chain: 'BSC',
      walletLabel: 'MAIN',
      tokenAddress: TOKEN_B,
      amountInBnb: '0.001',
      fee: '3000',
    }),
  /requires side/
);

assert.throws(
  () =>
    assertPancakeV4RouteBuilderInput(
      validRouteInput({
        currencyOut: RECIPIENT,
      })
    ),
  /must both belong to poolKey/
);

assert.throws(
  () =>
    assertPancakeV4RouteBuilderInput(
      validRouteInput({
        poolKey: {
          currency0: TOKEN_A,
          currency1: TOKEN_B,
          poolManager: POOL_MANAGER,
          fee: '3000',
          parameters: {},
        },
      })
    ),
  /exactly one of tickSpacing or binStep/
);

const sdkSupport = inspectPancakeV4SdkRouteBuilderSupport();
assert.equal(sdkSupport.hasPoolKeyEncoding, true);
assert.equal(sdkSupport.hasPoolManagerSwapCalldata, true);
assert.equal(sdkSupport.hasUniversalRouterPlanner, false);
assert.equal(sdkSupport.ready, false);

assert.throws(
  () => buildPancakeV4UniversalRouterCalldata(validRouteInput()),
  new RegExp(
    ROUTE_BUILDER_UNSUPPORTED_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  )
);

console.log('Pancake V4 route builder contract passed.');
