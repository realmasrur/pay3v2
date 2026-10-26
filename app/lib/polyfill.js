import { Buffer } from "buffer";

// bip39 / ed25519-hd-key reference a global Buffer, which only exists by
// default in Node. Import this file BEFORE them.
if (typeof globalThis !== "undefined" && typeof globalThis.Buffer === "undefined") {
  globalThis.Buffer = Buffer;
}

export { Buffer };
