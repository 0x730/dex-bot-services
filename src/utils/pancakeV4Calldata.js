function requirePrebuiltPancakeV4Calldata(calldata) {
  if (typeof calldata === 'string' && /^0x[0-9a-fA-F]*$/.test(calldata)) {
    return calldata;
  }

  throw new Error(
    'Missing or invalid Pancake V4 calldata. Internal route building is disabled. Provide pre-built Universal Router calldata and valueWei/valueEth.'
  );
}

module.exports = {
  requirePrebuiltPancakeV4Calldata,
};
