const REDACTED = '[redacted]';

function useJsonLogFormat() {
  return String(process.env.BOT_LOG_FORMAT || '').toLowerCase() === 'json';
}

function shouldRedactKey(key) {
  return /private.?key|authorization|api.?token|mnemonic|secret|signature|calldata/i.test(
    key
  );
}

function redact(value, seen = new WeakSet()) {
  if (typeof value === 'string') {
    if (/^0x[0-9a-fA-F]{128,}$/.test(value)) return REDACTED;
    return value;
  }

  if (typeof value === 'bigint') return value.toString();
  if (!value || typeof value !== 'object') return value;
  if (value instanceof Error) return value.stack || value.message;

  if (seen.has(value)) return '[circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redact(item, seen));
  }

  const output = {};
  for (const [key, item] of Object.entries(value)) {
    output[key] = shouldRedactKey(key) ? REDACTED : redact(item, seen);
  }
  return output;
}

function mapArgs(args) {
  return args.map((arg) => redact(arg));
}

function buildJsonLog(level, args) {
  const mappedArgs = mapArgs(args);
  const message = mappedArgs
    .filter((arg) => typeof arg === 'string')
    .join(' ')
    .trim();

  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message: message || undefined,
    args: mappedArgs,
  });
}

function write(level, consoleMethod, args) {
  if (useJsonLogFormat()) {
    consoleMethod(buildJsonLog(level, args));
    return;
  }

  consoleMethod(...mapArgs(args));
}

module.exports = {
  info: (...args) => write('info', console.log, args),
  warn: (...args) => write('warn', console.warn, args),
  error: (...args) => write('error', console.error, args),
};
