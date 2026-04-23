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
