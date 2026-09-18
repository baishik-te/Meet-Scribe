
const verifyActive = (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not authenticated' }
      });
    }

    // Check if user is ACTIVE and email is verified
    if (req.user.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_INACTIVE',
          message: 'Account is not yet verified. Please verify your email to continue.',
          userStatus: req.user.status,
          email: req.user.email
        }
      });
    }

    if (!req.user.emailVerified) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Please verify your email address to access this feature.',
          email: req.user.email
        }
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Verification check failed' }
    });
  }
};

module.exports = verifyActive;
