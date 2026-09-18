module.exports = (err, req, res, next) => {
  console.error('[Central Error Handler]:', err);

  if (err.name === 'InsufficientTokensError') {
    return res.status(402).json({
      success: false,
      error: { code: 'INSUFFICIENT_TOKENS', message: 'Insufficient token balance for this operation' }
    });
  }

  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: err.errors[0]?.message || 'Validation failed' }
    });
  }

  return res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected server error occurred'
    }
  });
};