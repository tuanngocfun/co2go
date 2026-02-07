require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  
  networks: {
    // Local development network
    hardhat: {
      chainId: 31337,
      accounts: {
        count: 20, // 20 test accounts
        accountsBalance: "10000000000000000000000", // 10000 ETH per account
      },
    },
    
    // Local node (run with: npx hardhat node)
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    
    // Polygon Amoy testnet (Mumbai is deprecated)
    amoy: {
      url: process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology/",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 80002,
      gasPrice: 35000000000, // 35 gwei
    },
    
    // Polygon mainnet (production)
    polygon: {
      url: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 137,
      gasPrice: 50000000000, // 50 gwei
    },
  },
  
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  },
  
  etherscan: {
    apiKey: {
      polygon: process.env.POLYGONSCAN_API_KEY || "",
      polygonAmoy: process.env.POLYGONSCAN_API_KEY || "",
    },
  },
};