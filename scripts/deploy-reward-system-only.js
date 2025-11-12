const hre = require("hardhat");

/**
 * Complete the deployment by deploying only the RewardSystem contract
 * Use this when CO2GoToken is already deployed but RewardSystem failed
 * 
 * Usage:
 * npx hardhat run scripts/deploy-reward-system-only.js --network amoy
 */

async function main() {
  console.log("🚀 Completing RewardSystem Deployment...\n");

  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("📝 Deploying with account:", deployer.address);
  
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", hre.ethers.formatEther(balance), "POL\n");

  // Check if we have enough balance
  // Updated: More conservative estimate based on actual gas costs
  const minBalance = hre.ethers.parseEther("0.01"); // Minimum 0.01 POL
  const recommendedBalance = hre.ethers.parseEther("0.05"); // Recommended 0.05 POL
  
  if (balance < minBalance) {
    console.error("❌ Error: Insufficient POL balance for deployment");
    console.log("   Current:", hre.ethers.formatEther(balance), "POL");
    console.log("   Minimum needed: ~0.01 POL");
    console.log("   Recommended: ~0.05 POL");
    console.log("\n💡 Quick ways to get POL:");
    console.log("   🥇 Alchemy Faucet (0.5 POL): https://www.alchemy.com/faucets/polygon-amoy");
    console.log("   🥈 Chainlink Faucet (0.5 POL): https://faucets.chain.link/polygon-amoy");
    console.log("   🥉 Polygon Faucet (0.1 POL): https://faucet.polygon.technology/");
    console.log("\n📖 See POLYGON_FAUCET_LIST.md for more faucets!");
    process.exit(1);
  }
  
  if (balance < recommendedBalance) {
    console.warn("⚠️  Warning: Low POL balance");
    console.log("   Current:", hre.ethers.formatEther(balance), "POL");
    console.log("   This might be enough, but deployment could fail");
    console.log("   Recommended: Get more POL from multiple faucets");
    console.log("\n❓ Continue anyway? (Ctrl+C to cancel, or wait 5 seconds to proceed)");
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log("   ▶️  Proceeding with deployment...\n");
  }

  // Load token address from deployment file
  const fs = require("fs");
  const deploymentPath = `./deployments/${hre.network.name}.json`;
  
  let tokenAddress;
  if (fs.existsSync(deploymentPath)) {
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    tokenAddress = deployment.tokenAddress;
    console.log("📄 Found existing CO2GoToken deployment:", tokenAddress);
    
    // Verify token contract exists
    const token = await hre.ethers.getContractAt("CO2GoToken", tokenAddress);
    const name = await token.name();
    const symbol = await token.symbol();
    console.log(`✅ Verified: ${name} (${symbol})\n`);
  } else {
    console.error("❌ Error: No deployment file found");
    console.log("   Expected file:", deploymentPath);
    console.log("   Please deploy CO2GoToken first or provide TOKEN_ADDRESS");
    
    tokenAddress = process.env.TOKEN_ADDRESS;
    if (!tokenAddress) {
      console.log("\n💡 You can set TOKEN_ADDRESS environment variable:");
      console.log("   export TOKEN_ADDRESS=0x615D02b05A9c80fd76D1cF87D012b0CAcDF195DC");
      process.exit(1);
    }
    console.log("📝 Using TOKEN_ADDRESS from environment:", tokenAddress);
  }

  // ============================================
  // Deploy RewardSystem with token address
  // ============================================
  console.log("📦 Deploying RewardSystem contract...");
  const RewardSystem = await hre.ethers.getContractFactory("RewardSystem");
  const rewardSystem = await RewardSystem.deploy(tokenAddress);
  
  await rewardSystem.waitForDeployment();
  const contractAddress = await rewardSystem.getAddress();
  
  console.log("✅ RewardSystem deployed to:", contractAddress);
  console.log("🔗 Transaction hash:", rewardSystem.deploymentTransaction().hash);
  
  // ============================================
  // Grant minter role to RewardSystem
  // ============================================
  console.log("\n🔑 Granting minter role to RewardSystem...");
  const token = await hre.ethers.getContractAt("CO2GoToken", tokenAddress);
  const tx = await token.addMinter(contractAddress);
  await tx.wait();
  console.log("✅ RewardSystem can now mint tokens!");
  
  // Verify setup
  console.log("\n📊 Verifying deployment:");
  const totalTrips = await rewardSystem.totalTrips();
  const owner = await rewardSystem.owner();
  const tokenAddressFromContract = await rewardSystem.getTokenAddress();
  
  console.log("- Owner:", owner);
  console.log("- Token Address:", tokenAddressFromContract);
  console.log("- Total Trips:", totalTrips.toString());
  
  // Check default rewards
  console.log("\n🎁 Default rewards:");
  const rewards = ["COFFEE_VOUCHER", "BUS_TICKET", "TREE_PLANT", "BIKE_RENTAL"];
  for (const rewardId of rewards) {
    const reward = await rewardSystem.getReward(rewardId);
    console.log(`- ${rewardId}: ${reward.name} (${reward.pointsCost} points)`);
  }

  // Update deployment info
  let deploymentInfo;
  if (fs.existsSync(deploymentPath)) {
    deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    deploymentInfo.contractAddress = contractAddress;
    deploymentInfo.rewardSystemDeployed = new Date().toISOString();
  } else {
    deploymentInfo = {
      network: hre.network.name,
      tokenAddress: tokenAddress,
      contractAddress: contractAddress,
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
    };
  }

  fs.mkdirSync("./deployments", { recursive: true });
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\n💾 Deployment info saved to: ${deploymentPath}`);

  console.log("\n✨ Deployment completed successfully!");
  console.log("\n⚠️  IMPORTANT: Update your .env file with:");
  console.log(`CONTRACT_ADDRESS=${contractAddress}`);
  console.log(`TOKEN_ADDRESS=${tokenAddress}`);
  
  // Verification instructions
  if (!["hardhat", "localhost"].includes(hre.network.name)) {
    console.log("\n🔍 To verify on block explorer, run:");
    console.log(`npx hardhat verify --network ${hre.network.name} ${contractAddress} ${tokenAddress}`);
  }

  console.log("\n🎉 Your CO2Go system is now fully deployed!");
  console.log("\n📖 Next steps:");
  console.log("1. Run: npx hardhat run scripts/check-balances.js --network amoy");
  console.log("2. Mint test tokens: npx hardhat run scripts/mint-test-tokens.js --network amoy");
  console.log("3. Test the system: npx hardhat run scripts/test-token-rewards.js --network amoy");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
