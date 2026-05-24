const { ethers } = require('ethers');
const pancakeV4Sdk = require('@pancakeswap/v4-sdk');

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const DYNAMIC_FEE_FLAG = 0x800000;
const ROUTE_BUILDER_UNSUPPORTED_MESSAGE =
  'Pancake V4 internal route building is not enabled. The installed @pancakeswap/v4-sdk exposes pool-key and pool-manager calldata helpers, but this service does not have a verified Pancake Infinity Universal Router planner. Provide pre-built Universal Router calldata and valueWei/valueEth.';

const SUPPORTED_ROUTE_SIDES = new Set(['buy', 'sell', 'swap']);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasValue(value) {
  return value !== undefined && value !== null && value !== '';
}

function requireRecord(value, path) {
  if (!isRecord(value)) {
    throw new Error(`Pancake V4 route builder requires ${path}.`);
  }
  return value;
}

function requireField(record, field, path = field) {
  const value = record[field];
  if (!hasValue(value)) {
    throw new Error(`Pancake V4 route builder requires ${path}.`);
  }
  return value;
}

function normalizeAddress(value, path) {
  if (typeof value !== 'string' || !ethers.isAddress(value)) {
    throw new Error(
      `Invalid Pancake V4 route builder ${path}: expected EVM address.`
    );
  }
  return ethers.getAddress(value);
}

function normalizeInteger(value, path, { min = 0, max } = {}) {
  const stringValue =
    typeof value === 'number' ? value.toString() : String(value);
  if (!/^\d+$/.test(stringValue)) {
    throw new Error(
      `Invalid Pancake V4 route builder ${path}: expected integer string.`
    );
  }

  const numberValue = Number(stringValue);
  if (
    !Number.isSafeInteger(numberValue) ||
    numberValue < min ||
    (max !== undefined && numberValue > max)
  ) {
    throw new Error(
      `Invalid Pancake V4 route builder ${path}: integer out of range.`
    );
  }

  return numberValue;
}

function normalizeAmount(value, path, { allowZero = false } = {}) {
  const stringValue =
    typeof value === 'bigint' ? value.toString() : String(value);
  if (!/^\d+$/.test(stringValue)) {
    throw new Error(
      `Invalid Pancake V4 route builder ${path}: expected base-unit integer string.`
    );
  }

  const amount = BigInt(stringValue);
  if (amount < 0n || (!allowZero && amount === 0n)) {
    throw new Error(
      `Invalid Pancake V4 route builder ${path}: amount out of range.`
    );
  }

  return stringValue;
}

function normalizePoolParameters(parameters) {
  const poolParameters = requireRecord(parameters, 'poolKey.parameters');
  const hasTickSpacing = hasValue(poolParameters.tickSpacing);
  const hasBinStep = hasValue(poolParameters.binStep);

  if (hasTickSpacing === hasBinStep) {
    throw new Error(
      'Pancake V4 route builder poolKey.parameters must include exactly one of tickSpacing or binStep.'
    );
  }

  const normalized = {};
  if (isRecord(poolParameters.hooksRegistration)) {
    normalized.hooksRegistration = { ...poolParameters.hooksRegistration };
  }

  if (hasTickSpacing) {
    normalized.tickSpacing = normalizeInteger(
      poolParameters.tickSpacing,
      'poolKey.parameters.tickSpacing',
      { min: 1, max: 8388607 }
    );
    return { poolType: 'CL', parameters: normalized };
  }

  normalized.binStep = normalizeInteger(
    poolParameters.binStep,
    'poolKey.parameters.binStep',
    { min: 1, max: 65535 }
  );
  return { poolType: 'Bin', parameters: normalized };
}

function normalizeFee(value, poolType) {
  const fee = normalizeInteger(value, 'poolKey.fee', {
    min: 0,
    max: DYNAMIC_FEE_FLAG,
  });
  const maxStaticFee = poolType === 'Bin' ? 100000 : 1000000;

  if (fee !== DYNAMIC_FEE_FLAG && fee > maxStaticFee) {
    throw new Error(
      `Invalid Pancake V4 route builder poolKey.fee: ${poolType} static fee out of range.`
    );
  }

  return fee;
}

function normalizePoolKey(input) {
  const poolKeyInput = requireRecord(input, 'poolKey');
  const { poolType, parameters } = normalizePoolParameters(
    requireField(poolKeyInput, 'parameters', 'poolKey.parameters')
  );

  const poolKey = {
    currency0: normalizeAddress(
      requireField(poolKeyInput, 'currency0', 'poolKey.currency0'),
      'poolKey.currency0'
    ),
    currency1: normalizeAddress(
      requireField(poolKeyInput, 'currency1', 'poolKey.currency1'),
      'poolKey.currency1'
    ),
    hooks: hasValue(poolKeyInput.hooks)
      ? normalizeAddress(poolKeyInput.hooks, 'poolKey.hooks')
      : ZERO_ADDRESS,
    poolManager: normalizeAddress(
      requireField(poolKeyInput, 'poolManager', 'poolKey.poolManager'),
      'poolKey.poolManager'
    ),
    fee: normalizeFee(
      requireField(poolKeyInput, 'fee', 'poolKey.fee'),
      poolType
    ),
    parameters,
  };

  return {
    poolType,
    poolKey,
    encodedPoolKey: pancakeV4Sdk.encodePoolKey(poolKey),
  };
}

function normalizeSide(value) {
  if (typeof value !== 'string' || !SUPPORTED_ROUTE_SIDES.has(value)) {
    throw new Error(
      'Pancake V4 route builder side must be one of buy, sell, or swap.'
    );
  }
  return value;
}

function assertPancakeV4RouteBuilderInput(input) {
  const request = requireRecord(input, 'route builder input');
  const side = normalizeSide(requireField(request, 'side'));
  const currencyIn = normalizeAddress(
    requireField(request, 'currencyIn'),
    'currencyIn'
  );
  const currencyOut = normalizeAddress(
    requireField(request, 'currencyOut'),
    'currencyOut'
  );
  const amountIn = normalizeAmount(
    requireField(request, 'amountIn'),
    'amountIn'
  );
  const amountOutMinimum = normalizeAmount(
    requireField(request, 'amountOutMinimum'),
    'amountOutMinimum',
    { allowZero: true }
  );
  const recipient = normalizeAddress(
    requireField(request, 'recipient'),
    'recipient'
  );
  const deadline = normalizeInteger(
    requireField(request, 'deadline'),
    'deadline',
    {
      min: 1,
    }
  );
  const nativeValueWei = hasValue(request.nativeValueWei)
    ? normalizeAmount(request.nativeValueWei, 'nativeValueWei', {
        allowZero: true,
      })
    : '0';
  const pool = normalizePoolKey(requireField(request, 'poolKey'));

  const poolCurrencies = new Set([
    pool.poolKey.currency0.toLowerCase(),
    pool.poolKey.currency1.toLowerCase(),
  ]);
  if (
    !poolCurrencies.has(currencyIn.toLowerCase()) ||
    !poolCurrencies.has(currencyOut.toLowerCase())
  ) {
    throw new Error(
      'Pancake V4 route builder currencyIn/currencyOut must both belong to poolKey.'
    );
  }
  if (currencyIn.toLowerCase() === currencyOut.toLowerCase()) {
    throw new Error(
      'Pancake V4 route builder currencyIn and currencyOut must differ.'
    );
  }

  return {
    side,
    currencyIn,
    currencyOut,
    amountIn,
    amountOutMinimum,
    recipient,
    deadline,
    nativeValueWei,
    ...pool,
  };
}

function inspectPancakeV4SdkRouteBuilderSupport(sdk = pancakeV4Sdk) {
  const exports = Object.keys(sdk).sort();
  const hasUniversalRouterPlanner = exports.some((name) =>
    /Universal.*Router|Route.*Planner|SwapRouter|Command|Planner/i.test(name)
  );
  const hasPoolKeyEncoding =
    typeof sdk.encodePoolKey === 'function' &&
    typeof sdk.encodePoolParameters === 'function';
  const hasPoolManagerSwapCalldata =
    typeof sdk.clPoolSwapCalldata === 'function' ||
    typeof sdk.binPoolSwapCalldata === 'function';

  return {
    ready:
      hasPoolKeyEncoding &&
      hasPoolManagerSwapCalldata &&
      hasUniversalRouterPlanner,
    hasPoolKeyEncoding,
    hasPoolManagerSwapCalldata,
    hasUniversalRouterPlanner,
    exports,
  };
}

function buildPancakeV4UniversalRouterCalldata(input) {
  assertPancakeV4RouteBuilderInput(input);
  throw new Error(ROUTE_BUILDER_UNSUPPORTED_MESSAGE);
}

module.exports = {
  ROUTE_BUILDER_UNSUPPORTED_MESSAGE,
  assertPancakeV4RouteBuilderInput,
  buildPancakeV4UniversalRouterCalldata,
  inspectPancakeV4SdkRouteBuilderSupport,
};
