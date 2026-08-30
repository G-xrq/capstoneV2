/* ─── Contract Configuration ──────────────────────────────────
   BBDRTS — Blockchain-Based Donation and Relief Transparency System
   Sepolia Testnet

   DEPLOYMENT INSTRUCTIONS:
   1. Open https://remix.ethereum.org/
   2. Paste the contents of contracts/DonationRelief.sol into a new file
   3. Compile with Solidity 0.8.20 (Enable optimization: 200 runs)
   4. Deploy via "Injected Provider - MetaMask" → Sepolia testnet
   5. Copy the deployed contract address and paste it below
   6. Copy the ABI from the Remix compilation output (ABI tab) — or use
      the one below which matches DonationRelief.sol exactly.
   ─────────────────────────────────────────────────────────── */

// ── STEP 5: Paste your new contract address here after deployment ──
// Old contract (no role management): 0x41feEEfE1829C53b069D70e4A6e851Fc8ecA493b
export const contractAddress = "0xB8Effb4f0394946a01da9C5342fC2e70c1E99ddA";

export const contractABI = [
    // ── Constructor ──────────────────────────────────────────────
    {
        "inputs": [],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },

    // ── State Variable Getters ───────────────────────────────────
    {
        "inputs": [],
        "name": "owner",
        "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "campaignCount",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "organizationCount",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "MAX_ORGANIZATIONS",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "address", "name": "", "type": "address" }],
        "name": "isOrganization",
        "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "name": "campaigns",
        "outputs": [
            { "internalType": "address payable", "name": "orgAddress", "type": "address" },
            { "internalType": "string", "name": "title", "type": "string" },
            { "internalType": "uint256", "name": "targetAmount", "type": "uint256" },
            { "internalType": "uint256", "name": "currentAmount", "type": "uint256" },
            { "internalType": "bool", "name": "isActive", "type": "bool" }
        ],
        "stateMutability": "view",
        "type": "function"
    },

    // ── Role Query ───────────────────────────────────────────────
    {
        "inputs": [{ "internalType": "address", "name": "_addr", "type": "address" }],
        "name": "getRole",
        "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }],
        "stateMutability": "view",
        "type": "function"
    },

    // ── Admin: Organization Management ──────────────────────────────
    {
        "inputs": [{ "internalType": "address", "name": "_organization", "type": "address" }],
        "name": "addOrganization",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "address", "name": "_organization", "type": "address" }],
        "name": "removeOrganization",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },

    // ── Campaign Management ──────────────────────────────────────
    {
        "inputs": [
            { "internalType": "string", "name": "_title", "type": "string" },
            { "internalType": "uint256", "name": "_targetAmount", "type": "uint256" }
        ],
        "name": "createCampaign",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "uint256", "name": "_campaignId", "type": "uint256" }],
        "name": "deactivateCampaign",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },

    // ── Donations ────────────────────────────────────────────────
    {
        "inputs": [
            { "internalType": "uint256", "name": "_campaignId", "type": "uint256" },
            { "internalType": "string", "name": "_txHash", "type": "string" }
        ],
        "name": "donateToCampaign",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },

    // ── Events ───────────────────────────────────────────────────
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "internalType": "uint256", "name": "campaignId", "type": "uint256" },
            { "indexed": true, "internalType": "address", "name": "orgAddress", "type": "address" },
            { "indexed": false, "internalType": "string", "name": "title", "type": "string" },
            { "indexed": false, "internalType": "uint256", "name": "targetAmount", "type": "uint256" }
        ],
        "name": "CampaignCreated",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "internalType": "uint256", "name": "campaignId", "type": "uint256" },
            { "indexed": true, "internalType": "address", "name": "donor", "type": "address" },
            { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" },
            { "indexed": false, "internalType": "string", "name": "txHash", "type": "string" }
        ],
        "name": "DonationReceived",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "internalType": "uint256", "name": "campaignId", "type": "uint256" },
            { "indexed": true, "internalType": "address", "name": "deactivatedBy", "type": "address" }
        ],
        "name": "CampaignDeactivated",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [{ "indexed": true, "internalType": "address", "name": "organization", "type": "address" }],
        "name": "OrganizationAdded",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [{ "indexed": true, "internalType": "address", "name": "organization", "type": "address" }],
        "name": "OrganizationRemoved",
        "type": "event"
    }
];