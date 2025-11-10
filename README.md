Got it — here’s a patched **README.md** that matches your current codebase and the exact run sequence you demonstrated (Hardhat node → deploy → start server → call APIs). It also clarifies the 99 vs 90 points (off-chain multiplier vs on-chain base) and lists the precise `.env` variables your code reads.

---

# 🌿 Blockchain Reward System — ongoing Implementation

A complete blockchain-based reward system for sustainable transportation with a PostgreSQL database and an Express REST API backend.

## 📋 Table of Contents

* [Overview](#overview)
* [Architecture](#architecture)
* [Features](#features)
* [Tech Stack](#tech-stack)
* [Quick Start](#quick-start)
* [API Reference](#api-reference)
* [Database Schema](#database-schema)
* [Testing](#testing)
* [Deployment](#deployment)
* [Monitoring](#monitoring)
* [Security](#security)
* [Contributing](#contributing)
* [License](#license)

---

## 🎯 Overview

This system rewards users with points for using sustainable transportation modes (walking, biking, public transport). Points are stored **on-chain** (smart contract) for transparency and finality, while a **PostgreSQL** database serves fast queries and analytics.

**Highlights**

* ✅ On-chain points & auditability
* ✅ Off-chain DB for summaries, leaderboards, analytics
* ✅ DEIRA 2024 emission factors
* ✅ Tiered rewards (Bronze → Silver → Gold → Diamond)
* ✅ Clean REST API

> ℹ️ **Design note:** Off-chain calculator uses *mode multipliers* (e.g., walking/biking bonus). The **smart contract** intentionally **does not** apply these multipliers to keep on-chain logic simple and predictable. Hence, off-chain “calculated” points can differ from on-chain “recorded” points (see [Why 99 vs 90 points?](#why-99-vs-90-points)).

---

## 🏗️ Architecture

```
Client → Backend API → Reward Calculator → Smart Contract → Blockchain
              ↓                                   ↓
         PostgreSQL DB                       Immutable Ledger
```

### Components

1. **Smart Contract** — `contracts/RewardSystem.sol`
   Stores points, trips, redemptions, rewards; emits events.
2. **Backend API** — `backend/server.js`
   Validates input, orchestrates contract + DB, exposes REST endpoints.
3. **Reward Calculator** — `backend/rewardCalculator.js`
   DEIRA 2024 factors, validation, multipliers, emissions.
4. **Database** — `backend/database.sql` (+ `backend/database.js`)
   Schema, views, triggers; Node `pg` access layer.
5. **Deployment/Tooling** — Hardhat scripts in `scripts/` and tests in `test/`.

---

## ✨ Features

### Phase 1: Trip Submission

* Input validation (mode, distance, duration, speed sanity)
* Off-chain calculation (bonus multipliers)
* **On-chain recording** with tx hash & block number
* Emissions saved (car baseline vs actual mode)

### Phase 2: Points & Verification

* Source of truth: **on-chain balance**
* Tier computation (on-chain & off-chain progress helper)
* Trip verification via `tripHash`
* Trip history (on-chain + off-chain cache)

### Phase 3: Reward Redemption

* Catalog (on-chain + off-chain sync)
* Redemption & stock decrement (off-chain)
* History & system stats

### Analytics

* Leaderboard, daily stats, activity timelines
* Environmental impact summaries

---

## 🛠️ Tech Stack

**Blockchain**

* Solidity `^0.8.19`
* Hardhat
* Ethers.js v6

**Backend**

* Node.js (recommend **18 LTS** or **20**)
* Express, `pg` (PostgreSQL client)
* `dotenv`, `morgan`, `cors`, `body-parser`

**Database**

* PostgreSQL 12+

**Testing**

* Hardhat tests (unit + integration)
* Chai assertions

---

## 🚀 Quick Start

### 1) Prerequisites

```bash
node -v      # Use Node 18 LTS or 20 (Hardhat warns on Node 21)
psql --version
```

### 2) Install dependencies

```bash
pnpm install
# (or) npm install
```

### 3) Create & configure `.env`

Create `.env` at repo root:

```ini
# --- Blockchain / Provider ---
RPC_URL=http://127.0.0.1:8545   # used by backend/rewardService.js
CONTRACT_ADDRESS=KEY
BACKEND_PRIVATE_KEY=0xabc123...

# --- Database ---
DB_HOST=localhost
DB_PORT=5432
DB_NAME=reward_system
DB_USER=postgres
DB_PASSWORD=postgres

# --- Server ---
PORT=3000
```

> If you deploy to testnet/mainnet later, add:
>
> ```ini
> AMOY_RPC_URL=...
> POLYGONSCAN_API_KEY=...
> ```

### 4) Initialize database

```bash
# Create DB (adjust user/password as needed)
createdb reward_system

# Run schema & seeds
pnpm run db:migrate
# (or) node backend/migrate.js
```

### 5) **Run locally** — exact terminal order

**Terminal 1 — Hardhat node**

```bash
pnpm run node
# -> starts JSON-RPC on http://127.0.0.1:8545
# (Hardhat prints 20 funded dev accounts & private keys)
```

**Terminal 2 — Deploy contract to localhost**

```bash
pnpm run deploy:local
# -> prints deployed address, e.g. 0x5FbDB2...80aa3
# -> also saves ./deployments/localhost.json
# Copy that address into CONTRACT_ADDRESS in .env (matches above)
```

**Terminal 3 — Start the API server**

```bash
pnpm run server
# Expect logs:
# ✅ RewardService initialized
# 📍 Contract: <CONTRACT_ADDRESS>
# 🔑 Signer: <BACKEND_PRIVATE_KEY address>
# ✅ Database connected
# 🚀 Reward System API running on port 3000
```

**Terminal 4 — Call the API (examples)**

```bash
# (A) Pure calculation (off-chain, includes multipliers)
curl -X POST http://localhost:3000/api/points/calculate \
  -H 'Content-Type: application/json' \
  -d '{"mode":"bike","distance":5000,"duration":1200}'

# (B) Record trip (on-chain; base formula, no multipliers)
curl -X POST http://localhost:3000/api/trips/submit \
  -H 'Content-Type: application/json' \
  -d '{"walletAddress":"0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266","mode":"bike","distance":5000,"duration":1200}'

# (C) Check balance (on-chain source of truth)
curl http://localhost:3000/api/points/balance/0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
```

#### Why **99 vs 90** points?

* `/api/points/calculate` (off-chain) → applies **multiplier 1.1 for bike**
  Base = `(5km*10) + (20min*2) = 90` → Off-chain final = `90 * 1.1 = 99`.
* `/api/trips/submit` → **on-chain** contract uses the **base formula only** → `90`.
  Balance & tier are derived from this **on-chain** value by design.

---

## 🔌 API Reference

Base URL: `http://localhost:3000/api`

### Trips

* `POST /trips/submit` — Record a trip (writes on-chain & caches off-chain)
  Body: `{ walletAddress, mode, distance, duration }`
* `GET /trips/history/:walletAddress`
* `GET /trips/verify/:tripHash`

### Points

* `GET /points/balance/:walletAddress` — On-chain balance + tier (+ off-chain progress helper)
* `POST /points/calculate` — Off-chain hypothetical calc (with multipliers)

### Rewards

* `GET /rewards/catalog`
* `POST /rewards/redeem` — `{ walletAddress, rewardId }`
* `GET /rewards/history/:walletAddress`

### Users

* `GET /users/summary/:walletAddress`
* `GET /users/leaderboard`
* `GET /users/activity/:walletAddress?days=30`

### System

* `GET /system/stats` — DB + on-chain totals
* `GET /system/daily?days=7`

---

## 📊 Database Schema

Tables:

* `users(id, wallet_address, username, email, total_points, tier, …)`
* `trips(id, trip_id, user_id, wallet_address, mode, distance, duration, points_earned, emissions_saved, trip_hash, tx_hash, block_number, verified, …)`
* `redemptions(id, redemption_id, user_id, wallet_address, reward_id, reward_name, points_cost, tx_hash, block_number, status, …)`
* `rewards(id, reward_id, name, description, points_cost, active, stock, …)`
* `system_stats(id=1, total_trips, total_users, total_points_issued, total_redemptions, total_emissions_saved, …)`

Views:

* `v_user_summary`
* `v_recent_trips`

Triggers/Functions:

* `update_user_tier` (auto-tier by total_points)
* `update_updated_at_column` for timestamp maintenance

> Apply with: `pnpm run db:migrate` (runs `backend/migrate.js` which executes `backend/database.sql`).

---

## 🧪 Testing

Run all tests:

```bash
pnpm test
# or
npx hardhat test
```

Run only integration tests:

```bash
npx hardhat test test/Integration.test.js
```

> Integration tests assert the exact behaviors reflected above:
>
> * Off-chain calculator (e.g., bike 5km/20min → **99**)
> * On-chain recording (same trip → **90**)
> * Duplicate trip prevention
> * Emissions computation, tiers, rewards redemption, stats

---

## 🚢 Deployment

### Amoy Testnet (Polygon)

```bash
# Configure RPC + keys in .env:
# AMOY_RPC_URL=...
# BACKEND_PRIVATE_KEY=...
# POLYGONSCAN_API_KEY=...

npx hardhat run scripts/deploy.js --network amoy
npx hardhat verify --network amoy <CONTRACT_ADDRESS>

# Update CONTRACT_ADDRESS in .env
pnpm run server
```

### Mainnet (Polygon)

```bash
npx hardhat run scripts/deploy.js --network polygon
npx hardhat verify --network polygon <CONTRACT_ADDRESS>

# Use managed Postgres (RDS/GCP/Azure), PM2/Docker for backend:
pm2 start backend/server.js --name reward-api
```

---

## 📈 Monitoring

Health check:

```bash
curl http://localhost:3000/health
```

Key metrics:

* `/api/system/stats`
* `/api/system/daily`
* `/api/users/leaderboard`

---

## 🔒 Security

* Secrets in `.env` (never commit)
* Parameterized SQL queries (no string concatenation)
* Input validation on all endpoints
* CORS enabled
* Consider adding rate limiting & auth in production

---

## 🤝 Contributing

1. Fork & branch
2. Commit with clear messages
3. Open a PR with test evidence

---

## 📝 License

MIT — see `LICENSE`.

---

### Appendix — Scripts (PNPM/NPM)

Common scripts (if using PNPM as you did):

```bash
pnpm run node           # hardhat node
pnpm run deploy:local   # deploy to localhost
pnpm run server         # start express server
pnpm run db:migrate     # run SQL migration
pnpm test               # run tests
```

> NPM equivalents: replace `pnpm` with `npm`.

---

**Built with ❤️ for a sustainable future 🌍**

---

If you paste this over your current `README.md`, it will align 1:1 with your code and the terminal logs you shared, including the exact run order and the `.env` keys your modules read.
