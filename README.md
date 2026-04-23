# experiment-canton

PoC for sharing a single Ed25519 signer between:

- Canton external-party signing primitives
- idOS user authentication

The current repo avoids Daml and Canton account abstraction on purpose. The focus is signer reuse.

## Current status

Working today:

- generate and persist one browser-local Ed25519 keypair
- derive a Canton signing key view from that keypair
- sign and verify a Canton-style transaction hash roundtrip
- derive a `NEAR` wallet view for idOS from that same keypair
- link that generated signer to an existing idOS profile
- authenticate to idOS using the generated signer after linking
- probe a local Canton bridge that is meant to talk to a validator-backed external-party flow
- request prepared Canton external-party topology for the shared signer from the UI
- sign the returned Canton `multiHash` in the browser and send it back for allocation
- validate the same prepare-sign-allocate Canton flow against LocalNet from a repeatable smoke script

## Stack

- Vite
- React
- TypeScript
- `@canton-network/wallet-sdk`
- `@kwilteam/kwil-js`
- browser-side `tweetnacl`

## Run locally

```bash
pnpm install
pnpm dev
```

In a second terminal, start the local Canton bridge:

```bash
pnpm canton:bridge
```

Then open the local Vite URL in a browser with an injected EVM wallet.

## LocalNet bootstrap

The repo now includes a LocalNet wrapper around the official Splice compose bundle:

```bash
pnpm canton:localnet:doctor
pnpm canton:localnet:download
pnpm canton:localnet:up
pnpm canton:bridge:localnet
pnpm canton:bridge:smoke
```

Notes:

- the wrapper prefers `podman-compose`
- it falls back to `podman compose` and then `docker compose`
- Podman must have a healthy machine connection; installed binaries alone are not enough
- LocalNet artifacts are cached under `.local/canton-localnet`
- the bundle version is resolved from the latest Digital Asset `decentralized-canton-sync` release unless `CANTON_LOCALNET_VERSION` is set

The wrapper script lives at [scripts/canton-localnet.sh](scripts/canton-localnet.sh).

## Happy path

1. Open the app.
2. Let it create or load the shared signer from browser storage.
3. Connect an existing EVM wallet that already has an idOS profile.
4. Click `Link generated signer as NEAR wallet`.
5. After linking succeeds, click `Authenticate generated signer`.

Expected result:

- the generated signer shows `Has profile: true`
- the generated signer shows `Wallet visible: true`
- the idOS user id resolves through the generated signer session

## Important implementation detail

The generated signer is linked to idOS as:

- `wallet_type: "NEAR"`
- `address`: NEAR implicit address derived from the Ed25519 public key
- `public_key`: `ed25519:<base58>`

The proof used for idOS is a browser-generated NEP-413 signature. This kept the integration simpler than trying to force the key through FaceSign-specific flows.

## Files worth reading

- [src/lib/sharedSigner.ts](src/lib/sharedSigner.ts)
  Shared Ed25519 key lifecycle plus Canton/idOS views of the same key
- [server/canton-bridge.mjs](server/canton-bridge.mjs)
  Local Node bridge for Canton external-party topology preparation
- [scripts/canton-localnet.sh](scripts/canton-localnet.sh)
  Repo-local LocalNet download and compose wrapper
- [scripts/canton-bridge-smoke.mjs](scripts/canton-bridge-smoke.mjs)
  CLI smoke test for the prepare-sign-allocate bridge roundtrip
- [src/lib/near.ts](src/lib/near.ts)
  NEP-413 message construction and signing
- [src/lib/idos/client.ts](src/lib/idos/client.ts)
  Thin idOS-specific client logic for profile inspection and wallet linking
- [src/App.tsx](src/App.tsx)
  Demo UI and browser flow

## Canton bridge

The browser app does not talk to the Canton SDK directly for the real network path anymore.
Instead it expects a small local bridge process:

- `GET /healthz`
  Returns bridge config status for the UI
- `POST /v1/external-party/topology`
  Accepts a Canton public key and returns prepared external-party topology plus the `multiHash` that the browser signer should sign
- `POST /v1/external-party/allocate`
  Accepts the same public key plus the browser-produced signature and submits the allocation request

For LocalNet specifically, run the bridge with:

```bash
pnpm canton:bridge:localnet
```

Bridge configuration is env-driven:

- `CANTON_NETWORK=localnet`
  Uses the documented LocalNet defaults plus the standard unsafe self-signed auth
- `CANTON_NETWORK=devnet` or `custom`
  Requires your own validator ledger API URL and self-signed auth env vars

There is an `.env.example` file with the supported variables.

## Validation used so far

- `pnpm build`
- `pnpm canton:localnet:doctor`
- `pnpm canton:localnet:download`
- `CANTON_LOCALNET_DRY_RUN=1 pnpm canton:localnet:up`
- `pnpm canton:bridge` plus `GET /healthz`
- `pnpm canton:bridge:smoke` against a running LocalNet bridge
- direct reachability checks against `https://nodes.idos.network`
- local NEP-413 packing and verification sanity checks
- browser validation with a real idOS profile

## Known limits

- No Daml code
- No validated Canton post-allocation ledger write yet
- No Canton token transfer or ping submission path yet
- DevNet still requires your own validator access; removing the browser wallet dependency does not remove validator onboarding
- No MPC-specific wallet sync work
- The generated key is stored in browser `localStorage`
- Bundle size is large because the current app pulls the Canton SDK into the browser bundle

## Next likely steps

- add a real post-allocation transaction flow such as ping or tap
- decide whether a DevNet-specific validation loop is still needed after LocalNet works
- reduce bundle size by moving more Canton-specific code out of the browser path
