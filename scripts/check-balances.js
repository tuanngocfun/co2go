const hre = require("hardhat");

/**
 * Check POL and C2GP balances
 * Quick script to see your balances for testing
 * 
 * Usage:
 * npx hardhat run scripts/check-balances.js --network amoy
 * npx hardhat run scripts/check-balances.js --network localhost
 */

async function main() {
  console.log("🔍 Balance Checker\n");

  // Get account
  const [account] = await hre.ethers.getSigners();
  console.log("📍 Network:", hre.network.name);
  console.log("👤 Account:", account.address);
  console.log("━".repeat(60));

  // Check POL/ETH balance (native token)
  const nativeBalance = await account.provider.getBalance(account.address);
  const nativeName = hre.network.name === "polygon" || hre.network.name === "amoy" ? "POL" : "ETH";
  console.log(`\n💎 ${nativeName} Balance (Gas Token):`);
  console.log(`   ${hre.ethers.formatEther(nativeBalance)} ${nativeName}`);

  // Try to load token address
  const fs = require("fs");
  const deploymentPath = `./deployments/${hre.network.name}.json`;
  
  if (fs.existsSync(deploymentPath)) {
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    
    console.log(`\n🪙 C2GP Token Balance (Reward Token):`);
    
    try {
      const token = await hre.ethers.getContractAt("CO2GoToken", deployment.tokenAddress);
      const tokenBalance = await token.balanceOf(account.address);
      const decimals = await token.decimals();
      const formatted = hre.ethers.formatUnits(tokenBalance, decimals);
      const symbol = await token.symbol();
      
      console.log(`   ${formatted} ${symbol}`);
      console.log(`   Token Address: ${deployment.tokenAddress}`);
      
      // Check if account is a minter
      const isMinter = await token.isMinter(account.address);
      console.log(`   Is Minter: ${isMinter ? "✅ Yes" : "❌ No"}`);
      
    } catch (error) {
      console.log(`   ⚠️  Could not connect to token: ${error.message}`);
    }

    // Check if RewardSystem is deployed
    if (deployment.contractAddress) {
      console.log(`\n🎁 RewardSystem:`);
      console.log(`   Address: ${deployment.contractAddress}`);
      console.log(`   Status: ✅ Deployed`);
    } else {
      console.log(`\n⚠️  RewardSystem: Not deployed yet`);
    }
  } else {
    console.log(`\n⚠️  No deployment found for ${hre.network.name}`);
    console.log(`   Deploy contracts first: npx hardhat run scripts/deploy.js --network ${hre.network.name}`);
  }

  console.log("\n━".repeat(60));
  
  // Show what's needed
  const minPOL = hre.ethers.parseEther("0.1");
  if (nativeBalance < minPOL) {
    console.log(`\n⚠️  Low ${nativeName} balance!`);
    console.log(`   You have: ${hre.ethers.formatEther(nativeBalance)} ${nativeName}`);
    console.log(`   Recommended: 0.1 ${nativeName} or more`);
    console.log(`\n💡 Get free ${nativeName} from:`);
    if (hre.network.name === "amoy") {
      console.log(`   - https://faucet.polygon.technology/`);
    }
  } else {
    console.log(`\n✅ You have enough ${nativeName} for gas fees!`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
