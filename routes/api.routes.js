const express = require('express');
const router = express.Router();

const AuthController = require('../controller/auth.controller');
const authenticate = require('../middleware/auth.middleware');

const userRoutes = require('./user.routes');
const adminRoutes = require('./admin.routes');

// Note: Stripe webhook is handled directly in index.js before JSON parsing
// This is required because Stripe needs the raw body for signature verification

router.use(express.json());
router.use(express.urlencoded({ extended: true }));

// Auth
router.post('/auth/register', AuthController.register);
router.post('/auth/verify-email', AuthController.verifyEmail); // Legacy endpoint - kept for backward compatibility
router.post('/auth/login', AuthController.login);
router.get('/auth/me', authenticate, AuthController.me);

// Alternative OTP endpoints in user routes (recommended for new implementations)
// /user/otp/resend and /user/otp/verify

// Debug endpoint - remove in production
if (process.env.NODE_ENV === 'development') {
  router.get('/debug/users', async (req, res) => {
    try {
      const { User } = require('../models');
      const users = await User.findAll({
        attributes: ['id', 'email', 'status', 'emailVerified', 'createdAt'],
        order: [['createdAt', 'DESC']],
        limit: 10
      });
      res.json({ users });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/debug/health', (req, res) => {
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      cors: ['localhost:5173', '192.168.0.100:5173'],
      environment: process.env.NODE_ENV || 'development'
    });
  });

  router.get('/debug/user/:email', async (req, res) => {
    try {
      const { User, Otp } = require('../models');
      const user = await User.findOne({
        where: { email: req.params.email },
        attributes: ['id', 'email', 'status', 'emailVerified', 'createdAt']
      });
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const latestOtp = await Otp.findOne({
        where: { userId: user.id, purpose: 'EMAIL_VERIFICATION' },
        order: [['createdAt', 'DESC']],
        attributes: ['id', 'expiresAt', 'attempts', 'verifiedAt', 'createdAt']
      });

      res.json({ user, latestOtp });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

// Sub-routers
router.use('/user', userRoutes);
router.use('/admin', adminRoutes);

module.exports = router;