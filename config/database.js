const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

// Database connection pool configuration
const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'documentprocessingdb',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  timezone: '+00:00',
  dateStrings: false
};

// Create connection pool
const pool = mysql.createPool(poolConfig);

// Test database connection
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✓ Database connection established successfully');
    connection.release();
    return true;
  } catch (error) {
    console.error('✗ Database connection failed:', error.message);
    return false;
  }
};

// Execute database setup script
const setupDatabase = async () => {
  const fs = require('fs');
  const path = require('path');
  
  try {
    // Create connection without database selection first
    const setupPool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: process.env.DB_PORT || 3306,
      multipleStatements: true
    });

    const setupScript = fs.readFileSync(
      path.join(__dirname, '../database/setup.sql'),
      'utf8'
    );

    console.log('Setting up database...');
    await setupPool.query(setupScript);
    console.log('✓ Database setup completed successfully');
    
    await setupPool.end();
    return true;
  } catch (error) {
    console.error('✗ Database setup failed:', error.message);
    return false;
  }
};

// Query helper function with error handling
const query = async (sql, params = []) => {
  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (error) {
    console.error('Query error:', error.message);
    throw error;
  }
};

// Transaction helper
const transaction = async (callback) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// Close all connections
const closePool = async () => {
  try {
    await pool.end();
    console.log('Database pool closed');
  } catch (error) {
    console.error('Error closing database pool:', error.message);
  }
};

module.exports = {
  pool,
  query,
  transaction,
  testConnection,
  setupDatabase,
  closePool
};
