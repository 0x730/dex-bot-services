const assert = require('assert');
const logger = require('../src/utils/logger');

function captureConsole(method, fn) {
  const original = console[method];
  const calls = [];
  console[method] = (...args) => calls.push(args);

  try {
    fn();
  } finally {
    console[method] = original;
  }

  return calls;
}

function withLogFormat(value, fn) {
  const previous = process.env.BOT_LOG_FORMAT;
  if (value === undefined) {
    delete process.env.BOT_LOG_FORMAT;
  } else {
    process.env.BOT_LOG_FORMAT = value;
  }

  try {
    fn();
  } finally {
    if (previous === undefined) {
      delete process.env.BOT_LOG_FORMAT;
    } else {
      process.env.BOT_LOG_FORMAT = previous;
    }
  }
}

withLogFormat(undefined, () => {
  const calls = captureConsole('warn', () => {
    logger.warn('plain warning', {
      apiToken: 'secret-token',
      amount: 10n,
    });
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'plain warning');
  assert.deepEqual(calls[0][1], {
    apiToken: '[redacted]',
    amount: '10',
  });
});

withLogFormat('json', () => {
  const calls = captureConsole('log', () => {
    logger.info('swap submitted', {
      privateKey: 'secret-key',
      calldata: '0x1234',
      amount: 20n,
    });
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].length, 1);

  const payload = JSON.parse(calls[0][0]);
  assert.equal(payload.level, 'info');
  assert.equal(payload.message, 'swap submitted');
  assert.match(payload.timestamp, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(payload.args, [
    'swap submitted',
    {
      privateKey: '[redacted]',
      calldata: '[redacted]',
      amount: '20',
    },
  ]);
});

console.log('Logger contracts passed.');
