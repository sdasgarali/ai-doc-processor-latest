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

    // Fetch all clients and documents separately
    let clients = await query('SELECT * FROM client');
    let documents = await query('SELECT * FROM document_processed');

    // Apply role-based access control on clients
    if (req.user.user_role === 'client') {
      clients = clients.filter(c => c.client_id === req.user.client_id);
    } else if (client_id) {
      clients = clients.filter(c => c.client_id === parseInt(client_id));
    }

    // Apply search filter on clients
    if (search) {
      const searchLower = search.toLowerCase();
      clients = clients.filter(c =>
        (c.client_name && c.client_name.toLowerCase().includes(searchLower)) ||
        (c.contact_name && c.contact_name.toLowerCase().includes(searchLower)) ||
        (c.email && c.email.toLowerCase().includes(searchLower))
      );
    }

    // Apply filters on documents
    if (from_date) {
      const fromDateObj = new Date(from_date);
      documents = documents.filter(d => d.time_initiated && new Date(d.time_initiated) >= fromDateObj);
    }

    if (to_date) {
      const toDateObj = new Date(to_date);
      toDateObj.setDate(toDateObj.getDate() + 1); // Add 1 day for inclusive range
      documents = documents.filter(d => d.time_initiated && new Date(d.time_initiated) <= toDateObj);
    }

    if (doc_category) {
      documents = documents.filter(d => d.doc_category === parseInt(doc_category));
    }

    // Group documents by client_id
    const docsByClient = {};
    documents.forEach(d => {
      if (!docsByClient[d.client_id]) {
        docsByClient[d.client_id] = [];
      }
      docsByClient[d.client_id].push(d);
    });

    // Build results
    const results = clients.map(c => {
      const clientDocs = docsByClient[c.client_id] || [];
      return {
        client_id: c.client_id,
        client_name: c.client_name,
        contact_name: c.contact_name,
        email: c.email,
        phone_no: c.phone_no,
        total_documents: clientDocs.length,
        total_pages: clientDocs.reduce((sum, d) => sum + (d.no_of_pages || 0), 0),
        total_records: clientDocs.reduce((sum, d) => sum + (d.total_records || 0), 0),
        total_cost: clientDocs.reduce((sum, d) => sum + (parseFloat(d.cost) || 0), 0),
        first_upload: clientDocs.length > 0 ? clientDocs.reduce((min, d) => d.time_initiated && (!min || new Date(d.time_initiated) < new Date(min)) ? d.time_initiated : min, null) : null,
        last_upload: clientDocs.length > 0 ? clientDocs.reduce((max, d) => d.time_initiated && (!max || new Date(d.time_initiated) > new Date(max)) ? d.time_initiated : max, null) : null,
        successful_docs: clientDocs.filter(d => d.processing_status === 'Processed').length,
        failed_docs: clientDocs.filter(d => d.processing_status === 'Failed').length
      };
    });

    // Sort by total_cost DESC
    results.sort((a, b) => (b.total_cost || 0) - (a.total_cost || 0));

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

    // Fetch all clients and documents separately (same logic as /client-usage)
    let clients = await query('SELECT * FROM client');
    let documents = await query('SELECT * FROM document_processed');

    // Apply role-based access control on clients
    if (req.user.user_role === 'client') {
      clients = clients.filter(c => c.client_id === req.user.client_id);
    } else if (client_id) {
      clients = clients.filter(c => c.client_id === parseInt(client_id));
    }

    // Apply search filter on clients
    if (search) {
      const searchLower = search.toLowerCase();
      clients = clients.filter(c =>
        (c.client_name && c.client_name.toLowerCase().includes(searchLower)) ||
        (c.contact_name && c.contact_name.toLowerCase().includes(searchLower)) ||
        (c.email && c.email.toLowerCase().includes(searchLower))
      );
    }

    // Apply filters on documents
    if (from_date) {
      const fromDateObj = new Date(from_date);
      documents = documents.filter(d => d.time_initiated && new Date(d.time_initiated) >= fromDateObj);
    }

    if (to_date) {
      const toDateObj = new Date(to_date);
      toDateObj.setDate(toDateObj.getDate() + 1);
      documents = documents.filter(d => d.time_initiated && new Date(d.time_initiated) <= toDateObj);
    }

    if (doc_category) {
      documents = documents.filter(d => d.doc_category === parseInt(doc_category));
    }

    // Group documents by client_id
    const docsByClient = {};
    documents.forEach(d => {
      if (!docsByClient[d.client_id]) {
        docsByClient[d.client_id] = [];
      }
      docsByClient[d.client_id].push(d);
    });

    // Build results
    const results = clients.map(c => {
      const clientDocs = docsByClient[c.client_id] || [];
      return {
        client_id: c.client_id,
        client_name: c.client_name,
        contact_name: c.contact_name,
        email: c.email,
        phone_no: c.phone_no,
        total_documents: clientDocs.length,
        total_pages: clientDocs.reduce((sum, d) => sum + (d.no_of_pages || 0), 0),
        total_records: clientDocs.reduce((sum, d) => sum + (d.total_records || 0), 0),
        total_cost: clientDocs.reduce((sum, d) => sum + (parseFloat(d.cost) || 0), 0),
        first_upload: clientDocs.length > 0 ? clientDocs.reduce((min, d) => d.time_initiated && (!min || new Date(d.time_initiated) < new Date(min)) ? d.time_initiated : min, null) : null,
        last_upload: clientDocs.length > 0 ? clientDocs.reduce((max, d) => d.time_initiated && (!max || new Date(d.time_initiated) > new Date(max)) ? d.time_initiated : max, null) : null,
        successful_docs: clientDocs.filter(d => d.processing_status === 'Processed').length,
        failed_docs: clientDocs.filter(d => d.processing_status === 'Failed').length
      };
    });

    // Sort by total_cost DESC
    results.sort((a, b) => (b.total_cost || 0) - (a.total_cost || 0));

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
