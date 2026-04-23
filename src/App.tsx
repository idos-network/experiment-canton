import { useState } from "react";

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

        <div className="note">
          <h2>Next obstacle</h2>
          <p>
            The signer bridge is now local and deterministic. The next step is wiring this signer
            into the current idOS SDK path that accepts `FaceSign`-style Ed25519 wallets.
          </p>
        </div>
      </section>
    </main>
  );
}
