const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { Call, Recording, Transcription, Summary, User } = require('../models');
const GeminiService = require('../services/gemini.service');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

/** Ensure a call exists and the requesting user is a participant (caller/receiver). */
async function findParticipantCall(callId, userId) {
  const call = await Call.findOne({
    where: {
      id: callId,
      [Op.or]: [{ callerId: userId }, { receiverId: userId }]
    }
  });
  return call;
}

/** Format a Date as a friendly default recording name, e.g. "Recording · Sep 18, 2026 3:45 PM". */
function defaultRecordingName(date = new Date()) {
  const opts = { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' };
  return `Recording · ${new Intl.DateTimeFormat('en-US', opts).format(date)}`;
}

class MediaController {
  // ─────────────────────────────────────────────────────────────────────────
  // Summaries
  // POST /user/calls/:callId/summary   → generate + save a Gemini summary
  // GET  /user/calls/:callId/summary   → latest saved summary (or null)
  // ─────────────────────────────────────────────────────────────────────────
  static async generateSummary(req, res, next) {
    const { callId } = req.params;
    try {
      const call = await findParticipantCall(callId, req.user.id);
      if (!call) {
        return res.status(404).json({ success: false, error: { code: 'CALL_NOT_FOUND', message: 'Call not found' } });
      }

      if (!GeminiService.isConfigured()) {
        return res.status(503).json({
          success: false,
          error: { code: 'GEMINI_KEY_MISSING', message: 'Summaries are unavailable: GEMINI_API_KEY is not configured on the server.' }
        });
      }

      const transcripts = await Transcription.findAll({
        where: { callId },
        order: [['createdAt', 'ASC']],
        include: [{ model: User, as: 'speaker', attributes: ['id', 'name'] }]
      });

      if (transcripts.length === 0) {
        return res.status(400).json({ success: false, error: { code: 'NO_TRANSCRIPT', message: 'There is no transcript to summarize for this call.' } });
      }

      const joined = transcripts
        .map((t) => `${t.speaker ? t.speaker.name : 'Speaker'}: ${t.text}`)
        .join('\n');

      let content;
      try {
        content = await GeminiService.summarizeTranscript(joined);
      } catch (err) {
        console.error('[generateSummary] Gemini error:', err.message);
        return res.status(502).json({ success: false, error: { code: 'SUMMARY_FAILED', message: 'Could not generate a summary.' } });
      }

      const summary = await Summary.create({
        callId,
        userId: req.user.id,
        content,
        model: process.env.GEMINI_MODEL || 'gemini-2.0-flash'
      });

      return res.status(201).json({ success: true, data: { summary } });
    } catch (error) {
      next(error);
    }
  }

  static async getSummary(req, res, next) {
    const { callId } = req.params;
    try {
      const call = await findParticipantCall(callId, req.user.id);
      if (!call) {
        return res.status(404).json({ success: false, error: { code: 'CALL_NOT_FOUND', message: 'Call not found' } });
      }
      const summary = await Summary.findOne({
        where: { callId },
        order: [['createdAt', 'DESC']]
      });
      return res.status(200).json({ success: true, data: { summary } });
    } catch (error) {
      next(error);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Recording upload (client-side MediaRecorder → file saved under /uploads)
  // POST /user/calls/:callId/recording/upload  (multipart: field "recording")
  // ─────────────────────────────────────────────────────────────────────────
  static async uploadRecording(req, res, next) {
    const { callId } = req.params;
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: { code: 'NO_FILE', message: 'No recording file uploaded' } });
      }

      const call = await findParticipantCall(callId, req.user.id);
      if (!call) {
        // multer already wrote the file to disk; clean it up.
        fs.promises.unlink(req.file.path).catch(() => {});
        return res.status(404).json({ success: false, error: { code: 'CALL_NOT_FOUND', message: 'Call not found' } });
      }

      const durationSeconds = parseInt(req.body.durationSeconds, 10) || 0;
      const startedAt = req.body.startedAt ? new Date(req.body.startedAt) : new Date(Date.now() - durationSeconds * 1000);
      const name = (req.body.name && req.body.name.trim()) || defaultRecordingName(startedAt);

      // Path stored relative to the uploads dir so it is portable.
      const relativePath = path.posix.join('recordings', path.basename(req.file.path));

      const recording = await Recording.create({
        callId,
        name,
        storageUrl: relativePath,
        storageProvider: 'local',
        startedAt,
        endedAt: new Date(),
        durationSeconds,
        status: 'STOPPED'
      });

      return res.status(201).json({ success: true, data: { recording } });
    } catch (error) {
      next(error);
    }
  }

  // GET /user/recordings — list recordings for calls the user participated in.
  static async listRecordings(req, res, next) {
    try {
      const recordings = await Recording.findAll({
        where: { storageUrl: { [Op.ne]: null } },
        order: [['createdAt', 'DESC']],
        include: [{
          model: Call,
          as: 'call',
          required: true,
          where: { [Op.or]: [{ callerId: req.user.id }, { receiverId: req.user.id }] },
          attributes: ['id', 'roomName', 'callerId', 'receiverId', 'startedAt']
        }]
      });
      return res.status(200).json({ success: true, data: { recordings } });
    } catch (error) {
      next(error);
    }
  }

  // PATCH /user/recordings/:id  { name }
  static async renameRecording(req, res, next) {
    const { id } = req.params;
    const { name } = req.body;
    try {
      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_NAME', message: 'A non-empty name is required.' } });
      }

      const recording = await Recording.findByPk(id, {
        include: [{ model: Call, as: 'call', attributes: ['callerId', 'receiverId'] }]
      });
      if (!recording || !recording.call) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Recording not found' } });
      }
      if (![recording.call.callerId, recording.call.receiverId].includes(req.user.id)) {
        return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You cannot modify this recording.' } });
      }

      recording.name = name.trim();
      await recording.save();
      return res.status(200).json({ success: true, data: { recording } });
    } catch (error) {
      next(error);
    }
  }

  // GET /user/recordings/:id/file — auth-protected streaming of the media file.
  static async streamRecording(req, res, next) {
    const { id } = req.params;
    try {
      const recording = await Recording.findByPk(id, {
        include: [{ model: Call, as: 'call', attributes: ['callerId', 'receiverId'] }]
      });
      if (!recording || !recording.storageUrl || !recording.call) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Recording not found' } });
      }
      if (![recording.call.callerId, recording.call.receiverId].includes(req.user.id)) {
        return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You cannot access this recording.' } });
      }

      const absPath = path.join(UPLOADS_DIR, recording.storageUrl);
      // Guard against path traversal: the resolved path must stay under uploads.
      if (!absPath.startsWith(UPLOADS_DIR) || !fs.existsSync(absPath)) {
        return res.status(404).json({ success: false, error: { code: 'FILE_MISSING', message: 'Recording file is missing.' } });
      }

      const stat = fs.statSync(absPath);
      const range = req.headers.range;
      res.setHeader('Content-Type', 'video/webm');

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Length', end - start + 1);
        fs.createReadStream(absPath, { start, end }).pipe(res);
      } else {
        res.setHeader('Content-Length', stat.size);
        fs.createReadStream(absPath).pipe(res);
      }
    } catch (error) {
      next(error);
    }
  }

  // GET /user/transcriptions — calls (the user participated in) that have a
  // transcript, with counts + whether a summary exists, for the library page.
  static async listTranscriptionSessions(req, res, next) {
    try {
      const calls = await Call.findAll({
        where: { [Op.or]: [{ callerId: req.user.id }, { receiverId: req.user.id }] },
        order: [['createdAt', 'DESC']],
        include: [
          { model: Transcription, as: 'transcriptions', attributes: ['id'], separate: true },
          { model: Summary, as: 'summaries', attributes: ['id'], separate: true },
          { model: User, as: 'caller', attributes: ['id', 'name'] },
          { model: User, as: 'receiver', attributes: ['id', 'name'] }
        ]
      });

      const sessions = calls
        .map((c) => ({
          callId: c.id,
          roomName: c.roomName,
          startedAt: c.startedAt || c.createdAt,
          durationSeconds: c.durationSeconds,
          caller: c.caller,
          receiver: c.receiver,
          transcriptCount: c.transcriptions ? c.transcriptions.length : 0,
          hasSummary: c.summaries ? c.summaries.length > 0 : false
        }))
        .filter((s) => s.transcriptCount > 0);

      return res.status(200).json({ success: true, data: { sessions } });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = MediaController;
