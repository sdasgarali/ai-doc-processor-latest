const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { query, transaction } = require('../config/database');
const { verifyToken, checkRole } = require('../middleware/auth');
const { processDocument } = require('../services/documentProcessor');
const { uploadToGoogleDrive } = require('../services/googleDrive');
const moment = require('moment-timezone');
const axios = require('axios');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
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
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
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

    // Upload to Google Drive (async, non-blocking)
    let driveFileId = null;
    uploadToGoogleDrive(newPath, newFilename, processId, false)
      .then(async driveResult => {
        if (driveResult.fileId) {
          driveFileId = driveResult.fileId;

          // Update database with Google Drive file ID
          await query(
            'UPDATE document_processed SET gdrive_file_id = ? WHERE process_id = ?',
            [driveResult.fileId, processId]
          ).catch(err => console.error('Error updating Google Drive file ID:', err));

          console.log(`✓ Uploaded to Google Drive: ${driveResult.fileName} (ID: ${driveResult.fileId})`);

          // Trigger n8n webhook AFTER successful Google Drive upload
          try {
            const webhookUrl = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/eob-process';

            await axios.post(
              webhookUrl,
              {
                processId: processId,
                filename: newFilename,
                originalFilename: req.file.originalname,
                driveFileId: driveResult.fileId,
                userid: req.user.userid,
                clientId: req.user.client_id,
                sessionId: sessionId,
                modelId: selectedModelId,
                docCategory: doc_category
              },
              { timeout: 5000 }
            );

            console.log(`✓ Triggered n8n processing for process_id: ${processId}, model: ${selectedModelId}`);
          } catch (webhookError) {
            console.error('Failed to trigger n8n webhook:', webhookError.message);

            // Update status to Failed if webhook fails
            await query(
              'UPDATE document_processed SET processing_status = ?, error_message = ? WHERE process_id = ?',
              ['Failed', 'Failed to trigger processing workflow: ' + webhookError.message, processId]
            ).catch(err => console.error('Error updating status:', err));
          }
        }
      })
      .catch(err => {
        console.warn('Google Drive upload failed:', err.message);

        // Update status to Failed if Google Drive upload fails
        query(
          'UPDATE document_processed SET processing_status = ?, error_message = ? WHERE process_id = ?',
          ['Failed', 'Google Drive upload failed: ' + err.message, processId]
        ).catch(err => console.error('Error updating status:', err));
      });

    // DISABLED - Processing now handled by n8n workflow via webhook
    // processDocument(processId, req.file.path, {
    //   userid: req.user.userid,
    //   client_id: req.user.client_id,
    //   model_id: model_id || null,
    //   session_id: sessionId,
    //   doc_category: doc_category,
    //   original_filename: req.file.originalname,
    //   timezone: req.user.timezone || 'UTC'
    // }).catch(error => {
    //   console.error('Background processing error:', error);
    // });

    res.status(201).json({
      success: true,
      message: 'Document uploaded successfully and processing started',
      process_id: processId,
      session_id: sessionId
    });
  } catch (error) {
    console.error('Upload error:', error);
    // Clean up file if exists
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    res.status(500).json({ 
      success: false, 
      message: 'Error uploading document.' 
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

    let sql = `
      SELECT
        dp.process_id,
        dp.doc_name,
        dp.original_filename,
        dp.no_of_pages,
        dp.total_records,
        dp.processing_status,
        dp.time_initiated,
        dp.time_finished,
        dp.total_processing_time,
        dp.cost,
        dp.link_to_file,
        dp.link_to_csv,
        dp.link_to_json,
        dp.session_id,
        dp.model_id,
        u.email as user_email,
        c.client_name,
        c.active_model,
        mc.model_name,
        dc.category_name,
        COALESCE(dp.model_id, c.active_model) as effective_model_id
      FROM document_processed dp
      LEFT JOIN user_profile u ON dp.userid = u.userid
      LEFT JOIN client c ON dp.client_id = c.client_id
      LEFT JOIN model_config mc ON dp.model_id = mc.model_id
      LEFT JOIN doc_category dc ON dp.doc_category = dc.category_id
      WHERE 1=1
    `;

    const params = [];

    // Apply filters based on user role
    if (req.user.user_role === 'client' || req.user.user_role === 'user') {
      sql += ' AND dp.client_id = ?';
      params.push(req.user.client_id);
    } else if (client_id) {
      sql += ' AND dp.client_id = ?';
      params.push(client_id);
    }

    if (status) {
      sql += ' AND dp.processing_status = ?';
      params.push(status);
    }

    if (doc_category) {
      sql += ' AND dp.doc_category = ?';
      params.push(doc_category);
    }

    if (from_date) {
      sql += ' AND dp.time_initiated >= ?';
      params.push(from_date);
    }

    if (to_date) {
      sql += ' AND dp.time_initiated <= ?';
      params.push(to_date);
    }

    // Get total count
    const countSql = sql.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM');
    const countResult = await query(countSql, params);
    const total = countResult[0].total;

    // Add pagination - use string interpolation for LIMIT/OFFSET (safe since we convert to numbers)
    const limitNum = Number(limit) || 20;
    const pageNum = Number(page) || 1;
    const offsetNum = (pageNum - 1) * limitNum;
    
    sql += ` ORDER BY dp.time_initiated DESC LIMIT ${limitNum} OFFSET ${offsetNum}`;
    
    const documents = await query(sql, params);

    res.json({
      success: true,
      data: documents,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
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

    let sql = `
      SELECT 
        dp.*,
        u.email as user_email,
        c.client_name,
        mc.model_name,
        dc.category_name
      FROM document_processed dp
      LEFT JOIN user_profile u ON dp.userid = u.userid
      LEFT JOIN client c ON dp.client_id = c.client_id
      LEFT JOIN model_config mc ON dp.model_id = mc.model_id
      LEFT JOIN doc_category dc ON dp.doc_category = dc.category_id
      WHERE dp.process_id = ?
    `;

    const params = [processId];

    // Apply access control
    if (req.user.user_role === 'client' || req.user.user_role === 'user') {
      sql += ' AND dp.client_id = ?';
      params.push(req.user.client_id);
    }

    const documents = await query(sql, params);

    if (documents.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Document not found or access denied.' 
      });
    }

    res.json({
      success: true,
      data: documents[0]
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

// Receive results from Python processor (no authentication required - called by Python processor)
router.post('/:processId/n8n-results', async (req, res) => {
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
    console.error('Update n8n results error:', error);
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
