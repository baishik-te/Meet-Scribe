const { Op } = require("sequelize");
const { Call, User, sequelize } = require("../models");
const TokenService = require("../services/token.service");
const LiveKitService = require("../services/livekit.service");
const SocketService = require("../services/socket.service");
const TranscriptionBot = require("../services/transcription-bot.service");
const { resolvePlanRates } = require("../services/billingSync.service");
const { endCallInstantly } = require("../services/callTeardown.service");

const CONNECT_GRACE_MS = 60000;

const runCallBillingCycle = async () => {
  try {
    const activeCalls = await Call.findAll({
      where: {
        status: { [Op.in]: ["ACTIVE", "RINGING"] },
      },
      include: [
        {
          model: User,
          as: "caller",
        },
      ],
    });

    for (const call of activeCalls) {
      const caller = call.caller;
      if (!caller) continue;

      const identities = await LiveKitService.listParticipantIdentities(
        call.roomName,
      );

      const realParticipants = identities !== null
        ? identities.filter((id) => !String(id).startsWith("transcriber-"))
        : null;

      const socketCount = SocketService.getRoomSocketCount(call.roomName);

      // If call is still marked RINGING, check if participants have joined
      if (call.status === "RINGING") {
        if ((realParticipants && realParticipants.length > 0) || socketCount > 0) {
          call.status = "ACTIVE";
          call.startedAt = call.startedAt || new Date();
          call.lastBilledAt = call.lastBilledAt || new Date();
          await call.save();
        } else {
          // If ringing for more than 60 seconds with nobody joining, auto-end with 0 duration & 0 tokens billed
          const ringingAge = Date.now() - new Date(call.createdAt).getTime();
          if (ringingAge > 60000) {
            await endCallInstantly(call.id, "NO_ANSWER");
          }
          continue; // Do not bill calls that haven't been joined
        }
      }

      // Check if call has NO users remaining: end instantly!
      const hasZeroLiveKit = realParticipants !== null && realParticipants.length === 0;
      const hasZeroSockets = socketCount === 0;

      if (hasZeroLiveKit || (realParticipants === null && hasZeroSockets)) {
        console.warn(`[Billing] Room ${call.roomName} is empty — ending call instantly.`);
        await endCallInstantly(call.id, "EMPTY_ROOM");
        continue; // do NOT bill this cycle
      }

      // Dynamically resolve caller's active subscription plan rates
      const rates = await resolvePlanRates(caller.id);

      let currentRate = 0;
      if (call.videoEnabled) currentRate += rates.videoRate;
      if (call.recordingEnabled) currentRate += rates.recordingRate;
      if (call.transcriptionEnabled) currentRate += rates.transcriptionRate;

      try {
        await sequelize.transaction(async (t) => {
          // 1. Deduct Video Usage if video call is active
          if (call.videoEnabled && rates.videoRate > 0) {
            await TokenService.deductTokens(
              {
                userId: caller.id,
                amount: rates.videoRate,
                transactionType: "VIDEO_USAGE",
                referenceId: call.id,
                featureReference: `call:${call.roomName}:video`,
                metadata: {
                  roomName: call.roomName,
                  planName: rates.plan?.name,
                  service: "VIDEO",
                  ratePerMinute: rates.videoRate,
                },
              },
              t,
            );
          }

          // 2. Deduct Video Recording Usage if recording is enabled
          if (call.recordingEnabled && rates.recordingRate > 0) {
            await TokenService.deductTokens(
              {
                userId: caller.id,
                amount: rates.recordingRate,
                transactionType: "RECORDING_USAGE",
                referenceId: call.id,
                featureReference: `call:${call.roomName}:recording`,
                metadata: {
                  roomName: call.roomName,
                  planName: rates.plan?.name,
                  service: "RECORDING",
                  ratePerMinute: rates.recordingRate,
                },
              },
              t,
            );
          }

          // 3. Deduct Transcription Usage if transcription is enabled
          if (call.transcriptionEnabled && rates.transcriptionRate > 0) {
            await TokenService.deductTokens(
              {
                userId: caller.id,
                amount: rates.transcriptionRate,
                transactionType: "TRANSCRIPTION_USAGE",
                referenceId: call.id,
                featureReference: `call:${call.roomName}:transcription`,
                metadata: {
                  roomName: call.roomName,
                  planName: rates.plan?.name,
                  service: "TRANSCRIPTION",
                  ratePerMinute: rates.transcriptionRate,
                },
              },
              t,
            );
          }

          call.durationSeconds = (call.durationSeconds || 0) + 60;
          call.lastBilledAt = new Date();
          await call.save({ transaction: t });
        });

        const updatedBalance = await TokenService.getBalance(caller.id);

        const updatePayload = {
          callerId: caller.id,
          balance: updatedBalance,
          currentBurnRate: currentRate,
          rates: {
            videoRate: rates.videoRate,
            recordingRate: rates.recordingRate,
            transcriptionRate: rates.transcriptionRate,
          },
          features: {
            videoEnabled: Boolean(call.videoEnabled),
            recordingEnabled: Boolean(call.recordingEnabled),
            transcriptionEnabled: Boolean(call.transcriptionEnabled),
          },
        };

        SocketService.emitToRoom(
          call.roomName,
          "wallet:balance_update",
          updatePayload,
        );
        SocketService.emitToUser(
          caller.id,
          "wallet:balance_update",
          updatePayload,
        );

        if (updatedBalance <= 15 && updatedBalance > 0) {
          SocketService.emitToUser(caller.id, "wallet:low_warning", {
            balance: updatedBalance,
            message: `Warning: Only ${updatedBalance} tokens remaining. Call will terminate when balance reaches 0.`,
          });
        }
      } catch (err) {
        if (err.name === "InsufficientTokensError") {
          console.warn(
            `[Billing] Caller ${caller.id} ran out of tokens. Terminating call ${call.roomName}`,
          );

          call.status = "TERMINATED_LOW_BALANCE";
          call.endedAt = new Date();
          await call.save();

          await LiveKitService.endRoom(call.roomName);

          SocketService.emitToRoom(call.roomName, "call:terminated", {
            reason: "TERMINATED_LOW_BALANCE",
            message: "Call terminated due to insufficient token balance.",
          });
        } else {
          console.error(`[Billing Error] Call ${call.id}:`, err);
        }
      }
    }
  } catch (error) {
    console.error("[Billing Cron] Critical cycle failure:", error);
  }
};

const initCallBilling = () => {
  // Executes once every 60 seconds
  setInterval(runCallBillingCycle, 60000);
  console.log("Automated 60-Second Call Billing Worker initialized.");
};

module.exports = { initCallBilling };
