const router = require('express').Router();
const UserController = require('../controller/user.controller');
const WalletController = require('../controller/wallet.controller');
const MediaController = require('../controller/media.controller');
const MessageController = require('../controller/message.controller');
const NotificationController = require('../controller/notification.controller');
const DashboardController = require('../controller/dashboard.controller');
const authenticate = require('../middleware/auth.middleware');
const verifyActive = require('../middleware/verify-active.middleware');
const { uploadRecording, uploadAvatar, uploadMessageFile } = require('../middleware/upload.middleware');

// OTP verification routes (no authentication required)
router.post('/otp/resend', UserController.resendOtp);
router.post('/otp/verify', UserController.verifyOtp); 
router.post('/otp/verify-only', UserController.verifyOtpOnly); 

router.use(authenticate);

// Apply verifyActive middleware to all routes below to block INACTIVE users
router.use(verifyActive);

// Profile
router.get('/profile', UserController.getProfile);
router.patch('/profile', UserController.updateProfile);
router.post('/avatar', (req, res, next) => {
  uploadAvatar.single('avatar')(req, res, (err) => {
    if (err) {
      err.status = err.status || 400;
      return next(err);
    }
    next();
  });
}, UserController.uploadAvatar);
router.patch('/password', UserController.changePassword);

// Subscription Plans
router.get('/plans', UserController.listPlans);
router.post('/checkout', UserController.createCheckoutSession);
router.post('/checkout/verify', UserController.verifyCheckoutSession);
router.get('/subscription', UserController.getActiveSubscription);

// Wallet
router.get('/wallet/balance', WalletController.getBalance);
router.get('/wallet/ledger', WalletController.getLedgerHistory);

// Dashboard Analytics, Scheduled Calls & AI Insights
router.get('/dashboard/analytics', DashboardController.getAnalytics);
router.get('/dashboard/meetings', DashboardController.getMeetings);
router.post('/dashboard/scheduled-calls', DashboardController.createScheduledCall);
router.patch('/dashboard/scheduled-calls/:id/auto-scribe', DashboardController.toggleAutoScribe);
router.get('/dashboard/ai-insights', DashboardController.getAiInsights);
router.post('/dashboard/action-items', DashboardController.createActionItem);
router.patch('/dashboard/action-items/:id', DashboardController.toggleActionItem);

// Connections
router.get('/connections/search', UserController.searchUsers);
router.get('/connections', UserController.getConnections);
router.post('/connections', UserController.sendConnectionRequest);
router.patch('/connections/:id/respond', UserController.respondConnection);
router.delete('/connections/:id/cancel', UserController.cancelConnectionRequest);
router.post('/connections/block', UserController.blockUser);
router.post('/connections/unblock', UserController.unblockUser);

// Direct 1 on 1 Messaging 
router.get('/messages/summary', MessageController.getSummary);
router.get('/connections/:connectionId/messages', MessageController.getMessages);
router.post('/connections/:connectionId/messages', uploadMessageFile.single('file'), MessageController.sendMessage);
router.post('/connections/:connectionId/typing', MessageController.setTyping);

// Video Calls & LiveKit
router.post('/calls/initiate', UserController.initiateCall);
router.post('/calls/accept', UserController.acceptCall);
router.post('/calls/end', UserController.endCall);
router.post('/calls/leave', UserController.leaveCall);

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

// MeetScribe AI 
router.use('/pdf', require('./pdfChat.routes'));

// Notifications
router.get('/notifications', NotificationController.list);
router.patch('/notifications/read-all', NotificationController.markAllRead);
router.post('/notifications/mark-read', NotificationController.markMultipleRead);
router.post('/notifications/delete-many', NotificationController.deleteMultiple);
router.patch('/notifications/:id/read', NotificationController.markRead);
router.delete('/notifications/:id', NotificationController.delete);

module.exports = router;