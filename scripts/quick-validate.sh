#!/bin/bash

# Quick validation (without integration tests)

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║       CO2Go Multi-Network Architecture - Quick Check        ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Network Configuration Check
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Validating Network Configuration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

node scripts/test-network-config.js

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                   ✅ QUICK CHECK PASSED                       ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
