// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title DonationRelief
 * @notice Blockchain-Based Donation and Relief Transparency System (BBDRTS)
 *         Capstone Project — Saint Joseph College, CCS, BSIT, June 2026
 *
 * @dev Role Hierarchy:
 *      - Admin (owner)     : Contract deployer. Can add/remove organizations,
 *                            create campaigns, and deactivate any campaign.
 *      - Organization      : Registered NGO wallets (max 10). Can create
 *                            campaigns and deactivate their own campaigns.
 *      - Donor             : Any connected wallet. Can donate to active campaigns.
 *      - Public            : Anyone. Can read all public campaign data.
 */
contract DonationRelief {

    /* ═══════════════════════════════════════════════════════════
       STATE VARIABLES
    ═══════════════════════════════════════════════════════════ */

    /* ═══════════════════════════════════════════════════════════
       STATE VARIABLES
    ═══════════════════════════════════════════════════════════ */

    address public owner;
    bool public isPaused;
    bool private _locked; // Reentrancy Guard state

    mapping(address => bool) public isOrganization;
    uint256 public organizationCount;
    uint256 public constant MAX_ORGANIZATIONS = 10;

    struct Campaign {
        address payable orgAddress;   // Wallet that deployed the campaign
        string title;                 // Public campaign name
        uint256 targetAmount;         // Fundraising goal in wei
        uint256 currentAmount;        // Total raised in wei
        bool isActive;                // Whether donations are still accepted
    }

    uint256 public campaignCount;
    mapping(uint256 => Campaign) public campaigns;

    /* ═══════════════════════════════════════════════════════════
       EVENTS
    ═══════════════════════════════════════════════════════════ */

    event CampaignCreated(
        uint256 indexed campaignId,
        address indexed orgAddress,
        string title,
        uint256 targetAmount
    );

    event DonationReceived(
        uint256 indexed campaignId,
        address indexed donor,
        uint256 amount,
        string txHash
    );

    event CampaignDeactivated(
        uint256 indexed campaignId,
        address indexed deactivatedBy
    );

    event OrganizationAdded(address indexed organization);
    event OrganizationRemoved(address indexed organization);

    event ContractPaused(address indexed account);
    event ContractUnpaused(address indexed account);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /* ═══════════════════════════════════════════════════════════
       MODIFIERS
    ═══════════════════════════════════════════════════════════ */

    modifier onlyOwner() {
        require(msg.sender == owner, "BBDRTS: Admin access required");
        _;
    }

    modifier onlyOrganizationOrOwner() {
        require(
            msg.sender == owner || isOrganization[msg.sender],
            "BBDRTS: Organization or Admin access required"
        );
        _;
    }

    modifier campaignExists(uint256 _campaignId) {
        require(
            _campaignId > 0 && _campaignId <= campaignCount,
            "BBDRTS: Campaign does not exist"
        );
        _;
    }

    modifier whenNotPaused() {
        require(!isPaused, "BBDRTS: Contract operations are currently paused");
        _;
    }

    modifier nonReentrant() {
        require(!_locked, "BBDRTS: Reentrancy guard triggered");
        _locked = true;
        _;
        _locked = false;
    }

    /* ═══════════════════════════════════════════════════════════
       CONSTRUCTOR
    ═══════════════════════════════════════════════════════════ */

    /**
     * @dev The deploying wallet becomes the Admin (owner).
     */
    constructor() {
        owner = msg.sender;
        isPaused = false;
    }

    /* ═══════════════════════════════════════════════════════════
       ADMIN — GOVERNANCE & EMERGENCY CIRCUIT BREAKER
    ═══════════════════════════════════════════════════════════ */

    /**
     * @notice Emergency Pause circuit breaker to freeze all campaign creations and donations.
     */
    function emergencyPause() external onlyOwner {
        require(!isPaused, "BBDRTS: Contract already paused");
        isPaused = true;
        emit ContractPaused(msg.sender);
    }

    /**
     * @notice Unpause contract after resolving emergency or audit.
     */
    function emergencyUnpause() external onlyOwner {
        require(isPaused, "BBDRTS: Contract is not paused");
        isPaused = false;
        emit ContractUnpaused(msg.sender);
    }

    /**
     * @notice Safely transfer Admin ownership to a new wallet.
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "BBDRTS: Invalid zero address");
        require(newOwner != owner, "BBDRTS: New owner is current owner");
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    /* ═══════════════════════════════════════════════════════════
       ADMIN — ORGANIZATION MANAGEMENT
    ═══════════════════════════════════════════════════════════ */

    /**
     * @notice Register a new NGO wallet as an Organization.
     * @dev    Only the Admin (owner) can call this function.
     *         Organization list is capped at MAX_ORGANIZATIONS.
     * @param  _organization The wallet address to grant Organization access.
     */
    function addOrganization(address _organization) external onlyOwner {
        require(_organization != address(0), "BBDRTS: Invalid address");
        require(_organization != owner, "BBDRTS: Owner cannot be an organization");
        require(!isOrganization[_organization], "BBDRTS: Already an organization");
        require(
            organizationCount < MAX_ORGANIZATIONS,
            "BBDRTS: Maximum organization limit reached"
        );

        isOrganization[_organization] = true;
        organizationCount++;
        emit OrganizationAdded(_organization);
    }

    /**
     * @notice Revoke Organization access from a registered NGO wallet.
     * @dev    Only the Admin (owner) can call this function.
     * @param  _organization The wallet address to revoke.
     */
    function removeOrganization(address _organization) external onlyOwner {
        require(isOrganization[_organization], "BBDRTS: Not a current organization");

        isOrganization[_organization] = false;
        organizationCount--;
        emit OrganizationRemoved(_organization);
    }

    /* ═══════════════════════════════════════════════════════════
       CAMPAIGN MANAGEMENT
    ═══════════════════════════════════════════════════════════ */

    /**
     * @notice Deploy a new fundraising campaign on the public ledger.
     * @dev    Restricted to Admin and registered Organizations.
     *         The caller's wallet becomes the campaign's managing organization.
     * @param  _title        Human-readable campaign name.
     * @param  _targetAmount Fundraising goal in wei.
     */
    function createCampaign(
        string memory _title,
        uint256 _targetAmount
    ) external onlyOrganizationOrOwner whenNotPaused {
        require(bytes(_title).length > 0, "BBDRTS: Title cannot be empty");
        require(
            _targetAmount > 0,
            "BBDRTS: Target amount must be greater than 0"
        );

        campaignCount++;
        campaigns[campaignCount] = Campaign({
            orgAddress: payable(msg.sender),
            title: _title,
            targetAmount: _targetAmount,
            currentAmount: 0,
            isActive: true
        });

        emit CampaignCreated(campaignCount, msg.sender, _title, _targetAmount);
    }

    /**
     * @notice Close a campaign so it no longer accepts donations.
     * @dev    Admin can deactivate any campaign.
     *         Organizations can only deactivate their own campaigns.
     * @param  _campaignId The campaign ID to deactivate.
     */
    function deactivateCampaign(uint256 _campaignId)
        external
        onlyOrganizationOrOwner
        campaignExists(_campaignId)
    {
        Campaign storage camp = campaigns[_campaignId];

        require(camp.isActive, "BBDRTS: Campaign is already inactive");
        require(
            msg.sender == owner || camp.orgAddress == msg.sender,
            "BBDRTS: You can only deactivate your own campaigns"
        );

        camp.isActive = false;
        emit CampaignDeactivated(_campaignId, msg.sender);
    }

    /* ═══════════════════════════════════════════════════════════
       DONATIONS
    ═══════════════════════════════════════════════════════════ */

    /**
     * @notice Donate ETH directly to a relief campaign.
     * @dev    Any wallet (donor or organization) may donate.
     *         Funds are forwarded immediately to the campaign's org address.
     *         Every donation emits a DonationReceived event — the transaction
     *         hash serves as the donor's verifiable digital receipt.
     * @param  _campaignId The target campaign ID.
     * @param  _txHash     An optional note / reference string (stored in event).
     */
    function donateToCampaign(uint256 _campaignId, string memory _txHash)
        external
        payable
        whenNotPaused
        nonReentrant
        campaignExists(_campaignId)
    {
        Campaign storage camp = campaigns[_campaignId];

        require(camp.isActive, "BBDRTS: Campaign is not accepting donations");
        require(msg.value > 0, "BBDRTS: Donation must be greater than 0 ETH");

        camp.currentAmount += msg.value;

        // Forward funds directly to the managing organization
        (bool success, ) = camp.orgAddress.call{value: msg.value}("");
        require(success, "BBDRTS: ETH transfer to organization failed");

        emit DonationReceived(_campaignId, msg.sender, msg.value, _txHash);
    }

    /* ═══════════════════════════════════════════════════════════
       VIEW — ROLE QUERY
    ═══════════════════════════════════════════════════════════ */

    /**
     * @notice Returns the on-chain role of a wallet address.
     * @return 2 = Admin, 1 = Organization, 0 = Donor/Public
     */
    function getRole(address _addr) external view returns (uint8) {
        if (_addr == owner)              return 2; // Admin
        if (isOrganization[_addr])       return 1; // Organization
        return 0;                                  // Donor / Public
    }
}
