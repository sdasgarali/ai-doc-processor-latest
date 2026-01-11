const dotenv = require('dotenv');
dotenv.config();

// Determine which database to use
const useSupabase = process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY;

let db;

if (useSupabase) {
  // Use Supabase REST API (works with Vercel serverless)
  const { createClient } = require('@supabase/supabase-js');

  // Use service role key if available (bypasses RLS), otherwise use anon key
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  const supabase = createClient(
    process.env.SUPABASE_URL,
    supabaseKey
  );

  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('✓ Using Supabase service role key (RLS bypassed)');
  }

  // Test connection
  const testConnection = async () => {
    try {
      const { data, error } = await supabase.from('user_profile').select('count').limit(1);
      if (error && error.code !== 'PGRST116') {
        // PGRST116 means table doesn't exist yet - that's ok for initial setup
        if (error.code !== '42P01') throw error;
      }
      console.log('✓ Supabase connection established successfully');
      return true;
    } catch (error) {
      console.error('✗ Supabase connection failed:', error.message);
      return false;
    }
  };

  // Query helper using Supabase REST API
  // This provides a simplified interface for common operations
  const query = async (sql, params = []) => {
    try {
      // For raw SQL, use rpc or direct table operations
      // Parse simple SELECT, INSERT, UPDATE, DELETE
      const trimmedSql = sql.trim().toUpperCase();

      if (trimmedSql.startsWith('SELECT')) {
        return await executeSelect(sql, params);
      } else if (trimmedSql.startsWith('INSERT')) {
        return await executeInsert(sql, params);
      } else if (trimmedSql.startsWith('UPDATE')) {
        return await executeUpdate(sql, params);
      } else if (trimmedSql.startsWith('DELETE')) {
        return await executeDelete(sql, params);
      } else {
        // For complex queries, use raw SQL via RPC if available
        console.warn('Complex query - consider using Supabase client directly:', sql.substring(0, 100));
        return [];
      }
    } catch (error) {
      console.error('Query error:', error.message);
      console.error('SQL:', sql.substring(0, 200));
      throw error;
    }
  };

  // Parse and execute SELECT queries
  const executeSelect = async (sql, params) => {
    // Simple parser for common SELECT patterns
    const tableMatch = sql.match(/FROM\s+[`"]?(\w+)[`"]?/i);
    if (!tableMatch) throw new Error('Could not parse table from SELECT');

    const table = tableMatch[1];
    let query = supabase.from(table).select('*');

    // Parse WHERE clause with parameters
    const whereMatch = sql.match(/WHERE\s+(.+?)(?:ORDER|LIMIT|GROUP|$)/is);
    if (whereMatch) {
      const conditions = parseWhereClause(whereMatch[1], params);
      for (const cond of conditions) {
        query = query.eq(cond.column, cond.value);
      }
    }

    // Parse ORDER BY
    const orderMatch = sql.match(/ORDER\s+BY\s+(\w+)(?:\s+(ASC|DESC))?/i);
    if (orderMatch) {
      query = query.order(orderMatch[1], { ascending: orderMatch[2]?.toUpperCase() !== 'DESC' });
    }

    // Parse LIMIT
    const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
    if (limitMatch) {
      query = query.limit(parseInt(limitMatch[1]));
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  };

  // Parse and execute INSERT queries
  const executeInsert = async (sql, params) => {
    const tableMatch = sql.match(/INTO\s+[`"]?(\w+)[`"]?/i);
    if (!tableMatch) throw new Error('Could not parse table from INSERT');

    const table = tableMatch[1];
    const columnsMatch = sql.match(/\(([^)]+)\)\s+VALUES/i);
    if (!columnsMatch) throw new Error('Could not parse columns from INSERT');

    const columns = columnsMatch[1].split(',').map(c => c.trim().replace(/[`"]/g, ''));
    const insertData = {};
    columns.forEach((col, i) => {
      if (params[i] !== undefined) insertData[col] = params[i];
    });

    const { data, error } = await supabase.from(table).insert(insertData).select();
    if (error) throw error;

    // Return insertId for compatibility
    if (data && data[0]) {
      const idField = Object.keys(data[0]).find(k => k.includes('id') || k === 'id');
      return { insertId: data[0][idField], affectedRows: 1 };
    }
    return { insertId: null, affectedRows: 1 };
  };

  // Parse and execute UPDATE queries
  const executeUpdate = async (sql, params) => {
    const tableMatch = sql.match(/UPDATE\s+[`"]?(\w+)[`"]?/i);
    if (!tableMatch) throw new Error('Could not parse table from UPDATE');

    const table = tableMatch[1];

    // Parse SET clause
    const setMatch = sql.match(/SET\s+(.+?)\s+WHERE/is);
    if (!setMatch) throw new Error('Could not parse SET from UPDATE');

    const setParts = setMatch[1].split(',').map(s => s.trim());
    const updateData = {};
    let paramIndex = 0;

    for (const part of setParts) {
      const eqIndex = part.indexOf('=');
      if (eqIndex === -1) continue;

      const col = part.substring(0, eqIndex).trim().replace(/[`"]/g, '');
      const valPart = part.substring(eqIndex + 1).trim();

      // Check for SQL functions like NOW(), CURRENT_TIMESTAMP
      if (/^NOW\(\)$/i.test(valPart) || /^CURRENT_TIMESTAMP$/i.test(valPart)) {
        updateData[col] = new Date().toISOString();
      } else if (valPart === '?') {
        updateData[col] = params[paramIndex++];
      } else if (/^'.*'$/.test(valPart)) {
        // Literal string
        updateData[col] = valPart.slice(1, -1);
      } else if (/^\d+$/.test(valPart)) {
        // Literal number
        updateData[col] = parseInt(valPart);
      } else if (/^(true|false)$/i.test(valPart)) {
        // Literal boolean
        updateData[col] = valPart.toLowerCase() === 'true';
      } else {
        // Default to param
        updateData[col] = params[paramIndex++];
      }
    }

    // Parse WHERE clause
    const whereMatch = sql.match(/WHERE\s+(.+)$/is);
    let query = supabase.from(table).update(updateData);

    if (whereMatch) {
      const conditions = parseWhereClause(whereMatch[1], params.slice(paramIndex));
      for (const cond of conditions) {
        query = query.eq(cond.column, cond.value);
      }
    }

    const { data, error } = await query.select();
    if (error) throw error;
    return { affectedRows: data?.length || 0, changedRows: data?.length || 0 };
  };

  // Parse and execute DELETE queries
  const executeDelete = async (sql, params) => {
    const tableMatch = sql.match(/FROM\s+[`"]?(\w+)[`"]?/i);
    if (!tableMatch) throw new Error('Could not parse table from DELETE');

    const table = tableMatch[1];
    let query = supabase.from(table).delete();

    const whereMatch = sql.match(/WHERE\s+(.+)$/is);
    if (whereMatch && params.length > 0) {
      const conditions = parseWhereClause(whereMatch[1], params);
      for (const cond of conditions) {
        query = query.eq(cond.column, cond.value);
      }
    }

    const { data, error } = await query.select();
    if (error) throw error;
    return { affectedRows: data?.length || 0 };
  };

  // Helper to parse WHERE clause
  const parseWhereClause = (whereClause, params) => {
    const conditions = [];
    const parts = whereClause.split(/\s+AND\s+/i);
    let paramIndex = 0;

    for (const part of parts) {
      // Check for parameterized condition (column = ?)
      const paramMatch = part.match(/[`"]?(\w+)[`"]?\s*=\s*\?/);
      if (paramMatch && paramIndex < params.length) {
        conditions.push({ column: paramMatch[1], value: params[paramIndex++] });
        continue;
      }

      // Check for literal boolean (column = true/false)
      const boolMatch = part.match(/[`"]?(\w+)[`"]?\s*=\s*(true|false)/i);
      if (boolMatch) {
        conditions.push({ column: boolMatch[1], value: boolMatch[2].toLowerCase() === 'true' });
        continue;
      }

      // Check for literal string (column = 'value')
      const stringMatch = part.match(/[`"]?(\w+)[`"]?\s*=\s*'([^']*)'/);
      if (stringMatch) {
        conditions.push({ column: stringMatch[1], value: stringMatch[2] });
        continue;
      }

      // Check for literal number (column = 123)
      const numMatch = part.match(/[`"]?(\w+)[`"]?\s*=\s*(\d+)/);
      if (numMatch) {
        conditions.push({ column: numMatch[1], value: parseInt(numMatch[2]) });
      }
    }

    return conditions;
  };

  // Transaction helper (simplified for Supabase)
  const transaction = async (callback) => {
    // Supabase doesn't support traditional transactions via REST
    // We'll execute operations sequentially
    console.warn('Supabase REST API does not support transactions - executing sequentially');
    return await callback({ query, execute: query });
  };

  // Direct Supabase client access for complex operations
  const getClient = () => supabase;

  const closePool = async () => {
    console.log('Supabase client closed');
  };

  db = {
    pool: null,
    query,
    transaction,
    testConnection,
    closePool,
    getClient,
    supabase,
    setupDatabase: async () => {
      console.log('Run migrations via Supabase SQL Editor');
      return true;
    },
    isPostgres: true,
    isSupabase: true
  };

} else {
  // Use MySQL (original implementation)
  const mysql = require('mysql2/promise');

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

  const pool = mysql.createPool(poolConfig);

  const testConnection = async () => {
    try {
      const connection = await pool.getConnection();
      console.log('✓ MySQL connection established successfully');
      connection.release();
      return true;
    } catch (error) {
      console.error('✗ MySQL connection failed:', error.message);
      return false;
    }
  };

  const setupDatabase = async () => {
    const fs = require('fs');
    const path = require('path');

    try {
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

  const query = async (sql, params = []) => {
    try {
      const [results] = await pool.execute(sql, params);
      return results;
    } catch (error) {
      console.error('Query error:', error.message);
      throw error;
    }
  };

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

  const closePool = async () => {
    try {
      await pool.end();
      console.log('Database pool closed');
    } catch (error) {
      console.error('Error closing database pool:', error.message);
    }
  };

  db = {
    pool,
    query,
    transaction,
    testConnection,
    setupDatabase,
    closePool,
    isPostgres: false,
    isSupabase: false
  };
}

module.exports = db;
