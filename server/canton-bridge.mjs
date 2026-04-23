import { createServer } from "node:http";

import { SDK, localNetStaticConfig } from "@canton-network/wallet-sdk";

const DEFAULT_PORT = 8787;
const LOCALNET_AUTH = {
  method: "self_signed",
  issuer: "unsafe-auth",
  audience: "https://canton.network.global",
  scope: "",
  clientId: localNetStaticConfig.LOCALNET_USER_ID,
  clientSecret: "unsafe",
};

let sdkPromise;

function readEnv(name) {
  const value = process.env[name]?.trim();

  return value ? value : undefined;
}

function parsePort(value) {
  const parsed = Number.parseInt(value ?? "", 10);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_PORT;
}

function buildConfiguredBridgeConfig(overrides) {
  return {
    configured: true,
    missingFields: [],
    ...overrides,
  };
}

function loadBridgeConfig() {
  const network = readEnv("CANTON_NETWORK") ?? "unconfigured";
  const port = parsePort(readEnv("CANTON_BRIDGE_PORT"));

  if (network === "localnet") {
    return {
      port,
      ...buildConfiguredBridgeConfig({
        network,
        ledgerClientUrl: localNetStaticConfig.LOCALNET_APP_USER_LEDGER_URL.toString(),
        auth: LOCALNET_AUTH,
      }),
    };
  }

  if (network === "devnet" || network === "custom") {
    const requiredEnvNames = [
      "CANTON_LEDGER_CLIENT_URL",
      "CANTON_AUTH_ISSUER",
      "CANTON_AUTH_AUDIENCE",
      "CANTON_AUTH_CLIENT_ID",
      "CANTON_AUTH_CLIENT_SECRET",
    ];
    const missingFields = requiredEnvNames.filter((name) => !readEnv(name));

    return {
      port,
      configured: missingFields.length === 0,
      missingFields,
      network,
      ledgerClientUrl: readEnv("CANTON_LEDGER_CLIENT_URL") ?? null,
      auth:
        missingFields.length === 0
          ? {
              method: "self_signed",
              issuer: readEnv("CANTON_AUTH_ISSUER"),
              audience: readEnv("CANTON_AUTH_AUDIENCE"),
              scope: readEnv("CANTON_AUTH_SCOPE") ?? "",
              clientId: readEnv("CANTON_AUTH_CLIENT_ID"),
              clientSecret: readEnv("CANTON_AUTH_CLIENT_SECRET"),
            }
          : null,
    };
  }

  return {
    port,
    configured: false,
    missingFields: ["CANTON_NETWORK"],
    network,
    ledgerClientUrl: null,
    auth: null,
  };
}

function toPublicHealth(config) {
  return {
    ok: true,
    bridge: "canton",
    version: 1,
    network: config.network,
    configured: config.configured,
    ledgerClientUrl: config.ledgerClientUrl,
    authMethod: config.auth?.method ?? null,
    issuer: config.auth?.issuer ?? null,
    audience: config.auth?.audience ?? null,
    clientId: config.auth?.clientId ?? null,
    missingFields: config.missingFields,
  };
}

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload, null, 2));
}

function writeNoContent(response) {
  response.writeHead(204, {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  response.end();
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let raw = "";

    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      raw += chunk;
    });
    request.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error("Request body must be valid JSON."));
      }
    });
    request.on("error", reject);
  });
}

async function getSdk(config) {
  if (!config.configured || !config.auth || !config.ledgerClientUrl) {
    throw new Error("Canton bridge is not configured yet.");
  }

  if (!sdkPromise) {
    sdkPromise = SDK.create({
      auth: config.auth,
      ledgerClientUrl: config.ledgerClientUrl,
      logAdapter: "console",
    }).catch((error) => {
      sdkPromise = undefined;
      throw error;
    });
  }

  return sdkPromise;
}

async function handlePrepareTopology(request, response) {
  const config = loadBridgeConfig();

  if (!config.configured) {
    writeJson(response, 400, {
      ok: false,
      error: "Canton bridge is not configured.",
      missingFields: config.missingFields,
    });
    return;
  }

  const payload = await readRequestBody(request);
  const body =
    payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  const publicKeyBase64 =
    typeof body.publicKeyBase64 === "string" ? body.publicKeyBase64.trim() : "";
  const partyHint = typeof body.partyHint === "string" ? body.partyHint.trim() : "";

  if (!publicKeyBase64) {
    writeJson(response, 400, {
      ok: false,
      error: "`publicKeyBase64` is required.",
    });
    return;
  }

  const sdk = await getSdk(config);
  const prepared = sdk.party.external.create(
    publicKeyBase64,
    partyHint ? { partyHint } : undefined,
  );
  const topology = await prepared.topology();

  writeJson(response, 200, {
    ok: true,
    topology,
  });
}

const server = createServer(async (request, response) => {
  const method = request.method ?? "GET";
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);

  if (method === "OPTIONS") {
    writeNoContent(response);
    return;
  }

  try {
    if (method === "GET" && url.pathname === "/healthz") {
      writeJson(response, 200, toPublicHealth(loadBridgeConfig()));
      return;
    }

    if (method === "POST" && url.pathname === "/v1/external-party/topology") {
      await handlePrepareTopology(request, response);
      return;
    }

    writeJson(response, 404, {
      ok: false,
      error: "Route not found.",
    });
  } catch (error) {
    writeJson(response, 500, {
      ok: false,
      error: error instanceof Error ? error.message : "Unexpected bridge error.",
    });
  }
});

const { port } = loadBridgeConfig();

server.listen(port, "127.0.0.1", () => {
  console.log(`Canton bridge listening on http://127.0.0.1:${port}`);
});
