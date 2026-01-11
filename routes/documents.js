const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const db = require('../config/database');
const { query, transaction } = db;
const { verifyToken, checkRole } = require('../middleware/auth');
const moment = require('moment-timezone');
const axios = require('axios');

// Configure multer for file uploads
// Use /tmp for serverless environments (Vercel), fallback to ./uploads for local dev
const getUploadDir = () => {
  if (process.env.UPLOAD_DIR) return process.env.UPLOAD_DIR;
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') return '/tmp/uploads';
  return './uploads';
};

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = getUploadDir();
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    // Use original filename temporarily - will be renamed with process_id after DB insert
    cb(null, file.originalname);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 50000000 // 50MB default
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// Upload document
router.post('/upload', verifyToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded.' 
      });
    }

    const { doc_category, model_id } = req.body;

    if (!doc_category) {
      // Clean up uploaded file
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ 
        success: false, 
        message: 'Document category is required.' 
      });
    }

    // Check if filename starts with "Processed_"
    if (req.file.originalname.startsWith('Processed_')) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ 
        success: false, 
        message: 'Already Processed - This file has been previously processed.' 
      });
    }

    // Generate session ID
    const sessionId = `${req.user.userid}_${moment().format('YYYYMMDD_HHmmss')}`;

    // Create document record
    const result = await query(
      `INSERT INTO document_processed 
       (doc_name, original_filename, processing_status, userid, client_id, model_id, session_id, doc_category, link_to_file) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.file.filename,
        req.file.originalname,
        'In-Progress',
        req.user.userid,
        req.user.client_id,
        model_id || null,
        sessionId,
        doc_category,
        req.file.path
      ]
    );

    const processId = result.insertId;

    // Rename file to include process_id
    const newFilename = `${processId}_${req.file.originalname}`;
    const uploadDir = getUploadDir();
    const newPath = path.join(uploadDir, newFilename);

    try {
      await fs.rename(req.file.path, newPath);

      // Update database with new filename
      await query(
        'UPDATE document_processed SET doc_name = ?, link_to_file = ? WHERE process_id = ?',
        [newFilename, newPath, processId]
      );

      console.log(`✓ Renamed file to: ${newFilename}`);
    } catch (renameError) {
      console.error('Error renaming file:', renameError);
      // Continue even if rename fails
    }

    // Get default model_id if not provided
    const selectedModelId = model_id || 2; // Default to GPT-4o-mini (model_id = 2)

    // Trigger document processing via Python processor webhook
    const processorUrl = process.env.PROCESSOR_WEBHOOK_URL;

    if (processorUrl) {
      // Call Python processor webhook synchronously
      try {
        console.log(`Triggering Python processor at: ${processorUrl}`);

        const processorResponse = await axios.post(
          `${processorUrl}/webhook/eob-process`,
          {
            processId: processId,
            filename: newFilename,
            originalFilename: req.file.originalname,
            localFilePath: newPath,
            userid: req.user.userid,
            clientId: req.user.client_id,
            sessionId: sessionId,
            modelId: selectedModelId,
            docCategory: parseInt(doc_category)
          },
          { timeout: 30000 } // 30 second timeout for processor acknowledgment
        );

        console.log(`✓ Triggered Python processor for process_id: ${processId}`);

        res.status(201).json({
          success: true,
          message: 'Document uploaded and processing started',
          process_id: processId,
          session_id: sessionId,
          processor_status: processorResponse.data?.status || 'Processing'
        });
      } catch (processorError) {
        console.error('Failed to trigger Python processor:', processorError.message);

        // Update status to Failed if processor trigger fails
        await query(
          'UPDATE document_processed SET processing_status = ?, error_message = ? WHERE process_id = ?',
          ['Failed', 'Failed to trigger processor: ' + processorError.message, processId]
        ).catch(err => console.error('Error updating status:', err));

        res.status(201).json({
          success: true,
          message: 'Document uploaded but processing failed to start',
          process_id: processId,
          session_id: sessionId,
          error: processorError.message
        });
      }
    } else {
      // No processor URL configured - document uploaded but needs manual processing
      console.log(`⚠️ No PROCESSOR_WEBHOOK_URL configured. Document uploaded but not processed.`);
      console.log(`DB config - isSupabase: ${db.isSupabase}, hasSupabase: ${!!db.supabase}`);

      // Update status to indicate processing is pending - use Supabase client directly
      let updateSuccess = false;
      let updateError = null;

      try {
        if (db.isSupabase && db.supabase) {
          console.log(`Attempting Supabase update for process_id: ${processId}`);
          const { data, error } = await db.supabase
            .from('document_processed')
            .update({
              processing_status: 'Pending',
              error_message: 'No processor configured. Set PROCESSOR_WEBHOOK_URL environment variable.'
            })
            .eq('process_id', processId)
            .select();

          if (error) {
            console.error('Supabase update error:', JSON.stringify(error));
            updateError = error.message || JSON.stringify(error);
          } else {
            console.log(`✓ Updated status to Pending for process_id: ${processId}, rows:`, data?.length || 0);
            updateSuccess = data?.length > 0;
          }
        } else {
          console.log(`Using SQL query for update, isSupabase: ${db.isSupabase}`);
          const updateResult = await query(
            'UPDATE document_processed SET processing_status = ?, error_message = ? WHERE process_id = ?',
            ['Pending', 'No processor configured. Set PROCESSOR_WEBHOOK_URL environment variable.', processId]
          );
          console.log(`✓ Updated status to Pending for process_id: ${processId}, result:`, updateResult);
          updateSuccess = true;
        }
      } catch (updateErr) {
        console.error('Error updating status to Pending:', updateErr.message || updateErr);
        updateError = updateErr.message || String(updateErr);
      }

      res.status(201).json({
        success: true,
        message: 'Document uploaded. Processing requires PROCESSOR_WEBHOOK_URL configuration.',
        process_id: processId,
        session_id: sessionId,
        warning: 'No processor configured',
        debug: { updateSuccess, updateError, isSupabase: db.isSupabase }
      });
    }
  } catch (error) {
    console.error('Upload error:', error);
    console.error('Error stack:', error.stack);
    // Clean up file if exists
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    res.status(500).json({
      success: false,
      message: 'Error uploading document.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get all documents (with filters)
router.get('/', verifyToken, async (req, res) => {
  try {
    const {
      status,
      client_id,
      doc_category,
      from_date,
      to_date,
      page = 1,
      limit = 20
    } = req.query;

    // Fetch all documents first
    let documents = await query('SELECT * FROM document_processed');

    // Apply filters in memory
    if (req.user.user_role === 'client' || req.user.user_role === 'user') {
      documents = documents.filter(d => d.client_id === req.user.client_id);
    } else if (client_id) {
      documents = documents.filter(d => d.client_id === parseInt(client_id));
    }

    if (status) {
      documents = documents.filter(d => d.processing_status === status);
    }

    if (doc_category) {
      documents = documents.filter(d => d.doc_category === parseInt(doc_category));
    }

    if (from_date) {
      const fromDateObj = new Date(from_date);
      documents = documents.filter(d => d.time_initiated && new Date(d.time_initiated) >= fromDateObj);
    }

    if (to_date) {
      const toDateObj = new Date(to_date);
      documents = documents.filter(d => d.time_initiated && new Date(d.time_initiated) <= toDateObj);
    }

    // Get total count before pagination
    const total = documents.length;

    // Sort by time_initiated DESC
    documents.sort((a, b) => new Date(b.time_initiated || 0) - new Date(a.time_initiated || 0));

    // Apply pagination
    let limitNum = Number(limit) || 20;
    let pageNum = Number(page) || 1;
    if (limitNum < 1) limitNum = 20;
    if (limitNum > 100) limitNum = 100;
    if (pageNum < 1) pageNum = 1;
    const offsetNum = (pageNum - 1) * limitNum;
    documents = documents.slice(offsetNum, offsetNum + limitNum);

    // Fetch related data for enrichment
    let users = [], clients = [], models = [], categories = [];
    try { users = await query('SELECT userid, email FROM user_profile'); } catch (e) { console.warn('Error fetching users:', e.message); }
    try { clients = await query('SELECT client_id, client_name, active_model FROM client'); } catch (e) { console.warn('Error fetching clients:', e.message); }
    try { models = await query('SELECT model_id, model_name FROM model_config'); } catch (e) { console.warn('Error fetching models:', e.message); }
    try { categories = await query('SELECT category_id, category_name FROM doc_category'); } catch (e) { console.warn('Error fetching categories:', e.message); }

    // Create lookup maps
    const userMap = {};
    users.forEach(u => { userMap[u.userid] = u.email; });
    const clientMap = {};
    clients.forEach(c => { clientMap[c.client_id] = { client_name: c.client_name, active_model: c.active_model }; });
    const modelMap = {};
    models.forEach(m => { modelMap[m.model_id] = m.model_name; });
    const categoryMap = {};
    categories.forEach(c => { categoryMap[c.category_id] = c.category_name; });

    // Enrich documents
    const enrichedDocs = documents.map(dp => {
      const client = clientMap[dp.client_id] || {};
      return {
        process_id: dp.process_id,
        doc_name: dp.doc_name,
        original_filename: dp.original_filename,
        no_of_pages: dp.no_of_pages,
        total_records: dp.total_records,
        processing_status: dp.processing_status,
        time_initiated: dp.time_initiated,
        time_finished: dp.time_finished,
        total_processing_time: dp.total_processing_time,
        cost: dp.cost,
        link_to_file: dp.link_to_file,
        link_to_csv: dp.link_to_csv,
        link_to_json: dp.link_to_json,
        session_id: dp.session_id,
        model_id: dp.model_id,
        user_email: userMap[dp.userid] || null,
        client_name: client.client_name || null,
        active_model: client.active_model || null,
        model_name: modelMap[dp.model_id] || null,
        category_name: categoryMap[dp.doc_category] || null,
        effective_model_id: dp.model_id || client.active_model || null
      };
    });

    res.json({
      success: true,
      data: enrichedDocs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching documents.'
    });
  }
});

// Get document by ID
router.get('/:processId', verifyToken, async (req, res) => {
  try {
    const { processId } = req.params;

    // Fetch document by process_id
    let documents = await query('SELECT * FROM document_processed WHERE process_id = ?', [processId]);

    if (documents.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document not found or access denied.'
      });
    }

    const dp = documents[0];

    // Apply access control
    if (req.user.user_role === 'client' || req.user.user_role === 'user') {
      if (dp.client_id !== req.user.client_id) {
        return res.status(404).json({
          success: false,
          message: 'Document not found or access denied.'
        });
      }
    }

    // Fetch related data for enrichment
    let userEmail = null, clientName = null, modelName = null, categoryName = null;

    try {
      if (dp.userid) {
        const users = await query('SELECT email FROM user_profile WHERE userid = ?', [dp.userid]);
        if (users.length > 0) userEmail = users[0].email;
      }
    } catch (e) { console.warn('Error fetching user:', e.message); }

    try {
      if (dp.client_id) {
        const clients = await query('SELECT client_name FROM client WHERE client_id = ?', [dp.client_id]);
        if (clients.length > 0) clientName = clients[0].client_name;
      }
    } catch (e) { console.warn('Error fetching client:', e.message); }

    try {
      if (dp.model_id) {
        const models = await query('SELECT model_name FROM model_config WHERE model_id = ?', [dp.model_id]);
        if (models.length > 0) modelName = models[0].model_name;
      }
    } catch (e) { console.warn('Error fetching model:', e.message); }

    try {
      if (dp.doc_category) {
        const categories = await query('SELECT category_name FROM doc_category WHERE category_id = ?', [dp.doc_category]);
        if (categories.length > 0) categoryName = categories[0].category_name;
      }
    } catch (e) { console.warn('Error fetching category:', e.message); }

    res.json({
      success: true,
      data: {
        ...dp,
        user_email: userEmail,
        client_name: clientName,
        model_name: modelName,
        category_name: categoryName
      }
    });
  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching document.'
    });
  }
});

// Get extracted data for a document
router.get('/:processId/data', verifyToken, async (req, res) => {
  try {
    const { processId } = req.params;

    // First check if user has access to this document
    let checkSql = 'SELECT link_to_json, processing_status FROM document_processed WHERE process_id = ?';
    const checkParams = [processId];

    if (req.user.user_role === 'client' || req.user.user_role === 'user') {
      checkSql += ' AND client_id = ?';
      checkParams.push(req.user.client_id);
    }

    const documents = await query(checkSql, checkParams);

    if (documents.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Document not found or access denied.' 
      });
    }

    const document = documents[0];

    if (document.processing_status !== 'Processed') {
      return res.status(400).json({ 
        success: false, 
        message: 'Document is still being processed or failed.' 
      });
    }

    if (!document.link_to_json) {
      return res.status(404).json({
        success: false,
        message: 'Extracted data not found.'
      });
    }

    // Check if it's a Google Drive URL or local path
    const jsonUrl = document.link_to_json;
    let jsonData;

    if (jsonUrl.includes('drive.google.com')) {
      // Extract file ID from Google Drive URL
      // Format: https://drive.google.com/file/d/FILE_ID/view?usp=drivesdk
      const fileIdMatch = jsonUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (!fileIdMatch) {
        throw new Error('Invalid Google Drive URL format');
      }
      const fileId = fileIdMatch[1];

      // Download file from Google Drive
      const { downloadFromGoogleDrive } = require('../services/googleDrive');
      const tempPath = path.join(__dirname, '..', 'temp', `${processId}_data.json`);

      // Ensure temp directory exists
      const tempDir = path.join(__dirname, '..', 'temp');
      await fs.mkdir(tempDir, { recursive: true });

      // Download file
      await downloadFromGoogleDrive(fileId, tempPath);

      // Read the downloaded file
      jsonData = await fs.readFile(tempPath, 'utf8');

      // Clean up temp file
      await fs.unlink(tempPath).catch(() => {});
    } else {
      // Read from local file path
      jsonData = await fs.readFile(jsonUrl, 'utf8');
    }

    const extractedData = JSON.parse(jsonData);

    // Handle both 'data' and 'results' keys for compatibility
    const results = extractedData.data || extractedData.results || extractedData;

    res.json({
      success: true,
      data: { results: results }
    });
  } catch (error) {
    console.error('Get extracted data error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching extracted data.'
    });
  }
});

// Download file (PDF, CSV, JSON, or ZIP)
router.get('/:processId/download/:fileType', verifyToken, async (req, res) => {
  try {
    const { processId, fileType } = req.params;
    console.log(`Download request: processId=${processId}, fileType=${fileType}`);

    let checkSql = 'SELECT * FROM document_processed WHERE process_id = ?';
    const checkParams = [processId];

    if (req.user.user_role === 'client' || req.user.user_role === 'user') {
      checkSql += ' AND client_id = ?';
      checkParams.push(req.user.client_id);
    }

    const documents = await query(checkSql, checkParams);

    if (documents.length === 0) {
      console.log(`Document not found or access denied: processId=${processId}`);
      return res.status(404).json({
        success: false,
        message: 'Document not found or access denied.'
      });
    }

    const document = documents[0];
    let fileUrl;
    let fileName;
    let driveFileId = null;

    switch (fileType.toLowerCase()) {
      case 'pdf':
        fileUrl = document.link_to_file;
        fileName = document.original_filename;
        driveFileId = document.gdrive_file_id;
        break;
      case 'csv':
        fileUrl = document.link_to_csv;
        fileName = `${path.parse(document.original_filename).name}.csv`;
        driveFileId = document.csv_drive_id;
        break;
      case 'json':
        fileUrl = document.link_to_json;
        fileName = `${path.parse(document.original_filename).name}.json`;
        driveFileId = document.json_drive_id;
        break;
      case 'zip':
        // Create ZIP with all files
        const archiver = require('archiver');
        const archive = archiver('zip', { zlib: { level: 9 } });

        fileName = `${path.parse(document.original_filename).name}_complete.zip`;

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        archive.pipe(res);

        if (document.link_to_file) {
          archive.file(document.link_to_file, { name: document.original_filename });
        }
        if (document.link_to_csv) {
          archive.file(document.link_to_csv, { name: `${path.parse(document.original_filename).name}.csv` });
        }
        if (document.link_to_json) {
          archive.file(document.link_to_json, { name: `${path.parse(document.original_filename).name}.json` });
        }

        await archive.finalize();
        return;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid file type. Use: pdf, csv, json, or zip'
        });
    }

    if (!fileUrl && !driveFileId) {
      console.log(`File URL and Drive ID not found for fileType=${fileType}`);
      return res.status(404).json({
        success: false,
        message: `${fileType.toUpperCase()} file not available for this document.`
      });
    }

    console.log(`File URL: ${fileUrl}`);
    console.log(`Drive File ID: ${driveFileId}`);
    console.log(`File Name: ${fileName}`);

    // Priority 1: Use Google Drive file ID if available
    if (driveFileId) {
      console.log(`Using Google Drive file ID: ${driveFileId}`);
      const { downloadFromGoogleDrive } = require('../services/googleDrive');

      try {
        // Create temp directory if it doesn't exist
        const tempDir = path.join(__dirname, '..', 'temp');
        await fs.mkdir(tempDir, { recursive: true });

        // Download to temp file
        const tempFilePath = path.join(tempDir, `${processId}_${Date.now()}_${fileName}`);
        await downloadFromGoogleDrive(driveFileId, tempFilePath);

        // Send file to client
        res.download(tempFilePath, fileName, async (err) => {
          // Clean up temp file after download
          try {
            await fs.unlink(tempFilePath);
          } catch (cleanupErr) {
            console.error('Error cleaning up temp file:', cleanupErr);
          }

          if (err) {
            console.error('Error sending file:', err);
          }
        });
      } catch (driveErr) {
        console.error('Error downloading from Google Drive:', driveErr);
        return res.status(500).json({
          success: false,
          message: 'Error downloading file from Google Drive.'
        });
      }
    } 
    // Priority 2: Check if fileUrl is a Google Drive URL
    else {
      const driveUrlMatch = fileUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);

      if (driveUrlMatch) {
        console.log(`Detected Google Drive URL, file ID: ${driveUrlMatch[1]}`);
        // It's a Google Drive URL - extract file ID and download
        const fileId = driveUrlMatch[1];
        const { downloadFromGoogleDrive } = require('../services/googleDrive');

        try {
          // Create temp directory if it doesn't exist
          const tempDir = path.join(__dirname, '..', 'temp');
          await fs.mkdir(tempDir, { recursive: true });

          // Download to temp file
          const tempFilePath = path.join(tempDir, `${processId}_${Date.now()}_${fileName}`);
          await downloadFromGoogleDrive(fileId, tempFilePath);

          // Send file to client
          res.download(tempFilePath, fileName, async (err) => {
            // Clean up temp file after download
            try {
              await fs.unlink(tempFilePath);
            } catch (cleanupErr) {
              console.error('Error cleaning up temp file:', cleanupErr);
            }

            if (err) {
              console.error('Error sending file:', err);
            }
          });
        } catch (driveErr) {
          console.error('Error downloading from Google Drive:', driveErr);
          return res.status(500).json({
            success: false,
            message: 'Error downloading file from Google Drive.'
          });
        }
      } else {
        // Priority 3: It's a local file path
        console.log(`Processing as local file path: ${fileUrl}`);
        // Check if file exists
        try {
          await fs.access(fileUrl);
          console.log(`File exists, sending download...`);
        } catch (err) {
          console.log(`File not found: ${fileUrl}`, err.message);
          return res.status(404).json({
            success: false,
            message: 'File not found on server.'
          });
        }

        res.download(fileUrl, fileName, (err) => {
          if (err) {
            console.error('Error sending file:', err);
          } else {
            console.log(`File sent successfully: ${fileName}`);
          }
        });
      }
    }
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({
      success: false,
      message: 'Error downloading file.'
    });
  }
});

// Get processing logs
router.get('/:processId/logs', verifyToken, async (req, res) => {
  try {
    const { processId } = req.params;

    // Check access
    let checkSql = 'SELECT process_id FROM document_processed WHERE process_id = ?';
    const checkParams = [processId];

    if (req.user.user_role === 'client' || req.user.user_role === 'user') {
      checkSql += ' AND client_id = ?';
      checkParams.push(req.user.client_id);
    }

    const documents = await query(checkSql, checkParams);

    if (documents.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Document not found or access denied.' 
      });
    }

    const logs = await query(
      'SELECT * FROM processing_logs WHERE process_id = ? ORDER BY created_at DESC',
      [processId]
    );

    res.json({
      success: true,
      logs
    });
  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching logs.' 
    });
  }
});

// Update extracted data
router.post('/:processId/update-data', verifyToken, async (req, res) => {
  try {
    const { processId } = req.params;
    const { results } = req.body;

    // Check access
    let checkSql = 'SELECT link_to_json, link_to_csv FROM document_processed WHERE process_id = ?';
    const checkParams = [processId];

    if (req.user.user_role === 'client' || req.user.user_role === 'user') {
      checkSql += ' AND client_id = ?';
      checkParams.push(req.user.client_id);
    }

    const documents = await query(checkSql, checkParams);

    if (documents.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Document not found or access denied.' 
      });
    }

    const document = documents[0];

    // Update JSON file
    if (document.link_to_json) {
      const jsonData = await fs.readFile(document.link_to_json, 'utf8');
      const existingData = JSON.parse(jsonData);
      existingData.results = results;
      await fs.writeFile(document.link_to_json, JSON.stringify(existingData, null, 2));
    }

    // Regenerate CSV file
    if (document.link_to_csv && results.length > 0) {
      const { generateCSV } = require('../services/dataFormatter');
      const csvData = generateCSV({ results }, '', processId.toString());
      await fs.writeFile(document.link_to_csv, csvData);
    }

    res.json({
      success: true,
      message: 'Data updated successfully'
    });
  } catch (error) {
    console.error('Update data error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating data.' 
    });
  }
});

// Delete document (admin only)
router.delete('/:processId', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { processId } = req.params;

    const documents = await query(
      'SELECT * FROM document_processed WHERE process_id = ?',
      [processId]
    );

    if (documents.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Document not found.' 
      });
    }

    const document = documents[0];

    // Delete files
    const filesToDelete = [
      document.link_to_file,
      document.link_to_csv,
      document.link_to_json
    ].filter(Boolean);

    for (const filePath of filesToDelete) {
      await fs.unlink(filePath).catch(() => {});
    }

    // Delete extracted data first (foreign key dependency)
    await query('DELETE FROM extracted_data WHERE process_id = ?', [processId]);

    // Delete from document_processed table
    await query('DELETE FROM document_processed WHERE process_id = ?', [processId]);

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error deleting document.' 
    });
  }
});

// Receive processing results from Python processor (no authentication required - called by Python processor)
router.post('/:processId/processing-results', async (req, res) => {
  try {
    const { processId } = req.params;
    const {
      status,
      jsonDriveUrl,
      csvDriveUrl,
      jsonDriveId,
      csvDriveId,
      processingTimeSeconds,
      documentAiCost,
      openAiCost,
      totalCost,
      errorMessage,
      totalRecords,
      noOfPages,
      // Local file paths from Python processor
      localJsonPath,
      localCsvPath,
      localXlsxPath
    } = req.body;

    console.log(`📥 Received Python processor results for process_id: ${processId}, status: ${status}`);
    console.log(`   Local paths - JSON: ${localJsonPath}, CSV: ${localCsvPath}, XLSX: ${localXlsxPath}`);

    // Use local paths as fallback when Drive URLs are not available
    const effectiveJsonPath = jsonDriveUrl || localJsonPath || null;
    const effectiveCsvPath = csvDriveUrl || localCsvPath || null;

    // Update database with results
    await query(
      `UPDATE document_processed
       SET processing_status = ?,
           link_to_json = ?,
           link_to_csv = ?,
           json_drive_id = ?,
           csv_drive_id = ?,
           total_processing_time = ?,
           document_ai_cost = ?,
           openai_cost = ?,
           cost = ?,
           time_finished = NOW(),
           error_message = ?,
           total_records = ?,
           no_of_pages = ?
       WHERE process_id = ?`,
      [
        status,
        effectiveJsonPath,
        effectiveCsvPath,
        jsonDriveId || null,
        csvDriveId || null,
        processingTimeSeconds || null,
        documentAiCost || null,
        openAiCost || null,
        totalCost || null,
        errorMessage || null,
        totalRecords || 0,
        noOfPages || 0,
        processId
      ]
    );

    console.log(`✓ Updated database for process_id: ${processId}`);

    // Populate extracted_data table with results from JSON file
    if (status === 'Processed' && totalRecords > 0) {
      try {
        let jsonData = null;
        let jsonSource = null;

        // Priority 1: Use local JSON file if available
        if (localJsonPath) {
          try {
            await fs.access(localJsonPath);
            jsonData = await fs.readFile(localJsonPath, 'utf8');
            jsonSource = 'local file';
            console.log(`📂 Reading JSON from local file: ${localJsonPath}`);
          } catch (localErr) {
            console.log(`⚠️  Local JSON file not accessible: ${localErr.message}`);
          }
        }

        // Priority 2: Download from Google Drive if local file not available
        if (!jsonData && jsonDriveId) {
          try {
            console.log(`📥 Downloading JSON from Google Drive for process_id: ${processId}`);
            const { downloadFromGoogleDrive } = require('../services/googleDrive');
            const tempPath = path.join(__dirname, '..', 'temp', `${processId}_initial_data.json`);

            const tempDir = path.join(__dirname, '..', 'temp');
            await fs.mkdir(tempDir, { recursive: true });

            await downloadFromGoogleDrive(jsonDriveId, tempPath);
            jsonData = await fs.readFile(tempPath, 'utf8');
            jsonSource = 'Google Drive';

            await fs.unlink(tempPath).catch(() => {});
          } catch (driveErr) {
            console.log(`⚠️  Google Drive download failed: ${driveErr.message}`);
          }
        }

        if (jsonData) {
          const parsedData = JSON.parse(jsonData);
          const results = parsedData.data || parsedData.results || [];

          console.log(`📊 Found ${results.length} records from ${jsonSource} to insert`);

          if (results.length > 0) {
            for (const record of results) {
              await query(
                'INSERT INTO extracted_data (process_id, row_data) VALUES (?, ?)',
                [processId, JSON.stringify(record)]
              );
            }
            console.log(`✓ Inserted ${results.length} records into extracted_data for process_id: ${processId}`);
          }
        } else {
          console.log(`⚠️  No JSON data source available for process_id: ${processId}`);
        }
      } catch (error) {
        console.error(`⚠️  Failed to populate extracted_data for process_id ${processId}:`, error.message);
      }
    }

    // Emit socket event for real-time UI update (if Socket.IO is configured)
    const io = req.app.get('io');
    if (io) {
      io.to(`process_${processId}`).emit('processing_complete', {
        processId,
        status,
        totalCost,
        totalRecords,
        processingTime: processingTimeSeconds
      });
      console.log(`✓ Emitted socket event for process_id: ${processId}`);
    }

    res.json({
      success: true,
      message: 'Results updated successfully',
      processId: processId
    });
  } catch (error) {
    console.error('Update processing results error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating results: ' + error.message
    });
  }
});

// Get extracted data from database for a document
router.get('/:processId/extracted-data', verifyToken, async (req, res) => {
  try {
    const { processId } = req.params;

    // Check if user has access to this document
    let checkSql = 'SELECT process_id FROM document_processed WHERE process_id = ?';
    const checkParams = [processId];

    if (req.user.user_role === 'client' || req.user.user_role === 'user') {
      checkSql += ' AND client_id = ?';
      checkParams.push(req.user.client_id);
    }

    const documents = await query(checkSql, checkParams);

    if (documents.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document not found or access denied.'
      });
    }

    // Fetch extracted data from database
    const extractedData = await query(
      'SELECT id, row_data, created_at, updated_at FROM extracted_data WHERE process_id = ? ORDER BY id ASC',
      [processId]
    );

    // MySQL JSON column is automatically parsed, no need to JSON.parse()
    const results = extractedData.map(row => ({
      id: row.id,
      ...row.row_data,
      _metadata: {
        created_at: row.created_at,
        updated_at: row.updated_at
      }
    }));

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Get extracted data error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching extracted data.'
    });
  }
});

// Save/update extracted data for a document
router.post('/:processId/extracted-data', verifyToken, async (req, res) => {
  try {
    const { processId } = req.params;
    const { records } = req.body;

    if (!records || !Array.isArray(records)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request. Records array is required.'
      });
    }

    // Check if user has access to this document
    let checkSql = 'SELECT process_id FROM document_processed WHERE process_id = ?';
    const checkParams = [processId];

    if (req.user.user_role === 'client' || req.user.user_role === 'user') {
      checkSql += ' AND client_id = ?';
      checkParams.push(req.user.client_id);
    }

    const documents = await query(checkSql, checkParams);

    if (documents.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document not found or access denied.'
      });
    }

    // Delete all existing records for this process_id
    await query('DELETE FROM extracted_data WHERE process_id = ?', [processId]);

    // Insert new records
    if (records.length > 0) {
      const insertPromises = records.map(record => {
        // Remove metadata and id fields before saving
        const { id, _metadata, ...rowData } = record;

        return query(
          'INSERT INTO extracted_data (process_id, row_data) VALUES (?, ?)',
          [processId, JSON.stringify(rowData)]
        );
      });

      await Promise.all(insertPromises);
    }

    // Update total_records in document_processed
    await query(
      'UPDATE document_processed SET total_records = ? WHERE process_id = ?',
      [records.length, processId]
    );

    res.json({
      success: true,
      message: 'Extracted data saved successfully',
      recordCount: records.length
    });
  } catch (error) {
    console.error('Save extracted data error:', error);
    res.status(500).json({
      success: false,
      message: 'Error saving extracted data.'
    });
  }
});

// Delete multiple extracted data records
router.delete('/:processId/extracted-data/bulk', verifyToken, async (req, res) => {
  try {
    const { processId } = req.params;
    const { recordIds } = req.body;

    if (!recordIds || !Array.isArray(recordIds) || recordIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request. Record IDs array is required.'
      });
    }

    // Check if user has access to this document
    let checkSql = 'SELECT process_id FROM document_processed WHERE process_id = ?';
    const checkParams = [processId];

    if (req.user.user_role === 'client' || req.user.user_role === 'user') {
      checkSql += ' AND client_id = ?';
      checkParams.push(req.user.client_id);
    }

    const documents = await query(checkSql, checkParams);

    if (documents.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document not found or access denied.'
      });
    }

    // Delete records
    const placeholders = recordIds.map(() => '?').join(',');
    await query(
      `DELETE FROM extracted_data WHERE id IN (${placeholders}) AND process_id = ?`,
      [...recordIds, processId]
    );

    // Update total_records count
    const remainingRecords = await query(
      'SELECT COUNT(*) as count FROM extracted_data WHERE process_id = ?',
      [processId]
    );

    await query(
      'UPDATE document_processed SET total_records = ? WHERE process_id = ?',
      [remainingRecords[0].count, processId]
    );

    res.json({
      success: true,
      message: 'Records deleted successfully',
      deletedCount: recordIds.length,
      remainingCount: remainingRecords[0].count
    });
  } catch (error) {
    console.error('Delete extracted data error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting extracted data.'
    });
  }
});

module.exports = router;
