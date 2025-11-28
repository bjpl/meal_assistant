/**
 * Meal Assistant API Server
 * Main entry point for the REST API
 */

require('dotenv').config();
require('express-async-errors');

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// Route imports
const patternRoutes = require('./routes/patterns');
const mealRoutes = require('./routes/meals');
const inventoryRoutes = require('./routes/inventory');
const prepRoutes = require('./routes/prep');
const shoppingRoutes = require('./routes/shopping');
const analyticsRoutes = require('./routes/analytics');
const authRoutes = require('./routes/auth');
const hydrationRoutes = require('./routes/hydration');
// Week 3-4: Weekly Ads Processing
const adRoutes = require('./routes/ads');
// Week 3-4: Template Versioning and Sharing
const templateRoutes = require('./routes/templates');
// Week 7-8: Price Intelligence and Deal Quality
const priceRoutes = require('./routes/prices');

// Middleware imports
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

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
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/patterns', patternRoutes);
app.use('/api/meals', mealRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/prep', prepRoutes);
app.use('/api/shopping', shoppingRoutes);
app.use('/api/analytics', analyticsRoutes);
// Week 1-2 Option B: Hydration & Caffeine Tracking
app.use('/api/hydration', hydrationRoutes);
// Note: Caffeine routes are also in hydrationRoutes, accessed via /api/hydration/caffeine/*

// Week 3-4: Weekly Ads Processing System
app.use('/api/ads', adRoutes);

// Week 3-4: Template Versioning and Sharing System
app.use('/api/templates', templateRoutes);

// Week 7-8: Price Intelligence and Deal Quality
app.use('/api/prices', priceRoutes);
app.use('/api/deals', priceRoutes);

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

module.exports = app;
