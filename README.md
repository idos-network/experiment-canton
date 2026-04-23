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

Then open the local Vite URL in a browser with an injected EVM wallet.

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
- [src/lib/near.ts](src/lib/near.ts)
  NEP-413 message construction and signing
- [src/lib/idos/client.ts](src/lib/idos/client.ts)
  Thin idOS-specific client logic for profile inspection and wallet linking
- [src/App.tsx](src/App.tsx)
  Demo UI and browser flow

## Validation used so far

- `pnpm build`
- direct reachability checks against `https://nodes.idos.network`
- local NEP-413 packing and verification sanity checks
- browser validation with a real idOS profile

## Known limits

- No Daml code
- No Canton network write path yet
- No Canton external-party allocation flow yet
- No MPC-specific wallet sync work
- The generated key is stored in browser `localStorage`
- Bundle size is large because the current app pulls the Canton SDK into the browser bundle

## Next likely steps

- replace the sample Canton signing panel with a more explicit external-party preparation flow
- decide whether a real Canton provider should be added to the demo
- reduce bundle size by code-splitting or moving some Canton logic off the initial client path
