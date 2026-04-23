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

- [ ] Initialize a TypeScript app in this repo
- [ ] Add a minimal local app shell for the demo
- [ ] Integrate Canton Wallet SDK
- [ ] Implement Ed25519 key generation/load for the Canton signer
- [ ] Implement a Canton signer module that can:
  - [ ] expose public key and derived identifiers
  - [ ] sign Canton transaction hashes
- [ ] Implement an idOS signer adapter backed by the same Ed25519 key
- [ ] Validate which idOS wallet path is the right bridge for the PoC:
  - [ ] custom signer
  - [ ] `FaceSign`-style raw Ed25519 path
- [ ] Build demo UI flow:
  - [ ] create/load signer
  - [ ] show signer public key and metadata
  - [ ] check idOS profile existence
  - [ ] if linked, log in to idOS
  - [ ] show basic idOS profile state
  - [ ] show Canton signing proof
- [ ] Add basic smoke tests or scripted verification where practical

## Milestone 2: Bootstrap/linking

- [ ] Determine whether our local app can embed FaceSign directly
- [ ] If yes, implement one-time profile creation/link flow in-repo
- [ ] If no, document the manual bootstrap via `app.idos.network`
- [ ] Verify that a profile created or linked through FaceSign can later be used by the shared Canton signer flow

## Milestone 3: Cleanup

- [ ] Document local setup and required env vars
- [ ] Document exact limits and known shortcuts in the PoC
- [ ] Capture follow-up work for productionizing the approach

## Open questions

- [ ] Does idOS accept the shared signer cleanly through the current custom-signer path, or do we need to present it specifically as `FaceSign`?
- [ ] What is the minimum Canton setup needed to demonstrate signer legitimacy without pulling in unnecessary network complexity?
- [ ] Can FaceSign bootstrap be exercised from localhost, or only from idOS-controlled origins?

## Not doing now

- [ ] Daml models or contracts
- [ ] Canton account abstraction
- [ ] Production key isolation
- [ ] Full UX polish
