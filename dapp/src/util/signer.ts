import { ethers } from "ethers";
import Web3Modal from "web3modal";
import WalletConnectProvider from "@walletconnect/web3-provider";
import { signer } from "./store";

export type SignerType = "ethereum" | "solana"; // | "tezos" | "solana" | "etc"
export const signerTypes: Array<SignerType> = ["ethereum", "solana"];

export type ProviderType = EthereumProvider | SolanaProvider;
export type EthereumProvider = "metamask" | "wallet-connect";
export type SolanaProvider = "phantom";
export interface BaseSigner {
    signerType: SignerType,
    providerType: ProviderType,
    disconnect: () => Promise<void>;
    sign: (statement: string) => Promise<string>;
    id: () => string;
};

export type Signer = EthereumSigner | SolanaSigner;
export interface EthereumSigner extends BaseSigner {
    ens: ENSType,
    signerType: "ethereum",
    web3Provider: ethers.providers.Web3Provider,
}

export interface SolanaSigner extends BaseSigner {
    signerType: "solana",
    // TODO: remove when other provider types are defined
    providerType: "phantom"
}

export type ENSType = {
    name: string | null;
    avatar: string | null;
};

declare global {
    interface Window {
        phantom:any;
    }
}

const isPhantom = window?.phantom?.solana?.isPhantom

export const connectSigner = async (signerType: SignerType): Promise<Signer> => {
    let sign: (statement: string) => Promise<string>;
    let id: () => string;
    let disconnect: () => Promise<void>;

    switch (signerType) {
        case "ethereum":
            const providerOptions = {
                walletconnect: {
                    package: WalletConnectProvider, // required
                    options: {
                        infuraId: process.env.INFURA_ID // required
                    }
                }
            };

            const web3Modal = new Web3Modal({
                cacheProvider: false,
                providerOptions,
            });
            web3Modal.clearCachedProvider()

            const instance = await web3Modal.connect();
            const provider = new ethers.providers.Web3Provider(instance);
            const s = provider.getSigner();

            if (!s) {
                throw new Error("User cancelled connection");
            }

            const ids = await provider.listAccounts();
            if (ids.length <= 0) {
                throw new Error("No ids found in ethereum connection");
            }

            let ens = { name: null, avatar: null };
            ens.name = await provider.lookupAddress(ids[0]);
            const network =
                provider.network.name === "homestead"
                    ? "mainnet"
                    : provider.network.name;

            ens.avatar = ens.name
                ? `https://metadata.ens.domains/${network}/avatar/${ens.name}`
                : null;


            sign = async (statement: string): Promise<string> => {
                return s.signMessage(statement)
            };

            id = (): string => ids[0];

            disconnect = async (): Promise<void> => {
                const providerOptions = {
                    walletconnect: {
                        package: WalletConnectProvider, // required
                        options: {
                            infuraId: process.env.INFURA_ID // required
                        }
                    }
                };

                const web3Modal = new Web3Modal({
                    network: "mainnet",
                    cacheProvider: true,
                    providerOptions,
                });

                await web3Modal.clearCachedProvider();

                return;
            }

            let ethSigner: EthereumSigner = { 
                disconnect,
                sign, 
                id, 
                signerType: "ethereum",
                // TODO: Break into provider detection fn?
                providerType:  provider?.connection?.url === 'metamask' ? 'metamask' : 'wallet-connect',
                web3Provider: provider,
                ens 
            };

            return ethSigner;
        case "solana":
            if (isPhantom) {
                const solSigner = window.phantom.solana;
                await solSigner.connect();
                id = (): string => solSigner.publicKey.toString();
                sign = async (statement: string): Promise<string> => {
                    let o = await solSigner.signMessage(
                        new TextEncoder().encode(statement),
                        "utf-8"
                    )

                    return [...new Uint8Array(o.signature.buffer)]
                        .map(x => x.toString(16).padStart(2, '0'))
                        .join('');
                }

                disconnect = async () => {
                    await solSigner.disconnect();
                }

                let sSigner: SolanaSigner = {
                    disconnect,
                    sign,
                    id,
                    signerType: "solana",
                    providerType: "phantom",
                }

                return sSigner
            }

            throw new Error(`Failed to find Phantom wallet, other wallets currently unsupported`)
        default:
            throw new Error(`Unknown signerType: ${signerType}`);
    }
};