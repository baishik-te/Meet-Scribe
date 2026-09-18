const router = require('express').Router();
const UserController = require('../controller/user.controller');
const WalletController = require('../controller/wallet.controller');
const MediaController = require('../controller/media.controller');
const MessageController = require('../controller/message.controller');
const authenticate = require('../middleware/auth.middleware');
const verifyActive = require('../middleware/verify-active.middleware');
const { uploadRecording } = require('../middleware/upload.middleware');

// OTP verification routes (no authentication required)
router.post('/otp/resend', UserController.resendOtp);
router.post('/otp/verify', UserController.verifyOtp); // Returns login token
router.post('/otp/verify-only', UserController.verifyOtpOnly); // Only verifies, no token

router.use(authenticate);

// Apply verifyActive middleware to all routes below to block INACTIVE users
router.use(verifyActive);

// Profile
router.get('/profile', UserController.getProfile);
router.patch('/profile', UserController.updateProfile);
router.patch('/password', UserController.changePassword);

// Subscription Plans
router.get('/plans', UserController.listPlans);
router.post('/checkout', UserController.createCheckoutSession);
router.get('/subscription', UserController.getActiveSubscription);

// Wallet
router.get('/wallet/balance', WalletController.getBalance);
router.get('/wallet/ledger', WalletController.getLedgerHistory);

// Connections
router.get('/connections/search', UserController.searchUsers);
router.get('/connections', UserController.getConnections);
router.post('/connections', UserController.sendConnectionRequest);
router.patch('/connections/:id/respond', UserController.respondConnection);
router.delete('/connections/:id/cancel', UserController.cancelConnectionRequest);
router.post('/connections/block', UserController.blockUser);
router.post('/connections/unblock', UserController.unblockUser);

// Direct 1:1 Messaging (within accepted connections)
router.get('/messages/summary', MessageController.getSummary);
router.get('/connections/:connectionId/messages', MessageController.getMessages);
router.post('/connections/:connectionId/messages', MessageController.sendMessage);
router.post('/connections/:connectionId/typing', MessageController.setTyping);

// Video Calls & LiveKit
router.post('/calls/initiate', UserController.initiateCall);
router.post('/calls/accept', UserController.acceptCall);
router.post('/calls/end', UserController.endCall);

// Dynamic Recording & Transcription Control
router.post('/calls/recording', UserController.toggleRecording);
router.post('/calls/transcription', UserController.toggleTranscription);
router.post('/calls/transcripts', UserController.submitTranscriptSegment);
router.get('/calls/:callId/transcripts', UserController.getCallTranscripts);

// Transcript summaries (Gemini). Live transcription itself is produced by the
// server-side whisper bot started via POST /calls/transcription.
router.post('/calls/:callId/summary', MediaController.generateSummary);
router.get('/calls/:callId/summary', MediaController.getSummary);

// Recordings (client-side capture → saved under /uploads) + library
router.post('/calls/:callId/recording/upload', uploadRecording.single('recording'), MediaController.uploadRecording);
router.get('/recordings', MediaController.listRecordings);
router.patch('/recordings/:id', MediaController.renameRecording);
router.get('/recordings/:id/file', MediaController.streamRecording);

// Transcription library (calls that have transcripts)
router.get('/transcriptions', MediaController.listTranscriptionSessions);

// MeetScribe AI — RAG PDF chat (inherits auth + verifyActive)
router.use('/pdf', require('./pdfChat.routes'));

module.exports = router;