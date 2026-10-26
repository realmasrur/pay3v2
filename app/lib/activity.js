/**
 * Transaction history per chain, normalised to one row shape:
 *   { id, hash, chain, direction: "in"|"out", value|null, symbol, tokenAddress|null,
 *     from, to, ts (ms|null), blockNum, hexBlock, status: "confirmed"|"failed" }
 */

import { PublicKey } from "@solana/web3.js";
import { CHAINS } from "./chains";

export async function fetchEvmActivity({ provider, chain, address }) {
  const def = CHAINS[chain];
  const base = { fromBlock: "0x0", category: ["external", "erc20"], order: "desc", maxCount: "0x14", excludeZeroValue: true, withMetadata: true };
  const [incoming, outgoing] = await Promise.all([
    provider.send("alchemy_getAssetTransfers", [{ ...base, toAddress: address }]),
    provider.send("alchemy_getAssetTransfers", [{ ...base, fromAddress: address }]),
  ]);
  const rows = [
    ...(incoming?.transfers || []).map((t) => ({ t, direction: "in" })),
    ...(outgoing?.transfers || []).map((t) => ({ t, direction: "out" })),
  ].map(({ t, direction }, i) => ({
    id: `${chain}:${t.hash}:${direction}:${t.uniqueId || i}`,
    hash: t.hash,
    chain,
    direction,
    value: t.value ?? 0,
    symbol: t.category === "external" ? def.symbol : t.asset || "TOKEN",
    tokenAddress: t.category === "external" ? null : t.rawContract?.address || null,
    from: t.from,
    to: t.to,
    ts: t.metadata?.blockTimestamp ? Date.parse(t.metadata.blockTimestamp) : null,
    blockNum: t.blockNum,
    hexBlock: true,
    status: "confirmed",
  }));
  return rows.sort((a, b) => parseInt(b.blockNum, 16) - parseInt(a.blockNum, 16)).slice(0, 20);
}

export async function fetchSolanaActivity({ connection, address, symbolForMint }) {
  const pubkey = new PublicKey(address);
  const me = pubkey.toBase58();
  const sigs = await connection.getSignaturesForAddress(pubkey, { limit: 15 });
  if (!sigs.length) return [];
  const parsed = await Promise.all(
    sigs.map((s) => connection.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0 }).catch(() => null))
  );
  const keyStr = (k) => (k.pubkey ? k.pubkey.toBase58() : k.toBase58());
  const rows = [];

  sigs.forEach((s, i) => {
    const tx = parsed[i];
    const ts = s.blockTime ? s.blockTime * 1000 : null;
    const common = { hash: s.signature, chain: "solana", ts, blockNum: s.slot, hexBlock: false };

    if (s.err) {
      rows.push({ ...common, id: `solana:${s.signature}:fail`, direction: "out", value: null, symbol: "SOL", tokenAddress: null, from: me, to: "", status: "failed" });
      return;
    }
    if (!tx?.meta) return;
    try {
      const keys = tx.transaction.message.accountKeys;
      const idx = keys.findIndex((k) => keyStr(k) === me);
      if (idx !== -1) {
        const diff = (tx.meta.postBalances[idx] - tx.meta.preBalances[idx]) / 1e9;
        // ignore pure-fee movements (a token transfer also costs a little SOL)
        const hasTokenMove = (tx.meta.postTokenBalances || []).some((b) => b.owner === me) || (tx.meta.preTokenBalances || []).some((b) => b.owner === me);
        if (Math.abs(diff) > 0.00002 || (!hasTokenMove && Math.abs(diff) > 1e-9)) {
          const direction = diff >= 0 ? "in" : "out";
          let other = "";
          for (let j = 0; j < keys.length; j++) {
            if (j !== idx && tx.meta.postBalances[j] !== tx.meta.preBalances[j]) {
              other = keyStr(keys[j]);
              break;
            }
          }
          rows.push({
            ...common, id: `solana:${s.signature}:sol`, direction, value: Math.abs(diff), symbol: "SOL", tokenAddress: null,
            from: direction === "out" ? me : other, to: direction === "out" ? other : me, status: "confirmed",
          });
        }
      }

      // SPL token movements for this owner
      const pre = tx.meta.preTokenBalances || [];
      const post = tx.meta.postTokenBalances || [];
      const mints = Array.from(new Set([...pre, ...post].filter((b) => b.owner === me).map((b) => b.mint)));
      for (const mint of mints) {
        const amt = (list, owner) =>
          list.filter((b) => b.mint === mint && (owner ? b.owner === me : b.owner !== me)).reduce((n, b) => n + Number(b.uiTokenAmount?.uiAmount || 0), 0);
        const diff = amt(post, true) - amt(pre, true);
        if (Math.abs(diff) < 1e-12) continue;
        const direction = diff >= 0 ? "in" : "out";
        const otherOwner = [...post, ...pre].find((b) => b.mint === mint && b.owner && b.owner !== me)?.owner || "";
        rows.push({
          ...common, id: `solana:${s.signature}:${mint}`, direction, value: Math.abs(diff), symbol: symbolForMint?.(mint) || `${mint.slice(0, 4)}…`, tokenAddress: mint,
          from: direction === "out" ? me : otherOwner, to: direction === "out" ? otherOwner : me, status: "confirmed",
        });
      }
    } catch {
      /* skip unparsable rows */
    }
  });
  return rows;
}
