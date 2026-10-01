const { Op } = require('sequelize');
const { Call } = require('../models');
const LiveKitService = require('./livekit.service');
const SocketService = require('./socket.service');
const TranscriptionBot = require('./transcription-bot.service');

const TERMINAL_STATUSES = ['ENDED', 'FAILED', 'TERMINATED_LOW_BALANCE'];

async function endCallInstantly(callIdOrRoomName, reason = 'USER_ENDED') {
  if (!callIdOrRoomName) return null;

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(callIdOrRoomName);
    const where = isUuid
      ? { [Op.or]: [{ id: callIdOrRoomName }, { roomName: callIdOrRoomName }] }
      : { roomName: callIdOrRoomName };

    const call = await Call.findOne({ where });
    if (!call) return null;

    if (!TERMINAL_STATUSES.includes(call.status)) {
      call.status = 'ENDED';
      call.endedAt = new Date();
      if (call.startedAt) {
        call.durationSeconds = Math.max(0, Math.round((call.endedAt - call.startedAt) / 1000));
      } else {
        // Ended before joining (e.g. from prejoin screen) — duration 0, zero tokens billed
        call.durationSeconds = 0;
      }
      await call.save();
    }

    // Teardown LiveKit room and speech bot
    await TranscriptionBot.stopForCall(call.id).catch(() => { });
    await LiveKitService.endRoom(call.roomName).catch(() => { });

    // Broadcast termination to room and both participants
    const payload = { callId: call.id, roomName: call.roomName, reason };
    SocketService.emitToRoom(call.roomName, 'call:ended', payload);
    SocketService.emitToRoom(call.roomName, 'call:terminated', {
      callId: call.id,
      reason,
      message: 'This call has ended.'
    });

    if (call.callerId) {
      SocketService.emitToUser(call.callerId, 'call:ended', payload);
    }
    if (call.receiverId) {
      SocketService.emitToUser(call.receiverId, 'call:ended', payload);
    }

    console.log(`[CallTeardown] Call ${call.roomName} (${call.id}) ended instantly. Reason: ${reason}`);
    return call;
  } catch (err) {
    console.error('[CallTeardown] Error ending call instantly:', err);
    return null;
  }
}

/**
 * Checks if a call should be ended because the room has become empty
 * or because the caller has left / disconnected.
 */
async function checkAndEndIfEmpty(callIdOrRoomName, leavingUserId = null) {
  if (!callIdOrRoomName) return null;

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(callIdOrRoomName);
    const where = isUuid
      ? { [Op.or]: [{ id: callIdOrRoomName }, { roomName: callIdOrRoomName }] }
      : { roomName: callIdOrRoomName };

    const call = await Call.findOne({ where });
    if (!call || TERMINAL_STATUSES.includes(call.status)) {
      return null;
    }

    // If call is still ringing or in prejoin setup (< 2 min), do not tear it down as empty
    if (call.status === 'RINGING' && !leavingUserId) {
      return null;
    }
    if (!call.startedAt && !leavingUserId) {
      const callAge = Date.now() - new Date(call.createdAt).getTime();
      if (callAge < 120000) {
        return null;
      }
    }


    // Check LiveKit participant count
    const identities = await LiveKitService.listParticipantIdentities(call.roomName);
    if (identities !== null) {
      const realParticipants = identities.filter((id) => {
        const strId = String(id);
        if (strId.startsWith('transcriber-')) return false;
        if (leavingUserId && strId === String(leavingUserId)) return false;
        return true;
      });

      if (realParticipants.length === 0) {
        return await endCallInstantly(call.id, 'EMPTY_ROOM');
      }
      return null;
    }

    // Check Socket.IO room socket count as secondary verification (fallback if LiveKit unreachable)
    const socketCount = SocketService.getRoomSocketCount(call.roomName);
    if (socketCount === 0) {
      return await endCallInstantly(call.id, 'NO_CONNECTED_CLIENTS');
    }

    return null;
  } catch (err) {
    console.error('[CallTeardown] Error checking empty room:', err);
    return null;
  }
}

module.exports = {
  endCallInstantly,
  checkAndEndIfEmpty
};
