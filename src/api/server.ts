/**
 * Meal Assistant API Server
 * Main entry point for the REST API
 */

import 'dotenv/config';
import 'express-async-errors';

import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

// Route imports
const patternRoutes = require('./routes/patterns').default;
const mealRoutes = require('./routes/meals').default;
const authRoutes = require('./routes/auth').default;
const vectorRoutes = require('./routes/vector.routes').default;
// const inventoryRoutes = require('./routes/inventory');
// const prepRoutes = require('./routes/prep');
// const shoppingRoutes = require('./routes/shopping');
// const analyticsRoutes = require('./routes/analytics');
// const hydrationRoutes = require('./routes/hydration');
// const adRoutes = require('./routes/ads');
// const templateRoutes = require('./routes/templates');
// const priceRoutes = require('./routes/prices');

// Middleware imports
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Body parsing and compression
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/patterns', patternRoutes);
app.use('/api/meals', mealRoutes);
app.use('/api/vector', vectorRoutes);
// app.use('/api/inventory', inventoryRoutes);
// app.use('/api/prep', prepRoutes);
// app.use('/api/shopping', shoppingRoutes);
// app.use('/api/analytics', analyticsRoutes);
// app.use('/api/hydration', hydrationRoutes);
// app.use('/api/ads', adRoutes);
// app.use('/api/templates', templateRoutes);
// app.use('/api/prices', priceRoutes);
// app.use('/api/deals', priceRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Meal Assistant API running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

export default app;
