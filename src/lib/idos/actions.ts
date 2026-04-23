import type { KwilSigner } from "@kwilteam/kwil-js";

import type { KwilActionClient } from "./kwilActionClient";

export type IdosUser = {
  id: string;
  recipient_encryption_public_key: string;
  encryption_password_store: "user" | "mpc";
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
