"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordRedemptionOnChain = recordRedemptionOnChain;
exports.checkRedemptionOnChain = checkRedemptionOnChain;
exports.getTransactionDetails = getTransactionDetails;
exports.getAccountBalance = getAccountBalance;
exports.blockchainHealthCheck = blockchainHealthCheck;
// functions/src/services/blockchain.ts
const ethers_1 = require("ethers");
const BLOCKCHAIN_RPC = process.env.BLOCKCHAIN_RPC || "";
const BLOCKCHAIN_PRIVATE_KEY = process.env.BLOCKCHAIN_PRIVATE_KEY || "";
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "";
const BLOCKCHAIN_ENABLED = process.env.BLOCKCHAIN_ENABLED === 'true';
const CONTRACT_ABI = [
    "function redeemVoucher(address user, string voucherId) external returns (bool)",
    "function getRedemption(address user, string voucherId) external view returns (bool)",
    "event VoucherRedeemed(address indexed user, string voucherId, uint256 timestamp)"
];
let provider = null;
let signer = null;
let contract = null;
function initializeBlockchain() {
    if (!BLOCKCHAIN_ENABLED) {
        console.log('Blockchain integration is disabled');
        return;
    }
    if (!BLOCKCHAIN_RPC || !BLOCKCHAIN_PRIVATE_KEY || !CONTRACT_ADDRESS) {
        console.warn('Blockchain configuration incomplete');
        return;
    }
    try {
        provider = new ethers_1.ethers.providers.JsonRpcProvider(BLOCKCHAIN_RPC);
        signer = new ethers_1.ethers.Wallet(BLOCKCHAIN_PRIVATE_KEY, provider);
        contract = new ethers_1.ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        console.log('Blockchain initialized:', {
            network: BLOCKCHAIN_RPC,
            contractAddress: CONTRACT_ADDRESS,
            signerAddress: signer.address
        });
    }
    catch (error) {
        console.error('Blockchain initialization failed:', error);
        throw error;
    }
}
async function recordRedemptionOnChain(userAddress, voucherId) {
    if (!BLOCKCHAIN_ENABLED) {
        throw new Error('Blockchain integration is disabled');
    }
    if (!contract) {
        initializeBlockchain();
    }
    if (!contract) {
        throw new Error('Blockchain not properly configured');
    }
    try {
        if (!ethers_1.ethers.utils.isAddress(userAddress)) {
            throw new Error('Invalid Ethereum address');
        }
        console.log(`Recording redemption on chain: ${userAddress} - ${voucherId}`);
        const gasEstimate = await contract.estimateGas.redeemVoucher(userAddress, voucherId);
        console.log(`Estimated gas: ${gasEstimate.toString()}`);
        const tx = await contract.redeemVoucher(userAddress, voucherId, {
            gasLimit: gasEstimate.mul(120).div(100)
        });
        console.log(`Transaction sent: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
        return receipt.transactionHash;
    }
    catch (error) {
        console.error('Blockchain transaction failed:', error);
        if (error.code === 'INSUFFICIENT_FUNDS') {
            throw new Error('Insufficient funds for gas fees');
        }
        else if (error.code === 'NONCE_EXPIRED') {
            throw new Error('Transaction nonce expired, please retry');
        }
        else if (error.message.includes('already redeemed')) {
            throw new Error('Voucher already redeemed on blockchain');
        }
        throw new Error(`Blockchain error: ${error.message}`);
    }
}
async function checkRedemptionOnChain(userAddress, voucherId) {
    if (!BLOCKCHAIN_ENABLED || !contract) {
        return false;
    }
    try {
        const isRedeemed = await contract.getRedemption(userAddress, voucherId);
        return isRedeemed;
    }
    catch (error) {
        console.error('Check redemption error:', error);
        return false;
    }
}
async function getTransactionDetails(txHash) {
    if (!provider) {
        initializeBlockchain();
    }
    if (!provider) {
        throw new Error('Blockchain provider not initialized');
    }
    try {
        const tx = await provider.getTransaction(txHash);
        const receipt = await provider.getTransactionReceipt(txHash);
        return {
            hash: tx.hash,
            from: tx.from,
            to: tx.to,
            blockNumber: tx.blockNumber,
            blockHash: receipt?.blockHash,
            status: receipt?.status === 1 ? 'success' : 'failed',
            gasUsed: receipt?.gasUsed?.toString(),
            timestamp: tx.timestamp
        };
    }
    catch (error) {
        console.error('Get transaction details error:', error);
        throw error;
    }
}
async function getAccountBalance() {
    if (!signer) {
        initializeBlockchain();
    }
    if (!signer) {
        throw new Error('Blockchain signer not initialized');
    }
    try {
        const balance = await signer.getBalance();
        return ethers_1.ethers.utils.formatEther(balance);
    }
    catch (error) {
        console.error('Get account balance error:', error);
        throw error;
    }
}
async function blockchainHealthCheck() {
    try {
        if (!BLOCKCHAIN_ENABLED) {
            return {
                status: 'disabled',
                details: { message: 'Blockchain integration is disabled' }
            };
        }
        if (!provider) {
            initializeBlockchain();
        }
        const network = await provider.getNetwork();
        const blockNumber = await provider.getBlockNumber();
        const balance = signer ? await getAccountBalance() : '0';
        return {
            status: 'healthy',
            details: {
                network: network.name,
                chainId: network.chainId,
                blockNumber,
                contractAddress: CONTRACT_ADDRESS,
                signerBalance: balance
            }
        };
    }
    catch (error) {
        console.error('Blockchain health check failed:', error);
        return {
            status: 'unhealthy',
            details: { error: String(error) }
        };
    }
}
//# sourceMappingURL=blockchain.js.map