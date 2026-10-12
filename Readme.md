# Veritas

### Milestone-Based Freelance Escrow Protocol

Veritas is a decentralized escrow protocol for freelance work, with a Web3 DApp for managing projects, milestones, and payments.

Funds are locked in smart contracts and released when predefined milestones are approved.

## How It Works

```text
Client
  ↓
Create Project
  ↓
Fund Escrow
  ↓
Freelancer Completes Milestone
  ↓
Submit Work
  ↓
Approve / Dispute
  ↓
Release Payment
```

## Core Features

- Milestone-based escrow
- Smart contract-controlled funds
- Client milestone approval
- Dispute handling
- On-chain payment transparency
- Non-custodial fund management

## Architecture

```text
Web3 DApp
    ↓
Smart Contracts
    ↓
Veritas Escrow Protocol
    ↓
Blockchain
```

The **protocol** defines the escrow and milestone rules, while the **DApp** provides the interface for clients and freelancers to interact with those contracts.

## Tech Stack

- Solidity
- Ethereum / EVM
- Hardhat
- OpenZeppelin
- Next.js
- TypeScript
- Ethers.js / Viem

## Project Structure

```text
veritas/
├── contracts/
├── scripts/
├── test/
├── frontend/
├── hardhat.config.ts
└── README.md
```

## Getting Started

### Prerequisites

- Node.js and npm
- Git

### Installation

```bash
git clone https://github.com/focusedaf/Veritas.git
cd Veritas
npm install
```

### Compile and Test

```bash
npx hardhat compile
npx hardhat test
```

### Local Deployment

To deploy the contract to a persistent local Hardhat node, use two terminals.

**Terminal 1 — Start the local blockchain**

```bash
npx hardhat node
```

Keep this terminal running.

**Terminal 2 — Deploy the contract**

```bash
npx hardhat run scripts/deploy.ts --network localhost
```

The deployment script prints the deployed contract address and exports the address to `frontend/lib/contract/address.json`.

### Export the Contract ABI

After compiling the contract, export its ABI for frontend integration:

```bash
npx hardhat compile
npx hardhat run scripts/export-contract.ts
```

The ABI is saved to `frontend/lib/contract/Escrow.json`.

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Configure the frontend to use the deployed contract address and the local network before interacting with the contract.

