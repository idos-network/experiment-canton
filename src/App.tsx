const milestones = [
  "Scaffold the demo app",
  "Share one Ed25519 signer between Canton and idOS",
  "Log in to idOS with the shared signer",
  "Stop when FaceSign user interaction is required",
];

export default function App() {
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

      <section className="panel">
        <h2>Current loop</h2>
        <ol className="milestone-list">
          {milestones.map((milestone) => (
            <li key={milestone}>{milestone}</li>
          ))}
        </ol>
      </section>
    </main>
  );
}
