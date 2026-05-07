class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// eslint-disable-next-line no-unused-vars
function errorMiddleware(err, req, res, next) {
  if (err.isOperational) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  console.error('[Unhandled error]', err);
  res.status(500).json({ error: 'Internal server error' });
}

module.exports = { AppError, errorMiddleware };
