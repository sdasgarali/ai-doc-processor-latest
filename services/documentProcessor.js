const fs = require('fs').promises;
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const axios = require('axios');
const { query } = require('../config/database');
const { uploadToGoogleDrive } = require('./googleDrive');
const { generateCSV, generateJSON } = require('./dataFormatter');
const moment = require('moment-timezone');

// Process document
async function processDocument(processId, filePath, metadata) {
  const startTime = Date.now();
  
  try {
    console.log(`Processing document ${processId}: ${metadata.original_filename}`);
    
    // Log processing start
    await logProcessing(processId, 'INFO', 'Processing started');
    
    // Step 1: Count pages and check if splitting is needed
    const pdfBytes = await fs.readFile(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pageCount = pdfDoc.getPageCount();
    
    await query(
      'UPDATE document_processed SET no_of_pages = ? WHERE process_id = ?',
      [pageCount, processId]
    );
    
    console.log(`Document has ${pageCount} pages`);
    await logProcessing(processId, 'INFO', `Document contains ${pageCount} pages`);
    
    const splitLimit = parseInt(process.env.PDF_SPLIT_PAGE_LIMIT) || 30;
    let processedFiles = [];
    
    if (pageCount > splitLimit) {
      // Step 2: Split PDF
      console.log(`Splitting PDF into chunks of ${splitLimit} pages`);
      await logProcessing(processId, 'INFO', `Splitting PDF (limit: ${splitLimit} pages per chunk)`);
      
      processedFiles = await splitPDF(filePath, splitLimit, processId);
      
      console.log(`Split into ${processedFiles.length} parts`);
      await logProcessing(processId, 'INFO', `Split into ${processedFiles.length} parts`);
    } else {
      processedFiles = [{ path: filePath, startPage: 1, endPage: pageCount }];
    }
    
    // Step 3: Upload all parts to Google Drive in parallel
    console.log('Uploading to Google Drive...');
    await logProcessing(processId, 'INFO', 'Uploading files to Google Drive');
    
    const uploadPromises = processedFiles.map(file => 
      uploadToGoogleDrive(file.path, metadata.original_filename, processId)
    );
    const uploadResults = await Promise.all(uploadPromises);
    
    console.log('Upload to Google Drive completed');
    await logProcessing(processId, 'INFO', 'Upload to Google Drive completed');
    
    // Step 4: Trigger n8n workflow for each part in parallel
    console.log('Triggering n8n workflow...');
    await logProcessing(processId, 'INFO', 'Triggering n8n workflow for processing');
    
    const n8nPromises = processedFiles.map((file, index) => 
      triggerN8nWorkflow({
        processId,
        fileId: uploadResults[index].fileId,
        fileName: uploadResults[index].fileName,
        partNumber: index + 1,
        totalParts: processedFiles.length,
        startPage: file.startPage,
        endPage: file.endPage,
        modelId: metadata.model_id,
        docCategory: metadata.doc_category,
        sessionId: metadata.session_id
      })
    );
    
    const n8nResults = await Promise.all(n8nPromises);
    
    console.log('n8n workflow processing completed');
    await logProcessing(processId, 'INFO', 'n8n workflow processing completed');
    
    // Step 5: Consolidate results if multiple parts
    let finalResults;
    if (processedFiles.length > 1) {
      console.log('Consolidating results from multiple parts...');
      await logProcessing(processId, 'INFO', 'Consolidating results from multiple parts');
      
      finalResults = await consolidateResults(n8nResults, metadata);
    } else {
      finalResults = n8nResults[0];
    }
    
    // Step 6: Generate output files (CSV and JSON)
    console.log('Generating output files...');
    await logProcessing(processId, 'INFO', 'Generating CSV and JSON output files');
    
    const resultsDir = process.env.RESULTS_DIR || './results';
    await fs.mkdir(resultsDir, { recursive: true });
    
    const baseName = path.parse(metadata.original_filename).name;
    const suffix = processedFiles.length > 1 ? '_consolidated' : '';
    const timestamp = moment().format('YYYYMMDD_HHmmss');
    
    const csvPath = path.join(resultsDir, `${baseName}${suffix}_${timestamp}.csv`);
    const jsonPath = path.join(resultsDir, `${baseName}${suffix}_${timestamp}.json`);
    
    // Generate JSON
    const jsonData = generateJSON(finalResults, {
      input_file: metadata.original_filename,
      session_id: metadata.session_id,
      processing_id: processId.toString()
    });
    await fs.writeFile(jsonPath, JSON.stringify(jsonData, null, 2));
    
    // Generate CSV
    const csvData = generateCSV(finalResults, metadata.session_id, processId.toString());
    await fs.writeFile(csvPath, csvData);
    
    console.log('Output files generated');
    await logProcessing(processId, 'INFO', 'Output files generated successfully');
    
    // Step 7: Upload results to Google Drive
    console.log('Uploading results to Google Drive...');
    await logProcessing(processId, 'INFO', 'Uploading results to Google Drive');
    
    const csvUpload = await uploadToGoogleDrive(csvPath, `${baseName}${suffix}.csv`, processId, true);
    const jsonUpload = await uploadToGoogleDrive(jsonPath, `${baseName}${suffix}.json`, processId, true);
    
    // Step 8: Update database with final status
    const endTime = Date.now();
    const processingTime = Math.floor((endTime - startTime) / 1000);
    
    await query(
      `UPDATE document_processed 
       SET processing_status = 'Processed',
           time_finished = NOW(),
           total_processing_time = ?,
           link_to_csv = ?,
           link_to_json = ?
       WHERE process_id = ?`,
      [processingTime, csvPath, jsonPath, processId]
    );
    
    console.log(`Processing completed in ${processingTime} seconds`);
    await logProcessing(processId, 'INFO', `Processing completed successfully in ${processingTime} seconds`);
    
    // Cleanup temporary files
    if (processedFiles.length > 1) {
      for (const file of processedFiles) {
        if (file.path !== filePath) {
          await fs.unlink(file.path).catch(() => {});
        }
      }
    }
    
    return { success: true, processId };
    
  } catch (error) {
    console.error(`Processing error for document ${processId}:`, error);
    
    await logProcessing(processId, 'ERROR', `Processing failed: ${error.message}`);
    
    await query(
      `UPDATE document_processed 
       SET processing_status = 'Failed',
           time_finished = NOW(),
           error_message = ?
       WHERE process_id = ?`,
      [error.message, processId]
    );
    
    throw error;
  }
}

// Split PDF into smaller chunks
async function splitPDF(filePath, pageLimit, processId) {
  const pdfBytes = await fs.readFile(filePath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const totalPages = pdfDoc.getPageCount();
  
  const splitFiles = [];
  const tempDir = process.env.TEMP_DIR || './temp';
  await fs.mkdir(tempDir, { recursive: true });
  
  const baseName = path.parse(filePath).name;
  const numParts = Math.ceil(totalPages / pageLimit);
  
  for (let i = 0; i < numParts; i++) {
    const startPage = i * pageLimit;
    const endPage = Math.min(startPage + pageLimit, totalPages);
    
    // Create new PDF document for this chunk
    const chunkDoc = await PDFDocument.create();
    
    // Copy pages to the chunk
    for (let pageNum = startPage; pageNum < endPage; pageNum++) {
      const [copiedPage] = await chunkDoc.copyPages(pdfDoc, [pageNum]);
      chunkDoc.addPage(copiedPage);
    }
    
    // Save chunk
    const chunkBytes = await chunkDoc.save();
    const chunkPath = path.join(tempDir, `${baseName}_part${i + 1}_of_${numParts}.pdf`);
    await fs.writeFile(chunkPath, chunkBytes);
    
    splitFiles.push({
      path: chunkPath,
      startPage: startPage + 1,  // 1-indexed for user display
      endPage: endPage
    });
  }
  
  return splitFiles;
}

// Trigger n8n workflow (or use mock data if disabled)
async function triggerN8nWorkflow(data) {
  try {
    // Check if n8n is enabled
    if (process.env.ENABLE_N8N !== 'true') {
      console.log('ℹ️  n8n integration is DISABLED, using mock data for testing');
      // Return mock extraction data
      return generateMockExtractionData(data);
    }
    
    const n8nUrl = process.env.N8N_WEBHOOK_URL;
    
    if (!n8nUrl) {
      throw new Error('N8N_WEBHOOK_URL not configured');
    }
    
    const response = await axios.post(n8nUrl, data, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 300000  // 5 minutes timeout
    });
    
    return response.data;
  } catch (error) {
    console.error('n8n workflow error:', error.message);
    throw new Error(`Failed to trigger n8n workflow: ${error.message}`);
  }
}

// Generate mock extraction data for testing (when n8n is disabled)
function generateMockExtractionData(data) {
  const pageCount = data.endPage - data.startPage + 1;
  const results = [];
  
  for (let i = 0; i < pageCount; i++) {
    results.push({
      Original_Page_No: data.startPage + i,
      EOB_Page_No: i + 1,
      Patient_Name: `Test Patient ${i + 1}`,
      Provider_Name: `Test Provider ${i + 1}`,
      Service_Date: `2024-01-${String(i + 1).padStart(2, '0')}`,
      Billed_Amount: (Math.random() * 1000 + 100).toFixed(2),
      Allowed_Amount: (Math.random() * 800 + 80).toFixed(2),
      Paid_Amount: (Math.random() * 600 + 50).toFixed(2),
      Patient_Responsibility: (Math.random() * 200 + 20).toFixed(2),
      Claim_Number: `CLM${String(10000 + i).padStart(8, '0')}`,
      Service_Code: `99${String(200 + i).padStart(3, '0')}`,
      Status: 'Paid'
    });
  }
  
  return {
    results,
    errors: [],
    metadata: {
      processId: data.processId,
      fileName: data.fileName,
      partNumber: data.partNumber,
      totalParts: data.totalParts,
      extractedCount: results.length
    }
  };
}

// Consolidate results from multiple parts
async function consolidateResults(results, metadata) {
  const consolidated = {
    results: [],
    errors: []
  };
  
  let currentPageOffset = 0;
  
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    
    if (result.results && Array.isArray(result.results)) {
      // Adjust page numbers based on the offset
      const adjustedResults = result.results.map(record => ({
        ...record,
        Original_Page_No: (record.Original_Page_No || record.Page_No || 0) + currentPageOffset,
        EOB_Page_No: record.EOB_Page_No || record.Original_Page_No || 0
      }));
      
      consolidated.results.push(...adjustedResults);
    }
    
    if (result.errors && Array.isArray(result.errors)) {
      // Adjust error page numbers
      const adjustedErrors = result.errors.map(error => ({
        ...error,
        page: error.page ? error.page + currentPageOffset : null
      }));
      
      consolidated.errors.push(...adjustedErrors);
    }
    
    // Update offset for next part
    const partPageCount = result.results ? result.results.length : 0;
    currentPageOffset += partPageCount;
  }
  
  return consolidated;
}

// Log processing activity
async function logProcessing(processId, level, message, details = null) {
  try {
    await query(
      'INSERT INTO processing_logs (process_id, log_level, log_message, log_details) VALUES (?, ?, ?, ?)',
      [processId, level, message, details ? JSON.stringify(details) : null]
    );
  } catch (error) {
    console.error('Failed to log processing activity:', error);
  }
}

// Get processing progress (for real-time updates)
async function getProcessingProgress(processId) {
  try {
    const results = await query(
      'SELECT processing_status, no_of_pages, time_initiated FROM document_processed WHERE process_id = ?',
      [processId]
    );
    
    if (results.length === 0) {
      return null;
    }
    
    const logs = await query(
      'SELECT * FROM processing_logs WHERE process_id = ? ORDER BY created_at DESC LIMIT 10',
      [processId]
    );
    
    return {
      ...results[0],
      recent_logs: logs
    };
  } catch (error) {
    console.error('Error getting processing progress:', error);
    return null;
  }
}

module.exports = {
  processDocument,
  getProcessingProgress,
  splitPDF,
  consolidateResults
};
