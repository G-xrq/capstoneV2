/* ─── Role Configuration ──────────────────────────────────────
   BBDRTS Role System — ON-CHAIN ENFORCEMENT
   Roles are determined by calling getRole(address) on the
   deployed DonationRelief smart contract.

   Role integers returned by the contract:
     2 → Admin     (contract owner / deployer)
     1 → Moderator (registered NGO wallet)
     0 → Donor     (any other connected wallet)
   ─────────────────────────────────────────────────────────── */

// ── Role enum ─────────────────────────────────────────────────
export const ROLES = {
  PUBLIC:    "public",    // Not connected
  DONOR:     "donor",     // Connected, no elevated role
  ORGANIZATION: "organization", // Registered NGO (on-chain)
  ADMIN:     "admin",     // Contract owner (on-chain)
};

// ── Role display metadata ─────────────────────────────────────
export const ROLE_META = {
  [ROLES.PUBLIC]:    { label: "Public",    icon: "public", color: "var(--text-muted)"  },
  [ROLES.DONOR]:     { label: "Donor",     icon: "favorite", color: "var(--accent)"      },
  [ROLES.ORGANIZATION]: { label: "Organization", icon: "account_balance", color: "var(--info)"        },
  [ROLES.ADMIN]:     { label: "Admin",     icon: "admin_panel_settings", color: "var(--warning)"     },
};

// ── Contract role integer → ROLES enum ───────────────────────
export const MAX_ORGANIZATIONS = 10; // Must match contract constant

export const roleFromInt = (roleInt) => {
  switch (Number(roleInt)) {
    case 2:  return ROLES.ADMIN;
    case 1:  return ROLES.ORGANIZATION;
    default: return ROLES.DONOR;
  }
};
