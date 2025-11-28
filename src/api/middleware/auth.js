/**
 * Authentication Middleware
 * JWT-based authentication with access and refresh tokens
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// Configuration from environment variables
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'meal-assistant-access-secret-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'meal-assistant-refresh-secret-change-in-production';
const JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '24h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const BCRYPT_SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);

// In-memory refresh token store (replace with Redis in production)
const refreshTokenStore = new Map();

/**
 * Hash a password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

/**
 * Compare password with hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} Match result
 */
async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Generate JWT access token for user
 * @param {Object} user - User object with id and email
 * @returns {string} JWT access token
 */
function generateAccessToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      type: 'access'
    },
    JWT_ACCESS_SECRET,
    { expiresIn: JWT_ACCESS_EXPIRES_IN }
  );
}

/**
 * Generate JWT refresh token for user
 * @param {Object} user - User object with id
 * @returns {string} JWT refresh token
 */
function generateRefreshToken(user) {
  const token = jwt.sign(
    {
      userId: user.id,
      type: 'refresh',
      tokenId: `${user.id}-${Date.now()}`
    },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN }
  );

  // Store refresh token for validation
  if (!refreshTokenStore.has(user.id)) {
    refreshTokenStore.set(user.id, new Set());
  }
  refreshTokenStore.get(user.id).add(token);

  return token;
}

/**
 * Generate both access and refresh tokens
 * @param {Object} user - User object
 * @returns {Object} Token pair with expiry info
 */
function generateTokenPair(user) {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Decode to get expiry times
  const accessDecoded = jwt.decode(accessToken);
  const refreshDecoded = jwt.decode(refreshToken);

  return {
    accessToken,
    refreshToken,
    accessExpiresAt: new Date(accessDecoded.exp * 1000).toISOString(),
    refreshExpiresAt: new Date(refreshDecoded.exp * 1000).toISOString(),
    tokenType: 'Bearer'
  };
}

/**
 * Verify and decode JWT access token
 * @param {string} token - JWT token
 * @returns {Object} Decoded token payload
 */
function verifyAccessToken(token) {
  const decoded = jwt.verify(token, JWT_ACCESS_SECRET);
  if (decoded.type !== 'access') {
    throw new Error('Invalid token type');
  }
  return decoded;
}

/**
 * Verify and decode JWT refresh token
 * @param {string} token - JWT token
 * @returns {Object} Decoded token payload
 */
function verifyRefreshToken(token) {
  const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
  if (decoded.type !== 'refresh') {
    throw new Error('Invalid token type');
  }

  // Check if refresh token is still valid (not revoked)
  const userTokens = refreshTokenStore.get(decoded.userId);
  if (!userTokens || !userTokens.has(token)) {
    throw new Error('Refresh token has been revoked');
  }

  return decoded;
}

/**
 * Refresh access token using refresh token
 * @param {string} refreshToken - Valid refresh token
 * @returns {Object} New token pair
 */
function refreshAccessToken(refreshToken) {
  const decoded = verifyRefreshToken(refreshToken);

  // Revoke old refresh token
  const userTokens = refreshTokenStore.get(decoded.userId);
  if (userTokens) {
    userTokens.delete(refreshToken);
  }

  // Generate new token pair
  return generateTokenPair({ id: decoded.userId, email: decoded.email });
}

/**
 * Revoke all refresh tokens for a user (logout from all devices)
 * @param {string} userId - User ID
 */
function revokeAllRefreshTokens(userId) {
  refreshTokenStore.delete(userId);
}

/**
 * Revoke a specific refresh token
 * @param {string} refreshToken - Token to revoke
 */
function revokeRefreshToken(refreshToken) {
  try {
    const decoded = jwt.decode(refreshToken);
    if (decoded && decoded.userId) {
      const userTokens = refreshTokenStore.get(decoded.userId);
      if (userTokens) {
        userTokens.delete(refreshToken);
      }
    }
  } catch (error) {
    // Token might be invalid, ignore
  }
}

/**
 * Authentication middleware
 * Extracts and validates JWT from Authorization header
 */
function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
        message: 'No authorization header provided'
      });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        error: 'Invalid authorization format',
        code: 'INVALID_AUTH_FORMAT',
        message: 'Expected: Bearer <token>'
      });
    }

    const token = parts[1];
    const decoded = verifyAccessToken(token);

    // Attach user info to request
    req.user = {
      id: decoded.userId,
      email: decoded.email
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        code: 'TOKEN_EXPIRED',
        message: 'Access token has expired. Use refresh token to get a new one.'
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        code: 'INVALID_TOKEN',
        message: 'The provided token is malformed or invalid'
      });
    }
    return res.status(500).json({
      error: 'Authentication error',
      code: 'AUTH_ERROR',
      message: 'An error occurred during authentication'
    });
  }
}

/**
 * Optional authentication middleware
 * Attaches user to request if token is valid, but doesn't require it
 */
function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader) {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        const decoded = verifyAccessToken(parts[1]);
        req.user = {
          id: decoded.userId,
          email: decoded.email
        };
      }
    }

    next();
  } catch (error) {
    // Ignore auth errors for optional auth
    next();
  }
}

module.exports = {
  // Password utilities
  hashPassword,
  comparePassword,

  // Token generation
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,

  // Token verification
  verifyAccessToken,
  verifyRefreshToken,

  // Token management
  refreshAccessToken,
  revokeAllRefreshTokens,
  revokeRefreshToken,

  // Middleware
  authenticate,
  optionalAuth,

  // Constants (for testing)
  JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN
};
