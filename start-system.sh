#!/bin/bash

# CO2Go Reward System - Quick Start Script
# This script helps you start all necessary services

echo "🌍 CO2Go Reward System - Starting Services"
echo "==========================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please create .env file with:"
    echo "  DB_HOST=localhost"
    echo "  DB_PORT=5432"
    echo "  DB_NAME=reward_system"
    echo "  DB_USER=postgres"
    echo "  DB_PASSWORD=your_password"
    echo "  RPC_URL=http://localhost:8545"
    echo "  BACKEND_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    echo "  CONTRACT_ADDRESS=(will be set after deploy)"
    exit 1
fi

echo "✅ .env file found"
echo ""

# Function to check if a port is in use
check_port() {
    if command -v lsof > /dev/null 2>&1; then
        lsof -i:$1 > /dev/null 2>&1
        return $?
    elif command -v ss > /dev/null 2>&1; then
        ss -ltn | grep -q ":$1 "
        return $?
    elif command -v netstat > /dev/null 2>&1; then
        netstat -ltn | grep -q ":$1 "
        return $?
    else
        echo "⚠️  Warning: Could not check port $1. Please install 'lsof', 'ss', or 'netstat'."
        return 2
    fi
}

echo "📋 Service Status Check:"
echo ""

# Check Hardhat node (port 8545)
if check_port 8545; then
    echo "✅ Hardhat node is running (port 8545)"
else
    echo "❌ Hardhat node not running. Start it with: pnpm run node"
    echo "   Run in a separate terminal"
fi

# Check Backend (port 3000)
if check_port 3000; then
    echo "✅ Backend server is running (port 3000)"
else
    echo "❌ Backend server not running. Start it with: pnpm run server"
    echo "   Run in a separate terminal after deploying contract"
fi

# Check Frontend (port 5173)
if check_port 5173; then
    echo "✅ Frontend dev server is running (port 5173)"
else
    echo "❌ Frontend not running. Start it with: cd frontend && npm run dev"
    echo "   Run in a separate terminal"
fi

echo ""
echo "📝 Deployment Status:"

# Check if contract is deployed
if [ -f deployments/localhost.json ]; then
    CONTRACT_ADDR=$(grep -o '"contractAddress": "[^"]*' deployments/localhost.json | sed 's/"contractAddress": "//')
    echo "✅ Contract deployed at: $CONTRACT_ADDR"
    
    # Check if .env has correct contract address
    ENV_CONTRACT=$(grep CONTRACT_ADDRESS .env | cut -d '=' -f2)
    if [ "$ENV_CONTRACT" == "$CONTRACT_ADDR" ]; then
        echo "✅ .env CONTRACT_ADDRESS matches deployment"
    else
        echo "⚠️  .env CONTRACT_ADDRESS doesn't match deployment"
        echo "   Update .env with: CONTRACT_ADDRESS=$CONTRACT_ADDR"
    fi
else
    echo "❌ Contract not deployed. Deploy with: pnpm run deploy:local"
    echo "   Make sure Hardhat node is running first"
fi

echo ""
echo "🚀 Quick Start Commands:"
echo ""
echo "Terminal 1: pnpm run node          # Start Hardhat node"
echo "Terminal 2: pnpm run deploy:local  # Deploy contract"
echo "Terminal 3: pnpm run server        # Start backend"
echo "Terminal 4: cd frontend && npm run dev  # Start UI"
echo ""
echo "Then open: http://localhost:5173"
echo ""

# Offer to open browser if everything is running
if check_port 8545 && check_port 3000 && check_port 5173; then
    echo "✅ All services are running!"
    echo ""
    read -p "Open UI in browser? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if command -v xdg-open > /dev/null; then
            xdg-open http://localhost:5173
        elif command -v open > /dev/null; then
            open http://localhost:5173
        else
            echo "Please open http://localhost:5173 in your browser"
        fi
    fi
fi
