import { useEffect, useState } from "react";

import { connectEvmWallet } from "./lib/idos/evm";
import {
  inspectExistingWallet,
  inspectIdosSigner,
  linkGeneratedNearWalletToExistingProfile,
  type ExistingWalletInspection,
  type IdosInspectorResult,
  type LinkGeneratedSignerResult,
} from "./lib/idos/client";
import { loadOrCreateSharedSigner, type SharedSignerSnapshot } from "./lib/sharedSigner";

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="data-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function WalletSummaryList({
  wallets,
}: {
  wallets: ExistingWalletInspection["wallets"] | IdosInspectorResult["wallets"];
}) {
  if (!wallets.length) {
    return <p className="muted-text">No wallets returned.</p>;
  }

  return (
    <ul className="wallet-list">
      {wallets.map((wallet) => (
        <li key={wallet.id}>
          <span>{wallet.wallet_type}</span>
          <code>{wallet.address}</code>
        </li>
      ))}
    </ul>
  );
}

export default function App() {
  const [snapshot, setSnapshot] = useState<SharedSignerSnapshot | null>(null);
  const [idosState, setIdosState] = useState<{
    error: string | null;
    loading: boolean;
    result: IdosInspectorResult | null;
  }>({
    error: null,
    loading: false,
    result: null,
  });
  const [connectedWallet, setConnectedWallet] = useState<{
    address: string;
    signer: Awaited<ReturnType<typeof connectEvmWallet>>["signer"];
  } | null>(null);
  const [existingWalletState, setExistingWalletState] = useState<{
    error: string | null;
    loading: boolean;
    result: ExistingWalletInspection | null;
  }>({
    error: null,
    loading: false,
    result: null,
  });
  const [linkState, setLinkState] = useState<{
    error: string | null;
    loading: boolean;
    result: LinkGeneratedSignerResult | null;
  }>({
    error: null,
    loading: false,
    result: null,
  });

  useEffect(() => {
    loadOrCreateSharedSigner().then(setSnapshot);
  }, []);

  async function handleInspectIdos() {
    if (!snapshot) {
      return;
    }

    setIdosState({
      error: null,
      loading: true,
      result: null,
    });

    try {
      const result = await inspectIdosSigner(snapshot);

      setIdosState({
        error: null,
        loading: false,
        result,
      });
    } catch (error) {
      setIdosState({
        error: error instanceof Error ? error.message : "Failed to inspect idOS signer.",
        loading: false,
        result: null,
      });
    }
  }

  async function handleConnectExistingWallet() {
    if (!snapshot) {
      return;
    }

    setExistingWalletState({
      error: null,
      loading: true,
      result: null,
    });
    setLinkState({
      error: null,
      loading: false,
      result: null,
    });

    try {
      const wallet = await connectEvmWallet();
      setConnectedWallet(wallet);

      const result = await inspectExistingWallet(wallet.signer, wallet.address);
      setExistingWalletState({
        error: null,
        loading: false,
        result,
      });
    } catch (error) {
      setExistingWalletState({
        error: error instanceof Error ? error.message : "Failed to inspect the connected wallet.",
        loading: false,
        result: null,
      });
    }
  }

  async function handleLinkGeneratedWallet() {
    if (!snapshot || !connectedWallet) {
      return;
    }

    setLinkState({
      error: null,
      loading: true,
      result: null,
    });

    try {
      const result = await linkGeneratedNearWalletToExistingProfile({
        existingWalletAddress: connectedWallet.address,
        existingWalletSigner: connectedWallet.signer,
        snapshot,
      });

      setLinkState({
        error: null,
        loading: false,
        result,
      });
      setExistingWalletState({
        error: null,
        loading: false,
        result: result.inspection,
      });
      setIdosState({
        error: null,
        loading: false,
        result: await inspectIdosSigner(snapshot),
      });
    } catch (error) {
      setLinkState({
        error: error instanceof Error ? error.message : "Failed to link the generated wallet.",
        loading: false,
        result: null,
      });
    }
  }

  if (!snapshot) {
    return (
      <main className="app-shell">
        <section className="hero">
          <p className="eyebrow">Canton x idOS</p>
          <h1>Shared signer experiment</h1>
          <p className="lede">Loading the generated signer...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">Canton x idOS</p>
        <h1>Shared signer experiment</h1>
        <p className="lede">
          This app will prove that one Ed25519 signer can be reused across Canton external-party
          flows and idOS authentication flows.
        </p>
      </section>

      <section className="panel panel-grid">
        <div>
          <div className="panel-header">
            <h2>Shared signer</h2>
            <button
              className="button"
              type="button"
              onClick={() => {
                loadOrCreateSharedSigner(true).then(setSnapshot);
              }}
            >
              Regenerate
            </button>
          </div>
          <dl className="data-list">
            <DataRow label="Canton public key" value={snapshot.cantonPublicKeyBase64} />
            <DataRow label="idOS public key" value={snapshot.ed25519PublicKeyHex} />
            <DataRow label="idOS wallet type" value={snapshot.idosAdapter.walletType} />
            <DataRow label="idOS address" value={snapshot.idosAdapter.publicAddress} />
          </dl>
        </div>

        <div>
          <h2>Signing proof</h2>
          <dl className="data-list">
            <DataRow label="Sample Canton hash" value={snapshot.sample.cantonHashHex} />
            <DataRow label="Canton signature" value={snapshot.sample.cantonSignatureBase64} />
            <DataRow label="idOS message" value={snapshot.sample.idosMessage} />
            <DataRow label="idOS signature" value={snapshot.sample.idosSignatureHex} />
          </dl>
        </div>

        <div className="note note-card">
          <div className="panel-header">
            <h2>Generated signer login</h2>
            <button className="button" type="button" onClick={handleInspectIdos} disabled={idosState.loading}>
              {idosState.loading ? "Authenticating..." : "Authenticate generated signer"}
            </button>
          </div>
          <p>
            This uses the generated Ed25519 key as a `NEAR` wallet signer and authenticates
            directly against idOS using a browser-generated NEP-413 signature.
          </p>
          {idosState.result ? (
            <>
              <dl className="data-list">
                <DataRow label="Node URL" value={idosState.result.nodeUrl} />
                <DataRow label="Chain ID" value={idosState.result.chainId} />
                <DataRow label="Has profile" value={String(idosState.result.hasProfile)} />
                <DataRow label="Wallet visible" value={String(idosState.result.generatedWalletPresent)} />
                <DataRow
                  label="User ID"
                  value={idosState.result.user?.id ?? "No idOS profile is linked to this signer yet."}
                />
                <DataRow label="Wallet count" value={String(idosState.result.wallets.length)} />
              </dl>
              <WalletSummaryList wallets={idosState.result.wallets} />
            </>
          ) : null}
          {idosState.error ? <p className="error-text">{idosState.error}</p> : null}
        </div>

        <div className="note note-card">
          <div className="panel-header">
            <h2>Link to existing profile</h2>
            <button
              className="button"
              type="button"
              onClick={handleConnectExistingWallet}
              disabled={existingWalletState.loading}
            >
              {existingWalletState.loading ? "Connecting..." : "Connect existing EVM wallet"}
            </button>
          </div>
          <p>
            This flow uses an existing idOS-linked EVM wallet for authentication, then adds the
            generated signer as a `NEAR` wallet using its implicit address and a browser-generated
            NEP-413 signature.
          </p>
          {existingWalletState.result ? (
            <dl className="data-list">
              <DataRow label="Connected wallet" value={existingWalletState.result.address} />
              <DataRow label="Has profile" value={String(existingWalletState.result.hasProfile)} />
              <DataRow
                label="Profile user ID"
                value={
                  existingWalletState.result.user?.id ??
                  "The connected wallet does not have an idOS profile."
                }
              />
              <DataRow
                label="Encryption mode"
                value={existingWalletState.result.user?.encryption_password_store ?? "unknown"}
              />
              <DataRow
                label="Linked wallets"
                value={String(existingWalletState.result.wallets.length)}
              />
            </dl>
          ) : null}
          {existingWalletState.result ? <WalletSummaryList wallets={existingWalletState.result.wallets} /> : null}
          {existingWalletState.result?.hasProfile ? (
            <button
              className="button"
              type="button"
              onClick={handleLinkGeneratedWallet}
              disabled={linkState.loading}
            >
              {linkState.loading ? "Linking..." : "Link generated signer as NEAR wallet"}
            </button>
          ) : null}
          {existingWalletState.error ? <p className="error-text">{existingWalletState.error}</p> : null}
          {linkState.result ? (
            <dl className="data-list">
              <DataRow label="Link status" value={linkState.result.status} />
              <DataRow label="Transaction hash" value={linkState.result.txHash ?? "No transaction submitted"} />
            </dl>
          ) : null}
          {linkState.error ? <p className="error-text">{linkState.error}</p> : null}
        </div>
      </section>
    </main>
  );
}
