# experiment-canton

PoC for one browser-generated Ed25519 key doing both of these jobs:

- authenticate to idOS
- sign for a Canton external party

The intended path for this repo is:

- idOS web app: `https://app.staging.idos.network`
- idOS node: `https://nodes.staging.idos.network`
- Canton: local LocalNet plus a local bridge process

The demo is intentionally narrow:

> One Ed25519 key can authenticate to idOS and sign for a Canton external party.

This repo does not try to explain every environment or every Canton flow. It is built to get
that one statement working end to end.

## What this proves

Working today:

- generate and persist one browser-local Ed25519 keypair
- derive a `NEAR` wallet view for idOS from that keypair
- link that generated signer to an existing idOS profile
- authenticate to idOS using the generated signer after linking
- derive a Canton signing key view from that same keypair
- prepare Canton external-party topology for the shared signer from the UI
- sign the returned Canton `multiHash` in the browser and send it back for allocation
- allocate a real Canton external party on LocalNet
- prepare, sign, and execute a real Canton self-ping after allocation

## Fastest Path

Follow these steps in order.

### 1. Install dependencies

```bash
pnpm install
```

### 2. Make sure you have an idOS profile on staging

Open `https://app.staging.idos.network`.

If you do not already have an idOS profile there:

1. Create a profile with FaceSign.
2. Connect an EVM wallet.
3. Keep using that same EVM wallet for the bootstrap step in this demo.

The browser app in this repo talks to `https://nodes.staging.idos.network` by default.

### 3. Start Canton LocalNet

```bash
pnpm canton:localnet:doctor
pnpm canton:localnet:download
pnpm canton:localnet:up
```

Notes:

- the wrapper prefers `podman-compose`
- it falls back to `podman compose` and then `docker compose`
- Podman must have a healthy machine connection; installed binaries alone are not enough. On non-Linux hosts, you may also need a working Podman machine.
- LocalNet artifacts are cached under `.local/canton-localnet`
- this repo defaults to `CANTON_LOCALNET_VERSION=0.5.18` because `@canton-network/wallet-sdk@1.0.0` only supports Canton `3.4.x`
- if you already downloaded or started a newer bundle, rerun with `CANTON_LOCALNET_VERSION=0.5.18` or remove the newer bundle from `.local/canton-localnet`

### 4. Start the local Canton bridge

In a second terminal:

```bash
pnpm canton:bridge:localnet
```

### 5. Start the browser app

In a third terminal:

```bash
pnpm dev
```

### 6. Run the browser flow

Open the local Vite URL.

The app will create or load a browser-local Ed25519 key automatically.

If that key is not linked to idOS yet:

1. Expand `Bootstrap idOS link`.
2. Click `Connect existing EVM wallet`.
3. Connect the same staging idOS wallet you used at `app.staging.idos.network`.
4. Click `Link generated key to idOS`.

Then click `Run crypto demo`.

Expected result:

- the summary header shows `idOS authenticated`
- the summary header shows `Canton ping executed`
- the app shows the idOS user id reached by the shared key
- the app shows the Canton party id and ping update id reached by that same key

## How the idOS Side Works

The generated signer is linked to idOS as:

- `wallet_type: "NEAR"`
- `address`: NEAR implicit address derived from the Ed25519 public key
- `public_key`: `ed25519:<base58>`

The proof used for idOS is a browser-generated NEP-413 signature. This kept the integration
simpler than trying to force the key through FaceSign-specific flows.

## How the Canton Side Works

The browser app does not talk to the Canton SDK directly for the real network path.
Instead it talks to a small local bridge process:

- `GET /healthz`
  Returns bridge config status for the UI
- `POST /v1/external-party/topology`
  Returns prepared external-party topology plus the `multiHash` the browser signer must sign
- `POST /v1/external-party/allocate`
  Submits the browser-produced signature and allocates the external party
- `POST /v1/ping/prepare`
  Prepares a Ping create transaction and returns the transaction hash to sign
- `POST /v1/ping/execute`
  Submits the signed Ping transaction

For the intended demo path, use:

- browser app -> `http://127.0.0.1:8787`
- bridge network -> `localnet`
- idOS node -> `https://nodes.staging.idos.network`

There is an [.env.example](.env.example) file with the main browser and bridge variables,
including `VITE_IDOS_NODE_URL` and `VITE_CANTON_BRIDGE_URL`.

## Validation Used So Far

- `pnpm build`
- `pnpm canton:localnet:doctor`
- `pnpm canton:localnet:download`
- `CANTON_LOCALNET_DRY_RUN=1 pnpm canton:localnet:up`
- `pnpm canton:bridge:localnet` plus `GET /healthz`
- `pnpm canton:bridge:smoke` against a running LocalNet bridge, including self-ping execution
- direct reachability checks against `https://nodes.staging.idos.network`
- local NEP-413 packing and verification sanity checks
- browser validation with a real staging idOS profile

## Files Worth Reading

- [src/lib/sharedSigner.ts](src/lib/sharedSigner.ts)
  Shared Ed25519 key lifecycle plus Canton and idOS views of the same key
- [src/lib/idos/client.ts](src/lib/idos/client.ts)
  idOS profile inspection and wallet-linking logic
- [src/lib/near.ts](src/lib/near.ts)
  NEP-413 message construction and signing
- [server/canton-bridge.mjs](server/canton-bridge.mjs)
  Local bridge for Canton external-party topology preparation and ping execution
- [scripts/canton-localnet.sh](scripts/canton-localnet.sh)
  Repo-local LocalNet download and compose wrapper
- [scripts/canton-bridge-smoke.mjs](scripts/canton-bridge-smoke.mjs)
  CLI smoke test for the prepare-sign-allocate bridge roundtrip
- [src/App.tsx](src/App.tsx)
  Demo UI and browser flow

## Known Limits

- No Daml code
- idOS scope here is wallet linking and authentication only
- The generated key is stored in browser `localStorage`
- Bundle size is large because the current app pulls the Canton SDK into the browser bundle
- The README is intentionally biased toward staging idOS plus LocalNet; other environments require adjusting the config and validation path

## Next Likely Steps

- capture and export a concise proof bundle from the demo run
- decide how AG-oriented flows should consume this shared signer proof
- reduce bundle size by moving more Canton-specific code out of the browser path
