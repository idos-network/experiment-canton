import nacl from "tweetnacl";
import { getPublicKeyFromPrivate, signTransactionHash } from "@canton-network/wallet-sdk";

const bridgeUrl = process.env.CANTON_BRIDGE_URL ?? "http://127.0.0.1:8787";
const partyHint = process.env.CANTON_PARTY_HINT ?? `idos-shared-${Date.now()}`;

async function postJson(path, payload) {
  const response = await fetch(`${bridgeUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json();

  if (!response.ok || !body.ok) {
    throw new Error(body.error ?? `Request to ${path} failed with status ${response.status}.`);
  }

  return body;
}

const keyPair = nacl.sign.keyPair();
const privateKeyBase64 = Buffer.from(keyPair.secretKey).toString("base64");
const publicKeyBase64 = getPublicKeyFromPrivate(privateKeyBase64);

const topology = await postJson("/v1/external-party/topology", {
  partyHint,
  publicKeyBase64,
});

const signature = signTransactionHash(topology.topology.multiHash, privateKeyBase64);

const allocation = await postJson("/v1/external-party/allocate", {
  partyHint,
  publicKeyBase64,
  signature,
});

console.log(
  JSON.stringify(
    {
      bridgeUrl,
      partyHint,
      publicKeyBase64,
      topology: topology.topology,
      allocation: allocation.allocation,
    },
    null,
    2,
  ),
);
