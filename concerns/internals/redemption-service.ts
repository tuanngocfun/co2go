// functions/src/services/redemption-service.ts
import { recordRedemptionOnChain } from "./blockchain";
import {
  getAvailableVouchers as getAvailableVouchersFromDb,
  getVoucherById,
  createRedemption,
  getRedemptionHistory as getRedemptionHistoryFromDb,
  decrementVoucherStock,
  getUserById,
  updateUserPoints
} from "./database";

interface RedemptionRequest {
  voucherId: string;
  userAddress?: string;
}

interface RedemptionResult {
  redemptionId: string;
  voucherCode: string;
  pointsSpent: number;
  blockchainTx?: string;
  voucher: {
    title: string;
    partner: string;
  };
}

export async function handleRedemption(req: any): Promise<RedemptionResult> {
  console.log('[handleRedemption] Starting...');
  
  const userId = req.headers['x-user-id'];
  console.log('[handleRedemption] userId from headers:', userId);
  
  if (!userId) {
    const error: any = new Error("No user ID provided");
    error.statusCode = 401;
    throw error;
  }

  const { voucherId, userAddress }: RedemptionRequest = req.body;
  console.log('[handleRedemption] voucherId:', voucherId, '| userAddress:', userAddress);

  if (!voucherId) {
    const error: any = new Error("voucherId is required");
    error.statusCode = 400;
    throw error;
  }

  // Get voucher from PostgreSQL
  console.log('[handleRedemption] Getting voucher from database...');
  const voucher = await getVoucherById(voucherId);
  if (!voucher) {
    console.log('[handleRedemption] ERROR: Voucher not found:', voucherId);
    const error: any = new Error("Voucher not found");
    error.statusCode = 404;
    throw error;
  }
  console.log('[handleRedemption] Voucher found:', voucher.title, '| Cost:', voucher.cost_points);

  const costPoints = voucher.cost_points || 0;
  validateVoucher(voucher);

  // Get user from PostgreSQL
  console.log('[handleRedemption] Getting user from database...');
  const user = await getUserById(userId);
  if (!user) {
    console.log('[handleRedemption] ERROR: User not found in database. userId:', userId);
    const error: any = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }
  console.log('[handleRedemption] User found:', user.username, '| Points:', user.points_balance);

  const currentPoints = user.points_balance || 0;
  if (currentPoints < costPoints) {
    console.log('[handleRedemption] ERROR: Insufficient points. Has:', currentPoints, 'Needs:', costPoints);
    const error: any = new Error("Insufficient points");
    error.statusCode = 400;
    throw error;
  }

  try {
    // Deduct points from user
    await updateUserPoints(userId, -costPoints);

    // Decrement voucher stock
    await decrementVoucherStock(voucherId);

    // Create redemption record
    const redemptionId = `redemption_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    let blockchainTxHash: string | undefined;

    if (process.env.BLOCKCHAIN_ENABLED === 'true' && userAddress) {
      try {
        blockchainTxHash = await recordRedemptionOnChain(userAddress, voucherId);
        console.log(`Blockchain tx recorded: ${blockchainTxHash}`);
      } catch (blockchainError) {
        console.error('Blockchain recording failed:', blockchainError);
      }
    }

    // Save redemption to PostgreSQL
    await createRedemption(redemptionId, userId, voucherId, costPoints);

    await sendRedemptionNotification(userId, voucher.title, costPoints, redemptionId);

    return {
      redemptionId,
      voucherCode: voucher.id,
      pointsSpent: costPoints,
      blockchainTx: blockchainTxHash,
      voucher: {
        title: voucher.title,
        partner: voucher.partner || 'Unknown'
      }
    };
  } catch (error: any) {
    const err: any = new Error(error.message || "Redemption failed");
    err.statusCode = 400;
    throw err;
  }
}

function validateVoucher(voucher: any): void {
  const now = new Date();

  if (voucher.active === false) {
    const error: any = new Error("Voucher is not active");
    error.statusCode = 400;
    throw error;
  }

  if (voucher.valid_from) {
    const validFrom = new Date(voucher.valid_from);
    if (validFrom > now) {
      const error: any = new Error("Voucher not yet valid");
      error.statusCode = 400;
      throw error;
    }
  }

  if (voucher.valid_to) {
    const validTo = new Date(voucher.valid_to);
    if (validTo < now) {
      const error: any = new Error("Voucher expired");
      error.statusCode = 400;
      throw error;
    }
  }

  if (voucher.stock !== undefined && voucher.stock <= 0) {
    const error: any = new Error("Voucher out of stock");
    error.statusCode = 400;
    throw error;
  }
}

async function sendRedemptionNotification(
  userId: string,
  voucherTitle: string,
  pointsSpent: number,
  redemptionId: string
): Promise<void> {
  try {
    // Skip FCM notification for now - would need Firebase admin SDK
    // In a real deployment, fetch fcmToken from PostgreSQL users table
    console.log(`Redemption notification: User ${userId} redeemed ${voucherTitle} for ${pointsSpent} points`);
    console.log(`Redemption ID: ${redemptionId}`);
  } catch (error) {
    console.error('Notification error:', error);
  }
}


export async function getAvailableVouchers(req: any): Promise<any> {
  // User ID is optional for this endpoint
  const vouchers = await getAvailableVouchersFromDb();
  return { vouchers };
}

export async function getRedemptionHistory(req: any): Promise<any> {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    const error: any = new Error("No user ID provided");
    error.statusCode = 401;
    throw error;
  }

  const redemptions = await getRedemptionHistoryFromDb(userId);
  
  return { 
    redemptions: redemptions.map(r => ({
      id: r.id,
      voucherId: r.voucher_id,
      pointsSpent: r.points_spent,
      status: r.status,
      createdAt: r.created_at,
      blockchainTx: r.blockchain_tx
    }))
  };
}