import { serialize } from "borsh";
import bs58 from "bs58";

import { concatBytes, uint16ToBigEndian } from "./bytes";
import { signDetachedMessage } from "./sharedSigner";

const NEP413_TAG = 2147484061;
const DEFAULT_RECIPIENT = "idos.network";

const nep413Schema = {
  struct: {
    tag: "u32",
    message: "string",
    nonce: { array: { type: "u8", len: 32 } },
    recipient: "string",
    callbackUrl: { option: "string" },
  },
} as const;

function createNonce(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

async function sha256(message: Uint8Array): Promise<Uint8Array> {
  const input = message.buffer.slice(
    message.byteOffset,
    message.byteOffset + message.byteLength,
  ) as ArrayBuffer;
  const hash = await crypto.subtle.digest("SHA-256", input);
  return new Uint8Array(hash);
}

export function nearPublicKeyFromBytes(publicKey: Uint8Array): string {
  return `ed25519:${bs58.encode(publicKey)}`;
}

export function implicitNearAddress(publicKey: Uint8Array): string {
  return Array.from(publicKey, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function signNearMessage({
  privateKeyBase64,
  message,
  recipient = DEFAULT_RECIPIENT,
}: {
  privateKeyBase64: string;
  message: string;
  recipient?: string;
}): Promise<Uint8Array> {
  const nonce = createNonce();
  const payload = serialize(nep413Schema, {
    tag: NEP413_TAG,
    message,
    nonce: Array.from(nonce),
    recipient,
    callbackUrl: null,
  });
  const digest = await sha256(payload);
  const signature = signDetachedMessage(privateKeyBase64, digest);

  return concatBytes(uint16ToBigEndian(payload.length), payload, signature);
}
