const { Op } = require('sequelize');
const { Call, User, Subscription, Plan } = require('../models');
const TokenService = require('./token.service');
const SocketService = require('./socket.service');

/**
 * Resolves the caller's active plan rates.
 * If user has an active subscription, uses that plan's rates.
 * Otherwise falls back to the lowest priced active plan or standard defaults.
 */
async function resolvePlanRates(callerId) {
  if (!callerId) {
    return {
      plan: null,
      videoRate: 2,
      recordingRate: 1,
      transcriptionRate: 1
    };
  }

  const caller = await User.findByPk(callerId, {
    include: [
      {
        model: Subscription,
        as: 'subscriptions',
        where: { status: 'ACTIVE' },
        required: false,
        include: [{ model: Plan, as: 'plan' }]
      }
    ],
    order: [
      [{ model: Subscription, as: 'subscriptions' }, 'createdAt', 'DESC']
    ]
  });

  const activeSub = caller?.subscriptions?.[0];
  let plan = activeSub?.plan;

  if (!plan) {
    plan = await Plan.findOne({
      where: { status: 'ACTIVE' },
      order: [['price', 'ASC']]
    });
  }

  return {
    plan,
    videoRate: plan?.videoRatePerMinute ?? 2,
    recordingRate: plan?.recordingRatePerMinute ?? 1,
    transcriptionRate: plan?.transcriptionRatePerMinute ?? 1
  };
}

/**
 * Synchronizes a call's balance and current burn rate immediately.
 * Activates the call if it was still in 'RINGING' state.
 * Emits 'wallet:balance_update' over WebSocket to the room and caller.
 */
async function syncCallBalanceAndRate(roomNameOrCallId, targetSocket = null) {
  if (!roomNameOrCallId) return null;

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roomNameOrCallId);
    const where = isUuid
      ? { [Op.or]: [{ id: roomNameOrCallId }, { roomName: roomNameOrCallId }] }
      : { roomName: roomNameOrCallId };

    const call = await Call.findOne({ where });

    if (!call) return null;

    // Transition call to ACTIVE if it was RINGING and someone is present
    if (call.status === 'RINGING') {
      call.status = 'ACTIVE';
      call.startedAt = call.startedAt || new Date();
      call.lastBilledAt = call.lastBilledAt || new Date();
      await call.save();
    }

    const rates = await resolvePlanRates(call.callerId);

    let currentBurnRate = 0;
    if (call.videoEnabled) currentBurnRate += rates.videoRate;
    if (call.recordingEnabled) currentBurnRate += rates.recordingRate;
    if (call.transcriptionEnabled) currentBurnRate += rates.transcriptionRate;

    const balance = await TokenService.getBalance(call.callerId);

    const payload = {
      callerId: call.callerId,
      balance,
      currentBurnRate,
      rates: {
        videoRate: rates.videoRate,
        recordingRate: rates.recordingRate,
        transcriptionRate: rates.transcriptionRate
      },
      features: {
        videoEnabled: Boolean(call.videoEnabled),
        recordingEnabled: Boolean(call.recordingEnabled),
        transcriptionEnabled: Boolean(call.transcriptionEnabled)
      }
    };

    if (targetSocket) {
      targetSocket.emit('wallet:balance_update', payload);
    }
    SocketService.emitToRoom(call.roomName, 'wallet:balance_update', payload);
    SocketService.emitToUser(call.callerId, 'wallet:balance_update', payload);

    return { call, rates, currentBurnRate, balance };
  } catch (err) {
    console.error('[BillingSync] Error syncing call balance and rate:', err);
    return null;
  }
}

module.exports = {
  resolvePlanRates,
  syncCallBalanceAndRate
};
