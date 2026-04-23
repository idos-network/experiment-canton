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

## Milestone 3: Cleanup

- [x] Document local setup and required env vars
- [x] Document exact limits and known shortcuts in the PoC
- [ ] Capture follow-up work for productionizing the approach

## Open questions

- [ ] What is the minimum Canton setup needed to demonstrate signer legitimacy without pulling in unnecessary network complexity?
- [ ] If a profile uses `mpc`, do we need extra MPC address-sync work for the linked signer to unlock encrypted data?

## Not doing now

- [ ] Daml models or contracts
- [ ] Canton account abstraction
- [ ] Production key isolation
- [ ] Full UX polish
