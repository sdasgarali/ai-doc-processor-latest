const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { PDFDocument } = require('pdf-lib');
const pdfParse = require('pdf-parse');
const { query, transaction } = require('../config/database');
const { verifyToken, checkRole } = require('../middleware/auth');
const aiService = require('../services/aiService');
const {
  aiAnalysisLimiter,
  categoryCreationLimiter,
  uploadLimiter
} = require('../middleware/rateLimiter');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/samples');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
    } catch (err) {
      // Directory exists
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `sample-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.png', '.jpg', '.jpeg', '.tiff'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and image files are allowed'));
    }
  }
});

// ==================== SAMPLE DOCUMENTS ====================

// Upload sample document for a category
router.post('/sample-document', uploadLimiter, verifyToken, checkRole('admin', 'superadmin'), upload.single('file'), async (req, res) => {
  try {
    const {
      doc_category_id,
      description,
      expected_fields,
      expected_output_format = 'csv'
    } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    if (!doc_category_id) {
      return res.status(400).json({ success: false, message: 'Document category ID is required.' });
    }

    // Check if category exists
    const categoryExists = await query(
      'SELECT category_id FROM doc_category WHERE category_id = ?',
      [doc_category_id]
    );
    if (categoryExists.length === 0) {
      return res.status(404).json({ success: false, message: 'Document category not found.' });
    }

    // Parse expected fields if provided as string
    let parsedExpectedFields = [];
    if (expected_fields) {
      try {
        parsedExpectedFields = typeof expected_fields === 'string'
          ? JSON.parse(expected_fields)
          : expected_fields;
      } catch (e) {
        // If not JSON, split by comma
        parsedExpectedFields = expected_fields.split(',').map(f => f.trim());
      }
    }

    const result = await query(`
      INSERT INTO category_sample_document (
        doc_category_id, file_name, original_filename, file_path,
        file_size, mime_type, description, expected_fields,
        expected_output_format, uploaded_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      doc_category_id,
      req.file.filename,
      req.file.originalname,
      req.file.path,
      req.file.size,
      req.file.mimetype,
      description || null,
      JSON.stringify(parsedExpectedFields),
      expected_output_format,
      req.user.userId
    ]);

    res.status(201).json({
      success: true,
      message: 'Sample document uploaded successfully',
      sample_id: result.insertId,
      file_name: req.file.filename
    });
  } catch (error) {
    console.error('Upload sample document error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading sample document.',
      error: error.message
    });
  }
});

// Get sample documents for a category
router.get('/sample-documents/:categoryId', verifyToken, async (req, res) => {
  try {
    const { categoryId } = req.params;

    const samples = await query(`
      SELECT sd.*,
             up.first_name as uploaded_by_name, up.last_name as uploaded_by_lastname
      FROM category_sample_document sd
      LEFT JOIN user_profile up ON sd.uploaded_by = up.userid
      WHERE sd.doc_category_id = ?
      ORDER BY sd.created_at DESC
    `, [categoryId]);

    res.json({
      success: true,
      data: samples
    });
  } catch (error) {
    console.error('Get sample documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching sample documents.',
      error: error.message
    });
  }
});

// Delete sample document
router.delete('/sample-document/:sampleId', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { sampleId } = req.params;

    // Get file path before deleting
    const sample = await query(
      'SELECT file_path FROM category_sample_document WHERE sample_id = ?',
      [sampleId]
    );

    if (sample.length === 0) {
      return res.status(404).json({ success: false, message: 'Sample document not found.' });
    }

    // Delete file
    try {
      await fs.unlink(sample[0].file_path);
    } catch (e) {
      console.error('Error deleting file:', e);
    }

    // Delete record
    await query('DELETE FROM category_sample_document WHERE sample_id = ?', [sampleId]);

    res.json({ success: true, message: 'Sample document deleted successfully' });
  } catch (error) {
    console.error('Delete sample document error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting sample document.',
      error: error.message
    });
  }
});

// ==================== AI ANALYSIS ====================

// Analyze sample document with AI
router.post('/analyze/:sampleId', aiAnalysisLimiter, verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { sampleId } = req.params;

    // Get sample document
    const sample = await query(`
      SELECT sd.*, dc.category_name
      FROM category_sample_document sd
      JOIN doc_category dc ON sd.doc_category_id = dc.category_id
      WHERE sd.sample_id = ?
    `, [sampleId]);

    if (sample.length === 0) {
      return res.status(404).json({ success: false, message: 'Sample document not found.' });
    }

    const sampleDoc = sample[0];

    // Update status to analyzing
    await query(
      'UPDATE category_sample_document SET analysis_status = ? WHERE sample_id = ?',
      ['analyzing', sampleId]
    );

    // Extract text from PDF
    let documentText = '';
    try {
      const pdfBuffer = await fs.readFile(sampleDoc.file_path);
      const pdfData = await pdfParse(pdfBuffer);
      documentText = pdfData.text;
    } catch (pdfError) {
      console.error('PDF parsing error:', pdfError);
      await query(
        'UPDATE category_sample_document SET analysis_status = ?, analysis_error = ? WHERE sample_id = ?',
        ['failed', `PDF parsing failed: ${pdfError.message}`, sampleId]
      );
      return res.status(500).json({
        success: false,
        message: 'Failed to parse PDF document.',
        error: pdfError.message
      });
    }

    // Parse expected fields
    let expectedFields = [];
    try {
      expectedFields = JSON.parse(sampleDoc.expected_fields || '[]');
    } catch (e) {
      // Ignore parse error
    }

    // Call AI to analyze document and suggest fields
    let aiResult;
    try {
      aiResult = await aiService.analyzeDocumentForFields(
        documentText,
        sampleDoc.description || `${sampleDoc.category_name} document`,
        expectedFields
      );
    } catch (aiError) {
      console.error('AI analysis error:', aiError);
      await query(
        'UPDATE category_sample_document SET analysis_status = ?, analysis_error = ? WHERE sample_id = ?',
        ['failed', `AI analysis failed: ${aiError.message}`, sampleId]
      );
      return res.status(500).json({
        success: false,
        message: 'AI analysis failed.',
        error: aiError.message
      });
    }

    // Update sample document with analysis results
    await query(`
      UPDATE category_sample_document SET
        analysis_status = 'completed',
        ai_analysis_result = ?,
        ai_suggested_fields = ?,
        analysis_error = NULL
      WHERE sample_id = ?
    `, [
      JSON.stringify({
        model: aiResult.model,
        provider: aiResult.provider,
        usage: aiResult.usage,
        analyzedAt: new Date().toISOString()
      }),
      JSON.stringify(aiResult.suggestedFields),
      sampleId
    ]);

    res.json({
      success: true,
      message: 'Document analysis completed',
      data: {
        suggestedFields: aiResult.suggestedFields,
        model: aiResult.model,
        provider: aiResult.provider
      }
    });
  } catch (error) {
    console.error('Analyze document error:', error);
    res.status(500).json({
      success: false,
      message: 'Error analyzing document.',
      error: error.message
    });
  }
});

// Get analysis results
router.get('/analysis/:sampleId', verifyToken, async (req, res) => {
  try {
    const { sampleId } = req.params;

    const sample = await query(`
      SELECT sample_id, analysis_status, ai_analysis_result,
             ai_suggested_fields, analysis_error, description,
             expected_fields
      FROM category_sample_document
      WHERE sample_id = ?
    `, [sampleId]);

    if (sample.length === 0) {
      return res.status(404).json({ success: false, message: 'Sample document not found.' });
    }

    const sampleDoc = sample[0];

    res.json({
      success: true,
      data: {
        status: sampleDoc.analysis_status,
        suggestedFields: sampleDoc.ai_suggested_fields ? JSON.parse(sampleDoc.ai_suggested_fields) : [],
        analysisResult: sampleDoc.ai_analysis_result ? JSON.parse(sampleDoc.ai_analysis_result) : null,
        error: sampleDoc.analysis_error,
        description: sampleDoc.description,
        expectedFields: sampleDoc.expected_fields ? JSON.parse(sampleDoc.expected_fields) : []
      }
    });
  } catch (error) {
    console.error('Get analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching analysis results.',
      error: error.message
    });
  }
});

// ==================== CATEGORY CREATION REQUEST ====================

// Create new category creation request
router.post('/request', categoryCreationLimiter, verifyToken, checkRole('admin', 'superadmin'), upload.single('sample_file'), async (req, res) => {
  try {
    const {
      category_name,
      category_description,
      expected_fields,
      expected_output_format = 'csv'
    } = req.body;

    if (!category_name || !category_description) {
      return res.status(400).json({
        success: false,
        message: 'Category name and description are required.'
      });
    }

    // Check for duplicate category name
    const existing = await query(
      'SELECT category_id FROM doc_category WHERE category_name = ?',
      [category_name.toLowerCase().replace(/\s+/g, '_')]
    );
    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'A category with this name already exists.'
      });
    }

    // Parse expected fields
    let parsedExpectedFields = [];
    if (expected_fields) {
      try {
        parsedExpectedFields = typeof expected_fields === 'string'
          ? JSON.parse(expected_fields)
          : expected_fields;
      } catch (e) {
        parsedExpectedFields = expected_fields.split(',').map(f => f.trim());
      }
    }

    let sampleDocumentId = null;

    // If sample file was uploaded, create sample document record first
    if (req.file) {
      // Create a temporary category entry for the sample document
      // We'll update this after the category is approved
      const sampleResult = await query(`
        INSERT INTO category_sample_document (
          doc_category_id, file_name, original_filename, file_path,
          file_size, mime_type, description, expected_fields,
          expected_output_format, uploaded_by, analysis_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `, [
        0, // Temporary, will be updated
        req.file.filename,
        req.file.originalname,
        req.file.path,
        req.file.size,
        req.file.mimetype,
        category_description,
        JSON.stringify(parsedExpectedFields),
        expected_output_format,
        req.user.userId
      ]);
      sampleDocumentId = sampleResult.insertId;
    }

    // Create the category creation request
    const result = await query(`
      INSERT INTO category_creation_request (
        category_name, category_description, expected_fields,
        expected_output_format, sample_document_id, status, requested_by
      ) VALUES (?, ?, ?, ?, ?, 'pending', ?)
    `, [
      category_name,
      category_description,
      JSON.stringify(parsedExpectedFields),
      expected_output_format,
      sampleDocumentId,
      req.user.userId
    ]);

    res.status(201).json({
      success: true,
      message: 'Category creation request submitted successfully',
      request_id: result.insertId,
      sample_document_id: sampleDocumentId
    });
  } catch (error) {
    console.error('Create category request error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating category request.',
      error: error.message
    });
  }
});

// Get all category creation requests
router.get('/requests', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    let sql = `
      SELECT ccr.*,
             csd.file_name as sample_file_name, csd.original_filename as sample_original_name,
             csd.analysis_status,
             up1.first_name as requested_by_name, up1.last_name as requested_by_lastname,
             up2.first_name as reviewed_by_name, up2.last_name as reviewed_by_lastname
      FROM category_creation_request ccr
      LEFT JOIN category_sample_document csd ON ccr.sample_document_id = csd.sample_id
      LEFT JOIN user_profile up1 ON ccr.requested_by = up1.userid
      LEFT JOIN user_profile up2 ON ccr.reviewed_by = up2.userid
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += ' AND ccr.status = ?';
      params.push(status);
    }

    // Count
    const countSql = sql.replace(/SELECT ccr\.\*[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM');
    const countResult = await query(countSql, params);
    const total = countResult[0]?.total || 0;

    // Pagination
    const limitNum = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
    const pageNum = Math.max(parseInt(page) || 1, 1);
    const offsetNum = (pageNum - 1) * limitNum;

    sql += ` ORDER BY ccr.created_at DESC LIMIT ${limitNum} OFFSET ${offsetNum}`;

    const requests = await query(sql, params);

    res.json({
      success: true,
      data: requests,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get category requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching category requests.',
      error: error.message
    });
  }
});

// Get single category creation request
router.get('/request/:requestId', verifyToken, async (req, res) => {
  try {
    const { requestId } = req.params;

    const requests = await query(`
      SELECT ccr.*,
             csd.file_name, csd.original_filename, csd.analysis_status,
             csd.ai_suggested_fields, csd.ai_analysis_result,
             up1.first_name as requested_by_name, up1.last_name as requested_by_lastname,
             up2.first_name as reviewed_by_name, up2.last_name as reviewed_by_lastname
      FROM category_creation_request ccr
      LEFT JOIN category_sample_document csd ON ccr.sample_document_id = csd.sample_id
      LEFT JOIN user_profile up1 ON ccr.requested_by = up1.userid
      LEFT JOIN user_profile up2 ON ccr.reviewed_by = up2.userid
      WHERE ccr.request_id = ?
    `, [requestId]);

    if (requests.length === 0) {
      return res.status(404).json({ success: false, message: 'Category request not found.' });
    }

    const request = requests[0];

    // Parse JSON fields
    request.expected_fields = request.expected_fields ? JSON.parse(request.expected_fields) : [];
    request.suggested_fields = request.suggested_fields ? JSON.parse(request.suggested_fields) : [];
    request.ai_response = request.ai_response ? JSON.parse(request.ai_response) : null;
    request.ai_suggested_fields = request.ai_suggested_fields ? JSON.parse(request.ai_suggested_fields) : [];
    request.ai_analysis_result = request.ai_analysis_result ? JSON.parse(request.ai_analysis_result) : null;

    res.json({
      success: true,
      data: request
    });
  } catch (error) {
    console.error('Get category request error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching category request.',
      error: error.message
    });
  }
});

// Process (analyze) category creation request
router.post('/request/:requestId/analyze', aiAnalysisLimiter, verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { requestId } = req.params;

    // Get request with sample document
    const requests = await query(`
      SELECT ccr.*, csd.file_path, csd.sample_id
      FROM category_creation_request ccr
      LEFT JOIN category_sample_document csd ON ccr.sample_document_id = csd.sample_id
      WHERE ccr.request_id = ?
    `, [requestId]);

    if (requests.length === 0) {
      return res.status(404).json({ success: false, message: 'Category request not found.' });
    }

    const request = requests[0];

    if (!request.file_path) {
      return res.status(400).json({
        success: false,
        message: 'No sample document found for this request.'
      });
    }

    // Update status
    await query(
      'UPDATE category_creation_request SET status = ? WHERE request_id = ?',
      ['processing', requestId]
    );
    await query(
      'UPDATE category_sample_document SET analysis_status = ? WHERE sample_id = ?',
      ['analyzing', request.sample_id]
    );

    // Extract text from PDF
    let documentText = '';
    try {
      const pdfBuffer = await fs.readFile(request.file_path);
      const pdfData = await pdfParse(pdfBuffer);
      documentText = pdfData.text;
    } catch (pdfError) {
      await query(
        'UPDATE category_creation_request SET status = ? WHERE request_id = ?',
        ['pending', requestId]
      );
      await query(
        'UPDATE category_sample_document SET analysis_status = ?, analysis_error = ? WHERE sample_id = ?',
        ['failed', pdfError.message, request.sample_id]
      );
      return res.status(500).json({
        success: false,
        message: 'Failed to parse PDF document.',
        error: pdfError.message
      });
    }

    // Parse expected fields
    let expectedFields = [];
    try {
      expectedFields = JSON.parse(request.expected_fields || '[]');
    } catch (e) {
      // Ignore
    }

    // Call AI
    let aiResult;
    try {
      aiResult = await aiService.analyzeDocumentForFields(
        documentText,
        request.category_description,
        expectedFields
      );
    } catch (aiError) {
      await query(
        'UPDATE category_creation_request SET status = ? WHERE request_id = ?',
        ['pending', requestId]
      );
      await query(
        'UPDATE category_sample_document SET analysis_status = ?, analysis_error = ? WHERE sample_id = ?',
        ['failed', aiError.message, request.sample_id]
      );
      return res.status(500).json({
        success: false,
        message: 'AI analysis failed.',
        error: aiError.message
      });
    }

    // Update both records
    await query(`
      UPDATE category_creation_request SET
        status = 'review',
        ai_model_used = ?,
        ai_response = ?,
        suggested_fields = ?
      WHERE request_id = ?
    `, [
      `${aiResult.provider}:${aiResult.model}`,
      JSON.stringify({ raw: aiResult.aiResponse, usage: aiResult.usage }),
      JSON.stringify(aiResult.suggestedFields),
      requestId
    ]);

    await query(`
      UPDATE category_sample_document SET
        analysis_status = 'completed',
        ai_analysis_result = ?,
        ai_suggested_fields = ?
      WHERE sample_id = ?
    `, [
      JSON.stringify({
        model: aiResult.model,
        provider: aiResult.provider,
        usage: aiResult.usage,
        analyzedAt: new Date().toISOString()
      }),
      JSON.stringify(aiResult.suggestedFields),
      request.sample_id
    ]);

    res.json({
      success: true,
      message: 'Analysis completed successfully',
      data: {
        suggestedFields: aiResult.suggestedFields,
        model: aiResult.model,
        provider: aiResult.provider
      }
    });
  } catch (error) {
    console.error('Analyze request error:', error);
    res.status(500).json({
      success: false,
      message: 'Error analyzing request.',
      error: error.message
    });
  }
});

// Approve category creation request
router.post('/request/:requestId/approve', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { requestId } = req.params;
    const {
      final_fields,    // Array of approved field configurations
      review_notes,
      category_display_name
    } = req.body;

    // Get request
    const requests = await query(
      'SELECT * FROM category_creation_request WHERE request_id = ?',
      [requestId]
    );

    if (requests.length === 0) {
      return res.status(404).json({ success: false, message: 'Category request not found.' });
    }

    const request = requests[0];

    if (request.status === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'This request has already been approved.'
      });
    }

    // Use suggested fields if final_fields not provided
    let fieldsToCreate = final_fields;
    if (!fieldsToCreate && request.suggested_fields) {
      fieldsToCreate = JSON.parse(request.suggested_fields);
    }

    if (!fieldsToCreate || fieldsToCreate.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields provided and no suggested fields available.'
      });
    }

    let newCategoryId, newProfileId;

    await transaction(async (conn) => {
      // 1. Create the new category
      const categoryName = request.category_name.toLowerCase().replace(/\s+/g, '_');
      const categoryResult = await conn.query(`
        INSERT INTO doc_category (
          category_name, category_display_name, description,
          is_active, is_ai_generated, requires_sample
        ) VALUES (?, ?, ?, TRUE, TRUE, TRUE)
      `, [
        categoryName,
        category_display_name || request.category_name,
        request.category_description
      ]);

      newCategoryId = categoryResult.insertId;

      // 2. Create fields for the category
      for (let i = 0; i < fieldsToCreate.length; i++) {
        const field = fieldsToCreate[i];
        await conn.query(`
          INSERT INTO field_table (
            field_name, field_display_name, field_type,
            is_required, doc_category, description
          ) VALUES (?, ?, ?, ?, ?, ?)
        `, [
          field.field_name,
          field.field_display_name || field.field_name,
          field.field_type || 'string',
          field.is_required ? 1 : 0,
          newCategoryId,
          field.description || null
        ]);
      }

      // 3. Create default output profile for the category
      const profileResult = await conn.query(`
        INSERT INTO output_profile (
          profile_name, client_id, doc_category_id, is_default,
          output_format, description, is_active, created_by
        ) VALUES (?, NULL, ?, TRUE, ?, ?, TRUE, ?)
      `, [
        `${request.category_name} Default Profile`,
        newCategoryId,
        request.expected_output_format || 'csv',
        `Default output profile for ${request.category_name} documents`,
        req.user.userId
      ]);

      newProfileId = profileResult.insertId;

      // 4. Add all fields to the default profile
      const newFields = await conn.query(
        'SELECT field_id FROM field_table WHERE doc_category = ?',
        [newCategoryId]
      );

      for (let i = 0; i < newFields.length; i++) {
        await conn.query(`
          INSERT INTO output_profile_field (
            profile_id, field_id, custom_label, field_order, is_included, is_required
          )
          SELECT ?, field_id, field_display_name, ?, TRUE, is_required
          FROM field_table WHERE field_id = ?
        `, [newProfileId, i + 1, newFields[i].field_id]);
      }

      // 5. Update the sample document's category_id
      if (request.sample_document_id) {
        await conn.query(
          'UPDATE category_sample_document SET doc_category_id = ? WHERE sample_id = ?',
          [newCategoryId, request.sample_document_id]
        );
      }

      // 6. Update the request status
      await conn.query(`
        UPDATE category_creation_request SET
          status = 'approved',
          review_notes = ?,
          created_category_id = ?,
          created_profile_id = ?,
          reviewed_by = ?,
          reviewed_at = NOW()
        WHERE request_id = ?
      `, [
        review_notes || null,
        newCategoryId,
        newProfileId,
        req.user.userId,
        requestId
      ]);
    });

    res.json({
      success: true,
      message: 'Category created successfully',
      data: {
        category_id: newCategoryId,
        profile_id: newProfileId,
        fields_created: fieldsToCreate.length
      }
    });
  } catch (error) {
    console.error('Approve category request error:', error);
    res.status(500).json({
      success: false,
      message: 'Error approving category request.',
      error: error.message
    });
  }
});

// Reject category creation request
router.post('/request/:requestId/reject', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { requestId } = req.params;
    const { review_notes } = req.body;

    const result = await query(`
      UPDATE category_creation_request SET
        status = 'rejected',
        review_notes = ?,
        reviewed_by = ?,
        reviewed_at = NOW()
      WHERE request_id = ?
    `, [review_notes || 'Request rejected', req.user.userId, requestId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Category request not found.' });
    }

    res.json({ success: true, message: 'Category request rejected' });
  } catch (error) {
    console.error('Reject category request error:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting category request.',
      error: error.message
    });
  }
});

module.exports = router;
