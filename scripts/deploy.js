const hre = require("hardhat");

async function main() {
  console.log("🚀 Starting deployment...\n");

  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("📝 Deploying contracts with account:", deployer.address);
  
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", hre.ethers.formatEther(balance), "ETH\n");

  // ============================================
  // STEP 1: Deploy CO2GoToken
  // ============================================
  console.log("📦 Deploying CO2GoToken contract...");
  const CO2GoToken = await hre.ethers.getContractFactory("CO2GoToken");
  const token = await CO2GoToken.deploy();
  
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  
  console.log("✅ CO2GoToken deployed to:", tokenAddress);
  console.log("🔗 Transaction hash:", token.deploymentTransaction().hash);

  // ============================================
  // STEP 2: Deploy RewardSystem with token address
  // ============================================
  console.log("\n📦 Deploying RewardSystem contract...");
  const RewardSystem = await hre.ethers.getContractFactory("RewardSystem");
  const rewardSystem = await RewardSystem.deploy(tokenAddress);
  
  await rewardSystem.waitForDeployment();
  const contractAddress = await rewardSystem.getAddress();
  
  console.log("✅ RewardSystem deployed to:", contractAddress);
  console.log("🔗 Transaction hash:", rewardSystem.deploymentTransaction().hash);
  
  // ============================================
  // STEP 3: Grant minter role to RewardSystem
  // ============================================
  console.log("\n🔑 Granting minter role to RewardSystem...");
  const tx = await token.addMinter(contractAddress);
  await tx.wait();
  console.log("✅ RewardSystem can now mint tokens!");
  
  // Wait for block confirmations (skip on local networks)
  if (["hardhat", "localhost"].includes(hre.network.name)) {
    console.log("\n⏭️  Skipping block confirmations on local network.");
  } else {
    console.log("\n⏳ Waiting for block confirmations...");
    const receipt = await rewardSystem.deploymentTransaction().wait(3);
    if (receipt && receipt.status === 1) {
      console.log("✅ Confirmed!");
    } else {
      console.log("⚠️  Confirmation received but status unknown");
    }
  }

  // Verify initial state
  console.log("\n📊 Verifying initial contract state:");
  const totalTrips = await rewardSystem.totalTrips();
  const totalRedemptions = await rewardSystem.totalRedemptions();
  const owner = await rewardSystem.owner();
  const tokenAddressFromContract = await rewardSystem.getTokenAddress();
  
  console.log("- Owner:", owner);
  console.log("- Token Address:", tokenAddressFromContract);
  console.log("- Total Trips:", totalTrips.toString());
  console.log("- Total Redemptions:", totalRedemptions.toString());
  
  // Check token info
  const tokenName = await token.name();
  const tokenSymbol = await token.symbol();
  const tokenDecimals = await token.decimals();
  const ownerBalance = await token.balanceOf(deployer.address);
  
  console.log("\n💰 Token Info:");
  console.log("- Name:", tokenName);
  console.log("- Symbol:", tokenSymbol);
  console.log("- Decimals:", tokenDecimals);
  console.log("- Owner Balance:", hre.ethers.formatUnits(ownerBalance, tokenDecimals), tokenSymbol);
  
  // Check default rewards
  console.log("\n🎁 Checking default rewards:");
  const rewards = ["COFFEE_VOUCHER", "BUS_TICKET", "TREE_PLANT", "BIKE_RENTAL"];
  for (const rewardId of rewards) {
    const reward = await rewardSystem.getReward(rewardId);
    console.log(`- ${rewardId}: ${reward.name} (${reward.pointsCost} points)`);
  }

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    tokenAddress: tokenAddress,
    tokenName: tokenName,
    tokenSymbol: tokenSymbol,
    contractAddress: contractAddress,
    deployer: deployer.address,
    blockNumber: rewardSystem.deploymentTransaction().blockNumber,
    timestamp: new Date().toISOString(),
  };

  console.log("\n📄 Deployment Summary:");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Save to file
  const fs = require("fs");
  const deploymentPath = `./deployments/${hre.network.name}.json`;
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
    console.log(`npx hardhat verify --network ${hre.network.name} ${tokenAddress}`);
    console.log(`npx hardhat verify --network ${hre.network.name} ${contractAddress} ${tokenAddress}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });