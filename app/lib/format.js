export const short = (addr, a = 6, b = 4) => (addr ? `${addr.slice(0, a)}…${addr.slice(-b)}` : "");

export const CURRENCIES = {
  usd: { code: "USD", name: "US Dollar" },
  eur: { code: "EUR", name: "Euro" },
  gbp: { code: "GBP", name: "British Pound" },
  bdt: { code: "BDT", name: "Bangladeshi Taka" },
  inr: { code: "INR", name: "Indian Rupee" },
  jpy: { code: "JPY", name: "Japanese Yen" },
  aed: { code: "AED", name: "UAE Dirham" },
  cad: { code: "CAD", name: "Canadian Dollar" },
  aud: { code: "AUD", name: "Australian Dollar" },
};

/** Fiat formatting: small balances keep up to 5 decimals ($0.21786), larger ones use 2. */
export function formatFiat(value, currency = "usd") {
  const code = (CURRENCIES[currency] || CURRENCIES.usd).code;
  const n = Number(value);
  if (!isFinite(n)) return "—";
  const abs = Math.abs(n);
  let opts;
  if (abs === 0) opts = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  else if (abs < 1) opts = { minimumFractionDigits: 2, maximumFractionDigits: 5 };
  else opts = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: code, ...opts }).format(n);
  } catch {
    return `${n.toFixed(2)} ${code}`;
  }
}

/** For list rows: tiny values collapse to "<$0.01". */
export function formatFiatShort(value, currency = "usd") {
  const n = Number(value);
  if (!isFinite(n)) return "—";
  if (n > 0 && n < 0.01) {
    const sym = formatFiat(0, currency).replace(/[\d.,\s]/g, "");
    return `<${sym}0.01`;
  }
  return formatFiat(n, currency);
}

export function formatAmount(value, max = 6) {
  const n = Number(value);
  if (!isFinite(n)) return "0";
  if (n === 0) return "0";
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2).replace(/\.00$/, "")}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2).replace(/\.00$/, "")}M`;
  return n.toLocaleString(undefined, { maximumFractionDigits: Math.abs(n) >= 1000 ? 2 : max });
}

export function formatPct(p) {
  const n = Number(p);
  if (!isFinite(n)) return "";
  return `${Math.abs(n).toFixed(2)}%`;
}

export function dayLabel(ts) {
  if (!ts) return "Earlier";
  const d = new Date(ts);
  if (isNaN(d)) return "Earlier";
  const today = new Date();
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(today) - startOf(d)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function timeLabel(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return isNaN(d) ? "" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** Hash a string to a 32-bit int (FNV-1a) — used for deterministic avatars. */
export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Decimal-string → trimmed plain string without exponent (for inputs). */
export function trimDecimals(str, max) {
  if (!str.includes(".")) return str;
  const [i, f] = str.split(".");
  const cut = f.slice(0, max).replace(/0+$/, "");
  return cut ? `${i}.${cut}` : i;
}
