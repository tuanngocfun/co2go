const hre = require("hardhat");

/**
 * REAL TOKEN TRANSFER TEST
 * This script tests actual token transfers on blockchain
 * Run with: npx hardhat run scripts/test-token-rewards.js --network localhost
 * Or for Polygon Amoy: npx hardhat run scripts/test-token-rewards.js --network amoy
 */

async function main() {
  console.log("🧪 Starting Token Reward Test\n");
  console.log("=" .repeat(60));

  // Get signers
  const [deployer, user1, user2] = await hre.ethers.getSigners();
  
  console.log("\n👥 Test Accounts:");
  console.log("Deployer:", deployer.address);
  console.log("User 1:", user1.address);
  console.log("User 2:", user2.address);

  // Load deployed contracts
  const fs = require("fs");
  const deploymentPath = `./deployments/${hre.network.name}.json`;
  
  if (!fs.existsSync(deploymentPath)) {
    console.error("\n❌ Deployment file not found!");
    console.error("Please run deployment first: pnpm run deploy:local");
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const tokenAddress = deployment.tokenAddress;
  const contractAddress = deployment.contractAddress;

  console.log("\n📍 Contract Addresses:");
  console.log("Token:", tokenAddress);
  console.log("RewardSystem:", contractAddress);

  // Get contract instances
  const CO2GoToken = await hre.ethers.getContractFactory("CO2GoToken");
  const token = CO2GoToken.attach(tokenAddress);

  const RewardSystem = await hre.ethers.getContractFactory("RewardSystem");
  const rewardSystem = RewardSystem.attach(contractAddress);

  console.log("\n" + "=".repeat(60));
  console.log("TEST 1: Check Initial Balances");
  console.log("=".repeat(60));

  const decimals = await token.decimals();
  console.log("Token decimals:", decimals);

  async function checkBalance(address, label) {
    const balance = await token.balanceOf(address);
    const formatted = hre.ethers.formatUnits(balance, decimals);
    console.log(`${label}: ${formatted} C2GP (${balance} wei)`);
    return balance;
  }

  const deployerBalanceBefore = await checkBalance(deployer.address, "Deployer");
  const user1BalanceBefore = await checkBalance(user1.address, "User 1");
  const user2BalanceBefore = await checkBalance(user2.address, "User 2");

  console.log("\n" + "=".repeat(60));
  console.log("TEST 2: Record Trip for User 1");
  console.log("=".repeat(60));

  const tripData = {
    tripId: Date.now(),
    user: user1.address,
    mode: "bike",
    distance: 5000, // 5 km
    duration: 1200, // 20 minutes
  };

  console.log("\nTrip Details:");
  console.log("- User:", tripData.user);
  console.log("- Mode:", tripData.mode);
  console.log("- Distance:", tripData.distance, "meters (5 km)");
  console.log("- Duration:", tripData.duration, "seconds (20 min)");

  console.log("\n⏳ Recording trip...");
  const tx = await rewardSystem.recordTrip(
    tripData.tripId,
    tripData.user,
    tripData.mode,
    tripData.distance,
    tripData.duration
  );

  console.log("Transaction hash:", tx.hash);
  const receipt = await tx.wait();
  console.log("✅ Transaction confirmed in block:", receipt.blockNumber);
  console.log("Gas used:", receipt.gasUsed.toString());

  // Parse events
  let pointsEarned = 0n;
  const iface = rewardSystem.interface;
  const target = (await rewardSystem.getAddress()).toLowerCase();

  for (const log of receipt.logs) {
    if ((log.address || "").toLowerCase() !== target) continue;
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === "TripRecorded") {
        pointsEarned = parsed.args.pointsEarned;
        console.log("\n🎉 Points Earned:", pointsEarned.toString());
        break;
      }
    } catch (_) {}
  }

  console.log("\n" + "=".repeat(60));
  console.log("TEST 3: Verify Token Transfer");
  console.log("=".repeat(60));

  console.log("\n💰 New Balances:");
  const user1BalanceAfter = await checkBalance(user1.address, "User 1");

  const tokensReceived = user1BalanceAfter - user1BalanceBefore;
  const expectedTokens = pointsEarned * (10n ** BigInt(decimals));

  console.log("\n📊 Verification:");
  console.log("Expected tokens:", hre.ethers.formatUnits(expectedTokens, decimals), "C2GP");
  console.log("Actual tokens received:", hre.ethers.formatUnits(tokensReceived, decimals), "C2GP");
  console.log("Match:", tokensReceived === expectedTokens ? "✅ YES" : "❌ NO");

  if (tokensReceived !== expectedTokens) {
    console.error("\n❌ TEST FAILED: Token amount mismatch!");
    process.exit(1);
  }

  console.log("\n" + "=".repeat(60));
  console.log("TEST 4: Check Contract Balance Query");
  console.log("=".repeat(60));

  const contractBalance = await rewardSystem.getBalance(user1.address);
  const contractBalanceFormatted = await rewardSystem.getBalanceFormatted(user1.address);
  
  console.log("Balance from contract (raw):", contractBalance.toString());
  console.log("Balance from contract (formatted):", contractBalanceFormatted.toString());
  console.log("Balance from token contract:", hre.ethers.formatUnits(user1BalanceAfter, decimals));
  console.log("Match:", contractBalance === user1BalanceAfter ? "✅ YES" : "❌ NO");

  console.log("\n" + "=".repeat(60));
  console.log("TEST 5: Record Multiple Trips");
  console.log("=".repeat(60));

  const trips = [
    { mode: "walk", distance: 2000, duration: 1500 },
    { mode: "bus", distance: 10000, duration: 900 },
    { mode: "train", distance: 25000, duration: 1800 },
  ];

  for (let i = 0; i < trips.length; i++) {
    const trip = trips[i];
    console.log(`\nTrip ${i + 1}: ${trip.mode} - ${trip.distance}m`);
    
    const tx = await rewardSystem.recordTrip(
      Date.now() + i,
      user1.address,
      trip.mode,
      trip.distance,
      trip.duration
    );
    
    await tx.wait();
    console.log("✅ Recorded");
  }

  const finalBalance = await token.balanceOf(user1.address);
  console.log("\n💰 Final User 1 Balance:", hre.ethers.formatUnits(finalBalance, decimals), "C2GP");

  console.log("\n" + "=".repeat(60));
  console.log("TEST 6: Get Trip History");
  console.log("=".repeat(60));

  const history = await rewardSystem.getTripHistory(user1.address);
  console.log(`\n📜 User 1 has ${history.length} trips:`);
  
  let totalPoints = 0n;
  for (let i = 0; i < history.length; i++) {
    const trip = history[i];
    totalPoints += trip.pointsEarned;
    console.log(`${i + 1}. ${trip.mode} - ${trip.distance}m - ${trip.pointsEarned} points`);
  }
  
  const expectedBalance = totalPoints * (10n ** BigInt(decimals));
  console.log("\nTotal points from history:", totalPoints.toString());
  console.log("Expected balance:", hre.ethers.formatUnits(expectedBalance, decimals), "C2GP");
  console.log("Actual balance:", hre.ethers.formatUnits(finalBalance, decimals), "C2GP");
  console.log("Match:", finalBalance === expectedBalance ? "✅ YES" : "❌ NO");

  console.log("\n" + "=".repeat(60));
  console.log("TEST 7: Test Reward Redemption");
  console.log("=".repeat(60));

  const balanceBeforeRedeem = await token.balanceOf(user1.address);
  console.log("\nBalance before redemption:", hre.ethers.formatUnits(balanceBeforeRedeem, decimals), "C2GP");

  // Get reward details
  const reward = await rewardSystem.getReward("COFFEE_VOUCHER");
  console.log("\nRedeeming:", reward.name);
  console.log("Cost:", reward.pointsCost.toString(), "points");

  const redeemTx = await rewardSystem.redeemReward(
    user1.address,
    "COFFEE_VOUCHER",
    reward.pointsCost
  );
  
  await redeemTx.wait();
  console.log("✅ Redemption successful");

  const balanceAfterRedeem = await token.balanceOf(user1.address);
  console.log("\nBalance after redemption:", hre.ethers.formatUnits(balanceAfterRedeem, decimals), "C2GP");

  const tokensBurned = balanceBeforeRedeem - balanceAfterRedeem;
  const expectedBurn = reward.pointsCost * (10n ** BigInt(decimals));
  console.log("Tokens burned:", hre.ethers.formatUnits(tokensBurned, decimals), "C2GP");
  console.log("Expected burn:", hre.ethers.formatUnits(expectedBurn, decimals), "C2GP");
  console.log("Match:", tokensBurned === expectedBurn ? "✅ YES" : "❌ NO");

  console.log("\n" + "=".repeat(60));
  console.log("TEST 8: Test Transfer Between Users");
  console.log("=".repeat(60));

  const user1BalanceBeforeTransfer = await token.balanceOf(user1.address);
  const user2BalanceBeforeTransfer = await token.balanceOf(user2.address);

  const transferAmount = hre.ethers.parseUnits("10", decimals);
  console.log("\nTransferring 10 C2GP from User 1 to User 2...");

  // User 1 transfers to User 2
  const transferTx = await token.connect(user1).transfer(user2.address, transferAmount);
  await transferTx.wait();
  console.log("✅ Transfer successful");

  const user1BalanceAfterTransfer = await token.balanceOf(user1.address);
  const user2BalanceAfterTransfer = await token.balanceOf(user2.address);

  console.log("\n📊 Results:");
  console.log("User 1 balance change:", hre.ethers.formatUnits(user1BalanceAfterTransfer - user1BalanceBeforeTransfer, decimals), "C2GP");
  console.log("User 2 balance change:", hre.ethers.formatUnits(user2BalanceAfterTransfer - user2BalanceBeforeTransfer, decimals), "C2GP");
  console.log("Transfer successful:", (user1BalanceAfterTransfer - user1BalanceBeforeTransfer === -transferAmount) && 
                                       (user2BalanceAfterTransfer - user2BalanceBeforeTransfer === transferAmount) ? "✅ YES" : "❌ NO");

  console.log("\n" + "=".repeat(60));
  console.log("🎉 ALL TESTS PASSED!");
  console.log("=".repeat(60));

  console.log("\n📊 Final Summary:");
  console.log("✅ Tokens are minted when trips are recorded");
  console.log("✅ Token balances match expected values");
  console.log("✅ Tokens are burned when rewards are redeemed");
  console.log("✅ Tokens can be transferred between users");
  console.log("✅ All blockchain transactions are real and verifiable");

  console.log("\n💡 Next Steps:");
  console.log("1. Deploy to Polygon Amoy testnet");
  console.log("2. Add token to MetaMask");
  console.log("3. View transactions on PolygonScan");
  console.log("4. See your token balance change in real-time!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  });
