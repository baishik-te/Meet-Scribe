const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { User, Connection, Call, Recording, Transcription, Plan, Subscription, Otp, sequelize } = require('../models');
const TokenService = require('../services/token.service');
const LiveKitService = require('../services/livekit.service');
const SocketService = require('../services/socket.service');
const StripeService = require('../services/stripe.service');
const TranscriptionBot = require('../services/transcription-bot.service');
const { EmailService } = require('../services/email.service');

class UserController {
  // OTP Verification Methods
  
  static async resendOtp(req, res, next) {
    const { email } = req.body;
    
    // Validate required fields
    if (!email) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_EMAIL', message: 'Email is required' }
      });
    }

    try {
      const user = await User.findOne({ where: { email } });
      if (!user) {
        return res.status(404).json({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'Account not found' }
        });
      }

      if (user.emailVerified && user.status === 'ACTIVE') {
        return res.status(400).json({
          success: false,
          error: { code: 'ALREADY_VERIFIED', message: 'Account is already verified and active' }
        });
      }

      // Check for recent OTP requests (rate limiting)
      const recentOtp = await Otp.findOne({
        where: {
          userId: user.id,
          purpose: 'EMAIL_VERIFICATION',
          createdAt: {
            [Op.gte]: new Date(Date.now() - 2 * 60 * 1000) // 2 minutes
          }
        },
        order: [['createdAt', 'DESC']]
      });

      if (recentOtp) {
        const timeLeft = Math.ceil((recentOtp.createdAt.getTime() + 2 * 60 * 1000 - Date.now()) / 1000);
        return res.status(429).json({
          success: false,
          error: { 
            code: 'RATE_LIMITED', 
            message: `Please wait ${timeLeft} seconds before requesting a new OTP` 
          }
        });
      }

      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpHash = await bcrypt.hash(generatedOtp, 10);

      console.log(`Generating new OTP for ${email}`);

      await sequelize.transaction(async (t) => {
        await Otp.update(
          { verifiedAt: new Date() },
          {
            where: {
              userId: user.id,
              purpose: 'EMAIL_VERIFICATION',
              verifiedAt: null
            },
            transaction: t
          }
        );

        // Create new OTP record
        await Otp.create({
          userId: user.id,
          email,
          otpHash,
          purpose: 'EMAIL_VERIFICATION',
          expiresAt: new Date(Date.now() + (process.env.OTP_EXPIRY_MINUTES || 10) * 60 * 1000)
        }, { transaction: t });

        // Send OTP email
        await EmailService.sendOtp(email, generatedOtp);
        console.log(`New OTP sent successfully for ${email}`);
      });

      return res.status(200).json({
        success: true,
        data: { message: 'New verification OTP sent to your email address' }
      });
    } catch (error) {
      console.error('Resend OTP error:', error);
      next(error);
    }
  }

  static async verifyOtpOnly(req, res, next) {
    const { email, otp } = req.body;
      
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'Email and OTP are required' }
      });
    }

    try {
      const user = await User.findOne({ where: { email } });
      if (!user) {
        return res.status(404).json({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'Account not found' }
        });
      }

      if (user.emailVerified && user.status === 'ACTIVE') {
        return res.status(400).json({
          success: false,
          error: { code: 'ALREADY_VERIFIED', message: 'Account is already verified and active' }
        });
      }

      const otpRecord = await Otp.findOne({
        where: {
          userId: user.id,
          purpose: 'EMAIL_VERIFICATION',
          verifiedAt: null
        },
        order: [['createdAt', 'DESC']]
      });

      if (!otpRecord || new Date() > otpRecord.expiresAt) {
        return res.status(400).json({
          success: false,
          error: { code: 'OTP_EXPIRED', message: 'OTP expired or unavailable. Please request a new one.' }
        });
      }

      if (otpRecord.attempts >= 5) {
        return res.status(400).json({
          success: false,
          error: { code: 'MAX_ATTEMPTS_EXCEEDED', message: 'Maximum verification attempts exceeded. Please request a new OTP.' }
        });
      }

      const matches = await bcrypt.compare(otp, otpRecord.otpHash);
      if (!matches) {
        otpRecord.attempts += 1;
        await otpRecord.save();
        
        const attemptsLeft = 5 - otpRecord.attempts;
        return res.status(400).json({
          success: false,
          error: { 
            code: 'INVALID_OTP', 
            message: `Invalid OTP. ${attemptsLeft} attempts remaining.` 
          }
        });
      }

      // OTP is valid - activate user (without login token)
      await sequelize.transaction(async (t) => {
        otpRecord.verifiedAt = new Date();
        await otpRecord.save({ transaction: t });
        
        user.emailVerified = true;
        user.status = 'ACTIVE';
        await user.save({ transaction: t });

        console.log(`User ${email} successfully verified and activated (verify-only)`);
      });

      return res.status(200).json({
        success: true,
        data: {
          message: 'Email verified successfully! Your account is now active. You can now login.',
          verified: true
        }
      });
    } catch (error) {
      console.error('OTP verification error:', error);
      next(error);
    }
  }

  static async verifyOtp(req, res, next) {
    const { email, otp } = req.body;
    
    // Validate required fields
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'Email and OTP are required' }
      });
    }

    try {
      const user = await User.findOne({ where: { email } });
      if (!user) {
        return res.status(404).json({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'Account not found' }
        });
      }

      if (user.emailVerified && user.status === 'ACTIVE') {
        return res.status(400).json({
          success: false,
          error: { code: 'ALREADY_VERIFIED', message: 'Account is already verified and active' }
        });
      }

      const otpRecord = await Otp.findOne({
        where: {
          userId: user.id,
          purpose: 'EMAIL_VERIFICATION',
          verifiedAt: null
        },
        order: [['createdAt', 'DESC']]
      });

      if (!otpRecord || new Date() > otpRecord.expiresAt) {
        return res.status(400).json({
          success: false,
          error: { code: 'OTP_EXPIRED', message: 'OTP expired or unavailable. Please request a new one.' }
        });
      }

      // Check attempts limit
      if (otpRecord.attempts >= 5) {
        return res.status(400).json({
          success: false,
          error: { code: 'MAX_ATTEMPTS_EXCEEDED', message: 'Maximum verification attempts exceeded. Please request a new OTP.' }
        });
      }

      const matches = await bcrypt.compare(otp, otpRecord.otpHash);
      if (!matches) {
        otpRecord.attempts += 1;
        await otpRecord.save();
        
        const attemptsLeft = 5 - otpRecord.attempts;
        return res.status(400).json({
          success: false,
          error: { 
            code: 'INVALID_OTP', 
            message: `Invalid OTP. ${attemptsLeft} attempts remaining.` 
          }
        });
      }

      // OTP is valid - activate user
      await sequelize.transaction(async (t) => {
        otpRecord.verifiedAt = new Date();
        await otpRecord.save({ transaction: t });
        
        user.emailVerified = true;
        user.status = 'ACTIVE';
        await user.save({ transaction: t });

        console.log(`User ${email} successfully verified and activated`);
      });

      return res.status(200).json({
        success: true,
        data: {
          message: 'Email verified successfully! Your account is now active.',
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.status,
            emailVerified: user.emailVerified,
            avatarUrl: user.avatarUrl
          }
        }
      });
    } catch (error) {
      console.error('OTP verification error:', error);
      next(error);
    }
  }

  // Profile Management 
  static async getProfile(req, res, next) {
    try {
      const user = await User.findByPk(req.user.id, {
        attributes: ['id', 'name', 'email', 'role', 'status', 'emailVerified', 'createdAt', 'avatarUrl']
      });
      return res.status(200).json({ success: true, data: { user } });
    } catch (error) {
      next(error);
    }
  }

  static async updateProfile(req, res, next) {
    const { name } = req.body;
    try {
      req.user.name = name || req.user.name;
      await req.user.save();
      return res.status(200).json({
        success: true,
        data: { user: { id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role } }
      });
    } catch (error) {
      next(error);
    }
  }

  static async uploadAvatar(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_FILE', message: 'An image file is required' }
        });
      }

      const previous = req.user.avatarUrl;
      if (previous && previous.startsWith('/uploads/avatars/')) {
        fs.unlink(path.join(__dirname, '..', previous.replace(/^\//, '')), () => {});
      }

      req.user.avatarUrl = `/uploads/avatars/${req.file.filename}`;
      await req.user.save();

      return res.status(200).json({
        success: true,
        data: {
          user: {
            id: req.user.id,
            name: req.user.name,
            email: req.user.email,
            role: req.user.role,
            status: req.user.status,
            emailVerified: req.user.emailVerified,
            avatarUrl: req.user.avatarUrl
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async changePassword(req, res, next) {
    const { oldPassword, newPassword } = req.body;
    
    // Validate required fields
    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'Old password and new password are required' }
      });
    }

    // Validate new password strength
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: { code: 'WEAK_PASSWORD', message: 'New password must be at least 6 characters long' }
      });
    }

    try {
      // Verify old password
      const user = await User.findByPk(req.user.id);
      const isValidPassword = await bcrypt.compare(oldPassword, user.password);
      
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect' }
        });
      }

      // Hash and update new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
      await user.save();

      return res.status(200).json({
        success: true,
        data: { message: 'Password successfully updated' }
      });
    } catch (error) {
      console.error('Change password error:', error);
      next(error);
    }
  }

  static async listPlans(req, res, next) {
    try {
      const plans = await Plan.findAll({ where: { status: 'ACTIVE' } });
      return res.status(200).json({ success: true, data: { plans } });
    } catch (error) {
      next(error);
    }
  }

  static async createCheckoutSession(req, res, next) {
    const { planId } = req.body;
    try {
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      const session = await StripeService.createCheckoutSession({
        user: req.user,
        planId,
        successUrl: `${clientUrl}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${clientUrl}/dashboard?payment=cancelled`
      });
      return res.status(200).json({ success: true, data: { checkoutUrl: session.url } });
    } catch (error) {
      next(error);
    }
  }

  static async verifyCheckoutSession(req, res, next) {
    const { sessionId } = req.body;
    try {
      const result = await StripeService.verifyAndSyncPayment({
        userId: req.user.id,
        sessionId
      });
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getActiveSubscription(req, res, next) {
    try {
      let subscription = await Subscription.findOne({
        where: { userId: req.user.id, status: 'ACTIVE' },
        include: [{ model: Plan, as: 'plan' }]
      });

      // If no active subscription is recorded in DB and user has a stripeCustomerId, auto-sync directly from Stripe
      if (!subscription && req.user.stripeCustomerId) {
        try {
          const syncResult = await StripeService.verifyAndSyncPayment({ userId: req.user.id });
          if (syncResult && syncResult.success && syncResult.data?.subscription) {
            subscription = syncResult.data.subscription;
          }
        } catch (e) {
          console.warn('[Subscription] Auto-sync with Stripe skipped:', e.message);
        }
      }

      return res.status(200).json({ success: true, data: { subscription } });
    } catch (error) {
      next(error);
    }
  }

  // Connections

  static async searchUsers(req, res, next) {
    const { q } = req.query;
    try {
      const users = await User.findAll({
        where: {
          id: { [Op.ne]: req.user.id },
          status: 'ACTIVE',
          ...(q ? {
            [Op.or]: [
              { name: { [Op.iLike]: `%${q}%` } },
              { email: { [Op.iLike]: `%${q}%` } }
            ]
          } : {})
        },
        attributes: ['id', 'name', 'email']
      });
      return res.status(200).json({ success: true, data: { users } });
    } catch (error) {
      next(error);
    }
  }

  static async getConnections(req, res, next) {
    try {
      const connections = await Connection.findAll({
        where: {
          [Op.or]: [{ requesterId: req.user.id }, { receiverId: req.user.id }]
        },
        include: [
          { model: User, as: 'requester', attributes: ['id', 'name', 'email'] },
          { model: User, as: 'receiver', attributes: ['id', 'name', 'email'] }
        ],
        order: [['createdAt', 'DESC']]
      });

      // Categorize connections with role information
      const categorizedConnections = connections.map(conn => {
        const isRequester = conn.requesterId === req.user.id;
        const isReceiver = conn.receiverId === req.user.id;
        
        return {
          id: conn.id,
          status: conn.status,
          createdAt: conn.createdAt,
          updatedAt: conn.updatedAt,
          myRole: isRequester ? 'SENDER' : 'RECEIVER',
          contact: isRequester ? conn.receiver : conn.requester,
          requester: conn.requester,
          receiver: conn.receiver,
          requesterId: conn.requesterId,
          receiverId: conn.receiverId
        };
      });

      return res.status(200).json({ 
        success: true, 
        data: { 
          connections: categorizedConnections,
          // Summary counts
          summary: {
            total: connections.length,
            incoming: connections.filter(c => c.receiverId === req.user.id && c.status === 'PENDING').length,
            outgoing: connections.filter(c => c.requesterId === req.user.id && c.status === 'PENDING').length,
            accepted: connections.filter(c => c.status === 'ACCEPTED').length,
            blocked: connections.filter(c => c.requesterId === req.user.id && c.status === 'BLOCKED').length
          }
        } 
      });
    } catch (error) {
      next(error);
    }
  }

  static async sendConnectionRequest(req, res, next) {
    const { receiverId } = req.body;
    try {
      if (receiverId === req.user.id) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_TARGET', message: 'Self-connection forbidden' } });
      }

      const existing = await Connection.findOne({
        where: {
          [Op.or]: [
            { requesterId: req.user.id, receiverId },
            { requesterId: receiverId, receiverId: req.user.id }
          ]
        }
      });

      if (existing) {
        if (existing.status === 'ACCEPTED') {
          return res.status(200).json({ success: true, data: { connection: existing } });
        }
        // If receiver already sent a request to me, and now I send to receiver: auto-accept!
        if (existing.status === 'PENDING' && existing.receiverId === req.user.id) {
          existing.status = 'ACCEPTED';
          await existing.save();

          const NotificationService = require('../services/notification.service');
          SocketService.emitToUser(existing.requesterId, 'connection:responded', {
            connectionId: existing.id,
            status: 'ACCEPTED'
          });
          SocketService.emitToUser(req.user.id, 'connection:responded', {
            connectionId: existing.id,
            status: 'ACCEPTED'
          });

          await NotificationService.createNotification({
            userId: existing.requesterId,
            type: 'CONNECTION_ACCEPTED',
            title: 'Connection Accepted',
            message: `${req.user.name} connected with you. You can now chat and start calls.`,
            data: { connectionId: existing.id, partnerId: req.user.id, partnerName: req.user.name }
          });

          return res.status(200).json({ success: true, data: { connection: existing, autoAccepted: true } });
        }

        return res.status(400).json({ success: false, error: { code: 'CONNECTION_EXISTS', message: 'Connection already exists' } });
      }

      const connection = await Connection.create({
        requesterId: req.user.id,
        receiverId,
        status: 'PENDING'
      });

      SocketService.emitToUser(receiverId, 'connection:requested', {
        connectionId: connection.id,
        requester: { id: req.user.id, name: req.user.name, email: req.user.email }
      });

      const NotificationService = require('../services/notification.service');
      await NotificationService.createNotification({
        userId: receiverId,
        type: 'CONNECTION_REQUEST',
        title: 'New Connection Request',
        message: `${req.user.name} sent you a connection request.`,
        data: { connectionId: connection.id, requesterId: req.user.id, requesterName: req.user.name }
      });

      return res.status(201).json({ success: true, data: { connection } });
    } catch (error) {
      next(error);
    }
  }

  static async respondConnection(req, res, next) {
    const { id } = req.params;
    const { action } = req.body; // 'ACCEPT' or 'REJECT'
    try {
      const connection = await Connection.findOne({
        where: { id, receiverId: req.user.id, status: 'PENDING' }
      });

      if (!connection) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Pending request not found' } });
      }

      connection.status = action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';
      await connection.save();

      SocketService.emitToUser(connection.requesterId, 'connection:responded', {
        connectionId: connection.id,
        status: connection.status
      });
      SocketService.emitToUser(req.user.id, 'connection:responded', {
        connectionId: connection.id,
        status: connection.status
      });

      if (action === 'ACCEPT') {
        const NotificationService = require('../services/notification.service');
        await NotificationService.createNotification({
          userId: connection.requesterId,
          type: 'CONNECTION_ACCEPTED',
          title: 'Connection Accepted',
          message: `${req.user.name} accepted your connection request. You can now chat and start calls.`,
          data: { connectionId: connection.id, partnerId: req.user.id, partnerName: req.user.name }
        });
      }

      return res.status(200).json({ success: true, data: { connection } });
    } catch (error) {
      next(error);
    }
  }

  // Cancel connection request
  static async cancelConnectionRequest(req, res, next) {
    const { id } = req.params;
    try {
      const connection = await Connection.findOne({
        where: { id, requesterId: req.user.id, status: 'PENDING' }
      });

      if (!connection) {
        return res.status(404).json({ 
          success: false, 
          error: { code: 'NOT_FOUND', message: 'Pending outgoing request not found' } 
        });
      }

      // Delete the connection request
      await connection.destroy();

      SocketService.emitToUser(connection.receiverId, 'connection:cancelled', {
        connectionId: connection.id,
        requesterId: req.user.id
      });

      return res.status(200).json({ 
        success: true, 
        data: { message: 'Connection request cancelled' } 
      });
    } catch (error) {
      next(error);
    }
  }

  // Block user (for sender)
  static async blockUser(req, res, next) {
    const { userId } = req.body; // User to block
    try {
      if (userId === req.user.id) {
        return res.status(400).json({ 
          success: false, 
          error: { code: 'INVALID_TARGET', message: 'Cannot block yourself' } 
        });
      }

      // Check if connection exists
      const existing = await Connection.findOne({
        where: {
          [Op.or]: [
            { requesterId: req.user.id, receiverId: userId },
            { requesterId: userId, receiverId: req.user.id }
          ]
        }
      });

      if (existing) {
        // Update existing connection to BLOCKED
        existing.status = 'BLOCKED';
        existing.requesterId = req.user.id; // Ensure current user is the blocker
        existing.receiverId = userId;
        await existing.save();

        SocketService.emitToUser(userId, 'connection:blocked', {
          blockerId: req.user.id
        });

        return res.status(200).json({ 
          success: true, 
          data: { message: 'User blocked successfully', connection: existing } 
        });
      } else {
        // Create new BLOCKED connection
        const connection = await Connection.create({
          requesterId: req.user.id,
          receiverId: userId,
          status: 'BLOCKED'
        });

        return res.status(201).json({ 
          success: true, 
          data: { message: 'User blocked successfully', connection } 
        });
      }
    } catch (error) {
      next(error);
    }
  }

  // Unblock user
  static async unblockUser(req, res, next) {
    const { userId } = req.body;
    try {
      const connection = await Connection.findOne({
        where: {
          requesterId: req.user.id,
          receiverId: userId,
          status: 'BLOCKED'
        }
      });

      if (!connection) {
        return res.status(404).json({ 
          success: false, 
          error: { code: 'NOT_FOUND', message: 'No blocked connection found' } 
        });
      }

      // Delete the blocked connection
      await connection.destroy();

      SocketService.emitToUser(userId, 'connection:unblocked', {
        unblockerId: req.user.id
      });

      return res.status(200).json({ 
        success: true, 
        data: { message: 'User unblocked successfully' } 
      });
    } catch (error) {
      next(error);
    }
  }

  // LiveKit Video Calls

  static async initiateCall(req, res, next) {
    const { receiverId } = req.body;
    try {
      // 1. Connection Validation Rule
      const connection = await Connection.findOne({
        where: {
          status: 'ACCEPTED',
          [Op.or]: [
            { requesterId: req.user.id, receiverId },
            { requesterId: receiverId, receiverId: req.user.id }
          ]
        }
      });

      if (!connection) {
        return res.status(403).json({
          success: false,
          error: { code: 'CONNECTION_REQUIRED', message: 'Active mutual connection required before starting a call' }
        });
      }

      // 2. Resolve Rate Card & 3-Minute Pre-Check
      const sub = await Subscription.findOne({
        where: { userId: req.user.id, status: 'ACTIVE' },
        include: [{ model: Plan, as: 'plan' }]
      });

      const videoRate = sub?.plan?.videoRatePerMinute || 2;
      const minRequired = 3 * videoRate;
      const balance = await TokenService.getBalance(req.user.id);

      if (balance < minRequired) {
        return res.status(402).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_TOKENS',
            message: `Minimum ${minRequired} tokens (3 minutes @ ${videoRate}/min) required to start call. Current balance: ${balance}`
          }
        });
      }

      const roomName = `room-${uuidv4().substring(0, 8)}`;
      const call = await Call.create({
        roomName,
        callerId: req.user.id,
        receiverId,
        status: 'RINGING',
        videoEnabled: true,
        recordingEnabled: false,
        transcriptionEnabled: false
      });

      const callerToken = await LiveKitService.generateToken(roomName, req.user.id, req.user.name);

      SocketService.emitToUser(receiverId, 'call:incoming', {
        callId: call.id,
        roomName,
        caller: { id: req.user.id, name: req.user.name }
      });

      const NotificationService = require('../services/notification.service');
      await NotificationService.createNotification({
        userId: receiverId,
        type: 'CALL_INCOMING',
        title: 'Incoming Video Call',
        message: `${req.user.name} is calling you`,
        data: {
          callId: call.id,
          roomName,
          callerId: req.user.id,
          callerName: req.user.name
        }
      });

      return res.status(201).json({
        success: true,
        data: {
          call,
          livekitToken: callerToken,
          livekitHost: process.env.LIVEKIT_URL || 'http://localhost:7880'
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async acceptCall(req, res, next) {
    const { callId } = req.body;
    try {
      const call = await Call.findOne({
        where: {
          id: callId,
          [Op.or]: [{ receiverId: req.user.id }, { callerId: req.user.id }]
        }
      });
      if (!call) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Call not found' } });
      }

      if (call.status === 'ENDED' || call.status === 'MISSED') {
        const endedAgo = call.endedAt ? (Date.now() - new Date(call.endedAt).getTime()) : 0;
        if (endedAgo > 300000 && call.durationSeconds > 0) {
          return res.status(400).json({ success: false, error: { code: 'CALL_ENDED', message: 'This call has already ended' } });
        }
        call.status = 'ACTIVE';
        call.endedAt = null;
      } else {
        call.status = 'ACTIVE';
      }
      if (!call.startedAt) call.startedAt = new Date();
      if (!call.lastBilledAt) call.lastBilledAt = new Date();
      await call.save();

      const receiverToken = await LiveKitService.generateToken(call.roomName, req.user.id, req.user.name);

      SocketService.emitToUser(call.callerId, 'call:accepted', { callId: call.id, roomName: call.roomName });

      // Mark the incoming call notification as read
      try {
        const { Notification } = require('../models');
        await Notification.update(
          { read: true, readAt: new Date() },
          { where: { userId: req.user.id, type: 'CALL_INCOMING' } }
        );
      } catch {}

      return res.status(200).json({
        success: true,
        data: {
          call,
          livekitToken: receiverToken,
          livekitHost: process.env.LIVEKIT_URL || 'http://localhost:7880'
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async endCall(req, res, next) {
    const { callId, reason } = req.body;
    try {
      const { endCallInstantly } = require('../services/callTeardown.service');
      const LiveKitService = require('../services/livekit.service');

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(callId);
      const where = isUuid
        ? { [Op.or]: [{ id: callId }, { roomName: callId }] }
        : { roomName: callId };

      const call = await Call.findOne({ where });
      if (!call) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Call record not found' } });
      }

      // Check if other real participants are still in the LiveKit room
      const identities = await LiveKitService.listParticipantIdentities(call.roomName);
      if (identities !== null) {
        const others = identities.filter(id => {
          const s = String(id);
          return !s.startsWith('transcriber-') && s !== String(req.user.id);
        });

        if (others.length > 0) {
          // Other participant is still in the call!
          // Remove only this user from LiveKit room, and keep the call active for the other participant!
          await LiveKitService.removeParticipant(call.roomName, req.user.id).catch(() => {});
          return res.status(200).json({
            success: true,
            data: { message: 'User left the call. Other participant remains in the call.', call }
          });
        }
      }

      // No other participants remaining in the room: terminate call immediately!
      const endedCall = await endCallInstantly(call.id, reason || 'USER_ENDED');
      return res.status(200).json({ success: true, data: { call: endedCall || call } });
    } catch (error) {
      next(error);
    }
  }

  static async leaveCall(req, res, next) {
    let body = req.body;
    if (Buffer.isBuffer(body)) {
      try {
        body = JSON.parse(body.toString());
      } catch {
        body = {};
      }
    }
    const callId = body?.callId;
    const userId = req.user?.id || body?.userId;
    try {
      const { checkAndEndIfEmpty } = require('../services/callTeardown.service');
      if (callId) {
        await checkAndEndIfEmpty(callId, userId);
      }
      return res.status(200).json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  // --- Dynamic Media Feature Control (Recording & Transcription) ---

  static async toggleRecording(req, res, next) {
    const { callId, enable } = req.body;
    try {
      const call = await Call.findByPk(callId);
      if (!call || !['RINGING', 'ACTIVE'].includes(call.status)) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_CALL', message: 'Call is not active' } });
      }

      if (call.status === 'RINGING') {
        call.status = 'ACTIVE';
        call.startedAt = call.startedAt || new Date();
        call.lastBilledAt = call.lastBilledAt || new Date();
      }

      if (enable) {
        const egressId = await LiveKitService.startRoomCompositeEgress(call.roomName);
        await Recording.create({
          callId: call.id,
          egressId,
          startedAt: new Date(),
          status: 'ACTIVE'
        });
        call.recordingEnabled = true;
      } else {
        const recording = await Recording.findOne({ where: { callId: call.id, status: 'ACTIVE' } });
        if (recording) {
          await LiveKitService.stopEgress(recording.egressId);
          recording.status = 'STOPPED';
          recording.endedAt = new Date();
          await recording.save();
        }
        call.recordingEnabled = false;
      }

      await call.save();
      SocketService.emitToRoom(call.roomName, 'call:feature_updated', {
        recordingEnabled: call.recordingEnabled,
        transcriptionEnabled: call.transcriptionEnabled
      });

      // Synchronize updated burn rate and wallet balance immediately
      const { syncCallBalanceAndRate } = require('../services/billingSync.service');
      await syncCallBalanceAndRate(call.roomName);

      return res.status(200).json({ success: true, data: { call } });
    } catch (error) {
      next(error);
    }
  }

  static async toggleTranscription(req, res, next) {
    const { callId, enable } = req.body;
    try {
      const call = await Call.findByPk(callId);
      if (!call || !['RINGING', 'ACTIVE'].includes(call.status)) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_CALL', message: 'Call is not available for transcription' } });
      }

      if (call.status === 'RINGING') {
        call.status = 'ACTIVE';
        call.startedAt = call.startedAt || new Date();
        call.lastBilledAt = call.lastBilledAt || new Date();
      }

      call.transcriptionEnabled = Boolean(enable);
      await call.save();

      if (call.transcriptionEnabled) {
        TranscriptionBot.startForCall(call).catch((err) =>
          console.error('[toggleTranscription] bot start error:', err.message)
        );
      } else {
        TranscriptionBot.stopForCall(call.id).catch((err) =>
          console.error('[toggleTranscription] bot stop error:', err.message)
        );
      }

      SocketService.emitToRoom(call.roomName, 'call:feature_updated', {
        recordingEnabled: call.recordingEnabled,
        transcriptionEnabled: call.transcriptionEnabled
      });

      // Synchronize updated burn rate and wallet balance immediately
      const { syncCallBalanceAndRate } = require('../services/billingSync.service');
      await syncCallBalanceAndRate(call.roomName);

      return res.status(200).json({ success: true, data: { call } });
    } catch (error) {
      next(error);
    }
  }

  static async submitTranscriptSegment(req, res, next) {
    const { callId, text, startTime, endTime } = req.body;
    try {
      const transcript = await Transcription.create({
        callId,
        speakerId: req.user.id,
        text,
        startTime,
        endTime
      });


      const call = await Call.findByPk(callId);
      if (call) {
        SocketService.emitToRoom(call.roomName, 'transcription:new', {
          transcript,
          speakerName: req.user.name
        });
      }

      return res.status(201).json({ success: true, data: { transcript } });
    } catch (error) {
      next(error);
    }
  }

  static async getCallTranscripts(req, res, next) {
    const { callId } = req.params;
    try {
      const transcripts = await Transcription.findAll({
        where: { callId },
        order: [['createdAt', 'ASC']],
        include: [{ model: User, as: 'speaker', attributes: ['id', 'name'] }]
      });
      return res.status(200).json({ success: true, data: { transcripts } });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = UserController;
