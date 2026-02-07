const hre = require("hardhat");

/**
 * Verify CO2GoToken deployment on Amoy
 * This checks that your token contract is working correctly
 */

async function main() {
  console.log("🔍 Verifying CO2GoToken on Amoy Testnet\n");
  console.log("=" .repeat(60));

  // Get account
  const [deployer] = await hre.ethers.getSigners();
  console.log("👤 Your Account:", deployer.address);

  // Token address from PolygonScan
  const tokenAddress = "0x3bf9bd06C9053FB389ee8937A2F8aD1a50618b2d";
  console.log("🪙 Token Address:", tokenAddress);
  console.log("🔗 PolygonScan:", `https://amoy.polygonscan.com/address/${tokenAddress}`);

  console.log("\n" + "=".repeat(60));
  console.log("Connecting to Contract...");
  console.log("=".repeat(60));

  try {
    // Connect to the token contract
    const token = await hre.ethers.getContractAt("CO2GoToken", tokenAddress);

    // Get token info
    console.log("\n📊 Token Information:");
    const name = await token.name();
    const symbol = await token.symbol();
    const decimals = await token.decimals();
    const totalSupply = await token.totalSupply();
    const owner = await token.owner();

    console.log("- Name:", name);
    console.log("- Symbol:", symbol);
    console.log("- Decimals:", decimals);
    console.log("- Total Supply:", hre.ethers.formatUnits(totalSupply, decimals), symbol);
    console.log("- Owner:", owner);

    // Check your balance
    console.log("\n💰 Your Balance:");
    const balance = await token.balanceOf(deployer.address);
    const formattedBalance = hre.ethers.formatUnits(balance, decimals);
    console.log(`- ${formattedBalance} ${symbol}`);

    // Check if you're a minter
    console.log("\n🔑 Minter Status:");
    const isMinter = await token.isMinter(deployer.address);
    console.log("- Are you a minter?", isMinter ? "✅ YES" : "❌ NO");

    if (!isMinter) {
      console.log("\n⚠️  WARNING: You are not a minter!");
      console.log("   This means you cannot mint more tokens.");
      console.log("   The owner needs to call: token.addMinter(yourAddress)");
    }

    // Verify ownership
    console.log("\n👑 Ownership:");
    if (owner.toLowerCase() === deployer.address.toLowerCase()) {
      console.log("✅ You are the owner! You can:");
      console.log("   - Add minters");
      console.log("   - Remove minters");
      console.log("   - Manage the contract");
    } else {
      console.log("❌ You are NOT the owner");
      console.log("   Owner is:", owner);
      console.log("   Your address:", deployer.address);
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ CONTRACT VERIFICATION SUCCESSFUL!");
    console.log("=".repeat(60));

    console.log("\n📋 Summary:");
    console.log(`✅ Token contract is deployed and working on Amoy`);
    console.log(`✅ You have ${formattedBalance} ${symbol}`);
    console.log(`${isMinter ? '✅' : '❌'} You are ${isMinter ? '' : 'NOT '}a minter`);
    console.log(`${owner.toLowerCase() === deployer.address.toLowerCase() ? '✅' : '❌'} You are ${owner.toLowerCase() === deployer.address.toLowerCase() ? '' : 'NOT '}the owner`);

    console.log("\n🎯 Next Steps:");
    if (isMinter) {
      console.log("1. ✅ Ready to deploy RewardSystem!");
      console.log("   Run: npx hardhat run scripts/deploy-reward-system-only.js --network amoy");
    } else {
      console.log("1. ⚠️  You need to be added as a minter first");
      if (owner.toLowerCase() === deployer.address.toLowerCase()) {
        console.log("   Run: npx hardhat console --network amoy");
        console.log("   Then: await token.addMinter(deployer.address)");
      } else {
        console.log("   Contact the owner to add you as a minter");
      }
    }

  } catch (error) {
    console.error("\n❌ VERIFICATION FAILED!");
    console.error("Error:", error.message);
    
    if (error.message.includes("INVALID_ARGUMENT")) {
      console.log("\n💡 Possible causes:");
      console.log("   - Token address is incorrect");
      console.log("   - Contract not deployed on Amoy network");
      console.log("   - Network configuration issue");
    } else if (error.message.includes("call revert exception")) {
      console.log("\n💡 Possible causes:");
      console.log("   - Contract bytecode doesn't match CO2GoToken");
      console.log("   - Wrong contract address");
    }
    
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
