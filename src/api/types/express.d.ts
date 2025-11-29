/**
 * Express Request type extensions
 * Extends the Express Request interface to include custom properties
 */

import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      };
    }
  }
}

export {};
