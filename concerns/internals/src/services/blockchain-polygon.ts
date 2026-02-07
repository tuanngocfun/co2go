// functions/src/services/blockchain-polygon.ts
// Real blockchain integration for Polygon Amoy testnet
import { ethers } from 'ethers';

// Polygon Amoy configuration
const POLYGON_AMOY_RPC = 'https://rpc-amoy.polygon.technology/';
const CHAIN_ID = 80002;

// Contract addresses (deployed on Polygon Amoy)
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '0x95DdD90C8DA187D146518c2cf97F2b516F18e602';
const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS || '0x3bf9bd06C9053FB389ee8937A2F8aD1a50618b2d';
const PRIVATE_KEY = process.env.BLOCKCHAIN_PRIVATE_KEY || '';
const BLOCKCHAIN_ENABLED = process.env.BLOCKCHAIN_ENABLED === 'true';

// RewardSystem ABI (minimal for Firebase Functions)
const REWARD_SYSTEM_ABI = [
  "function recordTrip(uint256 tripId, address user, string mode, uint256 distance, uint256 duration) external returns (uint256)",
  "function getBalance(address user) external view returns (uint256)",
  "function getBalanceFormatted(address user) external view returns (uint256)",
  "function getTripHistory(address user) external view returns (tuple(uint256 tripId, address user, string mode, uint256 distance, uint256 duration, uint256 pointsEarned, uint256 emissionsSaved, uint256 timestamp, bytes32 tripHash)[])",
  "function redeemReward(address user, string rewardId, uint256 pointsCost) external returns (bool)",
  "function getRedemptionHistory(address user) external view returns (tuple(uint256 redemptionId, address user, string rewardId, uint256 pointsCost, uint256 timestamp, bytes32 txHash)[])",
  "function getUserStats(address user) external view returns (uint256 balance, uint256 tripCount, uint256 redemptionCount, string tier, uint256 totalEmissionsSaved)",
  "function getReward(string rewardId) external view returns (tuple(string rewardId, string name, uint256 pointsCost, bool active))",
  "function getTokenAddress() external view returns (address)",
  "function totalTrips() external view returns (uint256)",
  "function totalRedemptions() external view returns (uint256)",
  "function totalPointsIssued() external view returns (uint256)",
  "event TripRecorded(address indexed user, uint256 indexed tripId, string mode, uint256 pointsEarned, bytes32 tripHash)",
  "event RewardRedeemed(address indexed user, string indexed rewardId, uint256 pointsCost, uint256 newBalance)"
];

// CO2GoToken ABI
const TOKEN_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function name() external view returns (string)",
  "function symbol() external view returns (string)",
  "function decimals() external view returns (uint8)"
];

let provider: ethers.JsonRpcProvider | null = null;
let signer: ethers.Wallet | null = null;
let contract: ethers.Contract | null = null;
let tokenContract: ethers.Contract | null = null;

/**
 * Initialize blockchain connection to Polygon Amoy
 */
function initializeBlockchain(): void {
  if (!BLOCKCHAIN_ENABLED) {
    console.log('[blockchain-polygon] Blockchain integration is disabled');
    return;
  }

  if (!PRIVATE_KEY) {
    console.warn('[blockchain-polygon] BLOCKCHAIN_PRIVATE_KEY not set');
    return;
  }

  try {
    provider = new ethers.JsonRpcProvider(POLYGON_AMOY_RPC);
    signer = new ethers.Wallet(PRIVATE_KEY, provider);
    contract = new ethers.Contract(CONTRACT_ADDRESS, REWARD_SYSTEM_ABI, signer);
    tokenContract = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, provider);
    
    console.log('[blockchain-polygon] Initialized:', {
      network: 'Polygon Amoy',
      chainId: CHAIN_ID,
      contractAddress: CONTRACT_ADDRESS,
      tokenAddress: TOKEN_ADDRESS,
      signerAddress: signer.address
    });
  } catch (error) {
    console.error('[blockchain-polygon] Initialization failed:', error);
    throw error;
  }
}

/**
 * Record a trip on Polygon Amoy blockchain
 */
export async function recordTripOnChain(
  tripId: number,
  userAddress: string,
  mode: string,
  distanceMeters: number,
  durationSeconds: number
): Promise<{
  success: boolean;
  txHash: string;
  pointsEarned: string;
  blockNumber: number;
  gasUsed: string;
}> {
  if (!BLOCKCHAIN_ENABLED) {
    throw new Error('Blockchain integration is disabled');
  }

  if (!contract) {
    initializeBlockchain();
  }

  if (!contract || !signer) {
    throw new Error('Blockchain not properly configured');
  }

  // Validate address
  if (!ethers.isAddress(userAddress)) {
    throw new Error('Invalid Ethereum address');
  }

  console.log(`[blockchain-polygon] Recording trip ${tripId} for ${userAddress}`);
  console.log(`[blockchain-polygon] Mode: ${mode}, Distance: ${distanceMeters}m, Duration: ${durationSeconds}s`);

  try {
    const tx = await contract.recordTrip(
      tripId,
      userAddress,
      mode,
      distanceMeters,
      durationSeconds
    );

    console.log(`[blockchain-polygon] Transaction sent: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`[blockchain-polygon] Confirmed in block ${receipt.blockNumber}`);

    // Parse TripRecorded event
    let pointsEarned = '0';
    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog({
          topics: log.topics as string[],
          data: log.data
        });
        if (parsed?.name === 'TripRecorded') {
          pointsEarned = parsed.args.pointsEarned.toString();
          break;
        }
      } catch {
        // Not our event
      }
    }

    return {
      success: true,
      txHash: tx.hash,
      pointsEarned,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString()
    };
  } catch (error: any) {
    console.error('[blockchain-polygon] Transaction failed:', error.message);
    throw new Error(`Blockchain error: ${error.message}`);
  }
}

/**
 * Get user's token balance from Polygon Amoy
 */
export async function getTokenBalance(userAddress: string): Promise<{
  raw: string;
  formatted: string;
  points: string;
  symbol: string;
}> {
  if (!BLOCKCHAIN_ENABLED) {
    return { raw: '0', formatted: '0', points: '0', symbol: 'C2GP' };
  }

  if (!tokenContract || !contract) {
    initializeBlockchain();
  }

  if (!tokenContract || !contract) {
    throw new Error('Blockchain not configured');
  }

  try {
    const balance = await tokenContract.balanceOf(userAddress);
    const decimals = await tokenContract.decimals();
    const symbol = await tokenContract.symbol();
    const formatted = ethers.formatUnits(balance, decimals);
    const pointsBalance = await contract.getBalanceFormatted(userAddress);

    return {
      raw: balance.toString(),
      formatted,
      points: pointsBalance.toString(),
      symbol
    };
  } catch (error: any) {
    console.error('[blockchain-polygon] Get balance error:', error.message);
    throw error;
  }
}

/**
 * Get user's trip history from Polygon Amoy
 */
export async function getTripHistory(userAddress: string): Promise<any[]> {
  if (!BLOCKCHAIN_ENABLED) {
    return [];
  }

  if (!contract) {
    initializeBlockchain();
  }

  if (!contract) {
    throw new Error('Blockchain not configured');
  }

  try {
    const trips = await contract.getTripHistory(userAddress);
    
    return trips.map((trip: any) => ({
      tripId: trip.tripId.toString(),
      mode: trip.mode,
      distance: trip.distance.toString(),
      duration: trip.duration.toString(),
      pointsEarned: trip.pointsEarned.toString(),
      emissionsSaved: trip.emissionsSaved.toString(),
      timestamp: new Date(Number(trip.timestamp) * 1000).toISOString(),
      tripHash: trip.tripHash
    }));
  } catch (error: any) {
    console.error('[blockchain-polygon] Get trip history error:', error.message);
    throw error;
  }
}

/**
 * Get user stats from Polygon Amoy
 */
export async function getUserStats(userAddress: string): Promise<{
  balance: string;
  tripCount: string;
  redemptionCount: string;
  tier: string;
  totalEmissionsSaved: string;
}> {
  if (!BLOCKCHAIN_ENABLED) {
    return {
      balance: '0',
      tripCount: '0',
      redemptionCount: '0',
      tier: 'Bronze',
      totalEmissionsSaved: '0'
    };
  }

  if (!contract) {
    initializeBlockchain();
  }

  if (!contract) {
    throw new Error('Blockchain not configured');
  }

  try {
    const stats = await contract.getUserStats(userAddress);
    
    return {
      balance: stats.balance.toString(),
      tripCount: stats.tripCount.toString(),
      redemptionCount: stats.redemptionCount.toString(),
      tier: stats.tier,
      totalEmissionsSaved: stats.totalEmissionsSaved.toString()
    };
  } catch (error: any) {
    console.error('[blockchain-polygon] Get user stats error:', error.message);
    throw error;
  }
}

/**
 * Redeem a reward on Polygon Amoy
 */
export async function redeemRewardOnChain(
  userAddress: string,
  rewardId: string,
  pointsCost: number
): Promise<{
  success: boolean;
  txHash: string;
  newBalance: string;
  blockNumber: number;
}> {
  if (!BLOCKCHAIN_ENABLED) {
    throw new Error('Blockchain integration is disabled');
  }

  if (!contract) {
    initializeBlockchain();
  }

  if (!contract) {
    throw new Error('Blockchain not configured');
  }

  console.log(`[blockchain-polygon] Redeeming ${rewardId} for ${userAddress}`);

  try {
    const tx = await contract.redeemReward(userAddress, rewardId, pointsCost);
    console.log(`[blockchain-polygon] Transaction sent: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`[blockchain-polygon] Confirmed in block ${receipt.blockNumber}`);

    const newBalance = await contract.getBalanceFormatted(userAddress);

    return {
      success: true,
      txHash: tx.hash,
      newBalance: newBalance.toString(),
      blockNumber: receipt.blockNumber
    };
  } catch (error: any) {
    console.error('[blockchain-polygon] Redeem failed:', error.message);
    
    if (error.message.includes('Insufficient')) {
      throw new Error('Insufficient points for this reward');
    }
    throw new Error(`Blockchain error: ${error.message}`);
  }
}

/**
 * Get token info for MetaMask
 */
export async function getTokenInfo(): Promise<{
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  chainId: number;
  network: string;
}> {
  if (!tokenContract) {
    initializeBlockchain();
  }

  if (!tokenContract) {
    return {
      address: TOKEN_ADDRESS,
      name: 'CO2Go Points',
      symbol: 'C2GP',
      decimals: 18,
      chainId: CHAIN_ID,
      network: 'Polygon Amoy'
    };
  }

  try {
    const [name, symbol, decimals] = await Promise.all([
      tokenContract.name(),
      tokenContract.symbol(),
      tokenContract.decimals()
    ]);

    return {
      address: TOKEN_ADDRESS,
      name,
      symbol,
      decimals: Number(decimals),
      chainId: CHAIN_ID,
      network: 'Polygon Amoy'
    };
  } catch (error: any) {
    console.error('[blockchain-polygon] Get token info error:', error.message);
    return {
      address: TOKEN_ADDRESS,
      name: 'CO2Go Points',
      symbol: 'C2GP',
      decimals: 18,
      chainId: CHAIN_ID,
      network: 'Polygon Amoy'
    };
  }
}

/**
 * Health check for blockchain connection
 */
export async function blockchainHealthCheck(): Promise<{
  status: string;
  details: {
    network?: string;
    chainId?: number;
    blockNumber?: number;
    contractAddress?: string;
    tokenAddress?: string;
    signerBalance?: string;
    message?: string;
    error?: string;
  };
}> {
  if (!BLOCKCHAIN_ENABLED) {
    return {
      status: 'disabled',
      details: { message: 'Blockchain integration is disabled' }
    };
  }

  try {
    if (!provider) {
      initializeBlockchain();
    }

    if (!provider || !signer) {
      return {
        status: 'not_configured',
        details: { message: 'Blockchain not properly configured' }
      };
    }

    const [network, blockNumber, balance] = await Promise.all([
      provider.getNetwork(),
      provider.getBlockNumber(),
      signer.provider!.getBalance(signer.address)
    ]);

    return {
      status: 'healthy',
      details: {
        network: 'Polygon Amoy',
        chainId: Number(network.chainId),
        blockNumber,
        contractAddress: CONTRACT_ADDRESS,
        tokenAddress: TOKEN_ADDRESS,
        signerBalance: ethers.formatEther(balance)
      }
    };
  } catch (error: any) {
    console.error('[blockchain-polygon] Health check failed:', error);
    return {
      status: 'unhealthy',
      details: { error: error.message }
    };
  }
}
