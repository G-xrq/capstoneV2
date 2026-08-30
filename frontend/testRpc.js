import { ethers } from "ethers";

const contractAddress = "0x0198663E3FC2803E99f9139ffd2C9593bfbc316C";
const abi = [
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
    }
];

async function main() {
    console.log("Connecting to public Sepolia node...");
    const provider = new ethers.JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");
    const contract = new ethers.Contract(contractAddress, abi, provider);

    console.log("Querying logs for DonationReceived event for CampaignID 1...");
    try {
        const filter = contract.filters.DonationReceived(1);
        const events = await contract.queryFilter(filter, -100000);
        console.log(`Found ${events.length} events!`);
        events.forEach((e, i) => {
            console.log(`Event ${i}:`, e.args);
        });
    } catch (err) {
        console.error("Query Error:", err.message);
    }
}

main();
