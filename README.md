# 🌍 CO2Go Reward System

A complete full-stack blockchain-based reward system for sustainable transportation with Ethereum smart contracts, PostgreSQL database, Express REST API backend, and React frontend.

## 📋 Table of Contents

* [Overview](#overview)
* [Architecture](#architecture)
* [Features](#features)
* [Tech Stack](#tech-stack)
* [Quick Start](#quick-start)
* [Frontend Guide](#frontend-guide)
* [API Reference](#api-reference)
* [Database Schema](#database-schema)
* [Testing](#testing)
* [Deployment](#deployment)
* [Security](#security)
* [License](#license)

---

## 🎯 Overview

CO2Go is a blockchain-based reward system that incentivizes sustainable transportation by rewarding users with points for using eco-friendly transport modes (walking, biking, e-bikes, scooters, public transport). Points are stored **on-chain** (Ethereum smart contract) for transparency and immutability, while a **PostgreSQL** database provides fast queries and analytics.

**Key Highlights**

* ✅ **On-chain transparency** — All trips and redemptions recorded on blockchain
* ✅ **Credible emission factors** — Based on UK DESNZ 2024, German UBA 2022, and academic research
* ✅ **Tiered rewards system** — Bronze → Silver → Gold → Diamond based on points earned
* ✅ **Full-stack application** — React frontend, Express backend, Solidity smart contracts
* ✅ **Real-time updates** — Frontend displays live blockchain data
* ✅ **Environmental impact tracking** — CO₂ saved vs. driving calculated for each trip

> ℹ️ **Points Calculation:** The system uses a formula combining distance, duration, and emissions saved:
> `points = (distance_km × 10) + (duration_min × 2) + (emissions_saved_g ÷ 100)`

---

## 🏗️ Architecture

```
React Frontend (Vite) → Express API → Reward Calculator → Smart Contract → Blockchain
                            ↓              ↓                      ↓
                      PostgreSQL DB   Validation         Immutable Ledger
```

### Components

1. **Smart Contract** (`contracts/RewardSystem.sol`)
   - Solidity ^0.8.19
   - Stores points, trips, redemptions, rewards on-chain
   - Emits events for trip recording and reward redemption
   - Simple base formula: `points = (distance_km × ALPHA) + (duration_min × BETA)`

2. **Backend API** (`backend/server.js`)
   - Express REST API on port 3000
   - Validates input and orchestrates blockchain + database operations
   - Exposes endpoints for trips, points, rewards, users, and system stats

3. **Reward Calculator** (`backend/rewardCalculator.js`)
   - Implements credible emission factors (UK DESNZ 2024, German UBA 2022)
   - Calculates points with emissions bonus
   - Validates trip data (mode, distance, duration, speed sanity checks)
   - Tier progression and environmental impact calculations

4. **Reward Service** (`backend/rewardService.js`)
   - Ethers.js v6 integration layer
   - Handles all blockchain interactions
   - Manages contract calls and event listening
   - Transaction handling and confirmation

5. **Database** (`backend/database.sql` + `backend/database.js`)
   - PostgreSQL schema with users, trips, redemptions, rewards, system_stats tables
   - Views for user summaries and recent trips
   - Triggers for auto-tier updates
   - Node.js pg client for database access

6. **Frontend** (`frontend/src/`)
   - React 19 with Vite 7
   - Components: WalletSelector, TripSimulator, UserDashboard, SystemStats
   - Real-time data from backend API
   - Responsive UI with environmental impact visualization

---

## ✨ Features

### Trip Recording & Points

* **Transport modes supported**: walk, bike, ebike, scooter, bus, coach, train, metro, car, ev_car, motorcycle
* **Validation**: Distance, duration, speed sanity checks
* **Points formula**: Base points + emissions bonus
  - Base: `(distance_km × 10) + (duration_min × 2)`
  - Bonus: `emissions_saved_g ÷ 100`
* **On-chain recording**: Immutable trip ledger with transaction hash & block number
* **Emissions tracking**: CO₂ saved vs. driving a petrol car (177g/km baseline)

### User Tiers

| Tier | Points Required | Benefits |
|------|----------------|----------|
| 🥉 Bronze | 0 - 499 | Starting tier |
| 🥈 Silver | 500 - 1,999 | Enhanced rewards |
| 🥇 Gold | 2,000 - 4,999 | Premium rewards |
| 💎 Diamond | 5,000+ | Exclusive rewards |

### Reward Redemption

* **Default rewards** (initialized in smart contract):
  - Coffee Voucher: 100 points
  - Bus Ticket: 250 points
  - Plant a Tree: 500 points
  - 1 Day Bike Rental: 750 points
* **Stock management**: Support for limited or unlimited stock
* **On-chain verification**: All redemptions recorded immutably

### Analytics & Leaderboards

* **User summaries**: Total points, trips, emissions saved
* **Leaderboard**: Top users by points
* **System stats**: Total trips, points issued, redemptions
* **Daily stats**: Activity trends over time
* **Environmental impact**: Trees equivalent, car km equivalent, gas saved

---

## 🛠️ Tech Stack

**Frontend**
* React 19.2.0
* Vite 7.2.2
* ESLint 9
* CSS3 with custom styles

**Backend**
* Node.js 20.19+ or 22.12+ (required for Vite 7)
* Express 4.18
* Ethers.js 6.9
* PostgreSQL client (pg) 8.11
* dotenv, morgan, cors, body-parser

**Blockchain**
* Solidity ^0.8.19
* Hardhat 2.19
* Hardhat Toolbox (testing, verification, gas reporting)
* Ethers.js v6

**Database**
* PostgreSQL 12+

**Development Tools**
* Hardhat local node
* Chai assertions for testing
* Gas reporter
* Solidity coverage

---

## 🚀 Quick Start

### Prerequisites

```bash
# Required versions
node -v      # Should be v20.19+ or v22.12+ (for Vite 7)
psql --version # PostgreSQL 12+
```

### 1. Install Dependencies

```bash
# Install root dependencies (Hardhat, backend)
npm install
# or
pnpm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 2. Configure Environment

Create `.env` file in the project root:

```ini
# Blockchain / Provider
RPC_URL=http://127.0.0.1:8545
CONTRACT_ADDRESS=  # Will be filled after deployment
TOKEN_ADDRESS=     # Will be filled after deployment

# Backend Wallet (for local development - Hardhat test account)
# ⚠️ This is a PUBLIC test key - ONLY for local development!
BACKEND_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=reward_system
DB_USER=postgres
DB_PASSWORD=postgres

# Server
PORT=3000

# Optional: For testnet/mainnet deployment
# AMOY_RPC_URL=https://rpc-amoy.polygon.technology/
# POLYGON_RPC_URL=https://polygon-rpc.com
# PRIVATE_KEY=your_private_key_here  # ⚠️ Keep this SECRET!
# POLYGONSCAN_API_KEY=your_api_key
# COINMARKETCAP_API_KEY=your_api_key
```

> ⚠️ **Security Note**: 
> - The `BACKEND_PRIVATE_KEY` above is Hardhat's **publicly known test account** - safe for local development only
> - For testnet/mainnet, use `PRIVATE_KEY` with your own wallet
> - **NEVER commit `.env` to git!** (already in `.gitignore`)
> - See [Security](#security) section for best practices

### 3. Set Up Database
For local development, the recommended way to start fresh is to drop and recreate the public schema, then rerun migrations:
```bash
psql -h localhost -p 5433 -U postgres -d reward_system \
  -v ON_ERROR_STOP=1 -c \
"DROP SCHEMA public CASCADE;
 CREATE SCHEMA public;
 GRANT ALL ON SCHEMA public TO postgres;
 GRANT ALL ON SCHEMA public TO public;"

pnpm run db:migrate
```
This will:

* Drop all existing tables, views, functions, triggers, and indexes
* Recreate a clean `public` schema
* Rebuild the full schema (tables, views, triggers)
* Seed default rewards and system stats

> 🔁 If your PostgreSQL runs on a different port or user, adjust `-p` and `-U` accordingly.

### 4. Start the System

Open **4 separate terminal windows**:

**Terminal 1 — Hardhat Node**
```bash
npm run node
# Starts local blockchain on http://127.0.0.1:8545
# Shows 20 test accounts with private keys
```

**Terminal 2 — Deploy Contract**
```bash
npm run deploy:local
# Deploys RewardSystem.sol to localhost
# Outputs contract address (copy this to .env as CONTRACT_ADDRESS)
# Saves deployment info to ./deployments/localhost.json
```

**Terminal 3 — Backend API Server**
```bash
npm run server
# Starts Express server on port 3000
# Logs:
#   ✅ RewardService initialized
#   📍 Contract: <CONTRACT_ADDRESS>
#   🔑 Signer: <BACKEND_WALLET_ADDRESS>
#   ✅ Database connected
#   🚀 Reward System API running on port 3000
```

**Terminal 4 — Frontend Dev Server**
```bash
cd frontend
npm run dev
# Starts Vite dev server on port 5173
# Open http://localhost:5173 in browser
```

### 5. Test the System

**Option A: Using the Frontend**

1. Open http://localhost:5173
2. Select a test wallet (0, 1, or 2)
3. Configure a trip:
   - Mode: bike
   - Distance: 5000 meters (5 km)
   - Duration: 1200 seconds (20 min)
4. Click "Preview Points" to see off-chain calculation
5. Click "Record on Blockchain" to submit the trip
6. View updated balance and trip history

**Option B: Using cURL**

```bash
# Calculate points (off-chain, no blockchain transaction)
curl -X POST http://localhost:3000/api/points/calculate \
  -H 'Content-Type: application/json' \
  -d '{"mode":"bike","distance":5000,"duration":1200}'

# Record trip (on-chain, writes to blockchain)
curl -X POST http://localhost:3000/api/trips/submit \
  -H 'Content-Type: application/json' \
  -d '{
    "walletAddress":"0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    "mode":"bike",
    "distance":5000,
    "duration":1200
  }'

# Check balance
curl http://localhost:3000/api/points/balance/0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

# Get user summary
curl http://localhost:3000/api/users/summary/0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

# Get trip history
curl http://localhost:3000/api/trips/history/0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
```

---

## 🎨 Frontend Guide

### Running the Frontend

```bash
cd frontend
npm run dev          # Start dev server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### Components

**WalletSelector** (`src/components/WalletSelector.jsx`)
- Select from 3 test wallets (Hardhat accounts #0, #1, #2)
- Enter custom wallet address
- Displays currently selected wallet

**TripSimulator** (`src/components/TripSimulator.jsx`)
- Select transport mode (walk, bike, ebike, scooter, bus, train, etc.)
- Input distance (meters) and duration (seconds)
- Preview points calculation (off-chain)
- Record trip on blockchain
- Shows transaction hash, block number, points earned

**UserDashboard** (`src/components/UserDashboard.jsx`)
- Points balance and current tier
- Tier progress bar to next level
- Recent trips table
- Environmental impact (total CO₂ saved)

**SystemStats** (`src/components/SystemStats.jsx`)
- Total trips recorded (blockchain)
- Total points issued
- Total rewards redeemed
- System-wide statistics

### Configuration

**Vite Proxy** (`frontend/vite.config.js`)
```javascript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true,
    }
  }
}
```

**Node.js Version** (`.nvmrc` + `frontend/package.json`)
```json
{
  "engines": {
    "node": ">=20.19 <21 || >=22.12"
  }
}
```

---

## 🔌 API Reference

Base URL: `http://localhost:3000`

### Health & Info

**GET /** — API information and endpoint list

**GET /health** — Health check
```json
{
  "success": true,
  "status": "healthy",
  "database": "connected",
  "blockchain": "connected"
}
```

### Trips

**POST /api/trips/submit** — Record a trip on blockchain
```json
{
  "walletAddress": "0x...",
  "mode": "bike",
  "distance": 5000,
  "duration": 1200
}
```

**GET /api/trips/history/:walletAddress** — Get trip history
- Query params: `?limit=50&offset=0`

**GET /api/trips/verify/:tripHash** — Verify trip on blockchain

**GET /api/trips/stats** — Trip statistics by mode

### Points

**GET /api/points/balance/:walletAddress** — Get balance and tier
```json
{
  "success": true,
  "data": {
    "balance": "108",
    "tier": "Bronze",
    "tierProgress": {
      "currentTier": "Bronze",
      "nextTier": "Silver",
      "progress": 21,
      "pointsToNext": 392
    }
  }
}
```

**POST /api/points/calculate** — Calculate points (off-chain, no tx)
```json
{
  "mode": "bike",
  "distance": 5000,
  "duration": 1200
}
```

### Rewards

**GET /api/rewards/catalog** — Get all available rewards

**POST /api/rewards/redeem** — Redeem a reward
```json
{
  "walletAddress": "0x...",
  "rewardId": "COFFEE_VOUCHER"
}
```

**GET /api/rewards/history/:walletAddress** — Redemption history

### Users

**GET /api/users/summary/:walletAddress** — Complete user profile
- Points balance and tier
- Activity stats (trip count, redemptions)
- Environmental impact

**GET /api/users/leaderboard** — Top users by points
- Query params: `?limit=10`

**GET /api/users/activity/:walletAddress** — Activity timeline
- Query params: `?days=30`

### System

**GET /api/system/stats** — System-wide statistics
```json
{
  "database": {
    "total_trips": 15,
    "total_users": 3,
    "total_points_issued": 1620
  },
  "blockchain": {
    "totalTrips": "15",
    "totalPointsIssued": "1350",
    "totalRedemptions": "0"
  }
}
```

**GET /api/system/daily** — Daily statistics
- Query params: `?days=7`

---

## 📊 Database Schema

### Tables

**users**
```sql
id, wallet_address (unique), username, email, 
total_points, tier, created_at, updated_at
```

**trips** (off-chain cache of blockchain data)
```sql
id, trip_id, user_id, wallet_address, mode, 
distance, duration, points_earned, emissions_saved,
trip_hash, tx_hash, block_number, verified, created_at
```

**redemptions**
```sql
id, redemption_id, user_id, wallet_address, reward_id,
reward_name, points_cost, tx_hash, block_number, 
status, created_at
```

**rewards** (synced from blockchain)
```sql
id, reward_id (unique), name, description, points_cost,
active, stock, created_at, updated_at
```

**system_stats** (singleton for analytics)
```sql
id (always 1), total_trips, total_users, total_points_issued,
total_redemptions, total_emissions_saved, last_updated
```

### Views

**v_user_summary** — Aggregated user stats

**v_recent_trips** — Recent trips across all users

### Triggers

**update_user_tier** — Automatically updates user tier based on total_points

**update_updated_at_column** — Maintains updated_at timestamp

### Migration

```bash
npm run db:migrate
# Runs backend/migrate.js which executes backend/database.sql
```

---

## 🧪 Testing

### Run All Tests

```bash
npm test
# or
npx hardhat test
```

### Run Specific Test File

```bash
npx hardhat test test/RewardSystem.test.js
npx hardhat test test/Integration.test.js
```

### Gas Reporting

```bash
REPORT_GAS=true npm test
```

### Coverage

```bash
npm run test:coverage
```

### Test Structure

**test/RewardSystem.test.js** — Smart contract unit tests
- Trip recording
- Points calculation
- Tier calculation
- Reward redemption
- Edge cases and validation

**test/Integration.test.js** — End-to-end integration tests
- Full flow: trip → blockchain → database
- Multiple user scenarios
- Emissions calculations
- Tier progression
- System stats

---

## 🚢 Deployment

### Understanding Token Types

Before deploying, it's crucial to understand the two types of tokens:

**1. POL (Polygon Native Token) - Gas Money ⛽**
- **Purpose**: Pay for transaction fees (gas) on Polygon network
- **How to get**: Faucets (testnet) or exchanges (mainnet)
- **Limitation**: Faucets provide limited amounts (0.1-0.5 POL every 24 hours)
- **Can you mint?**: ❌ No - it's the blockchain's native currency
- **You need it for**: Deploying contracts, sending transactions

**2. C2GP (CO2Go Points) - Your Application Token 🎁**
- **Purpose**: Reward users for eco-friendly trips
- **How to get**: Mint from your CO2GoToken contract (you're the owner!)
- **Limitation**: None - you can mint unlimited amounts for testing
- **Can you mint?**: ✅ Yes - you have minting privileges
- **You need it for**: Testing app features, funding test wallets

### Polygon Amoy Testnet Deployment

#### Step 1: Get Test POL (Gas Token)

You'll need POL for gas fees. Use **multiple faucets** to get POL quickly:

**🥇 Recommended Faucets (High Amount):**
```bash
# Alchemy Faucet - 0.5 POL (Highest!)
https://www.alchemy.com/faucets/polygon-amoy

# Chainlink Faucet - 0.5 POL
https://faucets.chain.link/polygon-amoy

# Polygon Official Faucet - 0.1 POL
https://faucet.polygon.technology/

# QuickNode Faucet - 0.1 POL
https://faucet.quicknode.com/polygon/amoy
```

**📖 See `POLYGON_FAUCET_LIST.md` for a complete list of 8+ faucets!**

**💡 Pro Tip**: You can claim from multiple faucets to get 1+ POL in 10 minutes!

#### Step 2: Configure Environment

Create `.env` file (⚠️ **NEVER commit this file to git!**):

```ini
# Polygon Amoy Testnet RPC
AMOY_RPC_URL=https://rpc-amoy.polygon.technology/

# Your wallet private key (⚠️ KEEP SECRET!)
PRIVATE_KEY=your_private_key_here

# For contract verification (optional)
POLYGONSCAN_API_KEY=your_api_key_here

# Token addresses (will be filled after deployment)
TOKEN_ADDRESS=
CONTRACT_ADDRESS=
```

> ⚠️ **Security**: Never share your private key! Use a separate wallet for testnet with no real funds.

#### Step 3: Deploy Contracts

**Option A: Full Deployment (First Time)**
```bash
# Deploy both CO2GoToken and RewardSystem
npx hardhat run scripts/deploy.js --network amoy

# Copy the addresses from output to your .env:
# TOKEN_ADDRESS=0x...
# CONTRACT_ADDRESS=0x...
```

**Option B: Deploy RewardSystem Only (If Token Already Exists)**
```bash
# If CO2GoToken is already deployed, just deploy RewardSystem
npx hardhat run scripts/deploy-reward-system-only.js --network amoy

# This uses the token address from deployments/amoy.json or .env
```

**Expected Output:**
```
✅ CO2GoToken deployed to: 0x...
✅ RewardSystem deployed to: 0x...
🔑 Granting minter role to RewardSystem...
✅ RewardSystem can now mint tokens!
```

#### Step 4: Verify Deployment

```bash
# Verify your token contract is working
npx hardhat run scripts/verify-token-amoy.js --network amoy

# Check your balances
npx hardhat run scripts/check-balances.js --network amoy
```

**Expected Balances:**
```
💎 POL Balance: ~0.05 POL (remaining after deployment)
🪙 C2GP Balance: 1,000,000 C2GP (from constructor)
```

#### Step 5: Mint Test Tokens (Your Application Currency)

Unlike POL (which is limited), you can mint **unlimited C2GP tokens** for testing!

**Edit `scripts/mint-test-tokens.js`:**
```javascript
const testAccounts = [
  {
    address: "0xYourWallet...",  // Replace with your wallet
    amount: 50000,               // 50,000 C2GP tokens
    label: "Test Wallet 1"
  },
  {
    address: "0xAnotherWallet...",
    amount: 10000,
    label: "Test User 2"
  },
  // Add as many as you need!
];
```

**Run the minting script:**
```bash
npx hardhat run scripts/mint-test-tokens.js --network amoy
```

**Output:**
```
📤 Minting 50000 C2GP to Test Wallet 1...
✅ Minted successfully!
💰 New Balance: 1050000 C2GP
```

**💡 Key Insight**: 
- **POL**: Limited by faucets, used for gas fees only
- **C2GP**: Unlimited minting, used for testing your app
- **Gas cost to mint C2GP**: ~0.0001 POL (basically free!)

#### Step 6: Verify on Block Explorer

```bash
# Verify contracts on PolygonScan (optional but recommended)
npx hardhat verify --network amoy <TOKEN_ADDRESS>
npx hardhat verify --network amoy <CONTRACT_ADDRESS> <TOKEN_ADDRESS>
```

View your deployed contracts:
- Token: `https://amoy.polygonscan.com/address/YOUR_TOKEN_ADDRESS`
- RewardSystem: `https://amoy.polygonscan.com/address/YOUR_CONTRACT_ADDRESS`

#### Step 7: Update Backend Configuration

Update `.env` with deployed addresses:
```ini
RPC_URL=https://rpc-amoy.polygon.technology/
CONTRACT_ADDRESS=0x...  # From deployment output
TOKEN_ADDRESS=0x...     # From deployment output
```

#### Step 8: Start Backend

```bash
npm run server
```

**Expected logs:**
```
✅ RewardService initialized
📍 Contract: 0x...
🔑 Signer: 0x...
✅ Database connected
🚀 Reward System API running on port 3000
```

### Common Deployment Issues & Solutions

#### Issue: "Insufficient POL balance"
**Cause**: Not enough POL for gas fees  
**Solution**: 
- Claim from multiple faucets (see `POLYGON_FAUCET_LIST.md`)
- Wait 24 hours for faucet cooldown
- Use 2-3 different faucets to get 1+ POL instantly

#### Issue: "Deployment failed: execution reverted"
**Cause**: Wrong token address or network mismatch  
**Solution**:
- Check `deployments/amoy.json` exists
- Verify token address in `.env` matches PolygonScan
- Run `scripts/verify-token-amoy.js` to test connection

#### Issue: "Token not showing in MetaMask"
**Cause**: Need to manually add custom token  
**Solution**:
1. Open MetaMask → Assets → Import Tokens
2. Paste Token Address from deployment
3. Symbol: C2GP
4. Decimals: 18

#### Issue: "How do I get test C2GP tokens?"
**Answer**: You don't need a faucet! You can mint unlimited C2GP:
```bash
npx hardhat run scripts/mint-test-tokens.js --network amoy
```

#### Issue: "Can I convert C2GP to POL?"
**Answer**: No. They are completely separate:
- POL = Blockchain gas (must get from faucets)
- C2GP = Your app tokens (you can mint unlimited)

### Gas Cost Estimates (Amoy Testnet)

| Action | POL Cost | Notes |
|--------|----------|-------|
| Deploy CO2GoToken | ~0.03-0.05 POL | One-time |
| Deploy RewardSystem | ~0.03-0.05 POL | One-time |
| Grant minter role | ~0.0001 POL | Included in deploy |
| Mint C2GP tokens | ~0.0001 POL | Per transaction |
| Record a trip | ~0.0002 POL | Per user trip |
| Redeem reward | ~0.0002 POL | Per redemption |

**Total for full deployment**: ~0.06-0.10 POL  
**Testing (100 transactions)**: ~0.01-0.02 POL  

**Conclusion**: 0.5 POL from one faucet = hundreds of test transactions! 🎉

### Polygon Mainnet

```bash
# 1. Configure .env (use POLYGON_RPC_URL)
# 2. Ensure wallet has MATIC for gas
# 3. Deploy
npm run deploy:polygon

# 4. Verify
npm run verify:polygon <CONTRACT_ADDRESS>

# 5. Production setup
# - Use managed PostgreSQL (AWS RDS, Google Cloud SQL, etc.)
# - Deploy backend with PM2 or Docker
# - Set up monitoring and logging
# - Configure CORS for production frontend
# - Use environment-specific .env files
```

### Production Backend

```bash
# Using PM2
npm install -g pm2
pm2 start backend/server.js --name co2go-api
pm2 save
pm2 startup

# Using Docker
docker build -t co2go-backend .
docker run -d -p 3000:3000 --env-file .env co2go-backend
```

### Production Frontend

```bash
cd frontend
npm run build
# Deploy dist/ folder to:
# - Vercel, Netlify, AWS S3 + CloudFront
# - Configure API_BASE to production backend URL
```

---

## 🔒 Security

### Security Best Practices

**⚠️ CRITICAL: Never Expose These Values!**

The following should **NEVER** be committed to git or shared publicly:

❌ **Private Keys** (`PRIVATE_KEY` in `.env`)
- Use separate wallets for dev/testnet/mainnet
- Testnet wallet should have NO real funds
- Use hardware wallets for mainnet
- Rotate keys if compromised

❌ **API Keys** (`POLYGONSCAN_API_KEY`, `COINMARKETCAP_API_KEY`)
- Keep in `.env` file (git ignored)
- Use environment-specific keys
- Rotate regularly

❌ **Database Credentials** (`DB_PASSWORD`)
- Use strong passwords
- Different credentials per environment
- Never hardcode in source files

✅ **Safe to Share (Public Information):**

These can be public as they're on-chain and visible to everyone:

✅ **Contract Addresses** (after deployment)
- TOKEN_ADDRESS: Visible on block explorer
- CONTRACT_ADDRESS: Visible on block explorer
- These are public by design

✅ **Wallet Addresses** (public keys)
- Your wallet address is public on blockchain
- Anyone can see your transactions
- Safe to share for receiving funds

✅ **Network RPCs** (public endpoints)
- RPC URLs are public infrastructure
- Safe to share and use

### `.env` File Security

Your `.env` file should look like this:

```ini
# ✅ SAFE - Public RPC endpoints
AMOY_RPC_URL=https://rpc-amoy.polygon.technology/
POLYGON_RPC_URL=https://polygon-rpc.com

# ❌ SECRET - Your private key (NEVER commit!)
PRIVATE_KEY=0x1234...abcd  # Replace with your actual key

# ✅ SAFE AFTER DEPLOYMENT - Public contract addresses
TOKEN_ADDRESS=0x3bf9bd06C9053FB389ee8937A2F8aD1a50618b2d
CONTRACT_ADDRESS=0x2245b060b645A6593c8547211CfD2CD33c9D1E10

# ❌ SECRET - Database credentials
DB_PASSWORD=YourStrongPassword123!

# ❌ SECRET - API keys
POLYGONSCAN_API_KEY=ABC123...
```

**📋 Git Ignore Configuration:**

Ensure `.gitignore` includes:
```
.env
.env.local
.env.*.local
*.key
secrets/
```

### Smart Contract Security

* **Access Control** — Owner-only functions for admin operations
* **Duplicate Prevention** — Trip IDs are unique per user
* **Reentrancy Protection** — State updates before external calls
* **Integer Overflow** — Solidity ^0.8.19 has built-in overflow protection
* **Input Validation** — All parameters validated before processing
* **Speed Checks** — Prevents unrealistic trip submissions

### API Security

* **Input Validation** — All API endpoints validate and sanitize input
* **SQL Injection Prevention** — All database queries use parameterized statements
* **CORS Configuration** — Configured for local development; restrict in production
* **Error Handling** — Sensitive error details not exposed to clients
* **Rate Limiting** — Consider adding for production (e.g., express-rate-limit)

### Wallet Security for Testing

**Testnet Wallet Best Practices:**

1. **Create Separate Testnet Wallet**
   ```bash
   # Generate new wallet for testing
   # Never use your mainnet wallet for testing!
   ```

2. **Use Hardhat Default Accounts for Local Development**
   ```javascript
   // These are PUBLIC test accounts (safe for localhost only!)
   BACKEND_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
   ```

3. **Testnet Wallet Should Have NO Real Funds**
   - Only use faucet tokens (free testnet POL)
   - Never send real cryptocurrency to testnet wallets

### Production Security Checklist

Before deploying to mainnet or production:

- [ ] Audit smart contracts (professional audit recommended)
- [ ] Set up proper key management (AWS Secrets Manager, HashiCorp Vault)
- [ ] Enable HTTPS/TLS for all connections
- [ ] Add authentication (JWT, OAuth2) to API
- [ ] Implement rate limiting (per IP, per wallet)
- [ ] Set up monitoring and alerting (Sentry, DataDog)
- [ ] Use managed database with encryption at rest
- [ ] Enable backup and disaster recovery
- [ ] Set up CI/CD with secret scanning
- [ ] Configure WAF (Web Application Firewall)
- [ ] Implement proper logging (no sensitive data in logs)
- [ ] Set up DDoS protection (Cloudflare, AWS Shield)

### Example: Secure Environment Setup

**Development (.env.development):**
```ini
PRIVATE_KEY=0xac09...  # Hardhat test account (public, safe)
RPC_URL=http://localhost:8545
```

**Testnet (.env.testnet):**
```ini
PRIVATE_KEY=${SECRET_TESTNET_KEY}  # From secrets manager
AMOY_RPC_URL=https://rpc-amoy.polygon.technology/
```

**Production (.env.production):**
```ini
PRIVATE_KEY=${SECRET_PRODUCTION_KEY}  # From hardware wallet/KMS
POLYGON_RPC_URL=${SECRET_RPC_URL}     # Private RPC with auth
```

### What to Do If Private Key is Compromised

1. **Immediately** stop using the compromised wallet
2. Create a new wallet with a new private key
3. Transfer any remaining funds to the new wallet
4. Redeploy contracts if necessary
5. Update all environment variables
6. Audit recent transactions for unauthorized activity
7. Report to relevant parties (team, users if applicable)

### Recommended Additions for Production

1. **API Authentication** — JWT, API keys, OAuth2
2. **Rate Limiting** — Per wallet, per IP address
3. **Input Sanitization Middleware** — Additional layer of validation
4. **HTTPS/TLS** — Encrypt all connections
5. **Smart Contract Audit** — Professional security review
6. **Bug Bounty Program** — Incentivize security researchers
7. **Monitoring** — Real-time alerts for suspicious activity

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Write or update tests
5. Commit with clear messages (`git commit -m 'Add amazing feature'`)
6. Push to your branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Development Guidelines

* Follow existing code style (ESLint configured)
* Add tests for new features
* Update documentation
* Keep commits atomic and well-described

---

## 📝 License

MIT License — see LICENSE file for details.

---

## 📚 Additional Resources

### Documentation Files

* `FRONTEND_GUIDE.md` — Detailed frontend development guide
* `CREATE_UI_COMPONENTS.md` — UI component creation instructions
* `MINTING_GUIDE.md` — **Complete guide to test token minting (C2GP)**
* `POLYGON_FAUCET_LIST.md` — **List of 8+ faucets to get POL quickly**
* `DEPLOYMENT_FIX.md` — **Quick deployment troubleshooting guide**
* `AMOY_DEPLOYMENT_DIAGNOSIS.md` — **Detailed deployment analysis**
* `DEPLOYMENT_VISUAL.md` — **Visual breakdown of deployment process**
* `.github/patch_errors.md` — Node.js version compatibility fixes
* `diagram/reward-system.mermaid` — System architecture diagram

### Scripts Reference

```bash
# Blockchain
npm run compile         # Compile smart contracts
npm run node           # Start Hardhat local node
npm run deploy:local   # Deploy to localhost
npm run deploy:amoy    # Deploy to Amoy testnet
npm run deploy:polygon # Deploy to Polygon mainnet

# Deployment Helpers
npx hardhat run scripts/deploy-reward-system-only.js --network amoy  # Deploy only RewardSystem
npx hardhat run scripts/verify-token-amoy.js --network amoy          # Verify token deployment
npx hardhat run scripts/check-balances.js --network amoy             # Check POL and C2GP balances
npx hardhat run scripts/mint-test-tokens.js --network amoy           # Mint C2GP test tokens

# Testing
npm test               # Run all tests
npm run test:coverage  # Generate coverage report
npm run test:gas       # Show gas usage

# Token Testing & Verification
npx hardhat run scripts/test-token-rewards.js --network amoy         # Test full token flow

# Backend
npm run server         # Start Express API server
npm run server:dev     # Start with nodemon (auto-reload)
npm run db:migrate     # Run database migrations

# Frontend
cd frontend
npm run dev           # Start Vite dev server
npm run build         # Build for production
npm run preview       # Preview production build
npm run lint          # Run ESLint

# Utilities
npm run clean         # Clean Hardhat artifacts
npm run console       # Open Hardhat console
./scripts/quick-start.sh amoy  # Automated deployment setup
```

---

**Built with ❤️ for a sustainable future 🌍**

---

## ❓ Frequently Asked Questions (FAQ)

### Deployment & Tokens

**Q: What's the difference between POL and C2GP?**

A: These are two completely different tokens:

| Feature | POL (Native Token) | C2GP (Your App Token) |
|---------|-------------------|----------------------|
| **What is it?** | Polygon blockchain's native currency | Your custom ERC20 reward token |
| **Purpose** | Pay transaction fees (gas) | Reward users in your app |
| **How to get?** | Faucets (testnet) or buy (mainnet) | Mint from your contract |
| **Limitation** | Limited by faucet (0.1-0.5/day) | Unlimited minting! |
| **Can you create more?** | ❌ No | ✅ Yes (you're the owner) |
| **Visible in wallet?** | By default | Need to add custom token |
| **Cost to get?** | Free (testnet) / Buy (mainnet) | Free to mint (tiny POL for gas) |

**Q: How do I get more POL for testing?**

A: Use multiple faucets! You're not limited to one:
- Alchemy: 0.5 POL (https://www.alchemy.com/faucets/polygon-amoy)
- Chainlink: 0.5 POL (https://faucets.chain.link/polygon-amoy)
- Polygon: 0.1 POL (https://faucet.polygon.technology/)
- QuickNode: 0.1 POL (https://faucet.quicknode.com/polygon/amoy)

See `POLYGON_FAUCET_LIST.md` for 8+ faucets!

**Q: How do I get test C2GP tokens?**

A: You don't need a faucet! Just mint them:
```bash
npx hardhat run scripts/mint-test-tokens.js --network amoy
```
You can mint **unlimited amounts** because you're the token owner!

**Q: Can I convert C2GP to POL?**

A: No, they're completely separate. C2GP is your application token, POL is the blockchain's gas currency.

**Q: Why do I have 1,000,000 C2GP already?**

A: Your CO2GoToken contract's constructor automatically mints 1 million tokens to the deployer (you!) when deployed. This is intentional for initial testing.

**Q: I ran out of POL. What do I do?**

A: 
1. Claim from multiple faucets (can get 1+ POL in 10 minutes)
2. Wait 24 hours for faucet cooldown
3. Use the POW faucet for unlimited claims (takes longer)

See `POLYGON_FAUCET_LIST.md` for options!

**Q: How much POL do I need?**

A:
- Full deployment (both contracts): ~0.06-0.10 POL
- RewardSystem only: ~0.03-0.05 POL
- Testing (100 transactions): ~0.01-0.02 POL
- Minting C2GP tokens: ~0.0001 POL per mint

**Conclusion**: 0.5 POL = hundreds of test transactions!

### Smart Contracts

**Q: Where are my tokens stored?**

A: On the blockchain! Your C2GP balance is stored in the CO2GoToken smart contract, visible on PolygonScan.

**Q: Can I mint C2GP on mainnet?**

A: Yes, but be careful! On mainnet, only mint what you need. Unlimited minting is for testnet testing only.

**Q: What happens if I lose my private key?**

A: You lose access to that wallet forever. The tokens are still on-chain but inaccessible. Always backup your keys securely!

**Q: Can I change the token contract after deployment?**

A: No, smart contracts are immutable once deployed. You'd need to deploy a new contract and migrate users.

### Troubleshooting

**Q: Deployment failed with "insufficient funds"**

A: You need more POL for gas. Claim from faucets or check your balance:
```bash
npx hardhat run scripts/check-balances.js --network amoy
```

**Q: "execution reverted" error**

A: Usually means:
1. Wrong token address in `.env`
2. Token not deployed on this network
3. You're not the contract owner
4. Invalid function parameters

Run the verification script:
```bash
npx hardhat run scripts/verify-token-amoy.js --network amoy
```

**Q: Token not showing in MetaMask**

A: Add it manually:
1. Open MetaMask → Assets → Import Tokens
2. Paste your TOKEN_ADDRESS
3. Symbol: C2GP
4. Decimals: 18

**Q: Database connection failed**

A: Check:
1. PostgreSQL is running: `sudo systemctl status postgresql`
2. Database exists: `psql -l | grep reward_system`
3. Credentials in `.env` are correct
4. Port is correct (default: 5432)

**Q: Frontend can't connect to backend**

A: Verify:
1. Backend is running: `curl http://localhost:3000/health`
2. Port in frontend matches backend (3000)
3. CORS is configured correctly
4. No firewall blocking connections

### Security

**Q: Is it safe to share my contract addresses?**

A: ✅ YES! Contract addresses are public on the blockchain anyway. Anyone can see them on PolygonScan.

**Q: Is it safe to share my wallet address?**

A: ✅ YES! Wallet addresses (public keys) are meant to be public. They're how people send you tokens.

**Q: Is it safe to share my private key?**

A: ❌ **NEVER!** Your private key gives complete control of your wallet. Never share it with anyone!

**Q: The README shows private keys. Is that okay?**

A: The private key shown is Hardhat's **public test account** - everyone knows it. It's only safe for local development. For testnet/mainnet, use your own secret key.

**Q: Should I commit `.env` to git?**

A: ❌ **NEVER!** `.env` contains secrets. It's already in `.gitignore` - keep it there!

### Development

**Q: Can I use a different database?**

A: The code is PostgreSQL-specific (uses pg client). For other databases, you'd need to:
1. Modify `backend/database.js`
2. Adjust SQL syntax in queries
3. Update schema in `backend/database.sql`

**Q: Can I deploy without a database?**

A: Technically yes (blockchain-only), but you'd lose:
- Fast queries and analytics
- User profiles
- Leaderboards
- Activity tracking

**Q: How do I reset everything?**

A:
```bash
# Reset blockchain (stop and restart hardhat node)
npm run node  # In new terminal

# Reset database
npm run db:migrate

# Redeploy contracts
npm run deploy:local
```

**Q: Where are deployment addresses saved?**

A: In `deployments/<network>.json`:
```bash
cat deployments/localhost.json  # Local
cat deployments/amoy.json      # Testnet
```

---

### Quick Links

* [Smart Contract](contracts/RewardSystem.sol)
* [Backend API](backend/server.js)
* [Frontend](frontend/src/App.jsx)
* [Tests](test/)
* [Deployment Scripts](scripts/deploy.js)

### Support

For issues, questions, or contributions, please open an issue on GitHub.
