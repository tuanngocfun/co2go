#!/bin/bash

# ============================================
# Complete System Test Script
# Tests the full flow from diagram/reward-system.mermaid
# ============================================

# Fail fast if jq is missing
if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required for this script. Please install jq and retry."
  exit 1
fi

echo "🧪 Starting Complete System Test"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration (override via env if you want)
API_URL="${API_URL:-http://localhost:3000}"
WALLET="${WALLET:-0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266}"  # Hardhat default account

echo -e "API_URL = ${YELLOW}${API_URL}${NC}"
echo -e "WALLET  = ${YELLOW}${WALLET}${NC}"
echo ""

# ============================================
# Test 1: Health Check
# ============================================
echo "Test 1: Health Check"
echo "-------------------"
response=$(curl -s "${API_URL}/health")
if echo "$response" | grep -q "healthy"; then
    echo -e "${GREEN}✓ Backend is healthy${NC}"
else
    echo -e "${RED}✗ Backend health check failed${NC}"
    echo "$response"
    exit 1
fi
echo ""

# ============================================
# Test 2: List Endpoints
# ============================================
echo "Test 2: List Endpoints"
echo "----------------------"
curl -s "${API_URL}/" | jq
echo ""

# ============================================
# Test 3: Get Rewards Catalog
# ============================================
echo "Test 3: Get Rewards Catalog"
echo "---------------------------"
rewards=$(curl -s "${API_URL}/api/rewards/catalog")
reward_count=$(echo "$rewards" | jq '.data | length')
if [ "$reward_count" -gt 0 ] 2>/dev/null; then
    echo -e "${GREEN}✓ Found $reward_count rewards${NC}"
    echo "$rewards" | jq '.data[] | {reward_id: .reward_id, name: .name, points_cost: .points_cost}'
else
    echo -e "${RED}✗ Failed to read rewards catalog${NC}"
    echo "$rewards"
    exit 1
fi
echo ""

# ============================================
# Test 4: Calculate Points (No Transaction)
# ============================================
echo "Test 4: Calculate Points (Phase 1 - Reward Calculator)"
echo "------------------------------------------------------"
calc_result=$(curl -s -X POST "${API_URL}/api/points/calculate" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "bike",
    "distance": 5000,
    "duration": 1200
  }')

points=$(echo "$calc_result" | jq '.data.pointsEarned')
emissions=$(echo "$calc_result" | jq '.data.emissionsSaved')

if [ "$points" != "null" ] && [ "$points" != "" ]; then
    echo -e "${GREEN}✓ Points calculated: $points${NC}"
    echo -e "${GREEN}✓ CO2 saved: ${emissions}g${NC}"
    echo "$calc_result" | jq '.data.breakdown'
else
    echo -e "${RED}✗ Point calculation failed${NC}"
    echo "$calc_result"
    exit 1
fi
echo ""

# ============================================
# Test 5: Submit Trips (Phase 1 - Complete)
# Submit TWO trips so we have enough points to redeem a 100-point reward.
# ============================================
echo "Test 5: Submit Trips to Blockchain (Phase 1 - Complete)"
echo "------------------------------------------------------"

submit_trip () {
  local label="$1"
  local trip_result
  trip_result=$(curl -s -X POST "${API_URL}/api/trips/submit" \
    -H "Content-Type: application/json" \
    -d "{
      \"walletAddress\": \"${WALLET}\",
      \"mode\": \"bike\",
      \"distance\": 5000,
      \"duration\": 1200
    }")

  if echo "$trip_result" | jq -e '.success == true' >/dev/null 2>&1; then
      local trip_id points total_points tx_hash
      trip_id=$(echo "$trip_result" | jq -r '.data.tripId')
      points=$(echo "$trip_result" | jq -r '.data.pointsEarned')
      total_points=$(echo "$trip_result" | jq -r '.data.totalPoints')
      tx_hash=$(echo "$trip_result" | jq -r '.data.txHash')

      echo -e "${GREEN}✓ ${label} recorded successfully${NC}"
      echo "  tripId       : $trip_id"
      echo "  pointsEarned : $points"
      echo "  totalPoints  : $total_points"
      echo "  txHash       : $tx_hash"
  else
      echo -e "${RED}✗ ${label} submission failed${NC}"
      echo "$trip_result"
      exit 1
  fi
  echo ""
}

submit_trip "Trip #1"
submit_trip "Trip #2"

# ============================================
# Test 6: Points Balance (Phase 2)
# ============================================
echo "Test 6: Get Points Balance (Phase 2 - Balance & Tier)"
echo "-----------------------------------------------------"
balance_result=$(curl -s "${API_URL}/api/points/balance/${WALLET}")

if echo "$balance_result" | jq -e '.success == true' >/dev/null 2>&1; then
    balance=$(echo "$balance_result" | jq -r '.data.balance')
    tier=$(echo "$balance_result" | jq -r '.data.tier')
    progress=$(echo "$balance_result" | jq -r '.data.tierProgress.progress')
    echo -e "${GREEN}✓ On-chain balance: ${balance} points (tier: ${tier}, progress: ${progress}% )${NC}"
else
    echo -e "${RED}✗ Failed to fetch points balance${NC}"
    echo "$balance_result"
    exit 1
fi
echo ""

# ============================================
# Test 7: Trip History & Verification (Phase 2)
# ============================================
echo "Test 7: Trip History & Verification"
echo "-----------------------------------"
history_result=$(curl -s "${API_URL}/api/trips/history/${WALLET}?limit=5")

if echo "$history_result" | jq -e '.success == true' >/dev/null 2>&1; then
    count=$(echo "$history_result" | jq -r '.data.count')
    echo -e "${GREEN}✓ Retrieved ${count} trips from database${NC}"

    # Show the most recent trip
    echo "Most recent trip:"
    echo "$history_result" | jq '.data.trips[0]'

    trip_hash=$(echo "$history_result" | jq -r '.data.trips[0].trip_hash // empty')
    if [ -n "$trip_hash" ]; then
        verify_result=$(curl -s "${API_URL}/api/trips/verify/${trip_hash}")
        if echo "$verify_result" | jq -e '.success == true and .data.verified == true' >/dev/null 2>&1; then
            echo -e "${GREEN}✓ Trip hash verified on-chain and found in DB${NC}"
        else
            echo -e "${RED}✗ Trip verification failed${NC}"
            echo "$verify_result"
            exit 1
        fi
    else
        echo -e "${YELLOW}! No trip_hash found in first trip record; skipping on-chain verification${NC}"
    fi
else
    echo -e "${RED}✗ Failed to fetch trip history${NC}"
    echo "$history_result"
    exit 1
fi
echo ""

# ============================================
# Test 8: User Summary (Phase 2/3)
# ============================================
echo "Test 8: User Summary"
echo "--------------------"
summary_result=$(curl -s "${API_URL}/api/users/summary/${WALLET}")

if echo "$summary_result" | jq -e '.success == true' >/dev/null 2>&1; then
    echo -e "${GREEN}✓ User summary fetched successfully${NC}"
    echo "$summary_result" | jq '.data | {wallet, points, activity, environmental}'
else
    echo -e "${RED}✗ Failed to fetch user summary${NC}"
    echo "$summary_result"
    exit 1
fi
echo ""

# ============================================
# Test 9: Reward Redemption (Phase 3)
# ============================================
echo "Test 9: Reward Redemption (Phase 3)"
echo "-----------------------------------"
redeem_result=$(curl -s -X POST "${API_URL}/api/rewards/redeem" \
  -H "Content-Type: application/json" \
  -d "{
    \"walletAddress\": \"${WALLET}\",
    \"rewardId\": \"COFFEE_VOUCHER\"
  }")

if echo "$redeem_result" | jq -e '.success == true' >/dev/null 2>&1; then
    new_balance=$(echo "$redeem_result" | jq -r '.data.newBalance')
    tx_hash=$(echo "$redeem_result" | jq -r '.data.txHash')
    echo -e "${GREEN}✓ Reward redeemed successfully${NC}"
    echo "  rewardId   : COFFEE_VOUCHER"
    echo "  newBalance : ${new_balance}"
    echo "  txHash     : ${tx_hash}"
else
    echo -e "${YELLOW}! Reward redemption failed or not allowed${NC}"
    echo "$redeem_result" | jq
    echo "This might be because there are still not enough points on-chain."
fi
echo ""

# ============================================
# Test 10: Reward Redemption History
# ============================================
echo "Test 10: Reward Redemption History"
echo "----------------------------------"
redemption_history=$(curl -s "${API_URL}/api/rewards/history/${WALLET}?limit=10")

if echo "$redemption_history" | jq -e '.success == true' >/dev/null 2>&1; then
    count=$(echo "$redemption_history" | jq -r '.data.count')
    echo -e "${GREEN}✓ Retrieved ${count} redemptions from database${NC}"
    echo "$redemption_history" | jq '.data.redemptions'
else
    echo -e "${RED}✗ Failed to fetch redemption history${NC}"
    echo "$redemption_history"
    exit 1
fi
echo ""

# ============================================
# Test 11: System Stats & Daily Analytics
# ============================================
echo "Test 11: System Stats & Daily Analytics"
echo "--------------------------------------"
stats_result=$(curl -s "${API_URL}/api/system/stats")
daily_result=$(curl -s "${API_URL}/api/system/daily?days=7")

if echo "$stats_result" | jq -e '.success == true' >/dev/null 2>&1; then
    echo -e "${GREEN}✓ System stats fetched${NC}"
    echo "$stats_result" | jq '.data'
else
    echo -e "${RED}✗ Failed to fetch system stats${NC}"
    echo "$stats_result"
fi

if echo "$daily_result" | jq -e '.success == true' >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Daily stats fetched${NC}"
    echo "$daily_result" | jq '.data'
else
    echo -e "${RED}✗ Failed to fetch daily stats${NC}"
    echo "$daily_result"
fi

echo ""
echo -e "${GREEN}🎉 Complete System Test finished.${NC}"
