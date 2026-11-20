import { ethers } from "ethers";
import { contractAddress, contractABI } from "./contractConfig";

export const SEPOLIA_RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";
export const SEPOLIA_EXPLORER_URL = "https://sepolia.etherscan.io";

// ── Read-only Sepolia public ledger contract (no MetaMask or user wallet required) ──
// All on-chain writes are notarized gaslessly by the BBDRTS backend relayer.
export const getReadOnlyContract = () => {
    const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
    return new ethers.Contract(contractAddress, contractABI, provider);
};
