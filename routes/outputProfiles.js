const express = require('express');
const router = express.Router();
const { query, transaction } = require('../config/database');
const { verifyToken, checkRole } = require('../middleware/auth');

// ==================== OUTPUT PROFILES ====================

// Get all output profiles
router.get('/', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { client_id, category_id, is_default, is_active = true, page = 1, limit = 20 } = req.query;

    let sql = `
      SELECT op.*,
             dc.category_name, dc.category_display_name,
             c.client_name,
             up.first_name as created_by_name, up.last_name as created_by_lastname
      FROM output_profile op
      LEFT JOIN doc_category dc ON op.doc_category_id = dc.category_id
      LEFT JOIN client c ON op.client_id = c.client_id
      LEFT JOIN user_profile up ON op.created_by = up.userid
      WHERE 1=1
    `;
    const params = [];

    if (client_id) {
      sql += ' AND op.client_id = ?';
      params.push(client_id);
    }
    if (category_id) {
      sql += ' AND op.doc_category_id = ?';
      params.push(category_id);
    }
    if (is_default !== undefined) {
      sql += ' AND op.is_default = ?';
      params.push(is_default === 'true' || is_default === true ? 1 : 0);
    }
    if (is_active !== undefined) {
      sql += ' AND op.is_active = ?';
      params.push(is_active === 'true' || is_active === true ? 1 : 0);
    }

    // Get total count
    const countSql = sql.replace(/SELECT op\.\*,[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM');
    const countResult = await query(countSql, params);
    const total = countResult[0]?.total || 0;

    // Add pagination
    const limitNum = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
    const pageNum = Math.max(parseInt(page) || 1, 1);
    const offsetNum = (pageNum - 1) * limitNum;

    sql += ` ORDER BY op.is_default DESC, op.created_at DESC LIMIT ${limitNum} OFFSET ${offsetNum}`;

    const profiles = await query(sql, params);

    res.json({
      success: true,
      data: profiles,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get output profiles error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching output profiles.',
      error: error.message
    });
  }
});

// Get single output profile with fields
router.get('/:profileId', verifyToken, async (req, res) => {
  try {
    const { profileId } = req.params;

    // Get profile
    const profileResult = await query(`
      SELECT op.*,
             dc.category_name, dc.category_display_name,
             c.client_name
      FROM output_profile op
      LEFT JOIN doc_category dc ON op.doc_category_id = dc.category_id
      LEFT JOIN client c ON op.client_id = c.client_id
      WHERE op.profile_id = ?
    `, [profileId]);

    if (profileResult.length === 0) {
      return res.status(404).json({ success: false, message: 'Output profile not found.' });
    }

    // Get profile fields
    const fields = await query(`
      SELECT opf.*,
             ft.field_name, ft.field_display_name, ft.field_type,
             ft.is_required as field_is_required
      FROM output_profile_field opf
      JOIN field_table ft ON opf.field_id = ft.field_id
      WHERE opf.profile_id = ?
      ORDER BY opf.field_order ASC
    `, [profileId]);

    res.json({
      success: true,
      data: {
        ...profileResult[0],
        fields
      }
    });
  } catch (error) {
    console.error('Get output profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching output profile.',
      error: error.message
    });
  }
});

// Get effective profile for client/category (with fallback to default)
router.get('/effective/:clientId/:categoryId', verifyToken, async (req, res) => {
  try {
    const { clientId, categoryId } = req.params;

    // Try to find client-specific profile first
    let profile = await query(`
      SELECT op.*,
             dc.category_name, dc.category_display_name,
             'client' as profile_source
      FROM output_profile op
      LEFT JOIN doc_category dc ON op.doc_category_id = dc.category_id
      WHERE op.client_id = ? AND op.doc_category_id = ? AND op.is_active = TRUE
    `, [clientId, categoryId]);

    // Fall back to default profile
    if (profile.length === 0) {
      profile = await query(`
        SELECT op.*,
               dc.category_name, dc.category_display_name,
               'default' as profile_source
        FROM output_profile op
        LEFT JOIN doc_category dc ON op.doc_category_id = dc.category_id
        WHERE op.doc_category_id = ? AND op.is_default = TRUE AND op.is_active = TRUE
      `, [categoryId]);
    }

    if (profile.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No output profile found for this category.'
      });
    }

    // Get profile fields
    const fields = await query(`
      SELECT opf.*,
             ft.field_name, ft.field_display_name, ft.field_type
      FROM output_profile_field opf
      JOIN field_table ft ON opf.field_id = ft.field_id
      WHERE opf.profile_id = ? AND opf.is_included = TRUE
      ORDER BY opf.field_order ASC
    `, [profile[0].profile_id]);

    res.json({
      success: true,
      data: {
        ...profile[0],
        fields
      }
    });
  } catch (error) {
    console.error('Get effective profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching effective profile.',
      error: error.message
    });
  }
});

// Create new output profile
router.post('/', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const {
      profile_name,
      client_id,
      doc_category_id,
      is_default = false,
      output_format = 'csv',
      csv_delimiter = ',',
      csv_quote_char = '"',
      include_header = true,
      date_format = 'YYYY-MM-DD',
      number_format = '0.00',
      currency_symbol = '$',
      null_value = '',
      description
    } = req.body;

    // Validate required fields
    if (!profile_name || !doc_category_id) {
      return res.status(400).json({
        success: false,
        message: 'Profile name and document category are required.'
      });
    }

    // Check if category exists
    const categoryExists = await query(
      'SELECT category_id FROM doc_category WHERE category_id = ?',
      [doc_category_id]
    );
    if (categoryExists.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Document category not found.'
      });
    }

    // Check for duplicate: client + category combination
    if (client_id) {
      const existing = await query(
        'SELECT profile_id FROM output_profile WHERE client_id = ? AND doc_category_id = ?',
        [client_id, doc_category_id]
      );
      if (existing.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'A profile already exists for this client and category combination.'
        });
      }
    }

    // Check for duplicate default profile for category
    if (is_default) {
      const existingDefault = await query(
        'SELECT profile_id FROM output_profile WHERE doc_category_id = ? AND is_default = TRUE',
        [doc_category_id]
      );
      if (existingDefault.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'A default profile already exists for this category.'
        });
      }
    }

    const result = await query(`
      INSERT INTO output_profile (
        profile_name, client_id, doc_category_id, is_default,
        output_format, csv_delimiter, csv_quote_char, include_header,
        date_format, number_format, currency_symbol, null_value,
        description, is_active, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?)
    `, [
      profile_name,
      client_id || null,
      doc_category_id,
      is_default ? 1 : 0,
      output_format,
      csv_delimiter,
      csv_quote_char,
      include_header ? 1 : 0,
      date_format,
      number_format,
      currency_symbol,
      null_value,
      description || null,
      req.user.userId
    ]);

    res.status(201).json({
      success: true,
      message: 'Output profile created successfully',
      profile_id: result.insertId
    });
  } catch (error) {
    console.error('Create output profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating output profile.',
      error: error.message
    });
  }
});

// Update output profile
router.put('/:profileId', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { profileId } = req.params;
    const {
      profile_name,
      output_format,
      csv_delimiter,
      csv_quote_char,
      include_header,
      date_format,
      number_format,
      currency_symbol,
      null_value,
      description,
      is_active
    } = req.body;

    // Check if profile exists
    const existing = await query(
      'SELECT profile_id, is_default FROM output_profile WHERE profile_id = ?',
      [profileId]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Output profile not found.' });
    }

    // Build dynamic update query
    const updates = [];
    const params = [];

    if (profile_name !== undefined) { updates.push('profile_name = ?'); params.push(profile_name); }
    if (output_format !== undefined) { updates.push('output_format = ?'); params.push(output_format); }
    if (csv_delimiter !== undefined) { updates.push('csv_delimiter = ?'); params.push(csv_delimiter); }
    if (csv_quote_char !== undefined) { updates.push('csv_quote_char = ?'); params.push(csv_quote_char); }
    if (include_header !== undefined) { updates.push('include_header = ?'); params.push(include_header ? 1 : 0); }
    if (date_format !== undefined) { updates.push('date_format = ?'); params.push(date_format); }
    if (number_format !== undefined) { updates.push('number_format = ?'); params.push(number_format); }
    if (currency_symbol !== undefined) { updates.push('currency_symbol = ?'); params.push(currency_symbol); }
    if (null_value !== undefined) { updates.push('null_value = ?'); params.push(null_value); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    params.push(profileId);
    await query(`UPDATE output_profile SET ${updates.join(', ')} WHERE profile_id = ?`, params);

    res.json({ success: true, message: 'Output profile updated successfully' });
  } catch (error) {
    console.error('Update output profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating output profile.',
      error: error.message
    });
  }
});

// Delete output profile
router.delete('/:profileId', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { profileId } = req.params;

    // Check if profile exists and is not a default profile
    const existing = await query(
      'SELECT profile_id, is_default, profile_name FROM output_profile WHERE profile_id = ?',
      [profileId]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Output profile not found.' });
    }

    if (existing[0].is_default) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete a default profile. Deactivate it instead.'
      });
    }

    await query('DELETE FROM output_profile WHERE profile_id = ?', [profileId]);

    res.json({ success: true, message: 'Output profile deleted successfully' });
  } catch (error) {
    console.error('Delete output profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting output profile.',
      error: error.message
    });
  }
});

// ==================== PROFILE FIELDS ====================

// Update profile fields (bulk update)
router.put('/:profileId/fields', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { profileId } = req.params;
    const { fields } = req.body; // Array of field configurations

    if (!Array.isArray(fields)) {
      return res.status(400).json({ success: false, message: 'Fields must be an array.' });
    }

    // Check if profile exists
    const existing = await query(
      'SELECT profile_id FROM output_profile WHERE profile_id = ?',
      [profileId]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Output profile not found.' });
    }

    // Use transaction for bulk update
    await transaction(async (conn) => {
      // Delete existing fields
      await conn.query('DELETE FROM output_profile_field WHERE profile_id = ?', [profileId]);

      // Insert new fields
      for (const field of fields) {
        await conn.query(`
          INSERT INTO output_profile_field (
            profile_id, field_id, custom_label, field_order,
            is_included, is_required, default_value,
            transform_type, transform_config, validation_rule
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          profileId,
          field.field_id,
          field.custom_label || null,
          field.field_order || 0,
          field.is_included !== false ? 1 : 0,
          field.is_required ? 1 : 0,
          field.default_value || null,
          field.transform_type || 'none',
          field.transform_config ? JSON.stringify(field.transform_config) : null,
          field.validation_rule ? JSON.stringify(field.validation_rule) : null
        ]);
      }
    });

    res.json({ success: true, message: 'Profile fields updated successfully' });
  } catch (error) {
    console.error('Update profile fields error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile fields.',
      error: error.message
    });
  }
});

// Add single field to profile
router.post('/:profileId/fields', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { profileId } = req.params;
    const {
      field_id,
      custom_label,
      field_order,
      is_included = true,
      is_required = false,
      default_value,
      transform_type = 'none',
      transform_config,
      validation_rule
    } = req.body;

    if (!field_id) {
      return res.status(400).json({ success: false, message: 'Field ID is required.' });
    }

    // Check if profile exists
    const profileExists = await query(
      'SELECT profile_id FROM output_profile WHERE profile_id = ?',
      [profileId]
    );
    if (profileExists.length === 0) {
      return res.status(404).json({ success: false, message: 'Output profile not found.' });
    }

    // Check if field exists
    const fieldExists = await query(
      'SELECT field_id FROM field_table WHERE field_id = ?',
      [field_id]
    );
    if (fieldExists.length === 0) {
      return res.status(400).json({ success: false, message: 'Field not found.' });
    }

    // Check for duplicate
    const existingField = await query(
      'SELECT id FROM output_profile_field WHERE profile_id = ? AND field_id = ?',
      [profileId, field_id]
    );
    if (existingField.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'This field is already in the profile.'
      });
    }

    // Get max field_order
    const maxOrder = await query(
      'SELECT MAX(field_order) as max_order FROM output_profile_field WHERE profile_id = ?',
      [profileId]
    );
    const newOrder = field_order !== undefined ? field_order : (maxOrder[0]?.max_order || 0) + 1;

    const result = await query(`
      INSERT INTO output_profile_field (
        profile_id, field_id, custom_label, field_order,
        is_included, is_required, default_value,
        transform_type, transform_config, validation_rule
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      profileId,
      field_id,
      custom_label || null,
      newOrder,
      is_included ? 1 : 0,
      is_required ? 1 : 0,
      default_value || null,
      transform_type,
      transform_config ? JSON.stringify(transform_config) : null,
      validation_rule ? JSON.stringify(validation_rule) : null
    ]);

    res.status(201).json({
      success: true,
      message: 'Field added to profile successfully',
      id: result.insertId
    });
  } catch (error) {
    console.error('Add profile field error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding field to profile.',
      error: error.message
    });
  }
});

// Update single field in profile
router.put('/:profileId/fields/:fieldId', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { profileId, fieldId } = req.params;
    const {
      custom_label,
      field_order,
      is_included,
      is_required,
      default_value,
      transform_type,
      transform_config,
      validation_rule
    } = req.body;

    // Check if profile field exists
    const existing = await query(
      'SELECT id FROM output_profile_field WHERE profile_id = ? AND field_id = ?',
      [profileId, fieldId]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Profile field not found.' });
    }

    // Build dynamic update
    const updates = [];
    const params = [];

    if (custom_label !== undefined) { updates.push('custom_label = ?'); params.push(custom_label); }
    if (field_order !== undefined) { updates.push('field_order = ?'); params.push(field_order); }
    if (is_included !== undefined) { updates.push('is_included = ?'); params.push(is_included ? 1 : 0); }
    if (is_required !== undefined) { updates.push('is_required = ?'); params.push(is_required ? 1 : 0); }
    if (default_value !== undefined) { updates.push('default_value = ?'); params.push(default_value); }
    if (transform_type !== undefined) { updates.push('transform_type = ?'); params.push(transform_type); }
    if (transform_config !== undefined) {
      updates.push('transform_config = ?');
      params.push(transform_config ? JSON.stringify(transform_config) : null);
    }
    if (validation_rule !== undefined) {
      updates.push('validation_rule = ?');
      params.push(validation_rule ? JSON.stringify(validation_rule) : null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    params.push(profileId, fieldId);
    await query(
      `UPDATE output_profile_field SET ${updates.join(', ')} WHERE profile_id = ? AND field_id = ?`,
      params
    );

    res.json({ success: true, message: 'Profile field updated successfully' });
  } catch (error) {
    console.error('Update profile field error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile field.',
      error: error.message
    });
  }
});

// Remove field from profile
router.delete('/:profileId/fields/:fieldId', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { profileId, fieldId } = req.params;

    const result = await query(
      'DELETE FROM output_profile_field WHERE profile_id = ? AND field_id = ?',
      [profileId, fieldId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Profile field not found.' });
    }

    res.json({ success: true, message: 'Field removed from profile successfully' });
  } catch (error) {
    console.error('Remove profile field error:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing field from profile.',
      error: error.message
    });
  }
});

// ==================== COPY PROFILE ====================

// Copy default profile to client
router.post('/copy', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { source_profile_id, target_client_id, profile_name } = req.body;

    if (!source_profile_id || !target_client_id) {
      return res.status(400).json({
        success: false,
        message: 'Source profile ID and target client ID are required.'
      });
    }

    // Get source profile
    const sourceProfile = await query(
      'SELECT * FROM output_profile WHERE profile_id = ?',
      [source_profile_id]
    );
    if (sourceProfile.length === 0) {
      return res.status(404).json({ success: false, message: 'Source profile not found.' });
    }

    // Check if client exists
    const clientExists = await query(
      'SELECT client_id FROM client WHERE client_id = ?',
      [target_client_id]
    );
    if (clientExists.length === 0) {
      return res.status(400).json({ success: false, message: 'Target client not found.' });
    }

    // Check if client profile already exists for this category
    const existingClientProfile = await query(
      'SELECT profile_id FROM output_profile WHERE client_id = ? AND doc_category_id = ?',
      [target_client_id, sourceProfile[0].doc_category_id]
    );
    if (existingClientProfile.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Client already has a profile for this category.'
      });
    }

    let newProfileId;

    await transaction(async (conn) => {
      // Create new profile
      const profileResult = await conn.query(`
        INSERT INTO output_profile (
          profile_name, client_id, doc_category_id, is_default,
          output_format, csv_delimiter, csv_quote_char, include_header,
          date_format, number_format, currency_symbol, null_value,
          description, is_active, created_by
        )
        SELECT
          ?, ?, doc_category_id, FALSE,
          output_format, csv_delimiter, csv_quote_char, include_header,
          date_format, number_format, currency_symbol, null_value,
          CONCAT('Customized from: ', profile_name), TRUE, ?
        FROM output_profile
        WHERE profile_id = ?
      `, [
        profile_name || `${sourceProfile[0].profile_name} - Custom`,
        target_client_id,
        req.user.userId,
        source_profile_id
      ]);

      newProfileId = profileResult.insertId;

      // Copy all fields
      await conn.query(`
        INSERT INTO output_profile_field (
          profile_id, field_id, custom_label, field_order,
          is_included, is_required, default_value,
          transform_type, transform_config, validation_rule
        )
        SELECT
          ?, field_id, custom_label, field_order,
          is_included, is_required, default_value,
          transform_type, transform_config, validation_rule
        FROM output_profile_field
        WHERE profile_id = ?
      `, [newProfileId, source_profile_id]);
    });

    res.status(201).json({
      success: true,
      message: 'Profile copied to client successfully',
      profile_id: newProfileId
    });
  } catch (error) {
    console.error('Copy profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error copying profile.',
      error: error.message
    });
  }
});

// ==================== DEFAULT PROFILES ====================

// Get all default profiles
router.get('/defaults/all', verifyToken, async (req, res) => {
  try {
    const profiles = await query(`
      SELECT op.*,
             dc.category_name, dc.category_display_name,
             (SELECT COUNT(*) FROM output_profile_field WHERE profile_id = op.profile_id) as field_count
      FROM output_profile op
      LEFT JOIN doc_category dc ON op.doc_category_id = dc.category_id
      WHERE op.is_default = TRUE AND op.is_active = TRUE
      ORDER BY dc.category_name
    `);

    res.json({
      success: true,
      data: profiles
    });
  } catch (error) {
    console.error('Get default profiles error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching default profiles.',
      error: error.message
    });
  }
});

// Get available fields for a category (fields not yet in profile)
router.get('/:profileId/available-fields', verifyToken, async (req, res) => {
  try {
    const { profileId } = req.params;

    // Get profile's category
    const profile = await query(
      'SELECT doc_category_id FROM output_profile WHERE profile_id = ?',
      [profileId]
    );
    if (profile.length === 0) {
      return res.status(404).json({ success: false, message: 'Profile not found.' });
    }

    // Get fields for this category that are not in the profile
    const availableFields = await query(`
      SELECT ft.*
      FROM field_table ft
      WHERE ft.doc_category = ?
        AND ft.field_id NOT IN (
          SELECT field_id FROM output_profile_field WHERE profile_id = ?
        )
      ORDER BY ft.field_display_name
    `, [profile[0].doc_category_id, profileId]);

    res.json({
      success: true,
      data: availableFields
    });
  } catch (error) {
    console.error('Get available fields error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching available fields.',
      error: error.message
    });
  }
});

module.exports = router;
