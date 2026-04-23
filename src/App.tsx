import { useState } from "react";

import { inspectIdosSigner, type IdosInspectorResult } from "./lib/idos/client";
import { loadOrCreateSharedSigner, type SharedSignerSnapshot } from "./lib/sharedSigner";

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="data-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export default function App() {
  const [snapshot, setSnapshot] = useState<SharedSignerSnapshot>(() => loadOrCreateSharedSigner());
  const [idosState, setIdosState] = useState<{
    error: string | null;
    loading: boolean;
    result: IdosInspectorResult | null;
  }>({
    error: null,
    loading: false,
    result: null,
  });

  async function handleInspectIdos() {
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
            <button className="button" type="button" onClick={() => setSnapshot(loadOrCreateSharedSigner(true))}>
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
            <h2>idOS probe</h2>
            <button className="button" type="button" onClick={handleInspectIdos} disabled={idosState.loading}>
              {idosState.loading ? "Checking..." : "Check profile"}
            </button>
          </div>
          <p>
            This uses the same Ed25519 key as a Kwil custom signer with `ed25519` signatures and
            checks whether idOS already knows the signer address.
          </p>
          {idosState.result ? (
            <dl className="data-list">
              <DataRow label="Node URL" value={idosState.result.nodeUrl} />
              <DataRow label="Chain ID" value={idosState.result.chainId} />
              <DataRow label="Has profile" value={String(idosState.result.hasProfile)} />
              <DataRow
                label="User ID"
                value={idosState.result.user?.id ?? "No idOS profile is linked to this signer yet."}
              />
            </dl>
          ) : null}
          {idosState.error ? <p className="error-text">{idosState.error}</p> : null}
        </div>
      </section>
    </main>
  );
}
