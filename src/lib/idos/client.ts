import { KwilSigner } from "@kwilteam/kwil-js";
import type { JsonRpcSigner } from "ethers";

import type { SharedSignerSnapshot } from "../sharedSigner";
import { hexToBytes } from "../bytes";
import { signNearMessage } from "../near";
import { addWallet, getUser, getWallets, hasProfile, type IdosUser, type IdosWallet } from "./actions";
import { createWebKwilClient } from "./kwilActionClient";

const DEFAULT_IDOS_NODE_URL = "https://nodes.staging.idos.network";

function getDefaultIdosNodeUrl(): string {
  const configuredUrl = import.meta.env.VITE_IDOS_NODE_URL;

  return typeof configuredUrl === "string" && configuredUrl.trim()
    ? configuredUrl.trim()
    : DEFAULT_IDOS_NODE_URL;
}

export type IdosInspectorResult = {
  nodeUrl: string;
  chainId: string;
  address: string;
  hasProfile: boolean;
  generatedWalletPresent: boolean;
  user: IdosUser | null;
  wallets: IdosWallet[];
};

export type ExistingWalletInspection = {
  address: string;
  chainId: string;
  hasProfile: boolean;
  nodeUrl: string;
  user: IdosUser | null;
  wallets: IdosWallet[];
};

export type LinkGeneratedSignerResult = {
  txHash?: string;
  inspection: ExistingWalletInspection;
  status: "linked" | "already-linked";
};

function createIdosKwilSigner(snapshot: SharedSignerSnapshot): KwilSigner {
  return new KwilSigner(
    async (message: Uint8Array) =>
      signNearMessage({
        privateKeyBase64: snapshot.privateKeyBase64,
        message: new TextDecoder().decode(message),
      }),
    hexToBytes(snapshot.ed25519PublicKeyHex),
    "nep413",
  );
}

export async function inspectIdosSigner(
  snapshot: SharedSignerSnapshot,
  nodeUrl = getDefaultIdosNodeUrl(),
): Promise<IdosInspectorResult> {
  const kwilClient = await createWebKwilClient({ nodeUrl });
  const signer = createIdosKwilSigner(snapshot);

  kwilClient.setSigner(signer);

  const profileExists = await hasProfile(kwilClient, snapshot.idosAdapter.publicAddress);
  const user = profileExists ? await getUser(kwilClient, signer) : null;
  const wallets = profileExists ? await getWallets(kwilClient, signer) : [];
  const generatedWalletPresent = wallets.some(
    (wallet) =>
      wallet.address === snapshot.idosAdapter.publicAddress &&
      wallet.wallet_type === snapshot.idosAdapter.walletType,
  );

  return {
    nodeUrl,
    chainId: kwilClient.chainId,
    address: snapshot.idosAdapter.publicAddress,
    hasProfile: profileExists,
    generatedWalletPresent,
    user,
    wallets,
  };
}

function createEvmKwilSigner(signer: JsonRpcSigner, address: string): KwilSigner {
  return new KwilSigner(signer, address);
}

export async function inspectExistingWallet(
  signer: JsonRpcSigner,
  address: string,
  nodeUrl = getDefaultIdosNodeUrl(),
): Promise<ExistingWalletInspection> {
  const kwilClient = await createWebKwilClient({ nodeUrl });
  const kwilSigner = createEvmKwilSigner(signer, address);
  kwilClient.setSigner(kwilSigner);

  const profileExists = await hasProfile(kwilClient, address);
  const user = profileExists ? await getUser(kwilClient, kwilSigner) : null;
  const wallets = profileExists ? await getWallets(kwilClient, kwilSigner) : [];

  return {
    address,
    chainId: kwilClient.chainId,
    hasProfile: profileExists,
    nodeUrl,
    user,
    wallets,
  };
}

export async function linkGeneratedNearWalletToExistingProfile({
  existingWalletAddress,
  existingWalletSigner,
  snapshot,
  nodeUrl = getDefaultIdosNodeUrl(),
}: {
  existingWalletAddress: string;
  existingWalletSigner: JsonRpcSigner;
  snapshot: SharedSignerSnapshot;
  nodeUrl?: string;
}): Promise<LinkGeneratedSignerResult> {
  const kwilClient = await createWebKwilClient({ nodeUrl });
  const kwilSigner = createEvmKwilSigner(existingWalletSigner, existingWalletAddress);
  kwilClient.setSigner(kwilSigner);

  const profileExists = await hasProfile(kwilClient, existingWalletAddress);
  if (!profileExists) {
    throw new Error("The connected EVM wallet does not have an idOS profile.");
  }

  const walletsBefore = await getWallets(kwilClient, kwilSigner);
  const alreadyLinked = walletsBefore.some(
    (wallet) =>
      wallet.address === snapshot.idosAdapter.publicAddress &&
      wallet.wallet_type === snapshot.idosAdapter.walletType,
  );

  if (alreadyLinked) {
    return {
      status: "already-linked",
      inspection: await inspectExistingWallet(existingWalletSigner, existingWalletAddress, nodeUrl),
    };
  }

  const message = `Link this generated Canton signer to my idOS profile. Nonce ${crypto.randomUUID()}`;
  const signatureBytes = await signNearMessage({
    privateKeyBase64: snapshot.privateKeyBase64,
    message,
  });
  const txHash = await addWallet(
    kwilClient,
    {
      id: crypto.randomUUID(),
      address: snapshot.idosAdapter.publicAddress,
      public_key: snapshot.idosAdapter.publicKey,
      wallet_type: "NEAR",
      message,
      signature: Array.from(signatureBytes, (byte) => byte.toString(16).padStart(2, "0")).join(""),
    },
    kwilSigner,
  );

  return {
    txHash,
    status: "linked",
    inspection: await inspectExistingWallet(existingWalletSigner, existingWalletAddress, nodeUrl),
  };
}
