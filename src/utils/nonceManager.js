const { ethers } = require('ethers');
const crypto = require('crypto');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const logger = require('./logger');

// Internal state per address
const stateByAddress = new Map();
const DEFAULT_FILE_LOCK_DIR = path.join(os.tmpdir(), 'dex-bot-services-nonce');
const DEFAULT_FILE_LOCK_STALE_MS = 30000;
const DEFAULT_FILE_LOCK_WAIT_MS = 10000;

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

function getNonceLockMode(env = process.env) {
  return (env.BOT_NONCE_LOCK_MODE || 'process').toLowerCase();
}

function getFileLockDir(env = process.env) {
  return env.BOT_NONCE_LOCK_DIR || DEFAULT_FILE_LOCK_DIR;
}

function getLockNumber(name, fallback, env = process.env) {
  const value = Number(env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function lockFileName(lockKey) {
  return crypto.createHash('sha256').update(lockKey).digest('hex');
}

function getLockPaths(lockKey, env = process.env) {
  const dir = getFileLockDir(env);
  const name = lockFileName(lockKey);
  return {
    dir,
    lockPath: path.join(dir, `${name}.lock`),
    statePath: path.join(dir, `${name}.json`),
  };
}

async function getNonceLockKey(provider, address, opts = {}) {
  if (opts.lockKey) return opts.lockKey;

  const network = await provider.getNetwork();
  if (!network || network.chainId === undefined || network.chainId === null) {
    throw new Error(
      'BOT_NONCE_LOCK_MODE=file requires provider.getNetwork() to return chainId.'
    );
  }

  return `${network.chainId.toString()}:${address.toLowerCase()}`;
}

async function readSharedNonceState(statePath) {
  try {
    const raw = await fs.readFile(statePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && parsed.nextNonce !== undefined) {
      return { nextNonce: BigInt(parsed.nextNonce) };
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  return { nextNonce: null };
}

async function writeSharedNonceState(statePath, nextNonce) {
  const payload = JSON.stringify({
    nextNonce: nextNonce.toString(),
    updatedAt: new Date().toISOString(),
  });
  await fs.writeFile(statePath, payload);
}

async function clearSharedNonceState(statePath) {
  try {
    await fs.unlink(statePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function acquireFileLock(lockPath, env = process.env) {
  const staleMs = getLockNumber(
    'BOT_NONCE_LOCK_STALE_MS',
    DEFAULT_FILE_LOCK_STALE_MS,
    env
  );
  const waitMs = getLockNumber(
    'BOT_NONCE_LOCK_WAIT_MS',
    DEFAULT_FILE_LOCK_WAIT_MS,
    env
  );
  const startedAt = Date.now();

  while (true) {
    try {
      const handle = await fs.open(lockPath, 'wx');
      await handle.writeFile(
        JSON.stringify({
          pid: process.pid,
          createdAt: new Date().toISOString(),
        })
      );
      await handle.close();
      return async () => {
        try {
          await fs.unlink(lockPath);
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
        }
      };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;

      let stale = false;
      try {
        const stat = await fs.stat(lockPath);
        stale = Date.now() - stat.mtimeMs > staleMs;
      } catch (statError) {
        if (statError.code !== 'ENOENT') throw statError;
      }

      if (stale) {
        try {
          await fs.unlink(lockPath);
        } catch (unlinkError) {
          if (unlinkError.code !== 'ENOENT') throw unlinkError;
        }
        continue;
      }

      if (Date.now() - startedAt > waitMs) {
        throw new Error(`Timed out waiting for nonce lock: ${lockPath}`);
      }

      await sleep(50);
    }
  }
}

async function withFileLock(lockKey, callback, env = process.env) {
  const { dir, lockPath, statePath } = getLockPaths(lockKey, env);
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  const release = await acquireFileLock(lockPath, env);
  try {
    return await callback(statePath);
  } finally {
    await release();
  }
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

async function resetSharedNonce(provider, address, opts = {}) {
  if (getNonceLockMode() !== 'file') return;
  const lockKey = await getNonceLockKey(provider, address, opts);
  await withFileLock(lockKey, (statePath) => clearSharedNonceState(statePath));
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
  const lockMode = getNonceLockMode();

  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (lockMode === 'file') {
        const lockKey = await getNonceLockKey(provider, address, opts);
        return await withFileLock(lockKey, async (statePath) => {
          const pendingNonce = await fetchPendingNonce(provider, address);
          const state = await readSharedNonceState(statePath);
          const nextNonce =
            state.nextNonce !== null && state.nextNonce > pendingNonce
              ? state.nextNonce
              : pendingNonce;
          const nonce = Number(nextNonce);
          if (typeof onNonce === 'function') {
            try {
              onNonce(nonce, attempt);
            } catch (_) {}
          }
          const txResp = await signer.sendTransaction({ ...tx, nonce });
          try {
            await writeSharedNonceState(statePath, nextNonce + 1n);
          } catch (writeError) {
            logger.warn(
              '[NonceManager] Failed to persist shared nonce state after broadcast:',
              writeError
            );
          }
          return txResp;
        });
      }

      const nonce = await allocateNonce(provider, address);
      if (typeof onNonce === 'function') {
        try {
          onNonce(nonce, attempt);
        } catch (_) {}
      }
      return await signer.sendTransaction({ ...tx, nonce });
    } catch (err) {
      lastError = err;
      if (isNonceError(err)) {
        // Reset and retry by refetching from network on next attempt
        resetNonce(provider, address);
        await resetSharedNonce(provider, address, opts);
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
  getNonceLockMode,
  sendTransactionWithNonce,
  resetNonce,
};
