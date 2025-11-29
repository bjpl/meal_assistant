/**
 * Authentication Middleware
 * JWT-based authentication with access and refresh tokens
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs'; // Using bcryptjs for pure JS compatibility
import { TokenPayload, TokenPair, User } from '../types/models';

// Configuration from environment variables
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'meal-assistant-access-secret-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'meal-assistant-refresh-secret-change-in-production';
const JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '24h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const BCRYPT_SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);

// In-memory refresh token store (replace with Redis in production)
const refreshTokenStore = new Map<string, Set<string>>();

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

/**
 * Compare password with hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate JWT access token for user
 */
export function generateAccessToken(user: User): string {
  const payload = {
    userId: user.id,
    email: user.email,
    type: 'access' as const
  };
  // @ts-ignore - expiresIn accepts string despite type definition
  return jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: JWT_ACCESS_EXPIRES_IN });
}

/**
 * Generate JWT refresh token for user
 */
export function generateRefreshToken(user: User): string {
  const payload = {
    userId: user.id,
    type: 'refresh' as const,
    tokenId: `${user.id}-${Date.now()}`
  };
  // @ts-ignore - expiresIn accepts string despite type definition
  const token = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });

  // Store refresh token for validation
  if (!refreshTokenStore.has(user.id)) {
    refreshTokenStore.set(user.id, new Set());
  }
  refreshTokenStore.get(user.id)!.add(token);

  return token;
}

/**
 * Generate both access and refresh tokens
 */
export function generateTokenPair(user: User): TokenPair {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Decode to get expiry times
  const accessDecoded = jwt.decode(accessToken) as TokenPayload;
  const refreshDecoded = jwt.decode(refreshToken) as TokenPayload;

  return {
    accessToken,
    refreshToken,
    accessExpiresAt: new Date(accessDecoded.exp! * 1000).toISOString(),
    refreshExpiresAt: new Date(refreshDecoded.exp! * 1000).toISOString(),
    tokenType: 'Bearer'
  };
}

/**
 * Verify and decode JWT access token
 */
export function verifyAccessToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, JWT_ACCESS_SECRET) as TokenPayload;
  if (decoded.type !== 'access') {
    throw new Error('Invalid token type');
  }
  return decoded;
}

/**
 * Verify and decode JWT refresh token
 */
export function verifyRefreshToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as TokenPayload;
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
 */
export function refreshAccessToken(refreshToken: string): TokenPair {
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
 */
export function revokeAllRefreshTokens(userId: string): void {
  refreshTokenStore.delete(userId);
}

/**
 * Revoke a specific refresh token
 */
export function revokeRefreshToken(refreshToken: string): void {
  try {
    const decoded = jwt.decode(refreshToken) as TokenPayload | null;
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
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
        message: 'No authorization header provided'
      });
      return;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      res.status(401).json({
        error: 'Invalid authorization format',
        code: 'INVALID_AUTH_FORMAT',
        message: 'Expected: Bearer <token>'
      });
      return;
    }

    const token = parts[1];
    const decoded = verifyAccessToken(token);

    // Attach user info to request
    req.user = {
      id: decoded.userId,
      email: decoded.email
    };

    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        error: 'Token expired',
        code: 'TOKEN_EXPIRED',
        message: 'Access token has expired. Use refresh token to get a new one.'
      });
      return;
    }
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({
        error: 'Invalid token',
        code: 'INVALID_TOKEN',
        message: 'The provided token is malformed or invalid'
      });
      return;
    }
    res.status(500).json({
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
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
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

// Export constants for testing
export {
  JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN
};
