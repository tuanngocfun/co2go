#!/bin/bash

# CO2Go System - Quick Start Script
# This script helps you complete your deployment and mint test tokens

echo "🚀 CO2Go System - Quick Start"
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check network argument
NETWORK=${1:-amoy}
echo "📍 Network: $NETWORK"
echo ""

# Step 1: Check balances
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 1: Checking your balances..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
npx hardhat run scripts/check-balances.js --network $NETWORK

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to check balances${NC}"
    exit 1
fi

echo ""
read -p "Do you have enough POL (>0.05) to continue? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}⚠️  Please get POL from: https://faucet.polygon.technology/${NC}"
    echo "Then run this script again."
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 2: Completing deployment (RewardSystem)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if deployment exists
if [ -f "deployments/$NETWORK.json" ]; then
    NEEDS_REWARD_SYSTEM=$(grep -q "contractAddress" deployments/$NETWORK.json && echo "no" || echo "yes")
    
    if [ "$NEEDS_REWARD_SYSTEM" = "yes" ]; then
        echo "📦 Deploying RewardSystem contract..."
        npx hardhat run scripts/deploy-reward-system-only.js --network $NETWORK
        
        if [ $? -ne 0 ]; then
            echo -e "${RED}❌ Deployment failed${NC}"
            exit 1
        fi
    else
        echo -e "${GREEN}✅ RewardSystem already deployed${NC}"
    fi
else
    echo "📦 Full deployment needed..."
    npx hardhat run scripts/deploy.js --network $NETWORK
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Deployment failed${NC}"
        exit 1
    fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 3: Minting test tokens..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "This will mint C2GP tokens to your test wallets."
echo ""
read -p "Do you want to mint test tokens now? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🪙 Minting tokens..."
    npx hardhat run scripts/mint-test-tokens.js --network $NETWORK
    
    if [ $? -ne 0 ]; then
        echo -e "${YELLOW}⚠️  Minting failed. You can do this later.${NC}"
    fi
else
    echo "⏭️  Skipped. You can mint later with:"
    echo "   npx hardhat run scripts/mint-test-tokens.js --network $NETWORK"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✨ Setup Complete!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 What's deployed:"

if [ -f "deployments/$NETWORK.json" ]; then
    TOKEN_ADDR=$(grep -o '"tokenAddress": *"[^"]*"' deployments/$NETWORK.json | grep -o '0x[^"]*')
    CONTRACT_ADDR=$(grep -o '"contractAddress": *"[^"]*"' deployments/$NETWORK.json | grep -o '0x[^"]*')
    
    echo "   🪙 CO2GoToken: $TOKEN_ADDR"
    echo "   🎁 RewardSystem: $CONTRACT_ADDR"
fi

echo ""
echo "🎯 Next steps:"
echo "   1. Update .env with contract addresses"
echo "   2. Test the system: npx hardhat run scripts/test-token-rewards.js --network $NETWORK"
echo "   3. Start frontend: cd frontend && npm run dev"
echo ""
echo "📚 For more info, see: MINTING_GUIDE.md"
echo ""
