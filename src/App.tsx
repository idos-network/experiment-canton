import { useEffect, useState } from "react";

import {
  getCantonBridgeUrl,
  prepareCantonExternalPartyTopology,
  probeCantonBridge,
  type CantonBridgeHealth,
  type CantonPreparedTopology,
} from "./lib/cantonBridge";
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
  const [partyHint, setPartyHint] = useState("idos-shared-signer");
  const [cantonBridgeState, setCantonBridgeState] = useState<{
    error: string | null;
    loading: boolean;
    result: CantonBridgeHealth | null;
  }>({
    error: null,
    loading: false,
    result: null,
  });
  const [cantonTopologyState, setCantonTopologyState] = useState<{
    error: string | null;
    loading: boolean;
    result: CantonPreparedTopology | null;
  }>({
    error: null,
    loading: false,
    result: null,
  });
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
    handleProbeCantonBridge();
  }, []);

  async function handleProbeCantonBridge() {
    setCantonBridgeState({
      error: null,
      loading: true,
      result: null,
    });

    try {
      const result = await probeCantonBridge();

      setCantonBridgeState({
        error: null,
        loading: false,
        result,
      });
    } catch (error) {
      setCantonBridgeState({
        error:
          error instanceof Error ? error.message : "Failed to reach the local Canton bridge.",
        loading: false,
        result: null,
      });
    }
  }

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

  async function handlePrepareCantonTopology() {
    if (!snapshot) {
      return;
    }

    setCantonTopologyState({
      error: null,
      loading: true,
      result: null,
    });

    try {
      const result = await prepareCantonExternalPartyTopology({
        partyHint,
        publicKeyBase64: snapshot.cantonPublicKeyBase64,
      });

      setCantonTopologyState({
        error: null,
        loading: false,
        result,
      });
    } catch (error) {
      setCantonTopologyState({
        error:
          error instanceof Error
            ? error.message
            : "Failed to prepare Canton external-party topology.",
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
          <h2>Canton signing proof</h2>
          <dl className="data-list">
            <DataRow label="Sample Canton hash (hex)" value={snapshot.sample.cantonHashHex} />
            <DataRow label="Canton tx hash (base64)" value={snapshot.sample.cantonHashBase64} />
            <DataRow label="Canton signature" value={snapshot.sample.cantonSignatureBase64} />
            <DataRow
              label="Signature verified"
              value={String(snapshot.sample.cantonSignatureVerified)}
            />
            <DataRow label="idOS message" value={snapshot.sample.idosMessage} />
            <DataRow label="idOS signature" value={snapshot.sample.idosSignatureHex} />
          </dl>
        </div>

        <div className="note note-card">
          <div className="panel-header">
            <h2>Canton bridge</h2>
            <button
              className="button"
              type="button"
              onClick={handleProbeCantonBridge}
              disabled={cantonBridgeState.loading}
            >
              {cantonBridgeState.loading ? "Checking..." : "Refresh bridge"}
            </button>
          </div>
          <p>
            Run <code>pnpm canton:bridge</code> to start the local Node bridge that will prepare
            Canton external-party topology using the same signer shown above.
          </p>
          {cantonBridgeState.result ? (
            <dl className="data-list">
              <DataRow label="Bridge URL" value={getCantonBridgeUrl()} />
              <DataRow label="Network target" value={cantonBridgeState.result.network} />
              <DataRow label="Configured" value={String(cantonBridgeState.result.configured)} />
              <DataRow
                label="Ledger API URL"
                value={cantonBridgeState.result.ledgerClientUrl ?? "Not configured"}
              />
              <DataRow
                label="Auth method"
                value={cantonBridgeState.result.authMethod ?? "Not configured"}
              />
            </dl>
          ) : null}
          {cantonBridgeState.result?.missingFields.length ? (
            <p className="muted-text">
              Missing env: {cantonBridgeState.result.missingFields.join(", ")}
            </p>
          ) : null}
          {cantonBridgeState.error ? <p className="error-text">{cantonBridgeState.error}</p> : null}
        </div>

        <div className="note note-card">
          <div className="panel-header">
            <h2>Prepare Canton party</h2>
            <button
              className="button"
              type="button"
              onClick={handlePrepareCantonTopology}
              disabled={cantonTopologyState.loading}
            >
              {cantonTopologyState.loading ? "Preparing..." : "Prepare topology"}
            </button>
          </div>
          <p>
            This sends the displayed Canton public key to the local bridge and asks the validator
            flow to prepare external-party topology. The returned <code>multiHash</code> is the
            exact value the shared signer should sign in the next loop.
          </p>
          <label className="field">
            <span>Party hint</span>
            <input
              className="text-input"
              type="text"
              value={partyHint}
              onChange={(event) => {
                setPartyHint(event.target.value);
              }}
            />
          </label>
          {cantonTopologyState.result ? (
            <dl className="data-list">
              <DataRow label="Party ID" value={cantonTopologyState.result.partyId} />
              <DataRow
                label="Key fingerprint"
                value={cantonTopologyState.result.publicKeyFingerprint}
              />
              <DataRow label="Multi-hash" value={cantonTopologyState.result.multiHash} />
              <DataRow
                label="Topology tx count"
                value={String(cantonTopologyState.result.topologyTransactions.length)}
              />
            </dl>
          ) : null}
          {cantonTopologyState.error ? <p className="error-text">{cantonTopologyState.error}</p> : null}
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
