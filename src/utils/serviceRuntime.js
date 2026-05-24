const logger = require('./logger');
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '::']);

const SERVICE_CONFIGS = {
  'uni-v2': {
    envPrefix: 'UNI_V2',
    defaultChains: ['ETHEREUM'],
    required: ['RPC_URL', 'PRIVATE_KEY_MAIN', 'WETH_ADDRESS', 'ROUTER_ADDRESS'],
  },
  'uni-v3': {
    envPrefix: 'UNI_V3',
    defaultChains: ['ETHEREUM'],
    required: [
      'RPC_URL',
      'PRIVATE_KEY_MAIN',
      ['WETH_ADDRESS', 'WRAPPED_ADDRESS'],
      'ROUTER_ADDRESS',
      'QUOTER_ADDRESS',
    ],
  },
  'uni-v4': {
    envPrefix: 'UNI_V4',
    defaultChains: ['ETHEREUM'],
    required: [
      'RPC_URL',
      'PRIVATE_KEY_MAIN',
      ['WETH_ADDRESS', 'WRAPPED_ADDRESS'],
      'ROUTER_ADDRESS',
      'QUOTER_ADDRESS',
    ],
  },
  pancake: {
    envPrefix: 'PANCAKE',
    defaultChains: ['BSC'],
    required: [
      'RPC_URL',
      'PRIVATE_KEY_MAIN',
      ['WBNB_ADDRESS', 'WETH_ADDRESS', 'WRAPPED_ADDRESS'],
      'ROUTER_ADDRESS',
      'FACTORY_ADDRESS',
    ],
  },
  'pancake-v3': {
    envPrefix: 'PANCAKE_V3',
    defaultChains: ['BSC'],
    required: [
      'RPC_URL',
      'PRIVATE_KEY_MAIN',
      ['WBNB_ADDRESS', 'WETH_ADDRESS', 'WRAPPED_ADDRESS'],
      'ROUTER_ADDRESS',
      'QUOTER_ADDRESS',
    ],
  },
  'pancake-v4': {
    envPrefix: 'PANCAKE_V4',
    defaultChains: ['BSC'],
    required: [
      'RPC_URL',
      'PRIVATE_KEY_MAIN',
      ['WBNB_ADDRESS', 'WETH_ADDRESS', 'WRAPPED_ADDRESS'],
      'ROUTER_ADDRESS',
      'QUOTER_ADDRESS',
    ],
  },
};

function normalizeHost(host) {
  return host || '127.0.0.1';
}

function isLoopbackHost(host) {
  const value = normalizeHost(host).toLowerCase();
  return LOOPBACK_HOSTS.has(value) || value.startsWith('127.');
}

function getConfiguredChains(config, env = process.env) {
  const prefix = `${config.envPrefix}_RPC_URL_`;
  const chains = new Set(config.defaultChains || []);

  for (const key of Object.keys(env)) {
    if (key.startsWith(prefix)) {
      chains.add(key.slice(prefix.length));
    }
  }

  return Array.from(chains).sort();
}

function envNameFor(config, chain, suffix) {
  return `${config.envPrefix}_${suffix}_${chain}`;
}

function resolveRequirement(config, chain, requirement) {
  const suffixes = Array.isArray(requirement) ? requirement : [requirement];
  return suffixes.map((suffix) => envNameFor(config, chain, suffix));
}

function buildReadiness(service, env = process.env) {
  const config = SERVICE_CONFIGS[service];
  if (!config) {
    return {
      ready: false,
      service,
      groups: [],
      missingEnv: [`unknown service: ${service}`],
    };
  }

  const groups = getConfiguredChains(config, env).map((chain) => {
    const required = config.required.map((requirement) =>
      resolveRequirement(config, chain, requirement)
    );
    const missingEnv = required
      .filter((alternatives) => !alternatives.some((key) => env[key]))
      .map((alternatives) =>
        alternatives.length === 1
          ? alternatives[0]
          : `one of ${alternatives.join(', ')}`
      );
    return {
      chain,
      ready: missingEnv.length === 0,
      missingEnv,
    };
  });

  const ready = groups.some((group) => group.ready);
  return {
    ready,
    service,
    groups,
    missingEnv: groups.flatMap((group) => group.missingEnv),
  };
}

function extractBearerToken(header) {
  if (!header) return '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1] : '';
}

function createBotApiTokenMiddleware(env = process.env) {
  return function botApiTokenMiddleware(req, res, next) {
    if (
      req.method === 'GET' &&
      (req.path === '/health' || req.path === '/ready')
    ) {
      return next();
    }

    const expected = env.BOT_API_TOKEN;
    if (!expected) return next();

    const provided =
      req.get('x-bot-api-token') ||
      extractBearerToken(req.get('authorization'));

    if (provided === expected) return next();

    return res.status(401).json({ error: 'Unauthorized.' });
  };
}

function registerServiceHealth(app, service, env = process.env) {
  app.get('/health', (req, res) => {
    res.json({
      ok: true,
      service,
      authEnabled: Boolean(env.BOT_API_TOKEN),
    });
  });

  app.get('/ready', (req, res) => {
    const readiness = buildReadiness(service, env);
    res.status(readiness.ready ? 200 : 503).json(readiness);
  });
}

function reportServiceBind(service, host, port, env = process.env) {
  const authStatus = env.BOT_API_TOKEN
    ? 'token auth enabled'
    : 'token auth off';
  logger.info(`${service} bind ${normalizeHost(host)}:${port} (${authStatus})`);
  if (!isLoopbackHost(host) && !env.BOT_API_TOKEN) {
    logger.warn(
      `${service} is bound outside loopback without BOT_API_TOKEN. This may be acceptable only on a trusted internal network.`
    );
  }
}

module.exports = {
  buildReadiness,
  createBotApiTokenMiddleware,
  isLoopbackHost,
  normalizeHost,
  registerServiceHealth,
  reportServiceBind,
};
