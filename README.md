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
# POLYGONSCAN_API_KEY=your_api_key
# COINMARKETCAP_API_KEY=your_api_key
```

> **Note:** The `BACKEND_PRIVATE_KEY` above is Hardhat's first test account private key (publicly known, for local development only).

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

### Polygon Amoy Testnet

```bash
# 1. Configure .env
AMOY_RPC_URL=https://rpc-amoy.polygon.technology/
PRIVATE_KEY=your_private_key_with_test_MATIC
POLYGONSCAN_API_KEY=your_polygonscan_api_key

# 2. Get test MATIC from faucet
# https://faucet.polygon.technology/

# 3. Deploy
npm run deploy:amoy

# 4. Verify on PolygonScan
npm run verify:amoy <CONTRACT_ADDRESS>

# 5. Update .env with new CONTRACT_ADDRESS
# 6. Start backend
npm run server
```

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

### Best Practices

* **Environment Variables** — Never commit `.env` files (listed in `.gitignore`)
* **Private Keys** — Use separate keys for development/testnet/mainnet
* **SQL Injection** — All database queries use parameterized statements
* **Input Validation** — All API endpoints validate and sanitize input
* **CORS** — Configured for local development; restrict in production
* **Rate Limiting** — Consider adding for production (e.g., express-rate-limit)
* **Authentication** — Current version has no auth; add JWT/OAuth for production

### Smart Contract Security

* **Access Control** — Owner-only functions for admin operations
* **Duplicate Prevention** — Trip IDs are unique per user
* **Reentrancy Protection** — State updates before external calls
* **Integer Overflow** — Solidity ^0.8.19 has built-in overflow protection

### Recommended Additions for Production

1. API authentication (JWT, API keys)
2. Rate limiting per wallet/IP
3. Input sanitization middleware
4. HTTPS/TLS for all connections
5. Smart contract audit before mainnet
6. Monitoring and alerting (Sentry, DataDog)
7. Backup and disaster recovery

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

# Testing
npm test               # Run all tests
npm run test:coverage  # Generate coverage report
npm run test:gas       # Show gas usage

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
```

---

**Built with ❤️ for a sustainable future 🌍**

---

### Quick Links

* [Smart Contract](contracts/RewardSystem.sol)
* [Backend API](backend/server.js)
* [Frontend](frontend/src/App.jsx)
* [Tests](test/)
* [Deployment Scripts](scripts/deploy.js)

### Support

For issues, questions, or contributions, please open an issue on GitHub.
