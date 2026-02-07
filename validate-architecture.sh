#!/bin/bash

# Multi-Network Architecture Validation Suite
# Runs all checks to ensure system integrity

set -e  # Exit on any error

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║       CO2Go Multi-Network Architecture Validation           ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Network Separation Tests
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Step 1: Running Network Separation Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

pnpm hardhat test test/NetworkSeparation.test.js

echo ""
echo -e "${GREEN}✅ Network Separation Tests: PASSED${NC}"
echo ""

# Step 2: Configuration Validation
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Step 2: Validating Network Configuration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

node scripts/test-network-config.js

echo ""
echo -e "${GREEN}✅ Configuration Validation: PASSED${NC}"
echo ""

# Step 3: Contract Integration Tests
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Step 3: Running Integration Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

pnpm hardhat test test/Integration.test.js

echo ""
echo -e "${GREEN}✅ Integration Tests: PASSED${NC}"
echo ""

# Summary
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                   ✅ ALL VALIDATIONS PASSED                   ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "🎉 Multi-Network Architecture is working correctly!"
echo ""
echo "📌 Current Deployment Status:"
echo "   ✅ Hardhat Local (31337): Deployed and configured"
echo "   ⏳ Polygon Amoy (80002): Ready to deploy"
echo ""
echo "🚀 Next Steps:"
echo "   1. Deploy to Polygon Amoy: pnpm run deploy:amoy"
echo "   2. Update CONTRACT_ADDRESSES[80002] in frontend/src/config/networks.js"
echo "   3. Re-run this validation: ./validate-architecture.sh"
echo "   4. Test frontend: cd frontend && pnpm dev"
echo ""
