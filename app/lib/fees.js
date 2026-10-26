export const NATIVE_TRANSFER_GAS = 21000n;
export const SOL_BASE_FEE = 0.000005;
export const SOL_ATA_RENT = 0.00203928; // rent-exempt minimum for a new token account

// Multipliers are per-mille of the node's suggested fee.
export const SPEED = {
  eco: { label: "Eco", mult: 850 },
  standard: { label: "Standard", mult: 1000 },
  fast: { label: "Fast", mult: 1250 },
};

export function computeFee(feeData, speedKey, gasLimit = NATIVE_TRANSFER_GAS) {
  if (!feeData) return null;
  const mult = BigInt(SPEED[speedKey].mult);
  if (feeData.maxFeePerGas) {
    const scaledMax = (feeData.maxFeePerGas * mult) / 1000n;
    let priority = feeData.maxPriorityFeePerGas ? (feeData.maxPriorityFeePerGas * mult) / 1000n : scaledMax / 10n;
    if (priority <= 0n) priority = scaledMax > 0n ? scaledMax : 1n;
    if (priority > scaledMax) priority = scaledMax;
    return { type: "eip1559", maxFeePerGas: scaledMax, maxPriorityFeePerGas: priority, gasLimit, totalWei: scaledMax * gasLimit };
  }
  if (feeData.gasPrice) {
    const scaled = (feeData.gasPrice * mult) / 1000n;
    return { type: "legacy", gasPrice: scaled, gasLimit, totalWei: scaled * gasLimit };
  }
  return null;
}

export function feeOverrides(fee) {
  if (!fee) return {};
  if (fee.type === "eip1559") return { maxFeePerGas: fee.maxFeePerGas, maxPriorityFeePerGas: fee.maxPriorityFeePerGas, gasLimit: fee.gasLimit };
  return { gasPrice: fee.gasPrice, gasLimit: fee.gasLimit };
}
