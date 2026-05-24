const Module = require('module');

const originalLoad = Module._load;

Module._load = function (request, parent, isMain) {
  if (request === 'ethers/lib/utils') {
    const ethers = require('ethers');

    if (!ethers.constants) {
      ethers.constants = {
        AddressZero: ethers.ZeroAddress,
        ZeroAddress: ethers.ZeroAddress,
      };
    }

    if (ethers.utils) {
      return ethers.utils;
    }

    const defaultAbiCoder = ethers.AbiCoder.defaultAbiCoder();
    return {
      AbiCoder: ethers.AbiCoder,
      defaultAbiCoder,
      hexlify: ethers.hexlify,
      isAddress: ethers.isAddress,
      getAddress: ethers.getAddress,
      keccak256: ethers.keccak256,
      solidityKeccak256: ethers.solidityKeccak256,
      solidityPacked: ethers.solidityPacked,
      solidityPackedKeccak256: ethers.solidityPackedKeccak256,
      arrayify: ethers.getBytes,
      zeroPad: ethers.zeroPadValue,
      zeroPadValue: ethers.zeroPadValue,
      concat: ethers.concat,
      toUtf8Bytes: ethers.toUtf8Bytes,
      toUtf8String: ethers.toUtf8String,
      formatBytes32String: ethers.encodeBytes32String,
      parseBytes32String: ethers.decodeBytes32String,
    };
  }

  return originalLoad.apply(this, arguments);
};
