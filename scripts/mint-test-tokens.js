const hre = require("hardhat");

/**
 * Mint C2GP tokens for testing
 * This script allows you to mint as many C2GP tokens as you want to any address
 * Perfect for setting up test scenarios without waiting for faucets!
 * 
 * Usage:
 * npx hardhat run scripts/mint-test-tokens.js --network amoy
 * npx hardhat run scripts/mint-test-tokens.js --network localhost
 */

async function main() {
  console.log("🪙 CO2Go Token Minting Tool\n");

  // Get deployer account (must be the owner)
  const [deployer] = await hre.ethers.getSigners();
  console.log("👤 Using account:", deployer.address);
  
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("💰 POL Balance:", hre.ethers.formatEther(balance), "POL");

  // Load token address from deployment file
  const fs = require("fs");
  const deploymentPath = `./deployments/${hre.network.name}.json`;
  
  let tokenAddress;
  if (fs.existsSync(deploymentPath)) {
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    tokenAddress = deployment.tokenAddress;
    console.log("📄 Loaded token address from deployment:", tokenAddress);
  } else {
    // Fallback: ask user to provide token address
    console.log("⚠️  No deployment file found. Please provide token address manually.");
    console.log("You can find it in your previous deployment logs.\n");
    
    // For this example, we'll use a placeholder
    // In real usage, you would pass this as a command line argument
    tokenAddress = process.env.TOKEN_ADDRESS;
    if (!tokenAddress) {
      console.error("❌ Error: TOKEN_ADDRESS not found in environment variables");
      console.log("Please run: export TOKEN_ADDRESS=0x...");
      process.exit(1);
    }
  }

  console.log("\n🔗 Connecting to CO2GoToken at:", tokenAddress);
  const token = await hre.ethers.getContractAt("CO2GoToken", tokenAddress);

  // Verify connection
  const tokenName = await token.name();
  const tokenSymbol = await token.symbol();
  const decimals = await token.decimals();
  console.log(`✅ Connected to: ${tokenName} (${tokenSymbol})`);
  console.log(`📊 Decimals: ${decimals}\n`);

  // Check if deployer is owner and minter
  const owner = await token.owner();
  const isMinter = await token.isMinter(deployer.address);
  console.log("🔑 Owner:", owner);
  console.log("🔑 Is deployer a minter?", isMinter);

  if (!isMinter) {
    console.error("❌ Error: Deployer is not a minter. Only minters can mint tokens.");
    process.exit(1);
  }

  // ============================================
  // CONFIGURE YOUR MINTING HERE
  // ============================================
  
  // Test accounts to fund (add as many as you need!)
  const testAccounts = [
    {
      address: deployer.address, // Fund yourself first
      amount: 10000, // 10,000 C2GP tokens
      label: "Deployer (You)"
    },
    {
      address: "0x6f5Fc373dD472728D22D81Daf91F5169F8B726a8", // Your wallet from the logs
      amount: 50000, // 50,000 C2GP tokens
      label: "Your Test Wallet"
    },
    // Add more test accounts as needed:
    // {
    //   address: "0x...",
    //   amount: 5000,
    //   label: "Test User 1"
    // },
  ];

  console.log("\n💸 Minting Test Tokens...\n");

  for (const account of testAccounts) {
    try {
      // Convert to proper token amount with decimals
      const amount = hre.ethers.parseUnits(account.amount.toString(), decimals);
      
      console.log(`📤 Minting ${account.amount} ${tokenSymbol} to ${account.label}...`);
      console.log(`   Address: ${account.address}`);
      
      const tx = await token.mint(account.address, amount);
      console.log(`   ⏳ Transaction submitted: ${tx.hash}`);
      
      await tx.wait();
      console.log(`   ✅ Minted successfully!`);
      
      // Check new balance
      const newBalance = await token.balanceOf(account.address);
      const formatted = hre.ethers.formatUnits(newBalance, decimals);
      console.log(`   💰 New Balance: ${formatted} ${tokenSymbol}\n`);
      
    } catch (error) {
      console.error(`   ❌ Failed to mint to ${account.label}:`, error.message);
    }
  }

  // Show summary
  console.log("📊 Minting Summary:");
  console.log("━".repeat(60));
  
  for (const account of testAccounts) {
    const balance = await token.balanceOf(account.address);
    const formatted = hre.ethers.formatUnits(balance, decimals);
    console.log(`${account.label.padEnd(25)} ${formatted} ${tokenSymbol}`);
  }
  
  console.log("━".repeat(60));
  
  // Get total supply
  const totalSupply = await token.totalSupply();
  const formattedSupply = hre.ethers.formatUnits(totalSupply, decimals);
  console.log(`Total Supply:                ${formattedSupply} ${tokenSymbol}`);
  
  console.log("\n✨ Token minting completed successfully!");
  console.log("\n💡 TIP: You can edit this script to mint to any address you want.");
  console.log("     Just modify the testAccounts array and run it again!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Minting failed:", error);
    process.exit(1);
  });
