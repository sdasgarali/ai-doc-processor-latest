// Vercel Serverless Function - Express App Handler
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// Middleware
const corsOrigin = (process.env.CORS_ORIGIN || '*').trim();
app.use(cors({
  origin: corsOrigin === '*' ? true : corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check (before routes to ensure it always works)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    database: process.env.SUPABASE_URL ? 'supabase' : 'mysql',
    env: {
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY,
      hasJwtSecret: !!process.env.JWT_SECRET
    }
  });
});

// Debug endpoint to test database
app.get('/api/debug/db-test', async (req, res) => {
  try {
    const { query } = require('../config/database');
    const users = await query('SELECT userid, email, user_role FROM user_profile WHERE is_active = true');
    res.json({ success: true, count: users.length, users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, stack: err.stack });
  }
});

// Debug login endpoint without middleware
app.post('/api/debug/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const bcrypt = require('bcryptjs');
    const jwt = require('jsonwebtoken');
    const { query } = require('../config/database');

    // Get user
    const users = await query(
      'SELECT * FROM user_profile WHERE email = ? AND is_active = true',
      [email]
    );

    if (!users || users.length === 0) {
      return res.status(401).json({ success: false, message: 'User not found', debug: { email, userCount: users?.length } });
    }

    const user = users[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: 'Invalid password' });
    }

    // Generate JWT token
    const expiresIn = process.env.JWT_EXPIRE && process.env.JWT_EXPIRE.trim() ? process.env.JWT_EXPIRE.trim() : '24h';
    const token = jwt.sign(
      { userid: user.userid, email: user.email, role: user.user_role },
      process.env.JWT_SECRET,
      { expiresIn }
    );

    res.json({ success: true, message: 'Login successful', token, user: { email: user.email, role: user.user_role } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, stack: err.stack });
  }
});

// Import and mount routes with error handling
try {
  const authRoutes = require('../routes/auth');
  app.use('/api/auth', authRoutes);
} catch (err) {
  console.error('Failed to load auth routes:', err.message);
  app.use('/api/auth', (req, res) => res.status(500).json({ error: 'Auth routes failed to load', details: err.message }));
}

try {
  const documentRoutes = require('../routes/documents');
  app.use('/api/documents', documentRoutes);
} catch (err) {
  console.error('Failed to load document routes:', err.message);
  app.use('/api/documents', (req, res) => res.status(500).json({ error: 'Document routes failed to load', details: err.message }));
}

try {
  const adminRoutes = require('../routes/admin');
  app.use('/api/admin', adminRoutes);
} catch (err) {
  console.error('Failed to load admin routes:', err.message);
  app.use('/api/admin', (req, res) => res.status(500).json({ error: 'Admin routes failed to load', details: err.message }));
}

try {
  const reportRoutes = require('../routes/reports');
  app.use('/api/reports', reportRoutes);
} catch (err) {
  console.error('Failed to load report routes:', err.message);
  app.use('/api/reports', (req, res) => res.status(500).json({ error: 'Report routes failed to load', details: err.message }));
}

try {
  const billingRoutes = require('../routes/billing');
  app.use('/api/billing', billingRoutes);
} catch (err) {
  console.error('Failed to load billing routes:', err.message);
  app.use('/api/billing', (req, res) => res.status(500).json({ error: 'Billing routes failed to load', details: err.message }));
}

try {
  const outputProfileRoutes = require('../routes/outputProfiles');
  app.use('/api/output-profiles', outputProfileRoutes);
} catch (err) {
  console.error('Failed to load output profile routes:', err.message);
  app.use('/api/output-profiles', (req, res) => res.status(500).json({ error: 'Output profile routes failed to load', details: err.message }));
}

try {
  const categoryCreationRoutes = require('../routes/categoryCreation');
  app.use('/api/category-creation', categoryCreationRoutes);
} catch (err) {
  console.error('Failed to load category creation routes:', err.message);
  app.use('/api/category-creation', (req, res) => res.status(500).json({ error: 'Category creation routes failed to load', details: err.message }));
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

// Export for Vercel
module.exports = app;
