import { type KwilSigner, type Types, Utils, WebKwil } from "@kwilteam/kwil-js";

type CreateKwilClientParams = {
  chainId?: string;
  nodeUrl: string;
};

const DEFAULT_TIMEOUT_MS = 30_000;

const actionSchema = {
  add_wallet: [
    {
      name: "id",
      type: Utils.DataType.Uuid,
    },
    {
      name: "address",
      type: Utils.DataType.Text,
    },
    {
      name: "public_key",
      type: Utils.DataType.Text,
    },
    {
      name: "wallet_type",
      type: Utils.DataType.Text,
    },
    {
      name: "message",
      type: Utils.DataType.Text,
    },
    {
      name: "signature",
      type: Utils.DataType.Text,
    },
  ],
  get_user: [],
  get_wallets: [],
  has_profile: [
    {
      name: "address",
      type: Utils.DataType.Text,
    },
  ],
} as const;

type ActionName = keyof typeof actionSchema;
type PositionalParams = Types.PositionalParams;

type CallParams<Name extends ActionName> = {
  name: Name;
  inputs: Record<string, unknown>;
};

type ExecuteParams<Name extends ActionName> = CallParams<Name> & {
  description: string;
};

export class KwilActionClient {
  signer?: KwilSigner;
  readonly client: WebKwil;
  readonly chainId: string;

  constructor(client: WebKwil, chainId: string) {
    this.client = client;
    this.chainId = chainId;
  }

  private createActionInputs(actionName: ActionName, params: Record<string, unknown>): PositionalParams {
    if (!Object.keys(params).length) {
      return [];
    }

    return actionSchema[actionName].map(({ name }) => {
      const value = params[name];

      if (value === "" || value === 0) {
        return value;
      }

      return value ?? null;
    }) as PositionalParams;
  }

  private actionTypes(actionName: ActionName) {
    return actionSchema[actionName].map((entry) => entry.type);
  }

  async call<T>(params: CallParams<ActionName>, signer: KwilSigner | undefined = this.signer): Promise<T> {
    const action = {
      name: params.name,
      namespace: "main",
      inputs: this.createActionInputs(params.name, params.inputs),
      types: this.actionTypes(params.name),
    };

    const response = await this.client.call(action, signer);
    return response?.data?.result as T;
  }

  async execute(
    params: ExecuteParams<ActionName>,
    signer: KwilSigner | undefined = this.signer,
    synchronous = true,
  ): Promise<string | undefined> {
    if (!signer) {
      throw new Error("Signer is required to execute idOS actions.");
    }

    const action = {
      name: params.name,
      namespace: "main",
      description: params.description,
      inputs: [this.createActionInputs(params.name, params.inputs)],
      types: this.actionTypes(params.name),
    };

    const response = await this.client.execute(action, signer, synchronous);
    return response.data?.tx_hash;
  }

  setSigner(signer: KwilSigner | undefined): void {
    this.signer = signer;
  }
}

export async function createWebKwilClient({
  chainId,
  nodeUrl,
}: CreateKwilClientParams): Promise<KwilActionClient> {
  const discoveryClient = new WebKwil({ kwilProvider: nodeUrl, chainId: "" });
  const discoveredChainId =
    chainId ?? (await discoveryClient.chainInfo({ disableWarning: true })).data?.chain_id;

  if (!discoveredChainId) {
    throw new Error("Unable to discover the idOS chain ID.");
  }

  return new KwilActionClient(
    new WebKwil({
      kwilProvider: nodeUrl,
      chainId: discoveredChainId,
      timeout: DEFAULT_TIMEOUT_MS,
    }),
    discoveredChainId,
  );
}
