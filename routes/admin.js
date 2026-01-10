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

    // Fetch all users (excluding password)
    let users = await query('SELECT userid, email, first_name, last_name, user_role, client_id, is_active, last_login, created_at, timezone FROM user_profile');

    // Apply filters
    if (client_id) {
      users = users.filter(u => u.client_id === parseInt(client_id));
    }
    if (role) {
      users = users.filter(u => u.user_role === role);
    }
    if (status !== undefined) {
      const isActive = status === 'active';
      users = users.filter(u => u.is_active === isActive);
    }

    // Get total count before pagination
    const total = users.length;

    // Sort by created_at DESC
    users.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    // Apply pagination
    const limitNum = parseInt(limit) || 20;
    const pageNum = parseInt(page) || 1;
    const offsetNum = (pageNum - 1) * limitNum;
    users = users.slice(offsetNum, offsetNum + limitNum);

    // Fetch clients for enrichment
    let clients = [];
    try { clients = await query('SELECT client_id, client_name FROM client'); } catch (e) { console.warn('Error fetching clients:', e.message); }

    // Create client lookup map
    const clientMap = {};
    clients.forEach(c => { clientMap[c.client_id] = c.client_name; });

    // Enrich users with client_name
    const enrichedUsers = users.map(u => ({
      ...u,
      client_name: u.client_id ? clientMap[u.client_id] : null
    }));

    res.json({
      success: true,
      data: enrichedUsers,
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
    const users = await query('SELECT * FROM user_profile WHERE userid = ?', [req.params.userid]);

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const user = users[0];

    // Get client name if user has client_id
    let clientName = null;
    if (user.client_id) {
      try {
        const clients = await query('SELECT client_name FROM client WHERE client_id = ?', [user.client_id]);
        if (clients.length > 0) clientName = clients[0].client_name;
      } catch (e) { console.warn('Error fetching client:', e.message); }
    }

    // Get user permissions
    let permissions = [];
    try {
      permissions = await query('SELECT permission_name FROM user_permissions WHERE userid = ?', [req.params.userid]);
    } catch (e) { console.warn('Error fetching permissions:', e.message); }

    // Exclude password from response
    const { password, ...userWithoutPassword } = user;

    res.json({
      success: true,
      data: {
        ...userWithoutPassword,
        client_name: clientName,
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

    // Check if user exists
    const existingUser = await query('SELECT userid FROM user_profile WHERE userid = ?', [req.params.userid]);
    if (existingUser.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Build dynamic update query with only provided fields
    const updates = [];
    const params = [];

    if (email !== undefined) { updates.push('email = ?'); params.push(email); }
    if (first_name !== undefined) { updates.push('first_name = ?'); params.push(first_name); }
    if (last_name !== undefined) { updates.push('last_name = ?'); params.push(last_name); }
    if (user_role !== undefined) { updates.push('user_role = ?'); params.push(user_role); }
    if (client_id !== undefined) { updates.push('client_id = ?'); params.push(client_id); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active); }
    if (timezone !== undefined) { updates.push('timezone = ?'); params.push(timezone); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    params.push(req.params.userid);
    await query(`UPDATE user_profile SET ${updates.join(', ')} WHERE userid = ?`, params);

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

    // Fetch all clients
    let clients = await query('SELECT * FROM client');

    // Apply status filter
    if (status) {
      clients = clients.filter(c => c.status === status);
    }

    // Get total count before pagination
    const total = clients.length;

    // Sort by created_at DESC
    clients.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    // Apply pagination
    const limitNum = parseInt(limit) || 20;
    const pageNum = parseInt(page) || 1;
    const offsetNum = (pageNum - 1) * limitNum;
    clients = clients.slice(offsetNum, offsetNum + limitNum);

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

    if (!client_name) {
      return res.status(400).json({ success: false, message: 'Client name is required.' });
    }

    // Check for duplicate email if provided
    if (email) {
      const existingEmail = await query('SELECT client_id FROM client WHERE email = ?', [email]);
      if (existingEmail.length > 0) {
        return res.status(400).json({ success: false, message: 'A client with this email already exists.' });
      }
    }

    const result = await query(
      `INSERT INTO client (client_name, contact_name, email, phone_no, date_started, status, active_model)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        client_name,
        contact_name || null,
        email || null,
        phone_no || null,
        date_started || null,
        status || 'active',
        active_model || null
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Client created successfully',
      client_id: result.insertId
    });
  } catch (error) {
    console.error('Create client error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'A client with this email already exists.' });
    }
    res.status(500).json({ success: false, message: 'Error creating client.' });
  }
});

// Update client
router.put('/clients/:clientId', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { client_name, contact_name, email, phone_no, date_started, end_date, status, active_model } = req.body;

    // Check if client exists
    const existingClient = await query('SELECT client_id FROM client WHERE client_id = ?', [req.params.clientId]);
    if (existingClient.length === 0) {
      return res.status(404).json({ success: false, message: 'Client not found.' });
    }

    // Build dynamic update query with only provided fields
    const updates = [];
    const params = [];

    if (client_name !== undefined) { updates.push('client_name = ?'); params.push(client_name); }
    if (contact_name !== undefined) { updates.push('contact_name = ?'); params.push(contact_name); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email); }
    if (phone_no !== undefined) { updates.push('phone_no = ?'); params.push(phone_no); }
    if (date_started !== undefined) { updates.push('date_started = ?'); params.push(date_started || null); }
    if (end_date !== undefined) { updates.push('end_date = ?'); params.push(end_date || null); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (active_model !== undefined) { updates.push('active_model = ?'); params.push(active_model || null); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    params.push(req.params.clientId);
    await query(`UPDATE client SET ${updates.join(', ')} WHERE client_id = ?`, params);

    res.json({ success: true, message: 'Client updated successfully' });
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({ success: false, message: 'Error updating client.' });
  }
});

// Delete client
router.delete('/clients/:clientId', verifyToken, checkRole('superadmin'), async (req, res) => {
  try {
    const { clientId } = req.params;

    // Check if client exists
    const existingClient = await query('SELECT client_id, client_name FROM client WHERE client_id = ?', [clientId]);
    if (existingClient.length === 0) {
      return res.status(404).json({ success: false, message: 'Client not found.' });
    }

    // Check if client has associated users
    const associatedUsers = await query('SELECT COUNT(*) as count FROM user_profile WHERE client_id = ?', [clientId]);
    if (associatedUsers[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete client. ${associatedUsers[0].count} user(s) are associated with this client. Please reassign or delete them first.`
      });
    }

    // Check if client has processed documents
    const associatedDocs = await query('SELECT COUNT(*) as count FROM document_processed WHERE client_id = ?', [clientId]);
    if (associatedDocs[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete client. ${associatedDocs[0].count} document(s) are associated with this client.`
      });
    }

    // Delete associated output profiles first
    await query('DELETE FROM output_profile WHERE client_id = ?', [clientId]);

    // Delete the client
    await query('DELETE FROM client WHERE client_id = ?', [clientId]);

    res.json({ success: true, message: 'Client deleted successfully' });
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({ success: false, message: 'Error deleting client.' });
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

    if (!category_name) {
      return res.status(400).json({ success: false, message: 'Category name is required.' });
    }

    // Check for duplicate category name
    const existing = await query('SELECT category_id FROM doc_category WHERE category_name = ?', [category_name]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Category with this name already exists.' });
    }

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
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Category with this name already exists.' });
    }
    res.status(500).json({ success: false, message: 'Error creating category.' });
  }
});

// Update category
router.put('/categories/:categoryId', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { category_name, category_description } = req.body;

    // Check if category exists
    const existingCategory = await query('SELECT category_id FROM doc_category WHERE category_id = ?', [req.params.categoryId]);
    if (existingCategory.length === 0) {
      return res.status(404).json({ success: false, message: 'Category not found.' });
    }

    // Build dynamic update query with only provided fields
    const updates = [];
    const params = [];

    if (category_name !== undefined) { updates.push('category_name = ?'); params.push(category_name); }
    if (category_description !== undefined) { updates.push('category_description = ?'); params.push(category_description); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    params.push(req.params.categoryId);
    await query(`UPDATE doc_category SET ${updates.join(', ')} WHERE category_id = ?`, params);

    res.json({ success: true, message: 'Category updated successfully' });
  } catch (error) {
    console.error('Update category error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Category with this name already exists.' });
    }
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

    // Fetch all fields
    let fields = await query('SELECT * FROM field_table');

    // Apply doc_category filter
    if (doc_category) {
      fields = fields.filter(f => f.doc_category === parseInt(doc_category));
    }

    // Sort by field_name
    fields.sort((a, b) => (a.field_name || '').localeCompare(b.field_name || ''));

    // Fetch categories for enrichment
    let categories = [];
    try { categories = await query('SELECT category_id, category_name FROM doc_category'); } catch (e) { console.warn('Error fetching categories:', e.message); }

    // Create category lookup map
    const categoryMap = {};
    categories.forEach(c => { categoryMap[c.category_id] = c.category_name; });

    // Enrich fields with category_name
    const enrichedFields = fields.map(f => ({
      ...f,
      category_name: f.doc_category ? categoryMap[f.doc_category] : null
    }));

    res.json({ success: true, data: enrichedFields });
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

    if (!field_name) {
      return res.status(400).json({ success: false, message: 'Field name is required.' });
    }

    if (!doc_category) {
      return res.status(400).json({ success: false, message: 'Document category is required.' });
    }

    // Handle undefined values - convert to null for MySQL
    const keywordsJson = keywords ? (Array.isArray(keywords) ? JSON.stringify(keywords) : keywords) : null;

    const result = await query(
      `INSERT INTO field_table
       (field_name, field_display_name, field_type, doc_category, is_required, default_value, validation_regex, keywords)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        field_name,
        field_display_name || null,
        field_type || 'string',
        doc_category,
        is_required === true ? 1 : 0,
        default_value || null,
        validation_regex || null,
        keywordsJson
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Field created successfully',
      field_id: result.insertId
    });
  } catch (error) {
    console.error('Create field error:', error);
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

    // Check if field exists
    const existingField = await query('SELECT field_id FROM field_table WHERE field_id = ?', [req.params.fieldId]);
    if (existingField.length === 0) {
      return res.status(404).json({ success: false, message: 'Field not found.' });
    }

    // Build dynamic update query with only provided fields
    const updates = [];
    const params = [];

    if (field_name !== undefined) { updates.push('field_name = ?'); params.push(field_name); }
    if (field_display_name !== undefined) { updates.push('field_display_name = ?'); params.push(field_display_name); }
    if (field_type !== undefined) { updates.push('field_type = ?'); params.push(field_type); }
    if (doc_category !== undefined) { updates.push('doc_category = ?'); params.push(doc_category); }
    if (is_required !== undefined) { updates.push('is_required = ?'); params.push(is_required === true ? 1 : 0); }
    if (default_value !== undefined) { updates.push('default_value = ?'); params.push(default_value || null); }
    if (validation_regex !== undefined) { updates.push('validation_regex = ?'); params.push(validation_regex || null); }
    if (keywords !== undefined) {
      const keywordsJson = keywords ? (Array.isArray(keywords) ? JSON.stringify(keywords) : keywords) : null;
      updates.push('keywords = ?');
      params.push(keywordsJson);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    params.push(req.params.fieldId);
    await query(`UPDATE field_table SET ${updates.join(', ')} WHERE field_id = ?`, params);

    res.json({ success: true, message: 'Field updated successfully' });
  } catch (error) {
    console.error('Update field error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Field with this name already exists for this category.' });
    }
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

    // Fetch all models
    let models = await query('SELECT * FROM model_config');

    // Apply filters
    if (doc_category) {
      models = models.filter(m => m.doc_category === parseInt(doc_category));
    }
    if (client_id) {
      models = models.filter(m => m.client_id === parseInt(client_id));
    }

    // Sort by created_at DESC
    models.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    // Fetch related data for enrichment
    let categories = [], clients = [];
    try { categories = await query('SELECT category_id, category_name FROM doc_category'); } catch (e) { console.warn('Error fetching categories:', e.message); }
    try { clients = await query('SELECT client_id, client_name FROM client'); } catch (e) { console.warn('Error fetching clients:', e.message); }

    // Create lookup maps
    const categoryMap = {};
    categories.forEach(c => { categoryMap[c.category_id] = c.category_name; });
    const clientMap = {};
    clients.forEach(c => { clientMap[c.client_id] = c.client_name; });

    // Enrich models
    const enrichedModels = models.map(m => ({
      ...m,
      category_name: m.doc_category ? categoryMap[m.doc_category] : null,
      client_name: m.client_id ? clientMap[m.client_id] : null
    }));

    res.json({ success: true, data: enrichedModels });
  } catch (error) {
    console.error('Get models error:', error);
    res.status(500).json({ success: false, message: 'Error fetching models.' });
  }
});

// Get model with field mappings
router.get('/models/:modelId', verifyToken, async (req, res) => {
  try {
    const models = await query('SELECT * FROM model_config WHERE model_id = ?', [req.params.modelId]);

    if (models.length === 0) {
      return res.status(404).json({ success: false, message: 'Model not found.' });
    }

    const model = models[0];

    // Get related data for enrichment
    let categoryName = null, clientName = null;
    if (model.doc_category) {
      try {
        const cats = await query('SELECT category_name FROM doc_category WHERE category_id = ?', [model.doc_category]);
        if (cats.length > 0) categoryName = cats[0].category_name;
      } catch (e) { console.warn('Error fetching category:', e.message); }
    }
    if (model.client_id) {
      try {
        const clients = await query('SELECT client_name FROM client WHERE client_id = ?', [model.client_id]);
        if (clients.length > 0) clientName = clients[0].client_name;
      } catch (e) { console.warn('Error fetching client:', e.message); }
    }

    // Get field mappings
    let mappings = [];
    try {
      const allMappings = await query('SELECT * FROM field_mapping WHERE model_id = ? AND is_active = true', [req.params.modelId]);
      const fields = await query('SELECT * FROM field_table');

      // Create field lookup map
      const fieldMap = {};
      fields.forEach(f => { fieldMap[f.field_id] = f; });

      // Enrich mappings with field data
      mappings = allMappings.map(fm => {
        const field = fieldMap[fm.field_id] || {};
        return {
          ...fm,
          field_name: field.field_name,
          field_display_name: field.field_display_name,
          field_type: field.field_type,
          keywords: field.keywords
        };
      });

      // Sort by field_order
      mappings.sort((a, b) => (a.field_order || 0) - (b.field_order || 0));
    } catch (e) { console.warn('Error fetching field mappings:', e.message); }

    res.json({
      success: true,
      data: {
        ...model,
        category_name: categoryName,
        client_name: clientName,
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

    // Fetch all models
    let models = await query('SELECT * FROM model');
    const total = models.length;

    // Sort by created_at DESC
    models.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    // Apply pagination
    const limitNum = parseInt(limit) || 20;
    const pageNum = parseInt(page) || 1;
    const offsetNum = (pageNum - 1) * limitNum;
    models = models.slice(offsetNum, offsetNum + limitNum);

    // Fetch related data for enrichment
    let categories = [], modelConfigs = [], fields = [];
    try { categories = await query('SELECT category_id, category_name FROM doc_category'); } catch (e) { console.warn('Error fetching categories:', e.message); }
    try { modelConfigs = await query('SELECT model_id, model_name FROM model_config'); } catch (e) { console.warn('Error fetching model_config:', e.message); }
    try { fields = await query('SELECT doc_category FROM field_table'); } catch (e) { console.warn('Error fetching fields:', e.message); }

    // Create lookup maps
    const categoryMap = {};
    categories.forEach(c => { categoryMap[c.category_id] = c.category_name; });
    const modelConfigMap = {};
    modelConfigs.forEach(mc => { modelConfigMap[mc.model_id] = mc.model_name; });

    // Count fields by category
    const fieldCountByCategory = {};
    fields.forEach(f => {
      if (f.doc_category) {
        fieldCountByCategory[f.doc_category] = (fieldCountByCategory[f.doc_category] || 0) + 1;
      }
    });

    // Enrich models
    const enrichedModels = models.map(m => ({
      ...m,
      category_name: m.doc_category_id ? categoryMap[m.doc_category_id] : null,
      ai_model_name: m.ai_model_id ? modelConfigMap[m.ai_model_id] : null,
      no_of_fields: m.doc_category_id ? (fieldCountByCategory[m.doc_category_id] || 0) : 0
    }));

    res.json({
      success: true,
      data: enrichedModels,
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
    // Helper to safely get count
    const safeCount = (result) => {
      if (!result || result.length === 0) return 0;
      return result[0]?.total || result[0]?.count || result.length || 0;
    };

    // Get total counts with error handling
    let userCount = 0, clientCount = 0, modelCount = 0, fieldCount = 0, categoryCount = 0;
    let activeUsers = 0, inactiveUsers = 0, activeClients = 0, inactiveClients = 0;
    let usersByRole = [], recentUsers = [], recentClients = [], fieldsByCategory = [];

    try {
      const users = await query('SELECT * FROM user_profile');
      userCount = users?.length || 0;
      activeUsers = users?.filter(u => u.is_active === true).length || 0;
      inactiveUsers = users?.filter(u => u.is_active === false).length || 0;

      // Group by role
      const roleMap = {};
      users?.forEach(u => {
        roleMap[u.user_role] = (roleMap[u.user_role] || 0) + 1;
      });
      usersByRole = Object.entries(roleMap).map(([user_role, count]) => ({ user_role, count }));

      // Recent users (exclude password)
      recentUsers = users?.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 5)
        .map(({ password, ...user }) => user) || [];
    } catch (err) {
      console.warn('Error fetching user stats:', err.message);
    }

    try {
      const clients = await query('SELECT * FROM client');
      clientCount = clients?.length || 0;
      activeClients = clients?.filter(c => c.status === 'active').length || 0;
      inactiveClients = clients?.filter(c => c.status === 'inactive').length || 0;
      recentClients = clients?.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5) || [];
    } catch (err) {
      console.warn('Error fetching client stats:', err.message);
    }

    try {
      const models = await query('SELECT * FROM model');
      modelCount = models?.length || 0;
    } catch (err) {
      console.warn('Error fetching model count:', err.message);
    }

    try {
      const fields = await query('SELECT * FROM field_table');
      fieldCount = fields?.length || 0;
    } catch (err) {
      console.warn('Error fetching field count:', err.message);
    }

    try {
      const categories = await query('SELECT * FROM doc_category');
      categoryCount = categories?.length || 0;
      fieldsByCategory = categories?.map(cat => ({
        category_name: cat.category_name,
        field_count: 0
      })) || [];
    } catch (err) {
      console.warn('Error fetching category stats:', err.message);
    }

    res.json({
      success: true,
      data: {
        totals: {
          users: userCount,
          clients: clientCount,
          models: modelCount,
          fields: fieldCount,
          categories: categoryCount
        },
        userStats: {
          active: activeUsers,
          inactive: inactiveUsers,
          byRole: usersByRole
        },
        clientStats: {
          active: activeClients,
          inactive: inactiveClients
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

    // Fetch all audit logs
    let logs = await query('SELECT * FROM audit_log');

    // Apply filters in memory
    if (userid) {
      logs = logs.filter(l => l.userid === parseInt(userid));
    }
    if (action) {
      const actionLower = action.toLowerCase();
      logs = logs.filter(l => l.action && l.action.toLowerCase().includes(actionLower));
    }
    if (from_date) {
      const fromDateObj = new Date(from_date);
      logs = logs.filter(l => l.created_at && new Date(l.created_at) >= fromDateObj);
    }
    if (to_date) {
      const toDateObj = new Date(to_date);
      logs = logs.filter(l => l.created_at && new Date(l.created_at) <= toDateObj);
    }

    // Get total count before pagination
    const total = logs.length;

    // Sort by created_at DESC
    logs.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    // Apply pagination
    const limitNum = parseInt(limit) || 50;
    const pageNum = parseInt(page) || 1;
    const offsetNum = (pageNum - 1) * limitNum;
    logs = logs.slice(offsetNum, offsetNum + limitNum);

    // Fetch users for enrichment
    let users = [];
    try { users = await query('SELECT userid, email FROM user_profile'); } catch (e) { console.warn('Error fetching users:', e.message); }

    // Create user lookup map
    const userMap = {};
    users.forEach(u => { userMap[u.userid] = u.email; });

    // Enrich logs with user_email
    const enrichedLogs = logs.map(l => ({
      ...l,
      user_email: l.userid ? userMap[l.userid] : null
    }));

    res.json({
      success: true,
      data: enrichedLogs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ success: false, message: 'Error fetching audit logs.' });
  }
});

module.exports = router;
