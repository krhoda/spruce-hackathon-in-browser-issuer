import { writable, Writable } from "svelte/store";
import { GlobeIcon, TwitterIcon, GitHubIcon, EthereumIcon, RedditIcon, SoundCloudIcon } from 'components/icons';
import type { Claim } from "./claim";
import { connectSigner, Signer,  SignerType } from "./signer";
import type { KeyType, Workflow } from "./witness";

// TODO: Break into UI file?
export type AccountState = "available" | "obtained";

// TODO: Break into UI file?
export const iconColor = "#625ff5";

// The UI element for poping toast-like alerts
export const alert: Writable<{
    message: string;
    variant: 'error' | 'warning' | 'success' | 'info';
}> = writable<{
    message: string;
    variant: 'error' | 'warning' | 'success' | 'info';
}>(null);

export let witnessState: Writable<Workflow> = writable("statement");

function defaultClaims(): Claim[] { 
    return [
        {
            credentials: [],
            credential_type: "twitter",
            icon: TwitterIcon,
            title: "Twitter",
            type: "public",
            available: true,
        },
        {
            credentials: [],
            credential_type: "github",
            icon: GitHubIcon,
            title: "GitHub",
            type: "public",
            available: true,
        },
        {
            credentials: [],
            credential_type: "dns",
            icon: GlobeIcon,
            title: "DNS",
            type: "public",
            available: true,
        },
        {
            credentials: [],
            credential_type: "self_signed",
            icon: EthereumIcon,
            title: "Two Key Self Signed",
            type: "public",
            available: true,
        },
        {
            credentials: [],
            credential_type: "reddit",
            icon: RedditIcon,
            title: "Reddit",
            type: "public",
            available: true,
        },
        {
            credentials: [],
            credential_type: "soundcloud",
            icon: SoundCloudIcon,
            title: "SoundCloud",
            type: "public",
            available: true,
        }
        // {
        //     credentials: [],
        //     credential_type: "discord",
        //     icon: DiscordIcon,
        //     title: "Discord",
        //     type: "public",
        //     available: false,
        // },
    ]
}

export let claims: Writable<Array<Claim>> = writable(defaultClaims());

export let currentType: Writable<SignerType> = writable("ethereum");
export let _currentType: SignerType = "ethereum";
currentType.subscribe(x => (_currentType = x));

export let signer: Writable<Signer | false> = writable(false);
export let _signer: Signer | false = false;
signer.subscribe(x => (_signer = x));

export const getKeyType = (): KeyType => {
    if (!_signer) {
        throw new Error("Please connect your wallet");
    }

    switch (_signer.signerType) {
        case "ethereum":
            return {
                pkh: {
                    eip155: {
                        address: _signer.id(),
                        chain_id: "1",
                    },
                },
            }
        case "solana": {
            return {
                pkh: {
                    solana: {
                        address: _signer.id()
                    }
                }
            }
        }
    };
};

const metamaskAccountChangeCB = (accounts: Array<string>): void => {
    if (accounts.length === 0) {
        if (
            _signer && 
            _signer.signerType === "ethereum" && 
            _signer?.web3Provider?.connection?.url === 'metamask'
        ){
            disconnect();
        }
    }
}

export const connect = async (): Promise<void> => {
    let s = await connectSigner(_currentType);
    signer.set(s);

    if (_currentType === "ethereum") {
        window.ethereum.on('accountsChanged', metamaskAccountChangeCB)
    }
}

// TODO: Make this disconnect current, add a Disconnect All which clears the saved credentials.
export const disconnect = async (): Promise<void> => {
    if (!_signer) {
        return
    }

    let p = _signer.providerType;
    await _signer.disconnect();
    signer.set(false);

    if (_currentType === "ethereum" && p === "metamask") {
        window.ethereum.on('accountsChanged', metamaskAccountChangeCB)
        window.ethereum.removeListener('accountsChanged', metamaskAccountChangeCB)
    }
};

export const sign = async (statement: string): Promise<string> => {
    if (!_signer) {
        throw new Error(`No signer currently set to active`);
    }

    return _signer.sign(statement);
}