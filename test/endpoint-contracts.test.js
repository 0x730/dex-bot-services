const assert = require('assert');
const fs = require('fs');
const path = require('path');

require('../ethers-compat');

const { app: pancakeApp } = require('../src/pancake');
const { app: pancakeV3App } = require('../src/pancake-v3');
const { app: pancakeV4App } = require('../src/pancake-v4');
const { app: uniV2App } = require('../src/uni-v2');
const { app: uniV3App } = require('../src/uni-v3');
const { app: uniV4App } = require('../src/uni-v4');
const {
  buildReadiness,
  createBotApiTokenMiddleware,
} = require('../src/utils/serviceRuntime');

const ROOT = path.resolve(__dirname, '..');

const EXPECTED_POST_ROUTES = {
  'src/uni-v2.js': [
    '/approve',
    '/uni-v2-buy',
    '/uni-v2-sell',
    '/uni-v2-swap',
    '/uni-v2-estimate-buy-cost',
    '/uni-v2-estimate-sell-cost',
    '/uni-v2-estimate-swap-cost',
  ],
  'src/uni-v3.js': [
    '/approve',
    '/uni-v3-buy',
    '/uni-v3-sell',
    '/uni-v3-swap',
    '/uni-v3-estimate-buy-cost',
    '/uni-v3-estimate-sell-cost',
    '/uni-v3-estimate-swap-cost',
  ],
  'src/uni-v4.js': [
    '/approve',
    '/uni-v4-buy',
    '/uni-v4-sell',
    '/uni-v4-swap',
    '/uni-v4-estimate-buy-cost',
    '/uni-v4-estimate-sell-cost',
    '/uni-v4-estimate-swap-cost',
    '/uni-v4-execute',
    '/uni-v4-quote-exact-in-single',
    '/uni-v4-build-calldata',
  ],
  'src/pancake.js': [
    '/pancake-approve',
    '/pancake-buy',
    '/pancake-sell',
    '/pancake-swap',
    '/pancake-estimate-buy-cost',
    '/pancake-estimate-sell-cost',
    '/pancake-estimate-swap-cost',
  ],
  'src/pancake-v3.js': [
    '/pancake-v3-approve',
    '/pancake-v3-buy',
    '/pancake-v3-sell',
    '/pancake-v3-swap',
    '/pancake-v3-estimate-buy-cost',
    '/pancake-v3-estimate-sell-cost',
    '/pancake-v3-estimate-swap-cost',
  ],
  'src/pancake-v4.js': [
    '/pancake-v4-approve',
    '/pancake-v4-buy',
    '/pancake-v4-sell',
    '/pancake-v4-swap',
    '/pancake-v4-estimate-buy-cost',
    '/pancake-v4-estimate-sell-cost',
    '/pancake-v4-estimate-swap-cost',
    '/pancake-v4-execute',
  ],
};

const VALIDATION_CASES = [
  {
    app: uniV2App,
    route: '/approve',
    error: 'chain, tokenAddress, and amount are required.',
  },
  {
    app: uniV2App,
    route: '/uni-v2-buy',
    error: 'chain, tokenAddress, and amountInEth are required.',
  },
  {
    app: uniV2App,
    route: '/uni-v2-sell',
    error: 'chain, tokenAddress, and amountInTokens are required.',
  },
  {
    app: uniV2App,
    route: '/uni-v2-swap',
    error: 'chain, tokenIn, tokenOut, and amountInTokens are required.',
  },
  {
    app: uniV3App,
    route: '/approve',
    error: 'Invalid or missing "chain" parameter.',
  },
  {
    app: uniV3App,
    route: '/uni-v3-buy',
    error: 'Invalid or missing "chain" parameter.',
  },
  {
    app: uniV3App,
    route: '/uni-v3-swap',
    error: 'Invalid or missing "chain" parameter.',
  },
  {
    app: uniV4App,
    route: '/approve',
    error: 'Invalid or missing "chain" parameter.',
  },
  {
    app: uniV4App,
    route: '/uni-v4-estimate-buy-cost',
    error: 'Invalid or missing "chain" parameter.',
  },
  {
    app: pancakeApp,
    route: '/pancake-approve',
    error: 'Invalid or missing "chain" parameter.',
  },
  {
    app: pancakeApp,
    route: '/pancake-buy',
    error: 'Invalid or missing "chain".',
  },
  {
    app: pancakeApp,
    route: '/pancake-swap',
    error: 'Invalid or missing "chain" parameter.',
  },
  {
    app: pancakeV3App,
    route: '/pancake-v3-approve',
    error: 'Missing chain/tokenAddress/amount',
  },
  {
    app: pancakeV3App,
    route: '/pancake-v3-buy',
    error: 'Missing chain/tokenAddress/amountInBnb',
  },
  {
    app: pancakeV4App,
    route: '/pancake-v4-approve',
    error: 'Invalid or missing "chain" parameter.',
  },
  {
    app: pancakeV4App,
    route: '/pancake-v4-estimate-buy-cost',
    error: 'Invalid or missing "chain" parameter.',
  },
];

function readSource(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function assertStaticRouteContracts() {
  for (const [file, routes] of Object.entries(EXPECTED_POST_ROUTES)) {
    const source = readSource(file);
    assert.match(source, /registerServiceHealth\(app, /, `${file} has health`);
    assert.match(
      source,
      /app\.use\(createBotApiTokenMiddleware\(\)\)/,
      `${file} has optional token middleware`
    );
    assert.match(source, /module\.exports = \{/, `${file} exports test app`);

    for (const route of routes) {
      assert(
        source.includes(`app.post('${route}'`) ||
          source.includes(`app.post("${route}"`),
        `${file} registers ${route}`
      );
    }
  }
}

function assertRuntimeLoggingUsesSharedLogger() {
  const runtimeFiles = [
    ...Object.keys(EXPECTED_POST_ROUTES),
    'src/utils/serviceRuntime.js',
  ];

  for (const file of runtimeFiles) {
    const source = readSource(file);
    assert(!source.includes('console.'), `${file} bypasses shared logger`);
  }
}

function createResponse(resolve) {
  return {
    statusCode: 200,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    getHeader(name) {
      return this.headers[name.toLowerCase()];
    },
    json(payload) {
      resolve({
        statusCode: this.statusCode,
        body: payload,
      });
      return this;
    },
    end(payload) {
      resolve({
        statusCode: this.statusCode,
        body: payload,
      });
      return this;
    },
  };
}

function invokeRoute(app, { method = 'GET', url, body, headers = {} }) {
  return new Promise((resolve, reject) => {
    const route = app._router.stack.find(
      (layer) =>
        layer.route &&
        layer.route.path === url &&
        layer.route.methods[method.toLowerCase()]
    );
    if (!route) {
      reject(new Error(`Route not found: ${method} ${url}`));
      return;
    }

    const req = {
      body,
      headers,
      method,
      path: url,
      url,
      get(name) {
        return headers[name] || headers[name.toLowerCase()];
      },
    };
    const res = createResponse(resolve);
    const routeHandlers = route.route.stack.filter(
      (layer) => layer.method === method.toLowerCase()
    );

    let index = 0;
    const next = (error) => {
      if (error) {
        reject(error);
        return;
      }
      const handler = routeHandlers[index++];
      if (!handler) return;
      Promise.resolve(handler.handle(req, res, next)).catch(reject);
    };

    next();
  });
}

function invokeMiddleware(middleware, req) {
  return new Promise((resolve, reject) => {
    const res = createResponse(resolve);
    middleware(req, res, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ statusCode: res.statusCode, body: null, nextCalled: true });
    });
  });
}

async function assertHttpContracts() {
  for (const [service, app] of [
    ['uni-v2', uniV2App],
    ['uni-v3', uniV3App],
    ['uni-v4', uniV4App],
    ['pancake', pancakeApp],
    ['pancake-v3', pancakeV3App],
    ['pancake-v4', pancakeV4App],
  ]) {
    const health = await invokeRoute(app, { url: '/health' });
    assert.equal(health.statusCode, 200);
    assert.equal(health.body.ok, true);
    assert.equal(health.body.service, service);
  }

  const ready = await invokeRoute(uniV4App, { url: '/ready' });
  assert([200, 503].includes(ready.statusCode));
  assert.equal(ready.body.service, 'uni-v4');
  assert(Array.isArray(ready.body.groups));

  const previousToken = process.env.BOT_API_TOKEN;
  process.env.BOT_API_TOKEN = 'contract-test-token';
  try {
    const middleware = createBotApiTokenMiddleware();
    const unauthorized = await invokeMiddleware(middleware, {
      method: 'POST',
      path: '/pancake-v4-estimate-buy-cost',
      get() {
        return undefined;
      },
    });
    assert.equal(unauthorized.statusCode, 401);

    const authorized = await invokeMiddleware(middleware, {
      method: 'POST',
      path: '/pancake-v4-estimate-buy-cost',
      get(name) {
        return name.toLowerCase() === 'x-bot-api-token'
          ? 'contract-test-token'
          : undefined;
      },
    });
    assert.equal(authorized.nextCalled, true);
  } finally {
    if (previousToken === undefined) {
      delete process.env.BOT_API_TOKEN;
    } else {
      process.env.BOT_API_TOKEN = previousToken;
    }
  }
}

async function assertValidationContracts() {
  for (const validationCase of VALIDATION_CASES) {
    const response = await invokeRoute(validationCase.app, {
      method: 'POST',
      url: validationCase.route,
      body: {},
    });

    assert.equal(
      response.statusCode,
      400,
      `${validationCase.route} status changed`
    );
    assert.equal(
      response.body.error,
      validationCase.error,
      `${validationCase.route} error changed`
    );
  }
}

function assertReadinessRedactsSecretValues() {
  const readiness = buildReadiness('pancake-v4', {
    PANCAKE_V4_RPC_URL_BSC: 'https://example.invalid/bsc-rpc',
    PANCAKE_V4_PRIVATE_KEY_MAIN_BSC: 'secret-private-key',
    PANCAKE_V4_WBNB_ADDRESS_BSC: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    PANCAKE_V4_ROUTER_ADDRESS_BSC: '0xd9c500dff816a1da21a48a732d3498bf09dc9aeb',
    PANCAKE_V4_QUOTER_ADDRESS_BSC: '0xd0737C9762912dD34c3271197E362Aa736Df0926',
  });

  const serialized = JSON.stringify(readiness);
  assert.equal(readiness.ready, true);
  assert(!serialized.includes('secret-private-key'));
}

(async () => {
  assertStaticRouteContracts();
  assertRuntimeLoggingUsesSharedLogger();
  assertReadinessRedactsSecretValues();
  await assertHttpContracts();
  await assertValidationContracts();
  console.log('Endpoint contracts passed.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
