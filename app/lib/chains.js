/**
 * Chain registry. Everything chain-specific lives here so screens never
 * hard-code a network.
 *
 *  - alchemySlug : subdomain used for RPC / NFT / Enhanced APIs
 *  - cgId        : CoinGecko id of the native coin (for price + 24h change)
 *  - cgPlatform  : CoinGecko "asset platform" id (for ERC-20 / SPL token prices)
 *  - twFolder    : folder name in the Trust Wallet assets repo (logos)
 *  - iconSymbols : candidate file names in the cryptocurrency-icons repo for
 *                  the NATIVE coin (tried in order)
 */

export const ALCHEMY_API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "";

export const CHAINS = {
  ethereum: {
    key: "ethereum", name: "Ethereum", code: "ETH", symbol: "ETH", coinName: "Ether", type: "evm", chainId: 1,
    alchemySlug: "eth-mainnet", cgId: "ethereum", cgPlatform: "ethereum", twFolder: "ethereum", iconSymbols: ["eth"],
    color: "#627EEA", explorerName: "Etherscan",
    explorerTx: (h) => `https://etherscan.io/tx/${h}`,
    explorerAddr: (a) => `https://etherscan.io/address/${a}`,
    explorerToken: (a) => `https://etherscan.io/token/${a}`,
  },
  polygon: {
    key: "polygon", name: "Polygon", code: "POL", symbol: "POL", coinName: "Polygon Ecosystem Token", type: "evm", chainId: 137,
    alchemySlug: "polygon-mainnet", cgId: "polygon-ecosystem-token", cgPlatform: "polygon-pos", twFolder: "polygon", iconSymbols: ["pol", "matic"],
    color: "#8247E5", explorerName: "Polygonscan",
    explorerTx: (h) => `https://polygonscan.com/tx/${h}`,
    explorerAddr: (a) => `https://polygonscan.com/address/${a}`,
    explorerToken: (a) => `https://polygonscan.com/token/${a}`,
  },
  optimism: {
    key: "optimism", name: "OP Mainnet", code: "OP", symbol: "ETH", coinName: "Ether", type: "evm", chainId: 10,
    alchemySlug: "opt-mainnet", cgId: "ethereum", cgPlatform: "optimistic-ethereum", twFolder: "optimism", iconSymbols: ["eth"],
    color: "#FF0420", explorerName: "Etherscan",
    explorerTx: (h) => `https://optimistic.etherscan.io/tx/${h}`,
    explorerAddr: (a) => `https://optimistic.etherscan.io/address/${a}`,
    explorerToken: (a) => `https://optimistic.etherscan.io/token/${a}`,
  },
  arbitrum: {
    key: "arbitrum", name: "Arbitrum One", code: "ARB", symbol: "ETH", coinName: "Ether", type: "evm", chainId: 42161,
    alchemySlug: "arb-mainnet", cgId: "ethereum", cgPlatform: "arbitrum-one", twFolder: "arbitrum", iconSymbols: ["eth"],
    color: "#28A0F0", explorerName: "Arbiscan",
    explorerTx: (h) => `https://arbiscan.io/tx/${h}`,
    explorerAddr: (a) => `https://arbiscan.io/address/${a}`,
    explorerToken: (a) => `https://arbiscan.io/token/${a}`,
  },
  base: {
    key: "base", name: "Base", code: "BASE", symbol: "ETH", coinName: "Ether", type: "evm", chainId: 8453,
    alchemySlug: "base-mainnet", cgId: "ethereum", cgPlatform: "base", twFolder: "base", iconSymbols: ["eth"],
    color: "#0052FF", explorerName: "Basescan",
    explorerTx: (h) => `https://basescan.org/tx/${h}`,
    explorerAddr: (a) => `https://basescan.org/address/${a}`,
    explorerToken: (a) => `https://basescan.org/token/${a}`,
  },
  zora: {
    key: "zora", name: "Zora", code: "ZORA", symbol: "ETH", coinName: "Ether", type: "evm", chainId: 7777777,
    alchemySlug: "zora-mainnet", cgId: "ethereum", cgPlatform: "zora-network", twFolder: "zora", iconSymbols: ["eth"],
    color: "#A1723A", explorerName: "Zora Explorer",
    explorerTx: (h) => `https://explorer.zora.energy/tx/${h}`,
    explorerAddr: (a) => `https://explorer.zora.energy/address/${a}`,
    explorerToken: (a) => `https://explorer.zora.energy/token/${a}`,
  },
  mantle: {
    key: "mantle", name: "Mantle", code: "MNT", symbol: "MNT", coinName: "Mantle", type: "evm", chainId: 5000,
    alchemySlug: "mantle-mainnet", cgId: "mantle", cgPlatform: "mantle", twFolder: "mantle", iconSymbols: ["mnt"],
    color: "#65B3AE", explorerName: "Mantlescan",
    explorerTx: (h) => `https://mantlescan.xyz/tx/${h}`,
    explorerAddr: (a) => `https://mantlescan.xyz/address/${a}`,
    explorerToken: (a) => `https://mantlescan.xyz/token/${a}`,
  },
  plasma: {
    key: "plasma", name: "Plasma", code: "XPL", symbol: "XPL", coinName: "Plasma", type: "evm", chainId: 9745,
    alchemySlug: "plasma-mainnet", cgId: "plasma", cgPlatform: "plasma", twFolder: "plasma", iconSymbols: ["xpl"],
    color: "#2DD4BF", explorerName: "Plasmascan",
    explorerTx: (h) => `https://plasmascan.to/tx/${h}`,
    explorerAddr: (a) => `https://plasmascan.to/address/${a}`,
    explorerToken: (a) => `https://plasmascan.to/token/${a}`,
  },
  solana: {
    key: "solana", name: "Solana", code: "SOL", symbol: "SOL", coinName: "Solana", type: "solana",
    alchemySlug: "solana-mainnet", cgId: "solana", cgPlatform: "solana", twFolder: "solana", iconSymbols: ["sol"],
    color: "#9945FF", explorerName: "Solana Explorer",
    explorerTx: (h) => `https://explorer.solana.com/tx/${h}`,
    explorerAddr: (a) => `https://explorer.solana.com/address/${a}`,
    explorerToken: (a) => `https://explorer.solana.com/address/${a}`,
  },
};

export const CHAIN_ORDER = ["ethereum", "polygon", "optimism", "arbitrum", "base", "zora", "mantle", "plasma", "solana"];
export const EVM_CHAINS = CHAIN_ORDER.filter((k) => CHAINS[k].type === "evm");

export const SOLANA_PATH = (index = 0) => `m/44'/501'/${index}'/0'`;
export const EVM_PATH = (index = 0) => `m/44'/60'/0'/0/${index}`;

export function rpcUrl(chain) {
  return `https://${chain.alchemySlug}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
}

export function chainKeyFromCaip(caip) {
  if (!caip) return null;
  const [ns, id] = caip.split(":");
  if (ns !== "eip155") return null;
  const num = parseInt(id, 10);
  return EVM_CHAINS.find((k) => CHAINS[k].chainId === num) || null;
}

/** Which chains a given wallet entry can use. */
export function chainsForWallet(entry) {
  if (!entry) return [];
  return CHAIN_ORDER.filter((k) => (CHAINS[k].type === "evm" ? !!entry.evmAddress : !!entry.solAddress));
}

export function addressOnChain(entry, chainKey) {
  if (!entry) return "";
  return CHAINS[chainKey].type === "solana" ? entry.solAddress || "" : entry.evmAddress || "";
}

/* WalletConnect */
export const WALLETCONNECT_PROJECT_ID = "080a7cf4b8c328ca3aa2ec842e3d7958";
export const WC_METHODS = ["eth_sendTransaction", "eth_signTransaction", "personal_sign", "eth_signTypedData", "eth_signTypedData_v4"];
export const WC_EVENTS = ["chainChanged", "accountsChanged"];
export const WC_METHOD_LABELS = {
  eth_sendTransaction: "Send a transaction",
  eth_signTransaction: "Sign a transaction",
  personal_sign: "Sign a message",
  eth_signTypedData: "Sign typed data",
  eth_signTypedData_v4: "Sign typed data",
};

export const APP_VERSION = "2.0.0";
