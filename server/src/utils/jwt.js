const jwt = require('jsonwebtoken');
const config = require('../config');
const { AppError } = require('../middleware/error.middleware');

function signAccessToken(payload) {
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiry,
  });
}

function signRefreshToken(payload, rememberMe = false) {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: rememberMe ? config.jwt.refreshExpiryLong : config.jwt.refreshExpiry,
  });
}

function verifyAccessToken(token) {
  try {
    return jwt.verify(token, config.jwt.accessSecret);
  } catch {
    throw new AppError('Invalid or expired access token', 401);
  }
}

function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, config.jwt.refreshSecret);
  } catch {
    throw new AppError('Invalid or expired refresh token', 401);
  }
}

module.exports = { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken };
