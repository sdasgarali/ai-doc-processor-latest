const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query, transaction } = require('../config/database');
const { verifyToken, checkRole } = require('../middleware/auth');

// ==================== USER MANAGEMENT ====================

// Get all users
router.get('/users', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { client_id, role, status, page = 1, limit = 20 } = req.query;
    
    let sql = `
      SELECT u.userid, u.email, u.first_name, u.last_name, u.user_role, 
             u.client_id, u.is_active, u.last_login, u.created_at, u.timezone,
             c.client_name
      FROM user_profile u
      LEFT JOIN client c ON u.client_id = c.client_id
      WHERE 1=1
    `;
    const params = [];

    if (client_id) {
      sql += ' AND u.client_id = ?';
      params.push(client_id);
    }
    if (role) {
      sql += ' AND u.user_role = ?';
      params.push(role);
    }
    if (status !== undefined) {
      sql += ' AND u.is_active = ?';
      params.push(status === 'active' ? 1 : 0);
    }

    // Get total count
    const countSql = sql.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as total FROM');
    const countResult = await query(countSql, params);
    const total = countResult[0].total;

    // Add pagination - use string interpolation for LIMIT/OFFSET (MySQL requirement)
    const limitNum = parseInt(limit);
    const pageNum = parseInt(page);
    const offsetNum = (pageNum - 1) * limitNum;
    
    sql += ` ORDER BY u.created_at DESC LIMIT ${limitNum} OFFSET ${offsetNum}`;
    
    const users = await query(sql, params);

    res.json({
      success: true,
      data: users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching users.',
      error: error.message 
    });
  }
});

// Create user
router.post('/users', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { email, password, first_name, last_name, user_role, client_id, timezone, is_active } = req.body;
    
    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }
    
    // Check if email already exists
    const existing = await query('SELECT userid FROM user_profile WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Email already exists.' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await query(
      `INSERT INTO user_profile (email, password, first_name, last_name, user_role, client_id, timezone, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [email, hashedPassword, first_name, last_name, user_role, client_id || null, timezone || 'UTC', is_active !== false]
    );

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      userid: result.insertId
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ success: false, message: 'Error creating user.' });
  }
});

// Get user by ID
router.get('/users/:userid', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const users = await query(
      `SELECT u.*, c.client_name
       FROM user_profile u
       LEFT JOIN client c ON u.client_id = c.client_id
       WHERE u.userid = ?`,
      [req.params.userid]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Get user permissions
    const permissions = await query(
      'SELECT permission_name FROM user_permissions WHERE userid = ?',
      [req.params.userid]
    );

    res.json({
      success: true,
      data: {
        ...users[0],
        permissions: permissions.map(p => p.permission_name)
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, message: 'Error fetching user.' });
  }
});

// Update user
router.put('/users/:userid', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { email, first_name, last_name, user_role, client_id, is_active, timezone } = req.body;
    
    await query(
      `UPDATE user_profile 
       SET email = ?, first_name = ?, last_name = ?, user_role = ?, 
           client_id = ?, is_active = ?, timezone = ?
       WHERE userid = ?`,
      [email, first_name, last_name, user_role, client_id, is_active, timezone, req.params.userid]
    );

    res.json({ success: true, message: 'User updated successfully' });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ success: false, message: 'Error updating user.' });
  }
});

// Reset user password
router.post('/users/:userid/reset-password', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await query(
      'UPDATE user_profile SET password = ? WHERE userid = ?',
      [hashedPassword, req.params.userid]
    );

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Error resetting password.' });
  }
});

// Delete user
router.delete('/users/:userid', verifyToken, checkRole('superadmin'), async (req, res) => {
  try {
    await query('DELETE FROM user_profile WHERE userid = ?', [req.params.userid]);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, message: 'Error deleting user.' });
  }
});

// ==================== CLIENT MANAGEMENT ====================

// Get all clients
router.get('/clients', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    let sql = 'SELECT * FROM client WHERE 1=1';
    const params = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    const countSql = sql.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as total FROM');
    const countResult = await query(countSql, params);
    const total = countResult[0].total;

    const limitNum = parseInt(limit);
    const pageNum = parseInt(page);
    const offsetNum = (pageNum - 1) * limitNum;
    
    // Use string interpolation for LIMIT/OFFSET (MySQL requirement)
    sql += ` ORDER BY created_at DESC LIMIT ${limitNum} OFFSET ${offsetNum}`;
    
    const clients = await query(sql, params);

    res.json({
      success: true,
      data: clients,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching clients.',
      error: error.message 
    });
  }
});

// Create client
router.post('/clients', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { client_name, contact_name, email, phone_no, date_started, status, active_model } = req.body;
    
    const result = await query(
      `INSERT INTO client (client_name, contact_name, email, phone_no, date_started, status, active_model)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [client_name, contact_name, email, phone_no, date_started, status || 'active', active_model]
    );

    res.status(201).json({
      success: true,
      message: 'Client created successfully',
      client_id: result.insertId
    });
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({ success: false, message: 'Error creating client.' });
  }
});

// Update client
router.put('/clients/:clientId', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { client_name, contact_name, email, phone_no, date_started, status, active_model } = req.body;
    
    await query(
      `UPDATE client 
       SET client_name = ?, contact_name = ?, email = ?, phone_no = ?, 
           date_started = ?, status = ?, active_model = ?
       WHERE client_id = ?`,
      [client_name, contact_name, email, phone_no, date_started, status, active_model, req.params.clientId]
    );

    res.json({ success: true, message: 'Client updated successfully' });
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({ success: false, message: 'Error updating client.' });
  }
});

// ==================== DOCUMENT CATEGORY MANAGEMENT ====================

// Get all categories
router.get('/categories', verifyToken, async (req, res) => {
  try {
    const categories = await query('SELECT * FROM doc_category ORDER BY category_name');
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ success: false, message: 'Error fetching categories.' });
  }
});

// Create category
router.post('/categories', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { category_name, category_description } = req.body;
    
    const result = await query(
      'INSERT INTO doc_category (category_name, category_description) VALUES (?, ?)',
      [category_name, category_description]
    );

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      category_id: result.insertId
    });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ success: false, message: 'Error creating category.' });
  }
});

// Update category
router.put('/categories/:categoryId', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { category_name, category_description } = req.body;
    
    await query(
      'UPDATE doc_category SET category_name = ?, category_description = ? WHERE category_id = ?',
      [category_name, category_description, req.params.categoryId]
    );

    res.json({ success: true, message: 'Category updated successfully' });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ success: false, message: 'Error updating category.' });
  }
});

// Delete category
router.delete('/categories/:categoryId', verifyToken, checkRole('superadmin'), async (req, res) => {
  try {
    await query('DELETE FROM doc_category WHERE category_id = ?', [req.params.categoryId]);
    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ success: false, message: 'Error deleting category.' });
  }
});

// ==================== FIELD MANAGEMENT ====================

// Get fields by category
router.get('/fields', verifyToken, async (req, res) => {
  try {
    const { doc_category } = req.query;
    
    let sql = `
      SELECT f.*, dc.category_name
      FROM field_table f
      LEFT JOIN doc_category dc ON f.doc_category = dc.category_id
      WHERE 1=1
    `;
    const params = [];

    if (doc_category) {
      sql += ' AND f.doc_category = ?';
      params.push(doc_category);
    }

    sql += ' ORDER BY f.field_name';
    
    const fields = await query(sql, params);
    res.json({ success: true, data: fields });
  } catch (error) {
    console.error('Get fields error:', error);
    res.status(500).json({ success: false, message: 'Error fetching fields.' });
  }
});

// Create field
router.post('/fields', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { 
      field_name, field_display_name, field_type, doc_category, 
      is_required, default_value, validation_regex, keywords 
    } = req.body;
    
    const keywordsJson = Array.isArray(keywords) ? JSON.stringify(keywords) : keywords;
    
    const result = await query(
      `INSERT INTO field_table 
       (field_name, field_display_name, field_type, doc_category, is_required, default_value, validation_regex, keywords)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [field_name, field_display_name, field_type, doc_category, is_required, default_value, validation_regex, keywordsJson]
    );

    res.status(201).json({
      success: true,
      message: 'Field created successfully',
      field_id: result.insertId
    });
  } catch (error) {
    console.error('Create field error:', error);
    // Return detailed error for debugging
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Field with this name already exists for this category.' });
    }
    res.status(500).json({ 
      success: false, 
      message: 'Error creating field.',
      error: error.message,
      code: error.code
    });
  }
});

// Update field
router.put('/fields/:fieldId', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { 
      field_name, field_display_name, field_type, doc_category, 
      is_required, default_value, validation_regex, keywords 
    } = req.body;
    
    const keywordsJson = Array.isArray(keywords) ? JSON.stringify(keywords) : keywords;
    
    await query(
      `UPDATE field_table 
       SET field_name = ?, field_display_name = ?, field_type = ?, doc_category = ?, 
           is_required = ?, default_value = ?, validation_regex = ?, keywords = ?
       WHERE field_id = ?`,
      [field_name, field_display_name, field_type, doc_category, is_required, default_value, validation_regex, keywordsJson, req.params.fieldId]
    );

    res.json({ success: true, message: 'Field updated successfully' });
  } catch (error) {
    console.error('Update field error:', error);
    res.status(500).json({ success: false, message: 'Error updating field.' });
  }
});

// Delete field
router.delete('/fields/:fieldId', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    await query('DELETE FROM field_table WHERE field_id = ?', [req.params.fieldId]);
    res.json({ success: true, message: 'Field deleted successfully' });
  } catch (error) {
    console.error('Delete field error:', error);
    res.status(500).json({ success: false, message: 'Error deleting field.' });
  }
});

// ==================== MODEL CONFIGURATION ====================

// Get all models
router.get('/models', verifyToken, async (req, res) => {
  try {
    const { doc_category, client_id } = req.query;
    
    let sql = `
      SELECT m.*, dc.category_name, c.client_name
      FROM model_config m
      LEFT JOIN doc_category dc ON m.doc_category = dc.category_id
      LEFT JOIN client c ON m.client_id = c.client_id
      WHERE 1=1
    `;
    const params = [];

    if (doc_category) {
      sql += ' AND m.doc_category = ?';
      params.push(doc_category);
    }
    if (client_id) {
      sql += ' AND m.client_id = ?';
      params.push(client_id);
    }

    sql += ' ORDER BY m.created_at DESC';
    
    const models = await query(sql, params);
    res.json({ success: true, data: models });
  } catch (error) {
    console.error('Get models error:', error);
    res.status(500).json({ success: false, message: 'Error fetching models.' });
  }
});

// Get model with field mappings
router.get('/models/:modelId', verifyToken, async (req, res) => {
  try {
    const models = await query(
      `SELECT m.*, dc.category_name, c.client_name
       FROM model_config m
       LEFT JOIN doc_category dc ON m.doc_category = dc.category_id
       LEFT JOIN client c ON m.client_id = c.client_id
       WHERE m.model_id = ?`,
      [req.params.modelId]
    );

    if (models.length === 0) {
      return res.status(404).json({ success: false, message: 'Model not found.' });
    }

    // Get field mappings
    const mappings = await query(
      `SELECT fm.*, f.field_name, f.field_display_name, f.field_type, f.keywords
       FROM field_mapping fm
       JOIN field_table f ON fm.field_id = f.field_id
       WHERE fm.model_id = ? AND fm.is_active = true
       ORDER BY fm.field_order`,
      [req.params.modelId]
    );

    res.json({
      success: true,
      data: {
        ...models[0],
        mappings
      }
    });
  } catch (error) {
    console.error('Get model error:', error);
    res.status(500).json({ success: false, message: 'Error fetching model.' });
  }
});

// Create model
router.post('/models', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const {
      model_name,
      model_code,
      doc_category,
      client_id,
      is_default,
      description,
      field_ids,
      input_cost_per_1k,
      output_cost_per_1k,
      is_active
    } = req.body;

    const result = await transaction(async (connection) => {
      // Create model
      const [modelResult] = await connection.execute(
        `INSERT INTO model_config (model_name, model_code, doc_category, client_id, is_default, description, created_by, input_cost_per_1k, output_cost_per_1k, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          model_name,
          model_code || null,
          doc_category || null,
          client_id || null,
          is_default || false,
          description || null,
          req.user.userid,
          input_cost_per_1k || 0.000150,
          output_cost_per_1k || 0.000600,
          is_active !== undefined ? is_active : true
        ]
      );

      const modelId = modelResult.insertId;

      // Add field mappings
      if (field_ids && Array.isArray(field_ids) && field_ids.length > 0) {
        for (let i = 0; i < field_ids.length; i++) {
          await connection.execute(
            'INSERT INTO field_mapping (model_id, field_id, field_order) VALUES (?, ?, ?)',
            [modelId, field_ids[i], i]
          );
        }
      }

      return modelId;
    });

    res.status(201).json({
      success: true,
      message: 'Model created successfully',
      model_id: result
    });
  } catch (error) {
    console.error('Create model error:', error);
    res.status(500).json({ success: false, message: 'Error creating model.' });
  }
});

// Update model
router.put('/models/:modelId', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const {
      model_name,
      model_code,
      doc_category,
      client_id,
      is_default,
      description,
      field_ids,
      input_cost_per_1k,
      output_cost_per_1k,
      is_active
    } = req.body;

    await transaction(async (connection) => {
      // Update model
      await connection.execute(
        `UPDATE model_config
         SET model_name = ?, model_code = ?, doc_category = ?, client_id = ?, is_default = ?, description = ?,
             input_cost_per_1k = ?, output_cost_per_1k = ?, is_active = ?
         WHERE model_id = ?`,
        [
          model_name,
          model_code || null,
          doc_category || null,
          client_id || null,
          is_default || false,
          description || null,
          input_cost_per_1k,
          output_cost_per_1k,
          is_active !== undefined ? is_active : true,
          req.params.modelId
        ]
      );

      // Update field mappings if provided
      if (field_ids && Array.isArray(field_ids)) {
        // Delete existing mappings
        await connection.execute(
          'DELETE FROM field_mapping WHERE model_id = ?',
          [req.params.modelId]
        );

        // Add new mappings
        for (let i = 0; i < field_ids.length; i++) {
          await connection.execute(
            'INSERT INTO field_mapping (model_id, field_id, field_order) VALUES (?, ?, ?)',
            [req.params.modelId, field_ids[i], i]
          );
        }
      }
    });

    res.json({ success: true, message: 'Model updated successfully' });
  } catch (error) {
    console.error('Update model error:', error);
    res.status(500).json({ success: false, message: 'Error updating model.' });
  }
});

// Delete model
router.delete('/models/:modelId', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    await query('DELETE FROM model_config WHERE model_id = ?', [req.params.modelId]);
    res.json({ success: true, message: 'Model deleted successfully' });
  } catch (error) {
    console.error('Delete model error:', error);
    res.status(500).json({ success: false, message: 'Error deleting model.' });
  }
});

// ==================== MODEL PRICING CONFIGURATION ====================

// Get all active OpenAI models with pricing (public endpoint for n8n)
router.get('/openai-models', async (req, res) => {
  try {
    const models = await query(
      `SELECT model_id, model_name, model_code,
              input_cost_per_1k, output_cost_per_1k, is_active
       FROM model_config
       WHERE is_active = true AND model_code IS NOT NULL
       ORDER BY model_name`
    );

    res.json({
      success: true,
      data: models
    });
  } catch (error) {
    console.error('Get OpenAI models error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching OpenAI models.',
      error: error.message
    });
  }
});

// Get specific model pricing by ID (public endpoint for n8n)
router.get('/openai-models/:modelId/pricing', async (req, res) => {
  try {
    const models = await query(
      `SELECT model_id, model_name, model_code,
              input_cost_per_1k, output_cost_per_1k
       FROM model_config
       WHERE model_id = ? AND is_active = true AND model_code IS NOT NULL`,
      [req.params.modelId]
    );

    if (models.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Model not found or not active.'
      });
    }

    res.json({
      success: true,
      data: models[0]
    });
  } catch (error) {
    console.error('Get model pricing error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching model pricing.',
      error: error.message
    });
  }
});

// Update model pricing (admin only)
router.put('/openai-models/:modelId/pricing', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { input_cost_per_1k, output_cost_per_1k } = req.body;

    if (input_cost_per_1k === undefined || output_cost_per_1k === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Both input_cost_per_1k and output_cost_per_1k are required.'
      });
    }

    await query(
      `UPDATE model_config
       SET input_cost_per_1k = ?, output_cost_per_1k = ?, updated_at = NOW()
       WHERE model_id = ?`,
      [input_cost_per_1k, output_cost_per_1k, req.params.modelId]
    );

    console.log(`✓ Updated pricing for model_id: ${req.params.modelId}`);

    res.json({
      success: true,
      message: 'Model pricing updated successfully'
    });
  } catch (error) {
    console.error('Update model pricing error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating model pricing.',
      error: error.message
    });
  }
});

// ==================== SYSTEM CONFIGURATION ====================

// Get system configuration value by key (public endpoint for n8n)
router.get('/config/:key', async (req, res) => {
  try {
    const configs = await query(
      'SELECT config_key, config_value, description FROM system_config WHERE config_key = ?',
      [req.params.key]
    );

    if (configs.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Configuration key not found.'
      });
    }

    const config = configs[0];

    res.json({
      success: true,
      data: {
        key: config.config_key,
        value: parseFloat(config.config_value) || config.config_value,
        description: config.description
      }
    });
  } catch (error) {
    console.error('Get system config error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching system configuration.',
      error: error.message
    });
  }
});

// Get all system configurations (admin only)
router.get('/config', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const configs = await query(
      'SELECT config_key, config_value, description, updated_at FROM system_config ORDER BY config_key'
    );

    res.json({
      success: true,
      data: configs
    });
  } catch (error) {
    console.error('Get all system configs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching system configurations.',
      error: error.message
    });
  }
});

// Update system configuration (admin only)
router.put('/config/:key', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { value } = req.body;

    if (value === undefined || value === null) {
      return res.status(400).json({
        success: false,
        message: 'Configuration value is required.'
      });
    }

    // Check if config key exists
    const existing = await query(
      'SELECT config_key FROM system_config WHERE config_key = ?',
      [req.params.key]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Configuration key not found.'
      });
    }

    await query(
      'UPDATE system_config SET config_value = ?, updated_at = NOW() WHERE config_key = ?',
      [value.toString(), req.params.key]
    );

    console.log(`✓ Updated system config: ${req.params.key} = ${value}`);

    res.json({
      success: true,
      message: 'System configuration updated successfully'
    });
  } catch (error) {
    console.error('Update system config error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating system configuration.',
      error: error.message
    });
  }
});

// Create new system configuration (admin only)
router.post('/config', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { config_key, config_value, description } = req.body;

    if (!config_key || !config_value) {
      return res.status(400).json({
        success: false,
        message: 'config_key and config_value are required.'
      });
    }

    // Check if key already exists
    const existing = await query(
      'SELECT config_key FROM system_config WHERE config_key = ?',
      [config_key]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Configuration key already exists. Use PUT to update.'
      });
    }

    await query(
      'INSERT INTO system_config (config_key, config_value, description) VALUES (?, ?, ?)',
      [config_key, config_value.toString(), description || null]
    );

    console.log(`✓ Created system config: ${config_key} = ${config_value}`);

    res.status(201).json({
      success: true,
      message: 'System configuration created successfully'
    });
  } catch (error) {
    console.error('Create system config error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating system configuration.',
      error: error.message
    });
  }
});

// ==================== PERMISSIONS MANAGEMENT ====================

// Grant permission to user
router.post('/permissions/:userid', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { permission_name } = req.body;
    
    await query(
      'INSERT INTO user_permissions (userid, permission_name, granted_by) VALUES (?, ?, ?)',
      [req.params.userid, permission_name, req.user.userid]
    );

    res.status(201).json({ success: true, message: 'Permission granted successfully' });
  } catch (error) {
    console.error('Grant permission error:', error);
    res.status(500).json({ success: false, message: 'Error granting permission.' });
  }
});

// Revoke permission from user
router.delete('/permissions/:userid/:permissionName', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    await query(
      'DELETE FROM user_permissions WHERE userid = ? AND permission_name = ?',
      [req.params.userid, req.params.permissionName]
    );

    res.json({ success: true, message: 'Permission revoked successfully' });
  } catch (error) {
    console.error('Revoke permission error:', error);
    res.status(500).json({ success: false, message: 'Error revoking permission.' });
  }
});

// ==================== MODEL MANAGEMENT ====================

// Get all models
router.get('/model-versions', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    // Get total count
    const countResult = await query('SELECT COUNT(*) as total FROM model');
    const total = countResult[0].total;

    // Add pagination - use string interpolation for LIMIT/OFFSET (MySQL requirement)
    const limitNum = parseInt(limit);
    const pageNum = parseInt(page);
    const offsetNum = (pageNum - 1) * limitNum;
    
    const sql = `
      SELECT m.*, dc.category_name, mc.model_name as ai_model_name,
             (SELECT COUNT(*) FROM field_table f WHERE f.doc_category = m.doc_category_id) as no_of_fields
      FROM model m
      LEFT JOIN doc_category dc ON m.doc_category_id = dc.category_id
      LEFT JOIN model_config mc ON m.ai_model_id = mc.model_id
      ORDER BY m.created_at DESC
      LIMIT ${limitNum} OFFSET ${offsetNum}
    `;
    const models = await query(sql);

    res.json({
      success: true,
      data: models,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get model versions error:', error);
    res.status(500).json({ success: false, message: 'Error fetching model versions.' });
  }
});

// Get model by ID
router.get('/model-versions/:id', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const models = await query('SELECT * FROM model WHERE id = ?', [req.params.id]);
    
    if (models.length === 0) {
      return res.status(404).json({ success: false, message: 'Model not found.' });
    }

    res.json({ success: true, data: models[0] });
  } catch (error) {
    console.error('Get model version error:', error);
    res.status(500).json({ success: false, message: 'Error fetching model version.' });
  }
});

// Create model
router.post('/model-versions', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { model_name, version, doc_category_id, ai_model_id, purpose } = req.body;

    if (!model_name || !version) {
      return res.status(400).json({ success: false, message: 'Model name and version are required.' });
    }

    const result = await query(
      'INSERT INTO model (model_name, version, doc_category_id, ai_model_id, purpose) VALUES (?, ?, ?, ?, ?)',
      [model_name, version, doc_category_id || null, ai_model_id || null, purpose || null]
    );

    res.status(201).json({
      success: true,
      message: 'Model created successfully',
      id: result.insertId
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Model with this name and version already exists.' });
    }
    console.error('Create model version error:', error);
    res.status(500).json({ success: false, message: 'Error creating model version.' });
  }
});

// Update model
router.put('/model-versions/:id', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { model_name, version, doc_category_id, ai_model_id, purpose } = req.body;

    await query(
      'UPDATE model SET model_name = ?, version = ?, doc_category_id = ?, ai_model_id = ?, purpose = ? WHERE id = ?',
      [model_name, version, doc_category_id || null, ai_model_id || null, purpose || null, req.params.id]
    );

    res.json({ success: true, message: 'Model updated successfully' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Model with this name and version already exists.' });
    }
    console.error('Update model version error:', error);
    res.status(500).json({ success: false, message: 'Error updating model version.' });
  }
});

// Delete model
router.delete('/model-versions/:id', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    await query('DELETE FROM model WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Model deleted successfully' });
  } catch (error) {
    console.error('Delete model version error:', error);
    res.status(500).json({ success: false, message: 'Error deleting model version.' });
  }
});

// ==================== DASHBOARD ANALYTICS ====================

// Get dashboard analytics
router.get('/dashboard/analytics', verifyToken, async (req, res) => {
  try {
    // Get total counts
    const userCount = await query('SELECT COUNT(*) as total FROM user_profile');
    const clientCount = await query('SELECT COUNT(*) as total FROM client');
    const modelCount = await query('SELECT COUNT(*) as total FROM model');
    const fieldCount = await query('SELECT COUNT(*) as total FROM field_table');
    const categoryCount = await query('SELECT COUNT(*) as total FROM doc_category');
    
    // Get active vs inactive users
    const activeUsers = await query('SELECT COUNT(*) as total FROM user_profile WHERE is_active = 1');
    const inactiveUsers = await query('SELECT COUNT(*) as total FROM user_profile WHERE is_active = 0');
    
    // Get active vs inactive clients
    const activeClients = await query("SELECT COUNT(*) as total FROM client WHERE status = 'active'");
    const inactiveClients = await query("SELECT COUNT(*) as total FROM client WHERE status = 'inactive'");
    
    // Get users by role
    const usersByRole = await query(`
      SELECT user_role, COUNT(*) as count 
      FROM user_profile 
      GROUP BY user_role
    `);
    
    // Get recent users (last 5)
    const recentUsers = await query(`
      SELECT userid, email, first_name, last_name, user_role, created_at
      FROM user_profile
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    // Get recent clients (last 5)
    const recentClients = await query(`
      SELECT client_id, client_name, contact_name, status, created_at
      FROM client
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    // Get fields by category
    const fieldsByCategory = await query(`
      SELECT dc.category_name, COUNT(f.field_id) as field_count
      FROM doc_category dc
      LEFT JOIN field_table f ON dc.category_id = f.doc_category
      GROUP BY dc.category_id, dc.category_name
      ORDER BY field_count DESC
    `);

    res.json({
      success: true,
      data: {
        totals: {
          users: userCount[0].total,
          clients: clientCount[0].total,
          models: modelCount[0].total,
          fields: fieldCount[0].total,
          categories: categoryCount[0].total
        },
        userStats: {
          active: activeUsers[0].total,
          inactive: inactiveUsers[0].total,
          byRole: usersByRole
        },
        clientStats: {
          active: activeClients[0].total,
          inactive: inactiveClients[0].total
        },
        recent: {
          users: recentUsers,
          clients: recentClients
        },
        fieldsByCategory: fieldsByCategory
      }
    });
  } catch (error) {
    console.error('Get dashboard analytics error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching dashboard analytics.',
      error: error.message 
    });
  }
});

// ==================== AUDIT LOG ====================

// Get audit logs
router.get('/audit-logs', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { userid, action, from_date, to_date, page = 1, limit = 50 } = req.query;
    
    let sql = `
      SELECT a.*, u.email as user_email
      FROM audit_log a
      LEFT JOIN user_profile u ON a.userid = u.userid
      WHERE 1=1
    `;
    const params = [];

    if (userid) {
      sql += ' AND a.userid = ?';
      params.push(userid);
    }
    if (action) {
      sql += ' AND a.action LIKE ?';
      params.push(`%${action}%`);
    }
    if (from_date) {
      sql += ' AND a.created_at >= ?';
      params.push(from_date);
    }
    if (to_date) {
      sql += ' AND a.created_at <= ?';
      params.push(to_date);
    }

    const countSql = sql.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as total FROM');
    const countResult = await query(countSql, params);
    const total = countResult[0].total;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    sql += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const logs = await query(sql, params);

    res.json({
      success: true,
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ success: false, message: 'Error fetching audit logs.' });
  }
});

module.exports = router;
