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

```bash
git clone https://github.com/<username>/veritas.git
cd veritas
npm install

npx hardhat compile
npx hardhat test
```
