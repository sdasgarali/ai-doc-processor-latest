const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const ExcelJS = require('exceljs');

// Get available field definitions for a module (with permission checking)
router.get('/fields/:module', verifyToken, async (req, res) => {
  try {
    const { module } = req.params;
    
    // Get all field definitions for the module
    const fields = await query(
      `SELECT * FROM report_field_definitions 
       WHERE module = ? 
       ORDER BY display_order`,
      [module]
    );

    // Get user's permissions
    const userPermissions = await query(
      `SELECT p.permission_name
       FROM permissions p
       LEFT JOIN role_permissions rp ON p.permission_id = rp.permission_id
       LEFT JOIN user_specific_permissions usp ON p.permission_id = usp.permission_id AND usp.userid = ?
       WHERE (rp.user_role = ? OR usp.userid = ?)
       AND (usp.permission_type IS NULL OR usp.permission_type = 'allow')`,
      [req.user.userid, req.user.user_role, req.user.userid]
    );

    const userPermissionNames = new Set(userPermissions.map(p => p.permission_name));
    
    // SuperAdmin has all permissions
    const hasAllPermissions = req.user.user_role === 'superadmin';

    // Filter fields based on permissions
    const accessibleFields = fields.filter(field => {
      if (!field.required_permission) return true;
      if (hasAllPermissions) return true;
      return userPermissionNames.has(field.required_permission);
    });

    res.json({
      success: true,
      data: accessibleFields
    });
  } catch (error) {
    console.error('Get field definitions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching field definitions'
    });
  }
});

// Get all saved reports (user's private + public reports)
router.get('/', verifyToken, async (req, res) => {
  try {
    const reports = await query(
      `SELECT 
        cr.*,
        u.email as creator_email,
        u.first_name as creator_first_name,
        u.last_name as creator_last_name
       FROM custom_reports cr
       LEFT JOIN user_profile u ON cr.created_by = u.userid
       WHERE cr.is_public = TRUE OR cr.created_by = ?
       ORDER BY cr.updated_at DESC`,
      [req.user.userid]
    );

    res.json({
      success: true,
      data: reports
    });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching reports'
    });
  }
});

// Get a specific report
router.get('/:reportId', verifyToken, async (req, res) => {
  try {
    const { reportId } = req.params;
    
    const reports = await query(
      `SELECT cr.* FROM custom_reports cr
       WHERE cr.report_id = ? 
       AND (cr.is_public = TRUE OR cr.created_by = ?)`,
      [reportId, req.user.userid]
    );

    if (reports.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Report not found or access denied'
      });
    }

    res.json({
      success: true,
      data: reports[0]
    });
  } catch (error) {
    console.error('Get report error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching report'
    });
  }
});

// Create a new custom report
router.post('/', verifyToken, async (req, res) => {
  try {
    const {
      report_name,
      description,
      is_public,
      module,
      selected_fields,
      filters,
      sort_order
    } = req.body;

    if (!report_name || !module || !selected_fields || selected_fields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Report name, module, and at least one field are required'
      });
    }

    const result = await query(
      `INSERT INTO custom_reports 
       (report_name, description, created_by, is_public, module, selected_fields, filters, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        report_name,
        description || null,
        req.user.userid,
        is_public || false,
        module,
        JSON.stringify(selected_fields),
        filters ? JSON.stringify(filters) : null,
        sort_order ? JSON.stringify(sort_order) : null
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Report created successfully',
      report_id: result.insertId
    });
  } catch (error) {
    console.error('Create report error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating report'
    });
  }
});

// Update an existing report
router.put('/:reportId', verifyToken, async (req, res) => {
  try {
    const { reportId } = req.params;
    const {
      report_name,
      description,
      is_public,
      selected_fields,
      filters,
      sort_order
    } = req.body;

    // Check ownership
    const reports = await query(
      'SELECT created_by FROM custom_reports WHERE report_id = ?',
      [reportId]
    );

    if (reports.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    if (reports[0].created_by !== req.user.userid) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own reports'
      });
    }

    await query(
      `UPDATE custom_reports 
       SET report_name = ?, description = ?, is_public = ?, 
           selected_fields = ?, filters = ?, sort_order = ?
       WHERE report_id = ?`,
      [
        report_name,
        description || null,
        is_public || false,
        JSON.stringify(selected_fields),
        filters ? JSON.stringify(filters) : null,
        sort_order ? JSON.stringify(sort_order) : null,
        reportId
      ]
    );

    res.json({
      success: true,
      message: 'Report updated successfully'
    });
  } catch (error) {
    console.error('Update report error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating report'
    });
  }
});

// Delete a report
router.delete('/:reportId', verifyToken, async (req, res) => {
  try {
    const { reportId } = req.params;

    const reports = await query(
      'SELECT created_by FROM custom_reports WHERE report_id = ?',
      [reportId]
    );

    if (reports.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    if (reports[0].created_by !== req.user.userid) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own reports'
      });
    }

    await query('DELETE FROM custom_reports WHERE report_id = ?', [reportId]);

    res.json({
      success: true,
      message: 'Report deleted successfully'
    });
  } catch (error) {
    console.error('Delete report error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting report'
    });
  }
});

// Execute a custom report (generate data)
router.post('/:reportId/execute', verifyToken, async (req, res) => {
  try {
    const { reportId } = req.params;
    const { additionalFilters } = req.body;

    // Get report configuration
    const reports = await query(
      `SELECT * FROM custom_reports 
       WHERE report_id = ? 
       AND (is_public = TRUE OR created_by = ?)`,
      [reportId, req.user.userid]
    );

    if (reports.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Report not found or access denied'
      });
    }

    const report = reports[0];
    // MySQL2 automatically parses JSON columns, so check if it's already an array
    const selectedFields = Array.isArray(report.selected_fields) 
      ? report.selected_fields 
      : JSON.parse(report.selected_fields);
    
    // Get field definitions - properly handle IN clause with array
    const placeholders = selectedFields.map(() => '?').join(',');
    const fieldDefs = await query(
      `SELECT * FROM report_field_definitions 
       WHERE module = ? AND field_name IN (${placeholders})`,
      [report.module, ...selectedFields]
    );

    // Build dynamic SQL query
    let sql = 'SELECT ';
    const selectClauses = [];
    const tables = new Set();

    fieldDefs.forEach(field => {
      selectClauses.push(`${field.table_name}.${field.column_name} as ${field.field_name}`);
      tables.add(field.table_name);
    });

    sql += selectClauses.join(', ');

    // Determine primary table
    let primaryTable = '';
    if (report.module === 'documents') {
      primaryTable = 'document_processed';
      sql += ` FROM document_processed`;
      if (tables.has('client')) sql += ` LEFT JOIN client ON document_processed.client_id = client.client_id`;
      if (tables.has('user_profile')) sql += ` LEFT JOIN user_profile ON document_processed.userid = user_profile.userid`;
      if (tables.has('doc_category')) sql += ` LEFT JOIN doc_category ON document_processed.doc_category = doc_category.category_id`;
      if (tables.has('model_config')) sql += ` LEFT JOIN model_config ON document_processed.model_id = model_config.model_id`;
    } else if (report.module === 'clients') {
      primaryTable = 'client';
      sql += ` FROM client`;
    } else if (report.module === 'users') {
      primaryTable = 'user_profile';
      sql += ` FROM user_profile`;
    }

    // Apply role-based filtering
    sql += ' WHERE 1=1';
    const params = [];

    if (req.user.user_role === 'client' && report.module === 'documents') {
      sql += ' AND document_processed.client_id = ?';
      params.push(req.user.client_id);
    }

    // Execute query
    const results = await query(sql, params);

    res.json({
      success: true,
      data: results,
      report_name: report.report_name,
      fields: fieldDefs
    });
  } catch (error) {
    console.error('Execute report error:', error);
    res.status(500).json({
      success: false,
      message: 'Error executing report: ' + error.message
    });
  }
});

// Export custom report to Excel
router.post('/:reportId/export', verifyToken, async (req, res) => {
  try {
    const { reportId } = req.params;

    // Execute report first
    const reports = await query(
      `SELECT * FROM custom_reports 
       WHERE report_id = ? 
       AND (is_public = TRUE OR created_by = ?)`,
      [reportId, req.user.userid]
    );

    if (reports.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    const report = reports[0];
    // MySQL2 automatically parses JSON columns, so check if it's already an array
    const selectedFields = Array.isArray(report.selected_fields) 
      ? report.selected_fields 
      : JSON.parse(report.selected_fields);
    
    // Get field definitions - properly handle IN clause with array
    const placeholders = selectedFields.map(() => '?').join(',');
    const fieldDefs = await query(
      `SELECT * FROM report_field_definitions 
       WHERE module = ? AND field_name IN (${placeholders})`,
      [report.module, ...selectedFields]
    );

    // Build and execute query (same logic as execute endpoint)
    let sql = 'SELECT ';
    const selectClauses = [];
    const tables = new Set();

    fieldDefs.forEach(field => {
      selectClauses.push(`${field.table_name}.${field.column_name} as ${field.field_name}`);
      tables.add(field.table_name);
    });

    sql += selectClauses.join(', ');

    if (report.module === 'documents') {
      sql += ` FROM document_processed`;
      if (tables.has('client')) sql += ` LEFT JOIN client ON document_processed.client_id = client.client_id`;
      if (tables.has('user_profile')) sql += ` LEFT JOIN user_profile ON document_processed.userid = user_profile.userid`;
      if (tables.has('doc_category')) sql += ` LEFT JOIN doc_category ON document_processed.doc_category = doc_category.category_id`;
      if (tables.has('model_config')) sql += ` LEFT JOIN model_config ON document_processed.model_id = model_config.model_id`;
    } else if (report.module === 'clients') {
      sql += ` FROM client`;
    } else if (report.module === 'users') {
      sql += ` FROM user_profile`;
    }

    sql += ' WHERE 1=1';
    const params = [];

    if (req.user.user_role === 'client' && report.module === 'documents') {
      sql += ' AND document_processed.client_id = ?';
      params.push(req.user.client_id);
    }

    const results = await query(sql, params);

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(report.report_name);

    // Set columns
    worksheet.columns = fieldDefs.map(field => ({
      header: field.display_name,
      key: field.field_name,
      width: 20
    }));

    // Style header
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1976D2' }
    };
    worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

    // Add data
    results.forEach(row => {
      worksheet.addRow(row);
    });

    // Send file
    const fileName = `${report.report_name.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Export report error:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting report'
    });
  }
});

module.exports = router;
