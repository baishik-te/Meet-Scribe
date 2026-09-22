const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Otp, Wallet, sequelize } = require('../models');
const { EmailService } = require('../services/email.service');

const OTP_EXPIRY_MS = (Number(process.env.OTP_EXPIRY_MINUTES) || 10) * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

class AuthController {
  static async register(req, res, next) {
    const { name, email, password } = req.body;
    
    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'Name, email, and password are required' }
      });
    }

    try {
      const existing = await User.findOne({ where: { email } });
      if (existing) {
        return res.status(400).json({
          success: false,
          error: { code: 'EMAIL_EXISTS', message: 'Email address already registered' }
        });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpHash = await bcrypt.hash(generatedOtp, 10);

      console.log(`Starting registration process for ${email}`);

      await sequelize.transaction(async (t) => {
        const user = await User.create({
          name,
          email,
          passwordHash,
          role: 'USER',
          status: 'INACTIVE'
        }, { transaction: t });

        console.log(`User created with ID: ${user.id}, status: ${user.status}`);

        await Wallet.create({ userId: user.id, currentTokenBalance: 0 }, { transaction: t });

        await Otp.create({
          userId: user.id,
          email,
          otpHash,
          purpose: 'EMAIL_VERIFICATION',
          expiresAt: new Date(Date.now() + 10 * 60 * 1000)
        }, { transaction: t });

        console.log(`OTP record created for user ${user.id}`);

        // Send OTP email
        await EmailService.sendOtp(email, generatedOtp);
        console.log(`Registration completed successfully for ${email}`);
      });

      return res.status(201).json({
        success: true,
        data: { message: 'Registration initiated. Verification OTP dispatched.' }
      });
    } catch (error) {
      console.error('Registration error:', error);
      next(error);
    }
  }

  static async verifyEmail(req, res, next) {
    const { email, otp } = req.body;
    try {
      const user = await User.findOne({ where: { email } });
      if (!user) {
        return res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'Account not found' } });
      }

      const otpRecord = await Otp.findOne({
        where: { userId: user.id, purpose: 'EMAIL_VERIFICATION', verifiedAt: null },
        order: [['createdAt', 'DESC']]
      });

      if (!otpRecord || new Date() > otpRecord.expiresAt) {
        return res.status(400).json({ success: false, error: { code: 'OTP_EXPIRED', message: 'OTP expired or unavailable' } });
      }

      const matches = await bcrypt.compare(otp, otpRecord.otpHash);
      if (!matches) {
        otpRecord.attempts += 1;
        await otpRecord.save();
        return res.status(400).json({ success: false, error: { code: 'INVALID_OTP', message: 'Provided code is incorrect' } });
      }

      await sequelize.transaction(async (t) => {
        otpRecord.verifiedAt = new Date();
        await otpRecord.save({ transaction: t });
        user.emailVerified = true;
        user.status = 'ACTIVE';
        await user.save({ transaction: t });
      });

      const token = jwt.sign(
        { userId: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      return res.status(200).json({
        success: true,
        data: {
          token,
          user: { 
            id: user.id, 
            name: user.name, 
            email: user.email, 
            role: user.role,
            status: user.status,
            emailVerified: user.emailVerified
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async login(req, res, next) {
    const { email, password } = req.body;
    try {
      const user = await User.findOne({ where: { email } });
      if (!user) {
        return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
      }

      const matches = await bcrypt.compare(password, user.passwordHash);
      if (!matches) {
        return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
      }

      // Check account status BEFORE email verification
      if (user.status === 'INACTIVE') {
        return res.status(403).json({ 
          success: false, 
          error: { 
            code: 'ACCOUNT_INACTIVE', 
            message: 'Your account is inactive. Please verify your email to activate your account.',
            email: user.email,
            requiresOtpVerification: true
          } 
        });
      }

      if (user.status !== 'ACTIVE') {
        return res.status(403).json({ 
          success: false, 
          error: { 
            code: 'ACCOUNT_SUSPENDED', 
            message: 'Account is suspended or unavailable' 
          } 
        });
      }

      if (!user.emailVerified) {
        return res.status(403).json({ 
          success: false, 
          error: { 
            code: 'EMAIL_NOT_VERIFIED', 
            message: 'Email address requires verification',
            email: user.email,
            userStatus: user.status
          } 
        });
      }

      const token = jwt.sign(
        { userId: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      return res.status(200).json({
        success: true,
        data: {
          token,
          user: { 
            id: user.id, 
            name: user.name, 
            email: user.email, 
            role: user.role,
            status: user.status,
            emailVerified: user.emailVerified
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async me(req, res, next) {
    try {
      const user = await User.findByPk(req.user.id, {
        attributes: ['id', 'name', 'email', 'role', 'status', 'emailVerified']
      });
      return res.status(200).json({ success: true, data: { user } });
    } catch (error) {
      next(error);
    }
  }

  // Step 1: Request a password reset. Sends an OTP to the user's email.
  // Always responds with success to avoid leaking which emails are registered.
  static async forgotPassword(req, res, next) {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'Email is required' }
      });
    }

    const genericResponse = {
      success: true,
      data: { message: 'If an account exists for that email, a reset code has been sent.' }
    };

    try {
      const user = await User.findOne({ where: { email } });

      // Do not reveal whether the account exists.
      if (!user) {
        return res.status(200).json(genericResponse);
      }

      const generatedOtp = generateOtp();
      const otpHash = await bcrypt.hash(generatedOtp, 10);

      await Otp.create({
        userId: user.id,
        email: user.email,
        otpHash,
        purpose: 'PASSWORD_RESET',
        expiresAt: new Date(Date.now() + OTP_EXPIRY_MS)
      });

      await EmailService.sendOtp(user.email, generatedOtp);

      return res.status(200).json(genericResponse);
    } catch (error) {
      next(error);
    }
  }

  // Step 2: Verify the password reset OTP without consuming it.
  static async verifyResetOtp(req, res, next) {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'Email and OTP are required' }
      });
    }

    try {
      const result = await AuthController._findValidResetOtp(email, otp);
      if (!result.ok) {
        return res.status(result.status).json({ success: false, error: result.error });
      }

      return res.status(200).json({
        success: true,
        data: { message: 'OTP verified. You may now set a new password.' }
      });
    } catch (error) {
      next(error);
    }
  }

  // Step 3: Reset the password. Re-validates the OTP, then updates the hash.
  static async resetPassword(req, res, next) {
    const { email, otp, newPassword, confirmPassword } = req.body;

    if (!email || !otp || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'Email, OTP, new password and confirmation are required' }
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: { code: 'PASSWORD_MISMATCH', message: 'Passwords do not match' }
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters long' }
      });
    }

    try {
      const result = await AuthController._findValidResetOtp(email, otp);
      if (!result.ok) {
        return res.status(result.status).json({ success: false, error: result.error });
      }

      const { user, otpRecord } = result;
      const passwordHash = await bcrypt.hash(newPassword, 12);

      await sequelize.transaction(async (t) => {
        user.passwordHash = passwordHash;
        await user.save({ transaction: t });

        otpRecord.verifiedAt = new Date();
        await otpRecord.save({ transaction: t });
      });

      return res.status(200).json({
        success: true,
        data: { message: 'Password updated successfully. You can now sign in with your new password.' }
      });
    } catch (error) {
      next(error);
    }
  }

  // Shared helper: locate and validate the latest unused PASSWORD_RESET OTP.
  // Returns { ok, user, otpRecord } on success, or { ok:false, status, error }.
  static async _findValidResetOtp(email, otp) {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return { ok: false, status: 400, error: { code: 'INVALID_OTP', message: 'Invalid or expired code' } };
    }

    const otpRecord = await Otp.findOne({
      where: { userId: user.id, purpose: 'PASSWORD_RESET', verifiedAt: null },
      order: [['createdAt', 'DESC']]
    });

    if (!otpRecord || new Date() > otpRecord.expiresAt) {
      return { ok: false, status: 400, error: { code: 'OTP_EXPIRED', message: 'OTP expired or unavailable' } };
    }

    if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
      return { ok: false, status: 429, error: { code: 'TOO_MANY_ATTEMPTS', message: 'Too many invalid attempts. Request a new code.' } };
    }

    const matches = await bcrypt.compare(otp, otpRecord.otpHash);
    if (!matches) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      return { ok: false, status: 400, error: { code: 'INVALID_OTP', message: 'Provided code is incorrect' } };
    }

    return { ok: true, user, otpRecord };
  }
}

module.exports = AuthController;