/**
 * Network Configuration
 * Maps chain IDs to their respective contract addresses
 */

export const SUPPORTED_NETWORKS = {
  // Hardhat Local Network
  31337: {
    name: 'Hardhat Local',
    chainId: 31337,
    chainIdHex: '0x7a69',
    rpcUrl: 'http://localhost:8545',
    currency: 'ETH',
    blockExplorer: null,
  },
  // Polygon Amoy Testnet
  80002: {
    name: 'Polygon Amoy Testnet',
    chainId: 80002,
    chainIdHex: '0x13882',
    rpcUrl: 'https://rpc-amoy.polygon.technology/',
    currency: 'POL',
    blockExplorer: 'https://amoy.polygonscan.com',
  },
}

/**
 * Contract addresses per network
 * UPDATE these after deploying to each network
 */
export const CONTRACT_ADDRESSES = {
  // Hardhat Local (from deployments/hardhat.json)
  31337: {
    token: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    rewardSystem: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
  },
  // Polygon Amoy (deploy with: pnpm run deploy:amoy)
  80002: {
    token: null, // TODO: Deploy to Amoy and update this
    rewardSystem: null, // TODO: Deploy to Amoy and update this
  },
}

/**
 * Get contract addresses for current network
 */
export function getContractAddresses(chainId) {
  const addresses = CONTRACT_ADDRESSES[chainId]
  if (!addresses) {
    return null
  }
  return addresses
}

/**
 * Get network info
 */
export function getNetworkInfo(chainId) {
  return SUPPORTED_NETWORKS[chainId] || null
}

/**
 * Check if network is supported
 */
export function isNetworkSupported(chainId) {
  return chainId in SUPPORTED_NETWORKS
}

/**
 * Get token address for current network
 */
export function getTokenAddress(chainId) {
  const addresses = getContractAddresses(chainId)
  return addresses?.token || null
}

/**
 * Get reward system address for current network
 */
export function getRewardSystemAddress(chainId) {
  const addresses = getContractAddresses(chainId)
  return addresses?.rewardSystem || null
}

/**
 * Check if contracts are deployed on network
 */
export function areContractsDeployed(chainId) {
  const addresses = getContractAddresses(chainId)
  return addresses && addresses.token && addresses.rewardSystem
}
