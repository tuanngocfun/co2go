const fs = require("fs");
const path = require("path");

/**
 * TEST NETWORK CONFIGURATION
 * Verifies that network config matches deployed contracts
 */

console.log("\n🔍 Testing Network Configuration...\n");

// Read deployments
const deploymentsDir = path.join(__dirname, "..", "deployments");
let deployments = {};

if (fs.existsSync(deploymentsDir)) {
  const files = fs.readdirSync(deploymentsDir);
  for (const file of files) {
    if (file.endsWith(".json")) {
      const data = JSON.parse(fs.readFileSync(path.join(deploymentsDir, file), "utf-8"));
      deployments[data.network] = data;
    }
  }
}

console.log("📋 Found deployments:");
Object.keys(deployments).forEach(network => {
  const deploy = deployments[network];
  console.log(`  ✓ ${network} (Chain ${deploy.chainId})`);
  console.log(`    Token: ${deploy.contracts.token}`);
  console.log(`    RewardSystem: ${deploy.contracts.rewardSystem}`);
  console.log(`    Deployed: ${new Date(deploy.timestamp).toLocaleString()}`);
});

// Read frontend config
const configPath = path.join(__dirname, "..", "frontend", "src", "config", "networks.js");

if (!fs.existsSync(configPath)) {
  console.log("\n❌ ERROR: networks.js not found at", configPath);
  process.exit(1);
}

const configContent = fs.readFileSync(configPath, "utf-8");

// Extract CONTRACT_ADDRESSES - handle export syntax
const addressesMatch = configContent.match(/export const CONTRACT_ADDRESSES\s*=\s*({[\s\S]*?})\s*\n/);

if (!addressesMatch) {
  console.log("\n❌ ERROR: Could not parse CONTRACT_ADDRESSES from networks.js");
  console.log("Looking for pattern: export const CONTRACT_ADDRESSES = {...}");
  process.exit(1);
}

console.log("\n📝 Frontend Configuration:");
console.log(addressesMatch[1]);

// Validate consistency
console.log("\n✅ Validation:");

let errors = 0;

for (const network in deployments) {
  const deploy = deployments[network];
  const chainId = deploy.chainId;
  
  // Check if chainId is in CONTRACT_ADDRESSES
  // Match the specific block in CONTRACT_ADDRESSES, not SUPPORTED_NETWORKS
  const contractAddressPattern = new RegExp(
    `CONTRACT_ADDRESSES[\\s\\S]*?${chainId}\\s*:\\s*{([^}]+)}`,
    "m"
  );
  const match = configContent.match(contractAddressPattern);
  
  if (!match) {
    console.log(`❌ Chain ${chainId} (${network}) not found in CONTRACT_ADDRESSES`);
    errors++;
    continue;
  }
  
  const configBlock = match[1];
  
  // Extract addresses from config
  const tokenMatch = configBlock.match(/token:\s*['"]?(0x[a-fA-F0-9]+)['"]?/);
  const rewardMatch = configBlock.match(/rewardSystem:\s*['"]?(0x[a-fA-F0-9]+)['"]?/);
  
  const configToken = tokenMatch && tokenMatch[1] ? tokenMatch[1].toLowerCase() : null;
  const configReward = rewardMatch && rewardMatch[1] ? rewardMatch[1].toLowerCase() : null;
  
  const deployedToken = deploy.contracts.token.toLowerCase();
  const deployedReward = deploy.contracts.rewardSystem.toLowerCase();
  
  // Compare
  if (configToken !== deployedToken) {
    console.log(`❌ Token address mismatch for chain ${chainId}:`);
    console.log(`   Config:   ${configToken}`);
    console.log(`   Deployed: ${deployedToken}`);
    errors++;
  } else {
    console.log(`✓ Token address matches for chain ${chainId}`);
  }
  
  if (configReward !== deployedReward) {
    console.log(`❌ RewardSystem address mismatch for chain ${chainId}:`);
    console.log(`   Config:   ${configReward}`);
    console.log(`   Deployed: ${deployedReward}`);
    errors++;
  } else {
    console.log(`✓ RewardSystem address matches for chain ${chainId}`);
  }
}

// Summary
console.log("\n" + "=".repeat(60));
if (errors === 0) {
  console.log("✅ ALL CHECKS PASSED - Configuration is consistent!");
} else {
  console.log(`❌ FOUND ${errors} ERROR(S) - Please update networks.js`);
  process.exit(1);
}
console.log("=".repeat(60) + "\n");

// Show next steps
console.log("📌 Next Steps:");
console.log("  1. Ensure MetaMask is connected to the correct network");
console.log("  2. Start frontend: cd frontend && pnpm dev");
console.log("  3. Test 'Add to MetaMask' button");
console.log("  4. Verify token appears in MetaMask wallet");
console.log("  5. Deploy to Polygon Amoy: pnpm run deploy:amoy");
console.log("  6. Update networks.js with Amoy addresses");
console.log("");
