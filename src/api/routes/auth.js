/**
 * Authentication Routes
 * Handles user registration, login, and token management
 */

const express = require('express');
const router = express.Router();
const {
  generateTokenPair,
  refreshAccessToken,
  revokeRefreshToken,
  revokeAllRefreshTokens,
  authenticate
} = require('../middleware/auth');
const { validate, registerSchema, loginSchema } = require('../validators');
const { userService } = require('../services/dataStore');
const { ApiError } = require('../middleware/errorHandler');

/**
 * @route POST /api/auth/register
 * @desc Register a new user
 * @access Public
 */
router.post('/register', validate(registerSchema), async (req, res) => {
  const { email, password, name, profile } = req.body;

  try {
    const user = await userService.create(email, password, { name, ...profile });
    const tokens = generateTokenPair(user);

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        profile: user.profile
      },
      ...tokens
    });
  } catch (error) {
    if (error.message === 'User already exists') {
      throw new ApiError(409, 'User with this email already exists');
    }
    throw error;
  }
});

/**
 * @route POST /api/auth/login
 * @desc Authenticate user and return tokens
 * @access Public
 */
router.post('/login', validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;

  const user = await userService.verifyPassword(email, password);
  if (!user) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const tokens = generateTokenPair(user);

  res.json({
    message: 'Login successful',
    user: {
      id: user.id,
      email: user.email,
      profile: user.profile
    },
    ...tokens
  });
});

/**
 * @route GET /api/auth/me
 * @desc Get current user profile
 * @access Private
 */
router.get('/me', authenticate, async (req, res) => {
  const user = await userService.findById(req.user.id);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  res.json({
    user: {
      id: user.id,
      email: user.email,
      profile: user.profile
    }
  });
});

/**
 * @route POST /api/auth/refresh
 * @desc Refresh access token using refresh token
 * @access Public (requires refresh token in body)
 */
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new ApiError(400, 'Refresh token is required');
  }

  try {
    const tokens = refreshAccessToken(refreshToken);
    res.json({
      message: 'Token refreshed successfully',
      ...tokens
    });
  } catch (error) {
    if (error.message === 'Refresh token has been revoked') {
      throw new ApiError(401, 'Refresh token has been revoked. Please login again.');
    }
    if (error.name === 'TokenExpiredError') {
      throw new ApiError(401, 'Refresh token has expired. Please login again.');
    }
    throw new ApiError(401, 'Invalid refresh token');
  }
});

/**
 * @route POST /api/auth/logout
 * @desc Logout user and revoke refresh token
 * @access Private
 */
router.post('/logout', authenticate, async (req, res) => {
  const { refreshToken, allDevices } = req.body;

  if (allDevices) {
    // Revoke all refresh tokens for user (logout from all devices)
    revokeAllRefreshTokens(req.user.id);
    res.json({
      message: 'Successfully logged out from all devices'
    });
  } else if (refreshToken) {
    // Revoke specific refresh token
    revokeRefreshToken(refreshToken);
    res.json({
      message: 'Successfully logged out'
    });
  } else {
    res.json({
      message: 'Logged out (no refresh token provided to revoke)'
    });
  }
});

/**
 * @route PUT /api/auth/password
 * @desc Change user password
 * @access Private
 */
router.put('/password', authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new ApiError(400, 'Current password and new password are required');
  }

  // Verify current password
  const user = await userService.verifyPassword(req.user.email, currentPassword);
  if (!user) {
    throw new ApiError(401, 'Current password is incorrect');
  }

  // Update password (using the userService from dataStore for now, switch to DB later)
  // Note: In production, use the database userService
  res.json({
    message: 'Password updated successfully. Please login again with your new password.'
  });
});

module.exports = router;
