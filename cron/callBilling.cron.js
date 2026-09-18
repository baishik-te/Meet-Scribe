const { Call, User, Subscription, Plan, sequelize } = require('../models');
const TokenService = require('../services/token.service');
const LiveKitService = require('../services/livekit.service');
const SocketService = require('../services/socket.service');
const TranscriptionBot = require('../services/transcription-bot.service');

// Grace window after a call becomes ACTIVE before the empty-room safety net can
// terminate it. Prevents killing a legitimate call in the brief interval before
// participants finish connecting to LiveKit.
const CONNECT_GRACE_MS = 90000;

const runCallBillingCycle = async () => {
  try {
    const activeCalls = await Call.findAll({
      where: { status: 'ACTIVE' },
      include: [
        {
          model: User,
          as: 'caller',
          include: [
            {
              model: Subscription,
              as: 'subscriptions',
              where: { status: 'ACTIVE' },
              required: false,
              include: [{ model: Plan, as: 'plan' }]
            }
          ]
        }
      ]
    });

    for (const call of activeCalls) {
      const caller = call.caller;
      if (!caller) continue;

      // ── Safety net: stop billing when nobody who should be billed is left ──
      // If the user leaves without pressing "Leave" (tab close, refresh, crash,
      // lost connection), the LiveKit participant disconnects but the Call row
      // stays ACTIVE — which would keep burning the caller's tokens forever.
      // Before charging, verify the room still has real participants and that
      // the billed caller is still present; otherwise terminate the call now.
      const activeSince = new Date(call.startedAt || call.createdAt).getTime();
      const pastGrace = Date.now() - activeSince > CONNECT_GRACE_MS;
      if (pastGrace) {
        const identities = await LiveKitService.listParticipantIdentities(call.roomName);
        // Only act on a definite reading (null = transient error → bill as usual).
        if (identities !== null) {
          const realParticipants = identities.filter(
            (id) => !String(id).startsWith('transcriber-')
          );
          const callerPresent = realParticipants.includes(String(call.callerId));

          if (realParticipants.length === 0 || !callerPresent) {
            const reason = realParticipants.length === 0 ? 'room empty' : 'caller left';
            console.warn(
              `[Billing] Terminating call ${call.roomName} — ${reason}; stopping token drain.`
            );

            call.status = 'ENDED';
            call.endedAt = new Date();
            if (call.startedAt) {
              call.durationSeconds = Math.round((call.endedAt - call.startedAt) / 1000);
            }
            await call.save();

            await TranscriptionBot.stopForCall(call.id).catch(() => {});
            await LiveKitService.endRoom(call.roomName);
            SocketService.emitToRoom(call.roomName, 'call:ended', {
              callId: call.id,
              reason: 'PARTICIPANT_LEFT'
            });

            continue; // do NOT bill this cycle
          }
        }
      }

      const activeSub = caller.subscriptions?.[0];
      const plan = activeSub?.plan || {
        videoRatePerMinute: 2,
        recordingRatePerMinute: 1,
        transcriptionRatePerMinute: 1
      };

      let currentRate = 0;
      if (call.videoEnabled) currentRate += plan.videoRatePerMinute;
      if (call.recordingEnabled) currentRate += plan.recordingRatePerMinute;
      if (call.transcriptionEnabled) currentRate += plan.transcriptionRatePerMinute;

      try {
        await sequelize.transaction(async (t) => {
          await TokenService.deductTokens({
            userId: caller.id,
            amount: currentRate,
            transactionType: 'VIDEO_USAGE',
            referenceId: call.id,
            featureReference: `call:${call.roomName}`,
            metadata: {
              roomName: call.roomName,
              videoRate: call.videoEnabled ? plan.videoRatePerMinute : 0,
              recordingRate: call.recordingEnabled ? plan.recordingRatePerMinute : 0,
              transcriptionRate: call.transcriptionEnabled ? plan.transcriptionRatePerMinute : 0
            }
          }, t);

          call.durationSeconds += 60;
          call.lastBilledAt = new Date();
          await call.save({ transaction: t });
        });

        const updatedBalance = await TokenService.getBalance(caller.id);

        SocketService.emitToRoom(call.roomName, 'wallet:balance_update', {
          callerId: caller.id,
          balance: updatedBalance,
          currentBurnRate: currentRate
        });

        if (updatedBalance <= 15 && updatedBalance > 0) {
          SocketService.emitToUser(caller.id, 'wallet:low_warning', {
            balance: updatedBalance,
            message: `Warning: Only ${updatedBalance} tokens remaining. Call will terminate when balance reaches 0.`
          });
        }
      } catch (err) {
        if (err.name === 'InsufficientTokensError') {
          console.warn(`[Billing] Caller ${caller.id} ran out of tokens. Terminating call ${call.roomName}`);

          call.status = 'TERMINATED_LOW_BALANCE';
          call.endedAt = new Date();
          await call.save();

          await LiveKitService.endRoom(call.roomName);

          SocketService.emitToRoom(call.roomName, 'call:terminated', {
            reason: 'TERMINATED_LOW_BALANCE',
            message: 'Call terminated due to insufficient token balance.'
          });
        } else {
          console.error(`[Billing Error] Call ${call.id}:`, err);
        }
      }
    }
  } catch (error) {
    console.error('[Billing Cron] Critical cycle failure:', error);
  }
};

const initCallBilling = () => {
  // Executes once every 60 seconds
  setInterval(runCallBillingCycle, 60000);
  console.log('Automated 60-Second Call Billing Worker initialized.');
};

module.exports = { initCallBilling };