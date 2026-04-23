# BACKLOG

## Goal

Prove that a single Ed25519 signer can be shared between:

- Canton external-party signing flows
- idOS user authentication flows

This repo is intentionally PoC quality. No Daml work for now. Focus on signer reuse.

## Working assumptions

- Source of truth for idOS capabilities is the current app and SDK behavior, not the public docs.
- FaceSign exists and can create/link idOS profiles, but embedding it from our own app may depend on origin and issuer setup.
- For the PoC, one Ed25519 keypair may be reused across both systems.
- Canton-side account abstraction is explicitly out of scope for v1.

## Milestone 1: Shared signer spike

- [x] Initialize a TypeScript app in this repo
- [x] Add a minimal local app shell for the demo
- [x] Integrate Canton Wallet SDK
- [x] Implement Ed25519 key generation/load for the Canton signer
- [x] Implement a Canton signer module that can expose public key and derived identifiers
- [x] Implement a Canton signer module that can sign Canton transaction hashes
- [x] Implement an idOS signer adapter backed by the same Ed25519 key
- [x] Validate the idOS bridge approach for the PoC
- [x] Build demo UI flow for signer creation and metadata display
- [x] Build demo UI flow for Canton signing proof
- [x] Build demo UI flow for idOS profile existence checks
- [x] Add basic scripted verification for NEP-413 payload packing and idOS node reachability

## Milestone 2: Bootstrap/linking

- [x] Complete the existing-wallet flow that links the generated signer as a `NEAR` wallet
- [x] Validate the end-to-end linking flow in a browser with a real idOS profile
- [x] Verify that the linked signer can authenticate to idOS after being added
- [x] Decide that FaceSign bootstrap is not needed for the current experiment path

## Milestone 3: Canton bridge

- [x] Decide to avoid a gated browser wallet for the first Canton network path
- [x] Add a local Canton bridge process that can be started outside the browser app
- [x] Add a bridge health endpoint so the frontend can detect local Canton readiness
- [x] Add an external-party topology preparation endpoint that accepts a public key
- [x] Document the bridge env contract for `localnet` and validator-backed `devnet`

## Milestone 4: Cleanup

- [x] Document local setup and required env vars
- [x] Document exact limits and known shortcuts in the PoC
- [ ] Capture follow-up work for productionizing the approach

## Open questions

- [ ] Should the first real Canton end-to-end path use LocalNet or an allowlisted DevNet validator?
- [ ] When we add the execute step, should the browser sign the returned `multiHash` directly or should the bridge own a session cache for prepared topology payloads?
- [ ] If a profile uses `mpc`, do we need extra MPC address-sync work for the linked signer to unlock encrypted data?

## Not doing now

- [ ] Daml models or contracts
- [ ] Canton account abstraction
- [ ] Production key isolation
- [ ] Full UX polish
- [ ] Browser-wallet-specific Canton integration
