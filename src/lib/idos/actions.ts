import type { KwilSigner } from "@kwilteam/kwil-js";

import type { KwilActionClient } from "./kwilActionClient";

export type IdosUser = {
  id: string;
  recipient_encryption_public_key: string;
  encryption_password_store: "user" | "mpc";
};

export type IdosWallet = {
  id: string;
  user_id: string;
  address: string;
  public_key: string | null;
  wallet_type: string;
  message: string;
  signature: string;
  inserter: string | null;
};

export async function hasProfile(kwilClient: KwilActionClient, address: string): Promise<boolean> {
  const result = await kwilClient.call<{ has_profile: boolean }[]>({
    name: "has_profile",
    inputs: { address },
  });

  return Boolean(result[0]?.has_profile);
}

export async function getUser(
  kwilClient: KwilActionClient,
  signer: KwilSigner | undefined = kwilClient.signer,
): Promise<IdosUser | null> {
  const result = await kwilClient.call<IdosUser[]>(
    {
      name: "get_user",
      inputs: {},
    },
    signer,
  );

  return result[0] ?? null;
}

export async function getWallets(
  kwilClient: KwilActionClient,
  signer: KwilSigner | undefined = kwilClient.signer,
): Promise<IdosWallet[]> {
  return kwilClient.call<IdosWallet[]>(
    {
      name: "get_wallets",
      inputs: {},
    },
    signer,
  );
}

export async function addWallet(
  kwilClient: KwilActionClient,
  params: {
    id: string;
    address: string;
    public_key: string;
    wallet_type: "NEAR";
    message: string;
    signature: string;
  },
  signer: KwilSigner | undefined = kwilClient.signer,
): Promise<string | undefined> {
  return kwilClient.execute(
    {
      name: "add_wallet",
      inputs: params,
      description: "Add a wallet to idOS",
    },
    signer,
  );
}
