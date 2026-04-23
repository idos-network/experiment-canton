import { getPublicKeyFromPrivate, signTransactionHash } from "@canton-network/wallet-sdk";
import nacl from "tweetnacl";

import { base64ToBytes, bytesToBase64, bytesToHex } from "./bytes";

const STORAGE_KEY = "experiment-canton:shared-signer";
const SAMPLE_CANTON_HASH = "11".repeat(32);
const SAMPLE_IDOS_MESSAGE = "idOS authentication";

export type SharedSignerRecord = {
  privateKeyBase64: string;
};

export type SharedSignerSnapshot = {
  privateKeyBase64: string;
  cantonPublicKeyBase64: string;
  ed25519PublicKeyHex: string;
  idosAdapter: {
    publicAddress: string;
    publicKey: string;
    signatureType: "ed25519";
    walletType: "FaceSign";
  };
  sample: {
    cantonHashHex: string;
    cantonSignatureBase64: string;
    idosMessage: string;
    idosSignatureHex: string;
  };
};

function createSignerRecord(): SharedSignerRecord {
  const keyPair = nacl.sign.keyPair();

  return {
    privateKeyBase64: bytesToBase64(keyPair.secretKey),
  };
}

function readStoredSigner(): SharedSignerRecord | null {
  const rawValue = window.localStorage.getItem(STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  const parsed = JSON.parse(rawValue) as Partial<SharedSignerRecord>;

  if (!parsed.privateKeyBase64) {
    return null;
  }

  return {
    privateKeyBase64: parsed.privateKeyBase64,
  };
}

function persistSigner(record: SharedSignerRecord): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
}

function toIdosSignature(privateKeyBase64: string, message: string): string {
  const signature = nacl.sign.detached(
    new TextEncoder().encode(message),
    base64ToBytes(privateKeyBase64),
  );

  return bytesToHex(signature);
}

export function loadOrCreateSharedSigner(forceNew = false): SharedSignerSnapshot {
  const record = forceNew ? createSignerRecord() : (readStoredSigner() ?? createSignerRecord());
  persistSigner(record);

  const cantonPublicKeyBase64 = getPublicKeyFromPrivate(record.privateKeyBase64);
  const ed25519PublicKeyHex = bytesToHex(base64ToBytes(cantonPublicKeyBase64));

  return {
    privateKeyBase64: record.privateKeyBase64,
    cantonPublicKeyBase64,
    ed25519PublicKeyHex,
    idosAdapter: {
      publicAddress: ed25519PublicKeyHex,
      publicKey: ed25519PublicKeyHex,
      signatureType: "ed25519",
      walletType: "FaceSign",
    },
    sample: {
      cantonHashHex: SAMPLE_CANTON_HASH,
      cantonSignatureBase64: signTransactionHash(SAMPLE_CANTON_HASH, record.privateKeyBase64),
      idosMessage: SAMPLE_IDOS_MESSAGE,
      idosSignatureHex: toIdosSignature(record.privateKeyBase64, SAMPLE_IDOS_MESSAGE),
    },
  };
}
