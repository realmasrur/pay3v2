import { ethers } from "ethers";
import { PublicKey } from "@solana/web3.js";

export function isValidAddressFor(chain, value) {
  if (!value) return false;
  if (chain.type === "solana") {
    try {
      new PublicKey(value);
      return true;
    } catch {
      return false;
    }
  }
  try {
    return ethers.isAddress(value);
  } catch {
    return false;
  }
}

/** Pull an address out of plain text or an `ethereum:0x…@1?value=…` style URI. */
export function extractAddress(text, chain) {
  let candidate = (text || "").trim();
  for (const p of ["ethereum:", "polygon:", "solana:", "pay3:", "web3:"]) {
    if (candidate.toLowerCase().startsWith(p)) candidate = candidate.slice(p.length);
  }
  candidate = candidate.split("?")[0].split("@")[0].trim();
  return isValidAddressFor(chain, candidate) ? candidate : null;
}

export function checksum(addr) {
  try {
    return ethers.getAddress(addr.toLowerCase());
  } catch {
    return addr;
  }
}
