const DEFAULT_CANTON_BRIDGE_URL = "http://127.0.0.1:8787";

export type CantonBridgeHealth = {
  ok: boolean;
  bridge: "canton";
  version: number;
  network: string;
  configured: boolean;
  ledgerClientUrl: string | null;
  authMethod: string | null;
  issuer: string | null;
  audience: string | null;
  clientId: string | null;
  missingFields: string[];
};

export type CantonPreparedTopology = {
  partyId: string;
  publicKeyFingerprint: string;
  topologyTransactions: string[];
  multiHash: string;
};

export function getCantonBridgeUrl(): string {
  const configuredUrl = import.meta.env.VITE_CANTON_BRIDGE_URL;

  return typeof configuredUrl === "string" && configuredUrl.trim()
    ? configuredUrl.trim()
    : DEFAULT_CANTON_BRIDGE_URL;
}

export async function probeCantonBridge(): Promise<CantonBridgeHealth> {
  const response = await fetch(`${getCantonBridgeUrl()}/healthz`);

  if (!response.ok) {
    throw new Error(`Canton bridge probe failed with status ${response.status}.`);
  }

  return (await response.json()) as CantonBridgeHealth;
}

export async function prepareCantonExternalPartyTopology(input: {
  partyHint?: string;
  publicKeyBase64: string;
}): Promise<CantonPreparedTopology> {
  const response = await fetch(`${getCantonBridgeUrl()}/v1/external-party/topology`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const payload = (await response.json()) as
    | { error?: string; ok: false }
    | { ok: true; topology: CantonPreparedTopology };

  if (!response.ok || !payload.ok) {
    throw new Error(
      ("error" in payload && payload.error) || "Failed to prepare Canton external-party topology.",
    );
  }

  return payload.topology;
}
