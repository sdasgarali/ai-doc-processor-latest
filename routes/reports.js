const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verifyToken, checkRole } = require('../middleware/auth');
const ExcelJS = require('exceljs');

// Get Client-wise Usage Report
router.get('/client-usage', verifyToken, async (req, res) => {
  try {
    const {
      client_id,
      doc_category,
      from_date,
      to_date,
      search
    } = req.query;

    let sql = `
      SELECT 
        c.client_id,
        c.client_name,
        c.contact_name,
        c.email,
        c.phone_no,
        COUNT(dp.process_id) as total_documents,
        SUM(dp.no_of_pages) as total_pages,
        SUM(dp.total_records) as total_records,
        SUM(dp.cost) as total_cost,
        MIN(dp.time_initiated) as first_upload,
        MAX(dp.time_initiated) as last_upload,
        COUNT(CASE WHEN dp.processing_status = 'Processed' THEN 1 END) as successful_docs,
        COUNT(CASE WHEN dp.processing_status = 'Failed' THEN 1 END) as failed_docs
      FROM client c
      LEFT JOIN document_processed dp ON c.client_id = dp.client_id
      WHERE 1=1
    `;

    const params = [];

    // Apply role-based access control
    if (req.user.user_role === 'client') {
      sql += ' AND c.client_id = ?';
      params.push(req.user.client_id);
    } else if (client_id) {
      sql += ' AND c.client_id = ?';
      params.push(client_id);
    }

    // Date range filter
    if (from_date) {
      sql += ' AND dp.time_initiated >= ?';
      params.push(from_date);
    }

    if (to_date) {
      sql += ' AND dp.time_initiated <= DATE_ADD(?, INTERVAL 1 DAY)';
      params.push(to_date);
    }

    // Doc category filter
    if (doc_category) {
      sql += ' AND dp.doc_category = ?';
      params.push(doc_category);
    }

    // Search filter
    if (search) {
      sql += ' AND (c.client_name LIKE ? OR c.contact_name LIKE ? OR c.email LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    sql += ' GROUP BY c.client_id ORDER BY total_cost DESC';

    const results = await query(sql, params);

    // Calculate totals
    const totals = {
      total_clients: results.length,
      total_documents: results.reduce((sum, row) => sum + (row.total_documents || 0), 0),
      total_pages: results.reduce((sum, row) => sum + (row.total_pages || 0), 0),
      total_records: results.reduce((sum, row) => sum + (row.total_records || 0), 0),
      total_cost: results.reduce((sum, row) => sum + (parseFloat(row.total_cost) || 0), 0)
    };

    res.json({
      success: true,
      data: results,
      totals: totals
    });
  } catch (error) {
    console.error('Client usage report error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating client usage report'
    });
  }
});

// Export Client-wise Usage Report to Excel
router.get('/client-usage/export', verifyToken, async (req, res) => {
  try {
    const {
      client_id,
      doc_category,
      from_date,
      to_date,
      search
    } = req.query;

    // Get report data (reuse same logic)
    let sql = `
      SELECT 
        c.client_id,
        c.client_name,
        c.contact_name,
        c.email,
        c.phone_no,
        COUNT(dp.process_id) as total_documents,
        SUM(dp.no_of_pages) as total_pages,
        SUM(dp.total_records) as total_records,
        SUM(dp.cost) as total_cost,
        MIN(dp.time_initiated) as first_upload,
        MAX(dp.time_initiated) as last_upload,
        COUNT(CASE WHEN dp.processing_status = 'Processed' THEN 1 END) as successful_docs,
        COUNT(CASE WHEN dp.processing_status = 'Failed' THEN 1 END) as failed_docs
      FROM client c
      LEFT JOIN document_processed dp ON c.client_id = dp.client_id
      WHERE 1=1
    `;

    const params = [];

    if (req.user.user_role === 'client') {
      sql += ' AND c.client_id = ?';
      params.push(req.user.client_id);
    } else if (client_id) {
      sql += ' AND c.client_id = ?';
      params.push(client_id);
    }

    if (from_date) {
      sql += ' AND dp.time_initiated >= ?';
      params.push(from_date);
    }

    if (to_date) {
      sql += ' AND dp.time_initiated <= DATE_ADD(?, INTERVAL 1 DAY)';
      params.push(to_date);
    }

    if (doc_category) {
      sql += ' AND dp.doc_category = ?';
      params.push(doc_category);
    }

    if (search) {
      sql += ' AND (c.client_name LIKE ? OR c.contact_name LIKE ? OR c.email LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    sql += ' GROUP BY c.client_id ORDER BY total_cost DESC';

    const results = await query(sql, params);

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Client Usage Report');

    // Set column headers
    worksheet.columns = [
      { header: 'Client ID', key: 'client_id', width: 12 },
      { header: 'Client Name', key: 'client_name', width: 30 },
      { header: 'Contact Name', key: 'contact_name', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Phone', key: 'phone_no', width: 15 },
      { header: 'Total Documents', key: 'total_documents', width: 18 },
      { header: 'Total Pages', key: 'total_pages', width: 15 },
      { header: 'Total Records', key: 'total_records', width: 15 },
      { header: 'Total Cost ($)', key: 'total_cost', width: 15 },
      { header: 'Successful Docs', key: 'successful_docs', width: 18 },
      { header: 'Failed Docs', key: 'failed_docs', width: 15 },
      { header: 'First Upload', key: 'first_upload', width: 20 },
      { header: 'Last Upload', key: 'last_upload', width: 20 }
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1976D2' }
    };
    worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

    // Add data rows
    results.forEach(row => {
      worksheet.addRow({
        client_id: row.client_id,
        client_name: row.client_name,
        contact_name: row.contact_name,
        email: row.email,
        phone_no: row.phone_no,
        total_documents: row.total_documents || 0,
        total_pages: row.total_pages || 0,
        total_records: row.total_records || 0,
        total_cost: parseFloat(row.total_cost || 0).toFixed(4),
        successful_docs: row.successful_docs || 0,
        failed_docs: row.failed_docs || 0,
        first_upload: row.first_upload ? new Date(row.first_upload).toLocaleString() : 'N/A',
        last_upload: row.last_upload ? new Date(row.last_upload).toLocaleString() : 'N/A'
      });
    });

    // Add totals row
    const totalsRow = worksheet.addRow({
      client_id: '',
      client_name: 'TOTAL',
      contact_name: '',
      email: '',
      phone_no: '',
      total_documents: results.reduce((sum, row) => sum + (row.total_documents || 0), 0),
      total_pages: results.reduce((sum, row) => sum + (row.total_pages || 0), 0),
      total_records: results.reduce((sum, row) => sum + (row.total_records || 0), 0),
      total_cost: results.reduce((sum, row) => sum + (parseFloat(row.total_cost) || 0), 0).toFixed(4),
      successful_docs: results.reduce((sum, row) => sum + (row.successful_docs || 0), 0),
      failed_docs: results.reduce((sum, row) => sum + (row.failed_docs || 0), 0),
      first_upload: '',
      last_upload: ''
    });

    totalsRow.font = { bold: true };
    totalsRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE3F2FD' }
    };

    // Set response headers
    const fileName = `Client_Usage_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Export client usage report error:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting report'
    });
  }
});

// Get document processing summary (for dashboard charts)
router.get('/processing-summary', verifyToken, async (req, res) => {
  try {
    const { from_date, to_date } = req.query;

    let sql = `
      SELECT 
        DATE(time_initiated) as date,
        COUNT(*) as total_docs,
        SUM(no_of_pages) as total_pages,
        SUM(cost) as total_cost,
        COUNT(CASE WHEN processing_status = 'Processed' THEN 1 END) as successful,
        COUNT(CASE WHEN processing_status = 'Failed' THEN 1 END) as failed
      FROM document_processed
      WHERE 1=1
    `;

    const params = [];

    if (req.user.user_role === 'client') {
      sql += ' AND client_id = ?';
      params.push(req.user.client_id);
    }

    if (from_date) {
      sql += ' AND time_initiated >= ?';
      params.push(from_date);
    }

    if (to_date) {
      sql += ' AND time_initiated <= DATE_ADD(?, INTERVAL 1 DAY)';
      params.push(to_date);
    }

    sql += ' GROUP BY DATE(time_initiated) ORDER BY date DESC';

    const results = await query(sql, params);

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Processing summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating processing summary'
    });
  }
});

module.exports = router;
