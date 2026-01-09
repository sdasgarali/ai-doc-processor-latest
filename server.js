require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const http = require('http');
const path = require('path');

const { testConnection, setupDatabase } = require('./config/database');
const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/documents');
const adminRoutes = require('./routes/admin');
const permissionRoutes = require('./routes/permissions');
const profileRoutes = require('./routes/profile');
const reportsRoutes = require('./routes/reports');
const customReportsRoutes = require('./routes/customReports');
const billingRoutes = require('./routes/billing');
const processingConfigRoutes = require('./routes/processingConfig');
const outputProfileRoutes = require('./routes/outputProfiles');
const categoryCreationRoutes = require('./routes/categoryCreation');

const app = express();
const server = http.createServer(app);

// Socket.IO setup for real-time updates
const io = new Server(server, {
  cors: {
    origin: process.env.SOCKET_IO_CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Trust proxy - required for rate limiting
app.set('trust proxy', 1);

// Rate limiting
const limiter = rateLimit({
  windowMs: (parseInt(process.env.RATE_LIMIT_WINDOW) || 15) * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.'
});

app.use('/api/', limiter);

// Static file serving for uploads and results
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/results', express.static(path.join(__dirname, 'results')));

// Health check endpoint - Basic
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Detailed health check endpoint
app.get('/health/detailed', async (req, res) => {
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    checks: {}
  };

  // Database check
  try {
    const { testConnection } = require('./config/database');
    const dbConnected = await testConnection();
    healthStatus.checks.database = {
      status: dbConnected ? 'healthy' : 'unhealthy',
      latency: null
    };

    // Measure DB latency
    const startTime = Date.now();
    const { query } = require('./config/database');
    await query('SELECT 1');
    healthStatus.checks.database.latency = Date.now() - startTime;
  } catch (error) {
    healthStatus.status = 'degraded';
    healthStatus.checks.database = {
      status: 'unhealthy',
      error: error.message
    };
  }

  // File system check
  try {
    const fs = require('fs').promises;
    const path = require('path');
    const uploadsDir = path.join(__dirname, 'uploads');
    const resultsDir = path.join(__dirname, 'results');

    await fs.access(uploadsDir);
    await fs.access(resultsDir);

    healthStatus.checks.filesystem = {
      status: 'healthy',
      uploadsDir: true,
      resultsDir: true
    };
  } catch (error) {
    healthStatus.status = 'degraded';
    healthStatus.checks.filesystem = {
      status: 'unhealthy',
      error: error.message
    };
  }

  // Memory check
  const memUsage = process.memoryUsage();
  const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
  const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
  const heapPercentage = (heapUsedMB / heapTotalMB) * 100;

  healthStatus.checks.memory = {
    status: heapPercentage < 90 ? 'healthy' : 'warning',
    heapUsedMB: heapUsedMB.toFixed(2),
    heapTotalMB: heapTotalMB.toFixed(2),
    heapPercentage: heapPercentage.toFixed(2)
  };

  // Determine overall status
  const checkStatuses = Object.values(healthStatus.checks).map(c => c.status);
  if (checkStatuses.includes('unhealthy')) {
    healthStatus.status = 'unhealthy';
  } else if (checkStatuses.includes('warning') || checkStatuses.includes('degraded')) {
    healthStatus.status = 'degraded';
  }

  const statusCode = healthStatus.status === 'healthy' ? 200 : healthStatus.status === 'degraded' ? 200 : 503;
  res.status(statusCode).json(healthStatus);
});

// Readiness check (for Kubernetes)
app.get('/health/ready', async (req, res) => {
  try {
    const { testConnection } = require('./config/database');
    const dbConnected = await testConnection();

    if (dbConnected) {
      res.json({ status: 'ready', timestamp: new Date().toISOString() });
    } else {
      res.status(503).json({ status: 'not ready', reason: 'database not connected' });
    }
  } catch (error) {
    res.status(503).json({ status: 'not ready', reason: error.message });
  }
});

// Liveness check (for Kubernetes)
app.get('/health/live', (req, res) => {
  res.json({ status: 'alive', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/custom-reports', customReportsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/admin/processing-config', processingConfigRoutes);
app.use('/api/output-profiles', outputProfileRoutes);
app.use('/api/category-creation', categoryCreationRoutes);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('subscribe_process', (processId) => {
    socket.join(`process_${processId}`);
    console.log(`Client ${socket.id} subscribed to process ${processId}`);
  });

  socket.on('unsubscribe_process', (processId) => {
    socket.leave(`process_${processId}`);
    console.log(`Client ${socket.id} unsubscribed from process ${processId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Make io accessible to routes
app.set('io', io);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err.name === 'MulterError') {
    return res.status(400).json({ 
      success: false, 
      message: 'File upload error: ' + err.message 
    });
  }
  
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
    message: 'Route not found' 
  });
});

// Initialize server
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Test database connection
    console.log('Testing database connection...');
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      console.log('Setting up database...');
      await setupDatabase();
      await testConnection();
    }

    // Start server
    server.listen(PORT, () => {
      console.log('='.repeat(50));
      console.log(`🚀 Universal Document Processing System Server Running`);
      console.log(`📍 Port: ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 API: http://localhost:${PORT}/api`);
      console.log(`💾 Database: ${process.env.DB_NAME}`);
      console.log('='.repeat(50));
    });

    // Google Drive monitoring (optional - can be enabled/disabled)
    if (process.env.ENABLE_GDRIVE_MONITORING === 'true') {
      const { monitorFolder } = require('./services/googleDrive');
      const { processDocument } = require('./services/documentProcessor');
      
      console.log('Starting Google Drive monitoring...');
      
      // Monitor source folder for new files
      monitorFolder(
        process.env.GOOGLE_DRIVE_FOLDER_SOURCE || 'eob-source',
        async (file) => {
          console.log(`New file detected in Google Drive: ${file.name}`);
          // Process the file automatically
          // Implementation would download and process the file
        },
        60000 // Check every minute
      );
    }

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the server
startServer();

// Initialize cron jobs (only in production or if enabled)
if (process.env.ENABLE_BILLING_CRON !== 'false') {
  const cronService = require('./services/cronService');
  cronService.initialize().catch(error => {
    console.error('Failed to initialize cron jobs:', error);
  });
}

module.exports = { app, server, io };
