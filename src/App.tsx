import { useEffect, useState } from "react";

import {
  allocateCantonExternalParty,
  executeCantonPing,
  getCantonBridgeUrl,
  prepareCantonExternalPartyTopology,
  prepareCantonPing,
  probeCantonBridge,
  type CantonAllocatedParty,
  type CantonBridgeHealth,
  type CantonExecutedPing,
  type CantonPreparedPing,
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
import {
  loadOrCreateSharedSigner,
  signCantonTransactionHash,
  type SharedSignerSnapshot,
} from "./lib/sharedSigner";

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="data-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "idle" | "ready" | "live";
}) {
  return <span className={`status-pill status-pill-${tone}`}>{label}</span>;
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

function shortenValue(value: string, head = 18, tail = 12): string {
  if (value.length <= head + tail + 3) {
    return value;
  }

  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

type AsyncState<T> = {
  error: string | null;
  loading: boolean;
  result: T | null;
};

function createAsyncState<T>(): AsyncState<T> {
  return {
    error: null,
    loading: false,
    result: null,
  };
}

export default function App() {
  const [snapshot, setSnapshot] = useState<SharedSignerSnapshot | null>(null);
  const [partyHint, setPartyHint] = useState<string | null>(null);
  const [demoState, setDemoState] = useState<{
    error: string | null;
    loading: boolean;
    lastCompletedAt: string | null;
  }>({
    error: null,
    loading: false,
    lastCompletedAt: null,
  });
  const [cantonBridgeState, setCantonBridgeState] = useState<AsyncState<CantonBridgeHealth>>(
    createAsyncState(),
  );
  const [idosState, setIdosState] = useState<AsyncState<IdosInspectorResult>>(createAsyncState());
  const [cantonTopologyState, setCantonTopologyState] = useState<
    AsyncState<CantonPreparedTopology>
  >(createAsyncState());
  const [cantonSignature, setCantonSignature] = useState<string | null>(null);
  const [cantonAllocationState, setCantonAllocationState] = useState<
    AsyncState<CantonAllocatedParty>
  >(createAsyncState());
  const [cantonPingState, setCantonPingState] = useState<AsyncState<CantonPreparedPing>>(
    createAsyncState(),
  );
  const [cantonPingSignature, setCantonPingSignature] = useState<string | null>(null);
  const [cantonPingExecutionState, setCantonPingExecutionState] = useState(
    createAsyncState<CantonExecutedPing>(),
  );
  const [connectedWallet, setConnectedWallet] = useState<{
    address: string;
    signer: Awaited<ReturnType<typeof connectEvmWallet>>["signer"];
  } | null>(null);
  const [existingWalletState, setExistingWalletState] = useState<
    AsyncState<ExistingWalletInspection>
  >(createAsyncState());
  const [linkState, setLinkState] = useState<AsyncState<LinkGeneratedSignerResult>>(
    createAsyncState(),
  );

  const bridgeReady = Boolean(cantonBridgeState.result?.configured && !cantonBridgeState.error);
  const idosReady = Boolean(
    idosState.result?.hasProfile && idosState.result.generatedWalletPresent,
  );
  const cantonReady = Boolean(cantonPingExecutionState.result);
  const demoReady = idosReady && cantonReady;

  useEffect(() => {
    loadOrCreateSharedSigner().then(setSnapshot);
    void handleProbeCantonBridge();
  }, []);

  function resetCantonState() {
    setPartyHint(null);
    setCantonTopologyState(createAsyncState());
    setCantonSignature(null);
    setCantonAllocationState(createAsyncState());
    setCantonPingState(createAsyncState());
    setCantonPingSignature(null);
    setCantonPingExecutionState(createAsyncState());
  }

  function resetDemoState() {
    setDemoState({
      error: null,
      loading: false,
      lastCompletedAt: null,
    });
    setIdosState(createAsyncState());
    resetCantonState();
  }

  async function handleProbeCantonBridge(): Promise<CantonBridgeHealth> {
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

      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to reach the local Canton bridge.";

      setCantonBridgeState({
        error: message,
        loading: false,
        result: null,
      });

      throw new Error(message);
    }
  }

  async function handleRunDemo() {
    if (!snapshot) {
      return;
    }

    const nextPartyHint = `idos-shared-${Date.now()}`;

    setDemoState({
      error: null,
      loading: true,
      lastCompletedAt: null,
    });
    resetCantonState();
    setPartyHint(nextPartyHint);

    try {
      const bridge = await handleProbeCantonBridge();

      if (!bridge.configured) {
        throw new Error("Start the Canton bridge before running the demo.");
      }

      setIdosState({
        error: null,
        loading: true,
        result: null,
      });

      const idosResult = await inspectIdosSigner(snapshot);
      setIdosState({
        error: null,
        loading: false,
        result: idosResult,
      });

      if (!idosResult.hasProfile || !idosResult.generatedWalletPresent) {
        throw new Error("The shared key is not linked to idOS yet. Use the bootstrap section.");
      }

      const topology = await prepareCantonExternalPartyTopology({
        partyHint: nextPartyHint,
        publicKeyBase64: snapshot.cantonPublicKeyBase64,
      });
      setCantonTopologyState({
        error: null,
        loading: false,
        result: topology,
      });

      const topologySignature = signCantonTransactionHash(
        snapshot.privateKeyBase64,
        topology.multiHash,
      );
      setCantonSignature(topologySignature);

      const allocation = await allocateCantonExternalParty({
        partyHint: nextPartyHint,
        publicKeyBase64: snapshot.cantonPublicKeyBase64,
        signature: topologySignature,
      });
      setCantonAllocationState({
        error: null,
        loading: false,
        result: allocation,
      });

      const ping = await prepareCantonPing({
        partyId: allocation.partyId,
      });
      setCantonPingState({
        error: null,
        loading: false,
        result: ping,
      });

      const pingSignature = signCantonTransactionHash(
        snapshot.privateKeyBase64,
        ping.response.preparedTransactionHash,
      );
      setCantonPingSignature(pingSignature);

      const pingExecution = await executeCantonPing({
        partyId: ping.partyId,
        responderPartyId: ping.responderPartyId,
        pingId: ping.pingId,
        response: ping.response,
        signature: pingSignature,
      });
      setCantonPingExecutionState({
        error: null,
        loading: false,
        result: pingExecution,
      });

      setDemoState({
        error: null,
        loading: false,
        lastCompletedAt: new Date().toISOString(),
      });
    } catch (error) {
      setDemoState({
        error: error instanceof Error ? error.message : "The demo run failed.",
        loading: false,
        lastCompletedAt: null,
      });
    }
  }

  async function handleRegenerateSigner() {
    setSnapshot(null);
    resetDemoState();
    setConnectedWallet(null);
    setExistingWalletState(createAsyncState());
    setLinkState(createAsyncState());
    setSnapshot(await loadOrCreateSharedSigner(true));
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
    setLinkState(createAsyncState());

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
      setDemoState((current) => ({
        ...current,
        error: null,
      }));
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
          <h1>One key. Two systems.</h1>
          <p className="lede">Loading the shared signer...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="hero hero-compact">
        <p className="eyebrow">Canton x idOS</p>
        <h1>One key. Two systems.</h1>
        <p className="lede">
          This demo uses a single Ed25519 key to authenticate to idOS and to sign for a Canton
          external party that executes a real LocalNet ping transaction.
        </p>
        <div className="hero-actions">
          <button className="button" type="button" onClick={handleRunDemo} disabled={demoState.loading}>
            {demoState.loading ? "Running demo..." : "Run crypto demo"}
          </button>
          <button className="button button-subtle" type="button" onClick={handleRegenerateSigner}>
            Regenerate key
          </button>
        </div>
        <div className="status-row">
          <StatusPill label={bridgeReady ? "Canton bridge ready" : "Canton bridge idle"} tone={bridgeReady ? "ready" : "idle"} />
          <StatusPill label={idosReady ? "idOS authenticated" : "idOS not linked"} tone={idosReady ? "ready" : "idle"} />
          <StatusPill label={cantonReady ? "Canton ping executed" : "No Canton write yet"} tone={cantonReady ? "live" : "idle"} />
        </div>
        {demoReady ? (
          <p className="hero-proof">
            Ready. The shared key authenticated to idOS user{" "}
            <code>{idosState.result?.user?.id ?? "unknown"}</code> and executed Canton update{" "}
            <code>{shortenValue(cantonPingExecutionState.result?.updateId ?? "")}</code>.
          </p>
        ) : null}
        {demoState.lastCompletedAt ? (
          <p className="muted-text">Last completed: {demoState.lastCompletedAt}</p>
        ) : null}
        {demoState.error ? <p className="error-text">{demoState.error}</p> : null}
      </section>

      <section className="panel summary-grid">
        <article className="metric-card">
          <h2>Key identity</h2>
          <p>The same raw Ed25519 key is derived into idOS and Canton signer views.</p>
          <dl className="data-list">
            <DataRow label="Ed25519 public key" value={shortenValue(snapshot.ed25519PublicKeyHex)} />
            <DataRow label="idOS NEAR address" value={shortenValue(snapshot.idosAdapter.publicAddress)} />
            <DataRow label="idOS public key" value={shortenValue(snapshot.idosAdapter.publicKey)} />
            <DataRow label="Canton public key" value={shortenValue(snapshot.cantonPublicKeyBase64)} />
          </dl>
        </article>

        <article className="metric-card">
          <h2>idOS proof</h2>
          <p>
            The key authenticates as a linked <code>NEAR</code> wallet inside idOS.
          </p>
          {idosState.result ? (
            <dl className="data-list">
              <DataRow label="User ID" value={idosState.result.user?.id ?? "No linked profile"} />
              <DataRow label="Has profile" value={String(idosState.result.hasProfile)} />
              <DataRow
                label="Wallet visible"
                value={String(idosState.result.generatedWalletPresent)}
              />
              <DataRow label="Wallet count" value={String(idosState.result.wallets.length)} />
            </dl>
          ) : (
            <p className="muted-text">Run the demo to authenticate this key against idOS.</p>
          )}
        </article>

        <article className="metric-card">
          <h2>Canton proof</h2>
          <p>The same key signs topology, allocates an external party, and executes a real ping.</p>
          {cantonPingExecutionState.result && cantonAllocationState.result ? (
            <dl className="data-list">
              <DataRow label="Party hint" value={partyHint ?? "Not generated"} />
              <DataRow
                label="Party ID"
                value={shortenValue(cantonAllocationState.result.partyId)}
              />
              <DataRow
                label="Key fingerprint"
                value={shortenValue(cantonAllocationState.result.publicKeyFingerprint)}
              />
              <DataRow
                label="Ping update ID"
                value={shortenValue(cantonPingExecutionState.result.updateId)}
              />
              <DataRow
                label="Completion offset"
                value={String(cantonPingExecutionState.result.completionOffset)}
              />
            </dl>
          ) : (
            <p className="muted-text">Run the demo to allocate a party and execute a self-ping.</p>
          )}
        </article>

        <article className="metric-card">
          <h2>Signature wires</h2>
          <p>These are the cross-system signatures produced by the same private key.</p>
          <dl className="data-list">
            <DataRow
              label="Sample idOS signature"
              value={shortenValue(snapshot.sample.idosSignatureHex)}
            />
            <DataRow
              label="Sample Canton signature"
              value={shortenValue(snapshot.sample.cantonSignatureBase64)}
            />
            <DataRow
              label="Topology signature"
              value={cantonSignature ? shortenValue(cantonSignature) : "Run the demo"}
            />
            <DataRow
              label="Ping signature"
              value={cantonPingSignature ? shortenValue(cantonPingSignature) : "Run the demo"}
            />
          </dl>
        </article>
      </section>

      <details className="panel detail-panel">
        <summary>
          <span>Raw artifacts</span>
          <span className="muted-text">Full identifiers, hashes, and signatures</span>
        </summary>
        <div className="detail-grid">
          <section>
            <h3>Key derivations</h3>
            <dl className="data-list">
              <DataRow label="Ed25519 public key" value={snapshot.ed25519PublicKeyHex} />
              <DataRow label="idOS address" value={snapshot.idosAdapter.publicAddress} />
              <DataRow label="idOS public key" value={snapshot.idosAdapter.publicKey} />
              <DataRow label="Canton public key" value={snapshot.cantonPublicKeyBase64} />
            </dl>
          </section>

          <section>
            <h3>Sample signatures</h3>
            <dl className="data-list">
              <DataRow label="Sample Canton hash" value={snapshot.sample.cantonHashBase64} />
              <DataRow label="Sample Canton signature" value={snapshot.sample.cantonSignatureBase64} />
              <DataRow label="Sample idOS message" value={snapshot.sample.idosMessage} />
              <DataRow label="Sample idOS signature" value={snapshot.sample.idosSignatureHex} />
            </dl>
          </section>

          {cantonTopologyState.result ? (
            <section>
              <h3>Real Canton topology</h3>
              <dl className="data-list">
                <DataRow label="Party hint" value={partyHint ?? "Not generated"} />
                <DataRow label="Party ID" value={cantonTopologyState.result.partyId} />
                <DataRow
                  label="Key fingerprint"
                  value={cantonTopologyState.result.publicKeyFingerprint}
                />
                <DataRow label="Topology multi-hash" value={cantonTopologyState.result.multiHash} />
                <DataRow label="Topology signature" value={cantonSignature ?? "Missing"} />
              </dl>
            </section>
          ) : null}

          {cantonPingState.result ? (
            <section>
              <h3>Real Canton ping</h3>
              <dl className="data-list">
                <DataRow label="Ping ID" value={cantonPingState.result.pingId} />
                <DataRow label="Ping responder" value={cantonPingState.result.responderPartyId} />
                <DataRow
                  label="Prepared transaction hash"
                  value={cantonPingState.result.response.preparedTransactionHash}
                />
                <DataRow label="Ping signature" value={cantonPingSignature ?? "Missing"} />
                <DataRow
                  label="Ping update ID"
                  value={cantonPingExecutionState.result?.updateId ?? "Not executed"}
                />
              </dl>
            </section>
          ) : null}
        </div>
      </details>

      <details className="panel detail-panel" open={!idosReady}>
        <summary>
          <span>Bootstrap idOS link</span>
          <span className="muted-text">Use this only if the shared key is not linked yet</span>
        </summary>
        <div className="detail-grid">
          <section>
            <h3>Link workflow</h3>
            <p>
              Connect an existing idOS-linked EVM wallet, then add the generated key as a{" "}
              <code>NEAR</code> wallet using its implicit address and a browser-generated NEP-413
              signature.
            </p>
            <div className="button-row">
              <button
                className="button"
                type="button"
                onClick={handleConnectExistingWallet}
                disabled={existingWalletState.loading}
              >
                {existingWalletState.loading ? "Connecting..." : "Connect existing EVM wallet"}
              </button>
              {existingWalletState.result?.hasProfile ? (
                <button
                  className="button"
                  type="button"
                  onClick={handleLinkGeneratedWallet}
                  disabled={linkState.loading}
                >
                  {linkState.loading ? "Linking..." : "Link generated key to idOS"}
                </button>
              ) : null}
            </div>
          </section>

          {existingWalletState.result ? (
            <section>
              <h3>Connected profile</h3>
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
                  label="Linked wallets"
                  value={String(existingWalletState.result.wallets.length)}
                />
              </dl>
              <WalletSummaryList wallets={existingWalletState.result.wallets} />
            </section>
          ) : null}

          {linkState.result ? (
            <section>
              <h3>Link result</h3>
              <dl className="data-list">
                <DataRow label="Status" value={linkState.result.status} />
                <DataRow
                  label="Transaction hash"
                  value={linkState.result.txHash ?? "No transaction submitted"}
                />
              </dl>
            </section>
          ) : null}

          {existingWalletState.error ? <p className="error-text">{existingWalletState.error}</p> : null}
          {linkState.error ? <p className="error-text">{linkState.error}</p> : null}
        </div>
      </details>
    </main>
  );
}
