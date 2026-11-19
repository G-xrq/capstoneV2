# Backend Scripts Directory

This directory contains database migration utilities, deployment routines, and diagnostic test scripts for the BBDRTS backend platform.

## Directory Structure

### `database/`
- **`migrate_to_cloud.js`**: Migrates legacy local SQLite database (`blockchain_relief.db`) tables, organizations, users, campaigns, and donation records into cloud TiDB Serverless. Invoked via `npm run migrate:cloud`.
- **`migrate_fiat_to_blockchain.js`**: One-off reconciliation script to notarize approved fiat donations onto the Sepolia EVM smart contract.
- **`migrate_org.js`**: Organization schema migration helper for TiDB.
- **`cloud_deploy.js`**: Automated table initialization and index verification script for cloud databases.

### `diagnostics/`
- **`check_db.js`**: Connects to TiDB Serverless and prints table health, row counts, and schema columns.
- **`check_org_donations.js`**: Tests organization-specific donation queries and verifies foreign key relationships.
- **`check_sepolia.js`**: Verifies Ethereum Sepolia RPC connection, chain ID, block height, and relayer wallet balance.
- **`test_audit_db.js`**: Inspects immutable audit logs and verifies timestamp formatting.
- **`test_recent.js`**: Checks recent transaction ordering and multi-rail query performance.
- **`test_relay.js`**: Tests the gasless relayer service (`blockchainRelayer.js`) by verifying private key encryption and simulated transaction signing.

