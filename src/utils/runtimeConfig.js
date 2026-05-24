function upper(value) {
  return String(value).toUpperCase();
}

function getWalletPrivateKey(prefix, label = 'MAIN', chain, env = process.env) {
  const envVar = `${prefix}_PRIVATE_KEY_${upper(label)}_${upper(chain)}`;
  const privateKey = env[envVar];
  if (!privateKey) {
    throw new Error(
      `Private key not found for label "${label}" on chain "${chain}"`
    );
  }
  return privateKey;
}

function readFirstIntEnv(names, fallback, env = process.env) {
  for (const name of names) {
    const parsed = parseInt(env[name]);
    if (parsed) return parsed;
  }
  return fallback;
}

function readIntEnv(name, fallback, env = process.env) {
  return readFirstIntEnv([name], fallback, env);
}

module.exports = {
  getWalletPrivateKey,
  readFirstIntEnv,
  readIntEnv,
};
