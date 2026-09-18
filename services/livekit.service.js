const { AccessToken, RoomServiceClient, EgressClient } = require('livekit-server-sdk');

const livekitHost = process.env.LIVEKIT_URL || 'http://127.0.0.1:7880';
const apiKey = process.env.LIVEKIT_API_KEY || 'devkey';
const apiSecret = process.env.LIVEKIT_API_SECRET || 'secret';

const roomService = new RoomServiceClient(livekitHost, apiKey, apiSecret);
const egressClient = new EgressClient(livekitHost, apiKey, apiSecret);

class LiveKitService {
  static async generateToken(roomName, identity, name) {
    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name,
      ttl: '4h'
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true
    });

    // livekit-server-sdk v2+ returns a Promise<string> from toJwt(); it MUST be
    // awaited or the caller receives a Promise that serializes to
    // "[object Object]" in the URL and breaks the LiveKit connection.
    return at.toJwt();
  }

  static async endRoom(roomName) {
    try {
      await roomService.deleteRoom(roomName);
      return true;
    } catch (err) {
      console.warn(`[LiveKit] Could not close room ${roomName} (it may already be closed):`, err.message);
      return false;
    }
  }

  /**
   * List the participant identities currently connected to a room.
   *
   * @returns {Promise<string[]|null>} identities, an empty array if the room no
   *   longer exists (everyone left → LiveKit closed it), or `null` when the
   *   state could not be determined due to a transient error (callers should
   *   NOT treat null as "empty").
   */
  static async listParticipantIdentities(roomName) {
    try {
      const participants = await roomService.listParticipants(roomName);
      return (participants || []).map((p) => p.identity);
    } catch (err) {
      const msg = (err && err.message) || '';
      // A missing room means it has already been torn down → treat as empty.
      if (/not.?found|does not exist|no such room|404/i.test(msg)) return [];
      console.warn(`[LiveKit] Could not list participants for ${roomName}:`, msg);
      return null;
    }
  }

  static async startRoomCompositeEgress(roomName) {
    try {
      const info = await egressClient.startRoomCompositeEgress(
        roomName,
        {
          file: {
            filepath: `recordings/${roomName}-${Date.now()}.mp4`
          }
        }
      );
      return info.egressId;
    } catch (err) {
      console.error('[LiveKit Egress] Failed to start egress:', err.message);
      return `mock-egress-${Date.now()}`;
    }
  }

  static async stopEgress(egressId) {
    try {
      if (egressId && !egressId.startsWith('mock-')) {
        await egressClient.stopEgress(egressId);
      }
    } catch (err) {
      console.warn('[LiveKit Egress] Stop error:', err.message);
    }
  }
}

module.exports = LiveKitService;