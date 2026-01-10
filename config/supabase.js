const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

// Supabase client for auth and storage
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// PostgreSQL connection pool for direct database access
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

const pool = new Pool(poolConfig);

// Test database connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('✓ Supabase PostgreSQL connection established successfully');
    client.release();
    return true;
  } catch (error) {
    console.error('✗ Supabase PostgreSQL connection failed:', error.message);
    return false;
  }
};

// Query helper function with error handling
// Converts MySQL-style ? placeholders to PostgreSQL $1, $2, etc.
const query = async (sql, params = []) => {
  try {
    // Convert MySQL ? placeholders to PostgreSQL $1, $2, etc.
    let paramIndex = 0;
    const pgSql = sql.replace(/\?/g, () => `$${++paramIndex}`);

    const result = await pool.query(pgSql, params);
    return result.rows;
  } catch (error) {
    console.error('Query error:', error.message);
    console.error('SQL:', sql);
    throw error;
  }
};

// Transaction helper
const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create a query function for the transaction
    const txQuery = async (sql, params = []) => {
      let paramIndex = 0;
      const pgSql = sql.replace(/\?/g, () => `$${++paramIndex}`);
      const result = await client.query(pgSql, params);
      return result.rows;
    };

    const result = await callback({ query: txQuery, client });
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Execute raw query (for migrations, etc.)
const executeRaw = async (sql) => {
  try {
    const result = await pool.query(sql);
    return result;
  } catch (error) {
    console.error('Raw query error:', error.message);
    throw error;
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

// Helper to get single row (equivalent to MySQL's result[0])
const queryOne = async (sql, params = []) => {
  const rows = await query(sql, params);
  return rows[0] || null;
};

// Helper for INSERT with RETURNING (PostgreSQL feature)
const insert = async (table, data) => {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  const columns = keys.join(', ');

  const sql = `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING *`;
  const result = await pool.query(sql, values);
  return result.rows[0];
};

// Helper for UPDATE with RETURNING
const update = async (table, data, whereClause, whereParams = []) => {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');

  // Adjust where clause placeholders
  let whereParamIndex = keys.length;
  const adjustedWhere = whereClause.replace(/\?/g, () => `$${++whereParamIndex}`);

  const sql = `UPDATE ${table} SET ${setClause} WHERE ${adjustedWhere} RETURNING *`;
  const result = await pool.query(sql, [...values, ...whereParams]);
  return result.rows;
};

module.exports = {
  supabase,
  pool,
  query,
  queryOne,
  transaction,
  executeRaw,
  insert,
  update,
  testConnection,
  closePool
};
