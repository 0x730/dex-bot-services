const assert = require('assert');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');

const {
  getNonceLockMode,
  sendTransactionWithNonce,
} = require('../src/utils/nonceManager');

const ADDRESS = '0x1111111111111111111111111111111111111111';

function withEnv(values, callback) {
  const previous = {};
  for (const key of Object.keys(values)) {
    previous[key] = process.env[key];
    if (values[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = values[key];
    }
  }

  return Promise.resolve()
    .then(callback)
    .finally(() => {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    });
}

function createProvider({ pendingNonce = 10, chainId = 56n } = {}) {
  return {
    async getNetwork() {
      return { chainId };
    },
    async getTransactionCount(address, blockTag) {
      assert.equal(address, ADDRESS);
      assert.equal(blockTag, 'pending');
      return typeof pendingNonce === 'function' ? pendingNonce() : pendingNonce;
    },
  };
}

function createSigner({ sent, failFirstWith } = {}) {
  let calls = 0;
  return {
    address: ADDRESS,
    async sendTransaction(tx) {
      calls += 1;
      sent.push(tx.nonce);
      if (calls === 1 && failFirstWith) throw failFirstWith;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { hash: `0x${tx.nonce}`, nonce: tx.nonce };
    },
  };
}

async function assertFileLockSerializesNonceState() {
  const lockDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nonce-lock-test-'));
  const sent = [];
  const provider = createProvider({ pendingNonce: 10 });
  const signer = createSigner({ sent });

  await withEnv(
    {
      BOT_NONCE_LOCK_MODE: 'file',
      BOT_NONCE_LOCK_DIR: lockDir,
    },
    async () => {
      assert.equal(getNonceLockMode(), 'file');
      await Promise.all([
        sendTransactionWithNonce(signer, { to: ADDRESS }, provider),
        sendTransactionWithNonce(signer, { to: ADDRESS }, provider),
      ]);
    }
  );

  assert.deepEqual(sent, [10, 11]);
  const files = await fs.readdir(lockDir);
  assert(files.some((file) => file.endsWith('.json')));
  assert(!files.some((file) => file.endsWith('.lock')));
}

async function assertFileLockRetriesAfterNonceError() {
  const lockDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nonce-lock-test-'));
  const pending = [3, 4];
  const sent = [];
  const provider = createProvider({ pendingNonce: () => pending.shift() });
  const signer = createSigner({
    sent,
    failFirstWith: Object.assign(new Error('nonce too low'), {
      code: 'NONCE_EXPIRED',
    }),
  });

  await withEnv(
    {
      BOT_NONCE_LOCK_MODE: 'file',
      BOT_NONCE_LOCK_DIR: lockDir,
    },
    async () => {
      const tx = await sendTransactionWithNonce(
        signer,
        { to: ADDRESS },
        provider
      );
      assert.equal(tx.nonce, 4);
    }
  );

  assert.deepEqual(sent, [3, 4]);
}

(async () => {
  await assertFileLockSerializesNonceState();
  await assertFileLockRetriesAfterNonceError();
  console.log('Nonce manager contracts passed.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
