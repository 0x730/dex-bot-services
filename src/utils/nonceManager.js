// Lightweight per-signer Nonce Manager with retry logic for ethers v6
// Works within a single Node.js process. For multi-process (e.g., PM2 cluster),
// use a shared lock (Redis) or ensure a single process per private key.

const { ethers } = require('ethers');

// Internal state per address
const stateByAddress = new Map();

function getState(address) {
  const key = address.toLowerCase();
  if (!stateByAddress.has(key)) {
    stateByAddress.set(key, {
      // next nonce to use; null means "unknown" and will be fetched
      nextNonce: null,
      // a simple promise-based lock to serialize nonce allocation
      lock: Promise.resolve(),
    });
  }
  return stateByAddress.get(key);
}

async function fetchPendingNonce(provider, address) {
  // Use 'pending' to include in-flight transactions
  const n = await provider.getTransactionCount(address, 'pending');
  // ethers v6 returns a number; normalize to BigInt for arithmetic safety
  return BigInt(n);
}

// Acquire a lock and allocate the next nonce
async function allocateNonce(provider, address) {
  const st = getState(address);
  // Chain on existing lock to serialize
  let release;
  const p = new Promise((resolve) => (release = resolve));
  const prev = st.lock;
  st.lock = prev.then(() => p);
  await prev; // wait for prior operations
  try {
    if (st.nextNonce === null) {
      st.nextNonce = await fetchPendingNonce(provider, address);
    }
    const nonceToUse = st.nextNonce;
    st.nextNonce = nonceToUse + 1n;
    return Number(nonceToUse); // ethers accepts number for nonce here
  } finally {
    // release lock
    release();
  }
}

function resetNonce(provider, address) {
  const st = getState(address);
  // Reset cached nonce; future allocate will refetch
  st.nextNonce = null;
}

function isNonceError(err) {
  if (!err) return false;
  const code = err.code || err.reason || err.shortMessage;
  const msg = (err.message || '').toLowerCase();
  return (
    code === 'NONCE_EXPIRED' ||
    msg.includes('nonce too low') ||
    msg.includes('already been used') ||
    msg.includes('replacement transaction underpriced')
  );
}

// Public helper: send with managed nonce + retry when needed
async function sendTransactionWithNonce(signer, tx, provider, opts = {}) {
  const { maxRetries = 2, onNonce } = opts;
  const address = signer.address || (await signer.getAddress());

  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const nonce = await allocateNonce(provider, address);
    if (typeof onNonce === 'function') {
      try {
        onNonce(nonce, attempt);
      } catch (_) {}
    }
    try {
      const txResp = await signer.sendTransaction({ ...tx, nonce });
      return txResp;
    } catch (err) {
      lastError = err;
      if (isNonceError(err)) {
        // Reset and retry by refetching from network on next attempt
        resetNonce(provider, address);
        continue;
      }
      throw err;
    }
  }
  throw (
    lastError || new Error('Failed to send transaction after nonce retries')
  );
}

module.exports = {
  sendTransactionWithNonce,
  resetNonce,
};
