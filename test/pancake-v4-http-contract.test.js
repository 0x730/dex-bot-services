const assert = require('assert');
const { handlePancakeV4ExecuteLike } = require('../src/pancake-v4');

function invokeExecuteLike(body) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        resolve({
          statusCode: this.statusCode,
          body: payload,
        });
      },
    };

    handlePancakeV4ExecuteLike({ body }, res, {
      mode: 'estimate',
      message: 'Pancake V4 Buy estimate',
    });
  });
}

(async () => {
  const response = await invokeExecuteLike({
    chain: 'BSC',
    walletLabel: 'MAIN',
    tokenAddress: '0x55d398326f99059fF775485246999027B3197955',
    amountInBnb: '0.001',
    fee: '3000',
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.body.error, /Missing or invalid Pancake V4 calldata/);
  console.log('Pancake V4 HTTP contract passed.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
