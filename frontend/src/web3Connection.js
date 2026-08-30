import { ethers } from "ethers";
import { contractAddress, contractABI } from "./contractConfig";

// ── Chain / Network Switch Guard ──────────────────────────────
export const ensureSepoliaNetwork = async () => {
    if (!window.ethereum) return false;
    try {
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        if (chainId !== '0xaa36a7') {
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: '0xaa36a7' }]
                });
                return true;
            } catch (switchError) {
                if (switchError.code === 4902) {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: '0xaa36a7',
                            chainName: 'Sepolia Test Network',
                            rpcUrls: ['https://ethereum-sepolia-rpc.publicnode.com'],
                            nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
                            blockExplorerUrls: ['https://sepolia.etherscan.io']
                        }]
                    });
                    return true;
                }
                return false;
            }
        }
        return true;
    } catch (err) {
        console.warn('Network verification error:', err);
        return false;
    }
};

// ── Wallet-connected contract (requires MetaMask) ──────────
export const connectWallet = async (forcePrompt = false) => {
    if (!window.ethereum) {
        if (typeof window !== 'undefined' && window.showToast) {
            window.showToast('warning', 'Please install the MetaMask browser extension to connect your Web3 wallet.', 'MetaMask Required');
        } else {
            console.warn('MetaMask extension not detected.');
        }
        throw new Error('MetaMask not installed');
    }

    try {
        await ensureSepoliaNetwork();
        if (forcePrompt) {
            await window.ethereum.request({
                method: "wallet_requestPermissions",
                params: [{ eth_accounts: {} }]
            });
        }
        await window.ethereum.request({ method: "eth_requestAccounts" });

        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(contractAddress, contractABI, signer);

        console.log("Wallet successfully connected:", await signer.getAddress());
        return { provider, signer, contract };
    } catch (error) {
        console.error("Error connecting to wallet:", error);
        throw error;
    }
};

// ── Silent Contract Hydration ──────────────────────────────
export const hydrateContract = async () => {
    if (!window.ethereum) return null;
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return new ethers.Contract(contractAddress, contractABI, signer);
};

// ── Read-only contract (no MetaMask required) ──────────────
// Used by the public LandingView to display campaigns without
// requiring the visitor to connect a wallet.
export const getReadOnlyContract = () => {
    const provider = new ethers.JsonRpcProvider(
        "https://ethereum-sepolia-rpc.publicnode.com"
    );
    return new ethers.Contract(contractAddress, contractABI, provider);
};