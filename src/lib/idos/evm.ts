import { BrowserProvider, type Eip1193Provider, type JsonRpcSigner } from "ethers";

export type ConnectedEvmWallet = {
  address: string;
  signer: JsonRpcSigner;
};

export async function connectEvmWallet(): Promise<ConnectedEvmWallet> {
  if (!("ethereum" in window)) {
    throw new Error("No injected EVM wallet was found in this browser.");
  }

  const provider = new BrowserProvider(window.ethereum as Eip1193Provider);
  await provider.send("eth_requestAccounts", []);

  const signer = await provider.getSigner();
  const address = await signer.getAddress();

  return {
    address,
    signer,
  };
}
