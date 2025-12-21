/**
 * Script to add missing rewards to the deployed RewardSystem contract
 * Run with: npx hardhat run scripts/add-rewards-to-contract.js --network amoy
 */
const hre = require("hardhat");

// Contract address on Polygon Amoy
const CONTRACT_ADDRESS = "0x95DdD90C8DA187D146518c2cf97F2b516F18e602";

// Minimal ABI for addReward function
const REWARD_SYSTEM_ABI = [
  "function addReward(string memory _rewardId, string memory _name, uint256 _pointsCost) external",
  "function getReward(string memory _rewardId) external view returns (tuple(string rewardId, string name, uint256 pointsCost, bool active))",
  "function owner() external view returns (address)",
  "event RewardAdded(string rewardId, string name, uint256 pointsCost)"
];

// Rewards to add (matching Firebase database vouchers)
const REWARDS_TO_ADD = [
  { id: "COFFEE_10", name: "10% Off Coffee", pointsCost: 50 },
  { id: "GRAB_RIDE", name: "Free GrabBike Ride", pointsCost: 100 },
  { id: "CINEMA_TICKET", name: "Movie Ticket", pointsCost: 200 }
];

async function main() {
  console.log("🎯 Adding Missing Rewards to RewardSystem Contract\n");
  console.log("📍 Contract:", CONTRACT_ADDRESS);
  console.log("🌐 Network:", hre.network.name);
  
  // Get signer
  const [signer] = await hre.ethers.getSigners();
  console.log("🔑 Signer:", signer.address);
  
  // Check balance
  const balance = await signer.provider.getBalance(signer.address);
  console.log("💰 Balance:", hre.ethers.formatEther(balance), "MATIC\n");
  
  // Connect to contract
  const contract = new hre.ethers.Contract(CONTRACT_ADDRESS, REWARD_SYSTEM_ABI, signer);
  
  // Verify owner
  const owner = await contract.owner();
  console.log("👤 Contract Owner:", owner);
  
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    console.error("❌ ERROR: Your wallet is not the contract owner!");
    console.error("   Only the owner can add rewards.");
    console.error("   Owner:", owner);
    console.error("   Your wallet:", signer.address);
    process.exit(1);
  }
  
  console.log("✅ You are the contract owner!\n");
  
  // Add each reward
  for (const reward of REWARDS_TO_ADD) {
    console.log(`📦 Adding reward: ${reward.id}...`);
    
    // Check if reward already exists
    try {
      const existing = await contract.getReward(reward.id);
      if (existing.rewardId && existing.rewardId.length > 0 && existing.active) {
        console.log(`   ⏭️  Reward ${reward.id} already exists, skipping.`);
        continue;
      }
    } catch (e) {
      // Reward doesn't exist, continue to add
    }
    
    try {
      // Set gas price to 35 gwei for Polygon Amoy
      const gasPrice = hre.ethers.parseUnits("35", "gwei");
      
      const tx = await contract.addReward(
        reward.id,
        reward.name,
        reward.pointsCost,
        { gasPrice }
      );
      
      console.log(`   ⏳ Transaction sent: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);
      console.log(`   🔗 https://amoy.polygonscan.com/tx/${tx.hash}\n`);
      
    } catch (error) {
      console.error(`   ❌ Failed to add ${reward.id}:`, error.message);
    }
  }
  
  // Verify all rewards
  console.log("📋 Verifying all rewards:\n");
  const allRewards = [...REWARDS_TO_ADD, 
    { id: "COFFEE_VOUCHER" },
    { id: "BUS_TICKET" },
    { id: "TREE_PLANT" },
    { id: "BIKE_RENTAL" }
  ];
  
  for (const r of allRewards) {
    try {
      const reward = await contract.getReward(r.id);
      console.log(`   ✅ ${r.id}: ${reward.name} (${reward.pointsCost} pts) - Active: ${reward.active}`);
    } catch (e) {
      console.log(`   ❌ ${r.id}: Not found`);
    }
  }
  
  console.log("\n✨ Done! Rewards have been added to the blockchain.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
