import { KwilSigner } from "@kwilteam/kwil-js";

import type { SharedSignerSnapshot } from "../sharedSigner";
import { hexToBytes } from "../bytes";
import { signDetachedMessage } from "../sharedSigner";
import { getUser, hasProfile, type IdosUser } from "./actions";
import { createWebKwilClient } from "./kwilActionClient";

const DEFAULT_IDOS_NODE_URL = "https://nodes.idos.network";

export type IdosInspectorResult = {
  nodeUrl: string;
  chainId: string;
  address: string;
  hasProfile: boolean;
  user: IdosUser | null;
};

function createIdosKwilSigner(snapshot: SharedSignerSnapshot): KwilSigner {
  return new KwilSigner(
    async (message: Uint8Array) => signDetachedMessage(snapshot.privateKeyBase64, message),
    hexToBytes(snapshot.ed25519PublicKeyHex),
    "ed25519",
  );
}

export async function inspectIdosSigner(
  snapshot: SharedSignerSnapshot,
  nodeUrl = DEFAULT_IDOS_NODE_URL,
): Promise<IdosInspectorResult> {
  const kwilClient = await createWebKwilClient({ nodeUrl });
  const signer = createIdosKwilSigner(snapshot);

  kwilClient.setSigner(signer);

  const profileExists = await hasProfile(kwilClient, snapshot.idosAdapter.publicAddress);
  const user = profileExists ? await getUser(kwilClient, signer) : null;

  return {
    nodeUrl,
    chainId: kwilClient.chainId,
    address: snapshot.idosAdapter.publicAddress,
    hasProfile: profileExists,
    user,
  };
}
