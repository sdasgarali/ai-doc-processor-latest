const { stringify } = require('csv-stringify/sync');
const { query } = require('../config/database');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, HeadingLevel, BorderStyle } = require('docx');

// Standard EOB field order (first 25 columns) - FALLBACK when no profile
const STANDARD_FIELDS = [
  'Page_No',
  'patient_acct',
  'Patient_ID',
  'Claim_ID',
  'Patient_Name',
  'First_Name',
  'Last_Name',
  'member_number',
  'service_date',
  'allowed_amount',
  'interest_amount',
  'paid_amount',
  'insurance_co',
  'billed_amount',
  'cpt_hcpcs',
  'adj_co45',
  'adj_co144',
  'adj_co253',
  'check_number',
  'account_number',
  'patient_responsibility',
  'claim_summary',
  'action_required',
  'reason_code_comments',
  'Confidence_Score'
];

// Generate JSON output according to schema
function generateJSON(extractedData, metadata) {
  const jsonOutput = {
    input_file: metadata.input_file,
    session_id: metadata.session_id,
    processing_id: metadata.processing_id,
    results: [],
    errors: []
  };

  // Process results
  if (extractedData.results && Array.isArray(extractedData.results)) {
    jsonOutput.results = extractedData.results.map(record => {
      const formattedRecord = {
        Original_Page_No: record.Original_Page_No || record.Page_No || 0,
        EOB_Page_No: record.EOB_Page_No || record.Original_Page_No || 0
      };

      // Add standard fields
      STANDARD_FIELDS.slice(1).forEach(field => {
        // Skip Page_No since we use Original_Page_No
        if (field === 'Page_No') return;
        
        const value = record[field];
        
        // Type conversion based on field
        if (['allowed_amount', 'interest_amount', 'paid_amount', 'billed_amount', 
             'adj_co45', 'adj_co144', 'adj_co253', 'patient_responsibility', 
             'Confidence_Score'].includes(field)) {
          formattedRecord[field] = value !== undefined && value !== null && value !== '' 
            ? parseFloat(value) || 0 
            : 0;
        } else {
          formattedRecord[field] = value !== undefined && value !== null ? String(value) : '';
        }
      });

      // Add any dynamic fields not in standard list
      Object.keys(record).forEach(key => {
        if (!STANDARD_FIELDS.includes(key) && 
            !['Original_Page_No', 'EOB_Page_No', 'Page_No'].includes(key)) {
          formattedRecord[key] = record[key];
        }
      });

      return formattedRecord;
    });
  }

  // Process errors
  if (extractedData.errors && Array.isArray(extractedData.errors)) {
    jsonOutput.errors = extractedData.errors.map(error => ({
      page: error.page || null,
      error: error.error || error.message || 'Unknown error',
      ...error  // Include any additional error fields
    }));
  }

  return jsonOutput;
}

// Generate CSV output according to schema
function generateCSV(extractedData, sessionId, processingId) {
  const records = [];
  
  // Add metadata rows at the top
  records.push(['Session ID:', sessionId]);
  records.push(['Processing ID:', processingId]);
  records.push([]);  // Empty row separator

  // Determine all field names (standard + dynamic)
  let allFields = [...STANDARD_FIELDS];
  const dynamicFields = new Set();

  if (extractedData.results && Array.isArray(extractedData.results)) {
    extractedData.results.forEach(record => {
      Object.keys(record).forEach(key => {
        if (!STANDARD_FIELDS.includes(key) && 
            !['Original_Page_No', 'EOB_Page_No'].includes(key)) {
          dynamicFields.add(key);
        }
      });
    });
  }

  // Add dynamic fields before Error column
  if (dynamicFields.size > 0) {
    allFields = [...STANDARD_FIELDS, ...Array.from(dynamicFields)];
  }

  // Add Error column at the end
  allFields.push('Error');

  // Add header row
  records.push(allFields);

  // Add data rows
  if (extractedData.results && Array.isArray(extractedData.results)) {
    extractedData.results.forEach((record, index) => {
      const row = allFields.map(field => {
        if (field === 'Page_No') {
          return record.Original_Page_No || record.Page_No || '';
        }
        
        if (field === 'Error') {
          // Check if there's an error for this record
          const error = extractedData.errors?.find(e => 
            e.page === (record.Original_Page_No || record.Page_No)
          );
          return error ? error.error || error.message || '' : '';
        }

        const value = record[field];
        
        // Format values appropriately
        if (value === null || value === undefined) {
          return '';
        }
        
        // Handle numeric fields
        if (['allowed_amount', 'interest_amount', 'paid_amount', 'billed_amount', 
             'adj_co45', 'adj_co144', 'adj_co253', 'patient_responsibility'].includes(field)) {
          return value !== '' ? parseFloat(value) || 0 : 0;
        }
        
        // Handle confidence score (can be 0-1 or 0-100)
        if (field === 'Confidence_Score') {
          const score = parseFloat(value) || 0;
          return score;
        }
        
        return String(value);
      });

      records.push(row);
    });
  }

  // Add global errors (not associated with specific pages) as separate rows
  if (extractedData.errors && Array.isArray(extractedData.errors)) {
    extractedData.errors
      .filter(error => !error.page)
      .forEach(error => {
        const errorRow = allFields.map(field => {
          if (field === 'Error') {
            return error.error || error.message || 'Unknown error';
          }
          return '';
        });
        records.push(errorRow);
      });
  }

  // Generate CSV with proper escaping
  return stringify(records, {
    quoted: true,
    quoted_empty: false,
    escape: '"',
    record_delimiter: 'unix'
  });
}

// Validate extracted data structure
function validateExtractedData(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    errors.push('Data must be an object');
    return { isValid: false, errors };
  }

  if (!Array.isArray(data.results)) {
    errors.push('results must be an array');
  }

  if (data.errors && !Array.isArray(data.errors)) {
    errors.push('errors must be an array if present');
  }

  // Validate each result record
  if (Array.isArray(data.results)) {
    data.results.forEach((record, index) => {
      if (typeof record !== 'object') {
        errors.push(`Result at index ${index} must be an object`);
      }
      
      // Check for required page number
      if (!record.Original_Page_No && !record.Page_No) {
        errors.push(`Result at index ${index} missing page number`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// Format date to YYYY-MM-DD
function formatDate(dateString) {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    return dateString;
  }
}

// Sanitize field value for CSV
function sanitizeForCSV(value) {
  if (value === null || value === undefined) return '';
  
  const stringValue = String(value);
  
  // If contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  
  return stringValue;
}

// Parse confidence score (handle both 0-1 and 0-100 formats)
function parseConfidenceScore(score) {
  const numScore = parseFloat(score);
  
  if (isNaN(numScore)) return 0;
  
  // If score is > 1, assume it's in percentage (0-100)
  // Otherwise assume it's probability (0-1)
  return numScore;
}

// Merge multiple extraction results (for consolidated PDFs)
function mergeExtractionResults(results, adjustPageNumbers = true) {
  const merged = {
    results: [],
    errors: []
  };

  let pageOffset = 0;

  results.forEach((result, partIndex) => {
    if (result.results && Array.isArray(result.results)) {
      const adjustedResults = result.results.map(record => {
        if (adjustPageNumbers) {
          return {
            ...record,
            Original_Page_No: (record.Original_Page_No || record.Page_No || 0) + pageOffset,
            EOB_Page_No: record.EOB_Page_No || record.Original_Page_No || 0
          };
        }
        return record;
      });

      merged.results.push(...adjustedResults);
      pageOffset += result.results.length;
    }

    if (result.errors && Array.isArray(result.errors)) {
      const adjustedErrors = result.errors.map(error => {
        if (adjustPageNumbers && error.page) {
          return {
            ...error,
            page: error.page + pageOffset
          };
        }
        return error;
      });

      merged.errors.push(...adjustedErrors);
    }
  });

  return merged;
}

// ==================== OUTPUT PROFILE INTEGRATION ====================

/**
 * Get effective output profile for client and category
 * Falls back to default profile if no client-specific profile exists
 */
async function getEffectiveProfile(clientId, categoryId) {
  try {
    // Try client-specific profile first
    let profile = await query(`
      SELECT op.*, dc.category_name
      FROM output_profile op
      LEFT JOIN doc_category dc ON op.doc_category_id = dc.category_id
      WHERE op.client_id = ? AND op.doc_category_id = ? AND op.is_active = TRUE
    `, [clientId, categoryId]);

    // Fallback to default profile
    if (profile.length === 0) {
      profile = await query(`
        SELECT op.*, dc.category_name
        FROM output_profile op
        LEFT JOIN doc_category dc ON op.doc_category_id = dc.category_id
        WHERE op.doc_category_id = ? AND op.is_default = TRUE AND op.is_active = TRUE
      `, [categoryId]);
    }

    if (profile.length === 0) {
      return null;
    }

    // Get profile fields
    const fields = await query(`
      SELECT opf.*, ft.field_name, ft.field_display_name, ft.field_type
      FROM output_profile_field opf
      JOIN field_table ft ON opf.field_id = ft.field_id
      WHERE opf.profile_id = ? AND opf.is_included = TRUE
      ORDER BY opf.field_order ASC
    `, [profile[0].profile_id]);

    return {
      ...profile[0],
      fields
    };
  } catch (error) {
    console.error('Error fetching effective profile:', error);
    return null;
  }
}

/**
 * Apply transformation to a field value based on profile configuration
 */
function applyTransform(value, transformType, transformConfig) {
  if (value === null || value === undefined || value === '') {
    return value;
  }

  const stringValue = String(value);

  switch (transformType) {
    case 'uppercase':
      return stringValue.toUpperCase();
    case 'lowercase':
      return stringValue.toLowerCase();
    case 'titlecase':
      return stringValue.replace(/\w\S*/g, txt =>
        txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
      );
    case 'prefix':
      return (transformConfig?.prefix || '') + stringValue;
    case 'suffix':
      return stringValue + (transformConfig?.suffix || '');
    case 'date_format':
      return formatDateCustom(value, transformConfig?.format || 'YYYY-MM-DD');
    case 'number_format':
      return formatNumber(value, transformConfig?.format || '0.00');
    case 'currency':
      return formatCurrency(value, transformConfig?.symbol || '$', transformConfig?.decimals || 2);
    case 'regex_replace':
      if (transformConfig?.pattern && transformConfig?.replacement !== undefined) {
        try {
          const regex = new RegExp(transformConfig.pattern, transformConfig.flags || 'g');
          return stringValue.replace(regex, transformConfig.replacement);
        } catch (e) {
          return stringValue;
        }
      }
      return stringValue;
    case 'none':
    default:
      return value;
  }
}

/**
 * Format date according to custom format string
 */
function formatDateCustom(value, format) {
  if (!value) return '';

  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return format
      .replace('YYYY', year)
      .replace('MM', month)
      .replace('DD', day)
      .replace('M', date.getMonth() + 1)
      .replace('D', date.getDate());
  } catch (e) {
    return value;
  }
}

/**
 * Format number according to format string
 */
function formatNumber(value, format) {
  const num = parseFloat(value);
  if (isNaN(num)) return value;

  // Determine decimal places from format (e.g., "0.00" = 2 decimals)
  const decimals = (format.split('.')[1] || '').length;
  return num.toFixed(decimals);
}

/**
 * Format as currency
 */
function formatCurrency(value, symbol, decimals) {
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return symbol + num.toFixed(decimals);
}

/**
 * Generate JSON output using output profile
 */
async function generateJSONWithProfile(extractedData, metadata, clientId = null) {
  const profile = clientId && metadata.categoryId
    ? await getEffectiveProfile(clientId, metadata.categoryId)
    : null;

  // If no profile found, use standard generation
  if (!profile || !profile.fields || profile.fields.length === 0) {
    return generateJSON(extractedData, metadata);
  }

  const jsonOutput = {
    input_file: metadata.input_file,
    session_id: metadata.session_id,
    processing_id: metadata.processing_id,
    profile_used: profile.profile_name,
    profile_type: profile.is_default ? 'default' : 'client-specific',
    results: [],
    errors: []
  };

  if (extractedData.results && Array.isArray(extractedData.results)) {
    jsonOutput.results = extractedData.results.map(record => {
      const formattedRecord = {};

      profile.fields.forEach(field => {
        const outputLabel = field.custom_label || field.field_display_name || field.field_name;
        let value = record[field.field_name];

        // Apply default value if empty
        if ((value === null || value === undefined || value === '') && field.default_value) {
          value = field.default_value;
        }

        // Apply transformation
        if (field.transform_type && field.transform_type !== 'none') {
          const config = field.transform_config ? JSON.parse(field.transform_config) : {};
          value = applyTransform(value, field.transform_type, config);
        }

        // Apply null value from profile settings
        if (value === null || value === undefined || value === '') {
          value = profile.null_value || '';
        }

        formattedRecord[outputLabel] = value;
      });

      return formattedRecord;
    });
  }

  if (extractedData.errors && Array.isArray(extractedData.errors)) {
    jsonOutput.errors = extractedData.errors;
  }

  return jsonOutput;
}

/**
 * Generate CSV output using output profile
 */
async function generateCSVWithProfile(extractedData, metadata, clientId = null) {
  const profile = clientId && metadata.categoryId
    ? await getEffectiveProfile(clientId, metadata.categoryId)
    : null;

  // If no profile found, use standard generation
  if (!profile || !profile.fields || profile.fields.length === 0) {
    return generateCSV(extractedData, metadata.session_id, metadata.processing_id);
  }

  const records = [];

  // Add metadata rows at top
  records.push(['Session ID:', metadata.session_id]);
  records.push(['Processing ID:', metadata.processing_id]);
  records.push(['Profile:', profile.profile_name]);
  records.push([]);

  // Build header row from profile fields
  const headers = profile.include_header !== false
    ? profile.fields.map(f => f.custom_label || f.field_display_name || f.field_name)
    : [];

  if (headers.length > 0) {
    headers.push('Error');
    records.push(headers);
  }

  // Add data rows
  if (extractedData.results && Array.isArray(extractedData.results)) {
    extractedData.results.forEach(record => {
      const row = profile.fields.map(field => {
        let value = record[field.field_name];

        // Apply default value
        if ((value === null || value === undefined || value === '') && field.default_value) {
          value = field.default_value;
        }

        // Apply transformation
        if (field.transform_type && field.transform_type !== 'none') {
          const config = field.transform_config ? JSON.parse(field.transform_config) : {};
          value = applyTransform(value, field.transform_type, config);
        }

        // Apply null value
        if (value === null || value === undefined || value === '') {
          value = profile.null_value || '';
        }

        return value;
      });

      // Add error column
      const error = extractedData.errors?.find(e =>
        e.page === (record.Original_Page_No || record.Page_No)
      );
      row.push(error ? error.error || error.message || '' : '');

      records.push(row);
    });
  }

  // Generate CSV with profile settings
  return stringify(records, {
    quoted: true,
    quoted_empty: false,
    escape: profile.csv_quote_char || '"',
    delimiter: profile.csv_delimiter || ',',
    record_delimiter: 'unix'
  });
}

/**
 * Generate Excel (XLSX) output using output profile
 */
async function generateXLSXWithProfile(extractedData, metadata, clientId = null) {
  const profile = clientId && metadata.categoryId
    ? await getEffectiveProfile(clientId, metadata.categoryId)
    : null;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EOB Extraction System';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Extracted Data');

  // Add metadata
  worksheet.addRow(['Session ID:', metadata.session_id]);
  worksheet.addRow(['Processing ID:', metadata.processing_id]);
  worksheet.addRow(['Input File:', metadata.input_file || '']);
  if (profile) {
    worksheet.addRow(['Profile:', profile.profile_name]);
  }
  worksheet.addRow([]); // Empty row separator

  // Determine fields to use
  const fields = profile?.fields?.length > 0
    ? profile.fields
    : STANDARD_FIELDS.map(f => ({ field_name: f, field_display_name: f }));

  // Add header row with styling
  const headers = fields.map(f => f.custom_label || f.field_display_name || f.field_name);
  headers.push('Error');
  const headerRow = worksheet.addRow(headers);

  // Style header row
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });

  // Add data rows
  if (extractedData.results && Array.isArray(extractedData.results)) {
    extractedData.results.forEach(record => {
      const rowData = fields.map(field => {
        let value = record[field.field_name];

        // Apply default value
        if ((value === null || value === undefined || value === '') && field.default_value) {
          value = field.default_value;
        }

        // Apply transformation
        if (field.transform_type && field.transform_type !== 'none') {
          const config = field.transform_config ? JSON.parse(field.transform_config) : {};
          value = applyTransform(value, field.transform_type, config);
        }

        // Apply null value
        if (value === null || value === undefined || value === '') {
          value = profile?.null_value || '';
        }

        return value;
      });

      // Add error column
      const error = extractedData.errors?.find(e =>
        e.page === (record.Original_Page_No || record.Page_No)
      );
      rowData.push(error ? error.error || error.message || '' : '');

      const dataRow = worksheet.addRow(rowData);
      dataRow.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });
  }

  // Auto-fit columns
  worksheet.columns.forEach(column => {
    let maxLength = 0;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const columnLength = cell.value ? cell.value.toString().length : 10;
      if (columnLength > maxLength) {
        maxLength = columnLength;
      }
    });
    column.width = Math.min(maxLength + 2, 50);
  });

  // Return buffer
  return await workbook.xlsx.writeBuffer();
}

/**
 * Generate PDF output using output profile
 */
async function generatePDFWithProfile(extractedData, metadata, clientId = null) {
  const profile = clientId && metadata.categoryId
    ? await getEffectiveProfile(clientId, metadata.categoryId)
    : null;

  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ margin: 50, size: 'A4', layout: 'landscape' });

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Title
    doc.fontSize(18).font('Helvetica-Bold').text('Document Extraction Report', { align: 'center' });
    doc.moveDown();

    // Metadata
    doc.fontSize(10).font('Helvetica');
    doc.text(`Session ID: ${metadata.session_id}`);
    doc.text(`Processing ID: ${metadata.processing_id}`);
    doc.text(`Input File: ${metadata.input_file || 'N/A'}`);
    if (profile) {
      doc.text(`Profile: ${profile.profile_name}`);
    }
    doc.text(`Generated: ${new Date().toISOString()}`);
    doc.moveDown();

    // Determine fields
    const fields = profile?.fields?.length > 0
      ? profile.fields
      : STANDARD_FIELDS.slice(0, 10).map(f => ({ field_name: f, field_display_name: f }));

    // Table header
    doc.fontSize(8).font('Helvetica-Bold');
    const headers = fields.map(f => f.custom_label || f.field_display_name || f.field_name);

    // Calculate column widths
    const pageWidth = doc.page.width - 100;
    const colWidth = Math.min(pageWidth / headers.length, 100);
    const startX = 50;
    let currentY = doc.y;

    // Draw header row
    headers.forEach((header, i) => {
      doc.text(header.substring(0, 15), startX + (i * colWidth), currentY, { width: colWidth - 5, align: 'left' });
    });

    currentY += 15;
    doc.moveTo(startX, currentY).lineTo(startX + (headers.length * colWidth), currentY).stroke();
    currentY += 5;

    // Draw data rows
    doc.font('Helvetica').fontSize(7);
    if (extractedData.results && Array.isArray(extractedData.results)) {
      extractedData.results.forEach((record, rowIndex) => {
        // Check for page break
        if (currentY > doc.page.height - 100) {
          doc.addPage();
          currentY = 50;
        }

        fields.forEach((field, i) => {
          let value = record[field.field_name];

          if ((value === null || value === undefined || value === '') && field.default_value) {
            value = field.default_value;
          }

          if (field.transform_type && field.transform_type !== 'none') {
            const config = field.transform_config ? JSON.parse(field.transform_config) : {};
            value = applyTransform(value, field.transform_type, config);
          }

          if (value === null || value === undefined || value === '') {
            value = profile?.null_value || '';
          }

          const displayValue = String(value).substring(0, 20);
          doc.text(displayValue, startX + (i * colWidth), currentY, { width: colWidth - 5, align: 'left' });
        });

        currentY += 12;
      });
    }

    // Summary
    doc.moveDown(2);
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text(`Total Records: ${extractedData.results?.length || 0}`, 50, currentY + 20);
    doc.text(`Errors: ${extractedData.errors?.length || 0}`);

    doc.end();
  });
}

/**
 * Generate Word (DOCX) output using output profile
 */
async function generateDOCXWithProfile(extractedData, metadata, clientId = null) {
  const profile = clientId && metadata.categoryId
    ? await getEffectiveProfile(clientId, metadata.categoryId)
    : null;

  // Determine fields
  const fields = profile?.fields?.length > 0
    ? profile.fields
    : STANDARD_FIELDS.slice(0, 15).map(f => ({ field_name: f, field_display_name: f }));

  const headers = fields.map(f => f.custom_label || f.field_display_name || f.field_name);

  // Build table rows
  const tableRows = [];

  // Header row
  tableRows.push(
    new TableRow({
      children: headers.map(header =>
        new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text: header, bold: true, size: 20 })]
          })],
          shading: { fill: '4472C4' }
        })
      )
    })
  );

  // Data rows
  if (extractedData.results && Array.isArray(extractedData.results)) {
    extractedData.results.forEach(record => {
      const rowCells = fields.map(field => {
        let value = record[field.field_name];

        if ((value === null || value === undefined || value === '') && field.default_value) {
          value = field.default_value;
        }

        if (field.transform_type && field.transform_type !== 'none') {
          const config = field.transform_config ? JSON.parse(field.transform_config) : {};
          value = applyTransform(value, field.transform_type, config);
        }

        if (value === null || value === undefined || value === '') {
          value = profile?.null_value || '';
        }

        return new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text: String(value), size: 18 })]
          })]
        });
      });

      tableRows.push(new TableRow({ children: rowCells }));
    });
  }

  // Create document
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          children: [new TextRun({ text: 'Document Extraction Report', bold: true, size: 36 })],
          heading: HeadingLevel.HEADING_1
        }),
        new Paragraph({
          children: [new TextRun({ text: `Session ID: ${metadata.session_id}`, size: 22 })]
        }),
        new Paragraph({
          children: [new TextRun({ text: `Processing ID: ${metadata.processing_id}`, size: 22 })]
        }),
        new Paragraph({
          children: [new TextRun({ text: `Input File: ${metadata.input_file || 'N/A'}`, size: 22 })]
        }),
        ...(profile ? [new Paragraph({
          children: [new TextRun({ text: `Profile: ${profile.profile_name}`, size: 22 })]
        })] : []),
        new Paragraph({
          children: [new TextRun({ text: `Generated: ${new Date().toISOString()}`, size: 22 })]
        }),
        new Paragraph({ children: [] }), // Spacer
        new Table({
          rows: tableRows,
          width: { size: 100, type: 'pct' }
        }),
        new Paragraph({ children: [] }), // Spacer
        new Paragraph({
          children: [
            new TextRun({ text: `Total Records: ${extractedData.results?.length || 0}`, size: 22, bold: true })
          ]
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `Errors: ${extractedData.errors?.length || 0}`, size: 22 })
          ]
        })
      ]
    }]
  });

  return await Packer.toBuffer(doc);
}

/**
 * Generate plain text (TXT) output using output profile
 */
async function generateTXTWithProfile(extractedData, metadata, clientId = null) {
  const profile = clientId && metadata.categoryId
    ? await getEffectiveProfile(clientId, metadata.categoryId)
    : null;

  const lines = [];

  // Header
  lines.push('=' .repeat(80));
  lines.push('DOCUMENT EXTRACTION REPORT');
  lines.push('=' .repeat(80));
  lines.push('');
  lines.push(`Session ID:    ${metadata.session_id}`);
  lines.push(`Processing ID: ${metadata.processing_id}`);
  lines.push(`Input File:    ${metadata.input_file || 'N/A'}`);
  if (profile) {
    lines.push(`Profile:       ${profile.profile_name}`);
  }
  lines.push(`Generated:     ${new Date().toISOString()}`);
  lines.push('');
  lines.push('-'.repeat(80));
  lines.push('');

  // Determine fields
  const fields = profile?.fields?.length > 0
    ? profile.fields
    : STANDARD_FIELDS.map(f => ({ field_name: f, field_display_name: f }));

  // Data records
  if (extractedData.results && Array.isArray(extractedData.results)) {
    extractedData.results.forEach((record, index) => {
      lines.push(`RECORD ${index + 1}`);
      lines.push('-'.repeat(40));

      fields.forEach(field => {
        let value = record[field.field_name];

        if ((value === null || value === undefined || value === '') && field.default_value) {
          value = field.default_value;
        }

        if (field.transform_type && field.transform_type !== 'none') {
          const config = field.transform_config ? JSON.parse(field.transform_config) : {};
          value = applyTransform(value, field.transform_type, config);
        }

        if (value === null || value === undefined || value === '') {
          value = profile?.null_value || 'N/A';
        }

        const label = (field.custom_label || field.field_display_name || field.field_name).padEnd(25);
        lines.push(`${label}: ${value}`);
      });

      // Check for errors
      const error = extractedData.errors?.find(e =>
        e.page === (record.Original_Page_No || record.Page_No)
      );
      if (error) {
        lines.push(`${'Error'.padEnd(25)}: ${error.error || error.message}`);
      }

      lines.push('');
    });
  }

  // Summary
  lines.push('='.repeat(80));
  lines.push('SUMMARY');
  lines.push('='.repeat(80));
  lines.push(`Total Records: ${extractedData.results?.length || 0}`);
  lines.push(`Total Errors:  ${extractedData.errors?.length || 0}`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Generate XML output using output profile
 */
async function generateXMLWithProfile(extractedData, metadata, clientId = null) {
  const profile = clientId && metadata.categoryId
    ? await getEffectiveProfile(clientId, metadata.categoryId)
    : null;

  const escapeXML = (str) => {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const lines = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<ExtractionReport>');
  lines.push('  <Metadata>');
  lines.push(`    <SessionId>${escapeXML(metadata.session_id)}</SessionId>`);
  lines.push(`    <ProcessingId>${escapeXML(metadata.processing_id)}</ProcessingId>`);
  lines.push(`    <InputFile>${escapeXML(metadata.input_file || '')}</InputFile>`);
  if (profile) {
    lines.push(`    <Profile>${escapeXML(profile.profile_name)}</Profile>`);
  }
  lines.push(`    <Generated>${new Date().toISOString()}</Generated>`);
  lines.push('  </Metadata>');

  // Determine fields
  const fields = profile?.fields?.length > 0
    ? profile.fields
    : STANDARD_FIELDS.map(f => ({ field_name: f, field_display_name: f }));

  lines.push('  <Results>');

  if (extractedData.results && Array.isArray(extractedData.results)) {
    extractedData.results.forEach((record, index) => {
      lines.push(`    <Record index="${index + 1}">`);

      fields.forEach(field => {
        let value = record[field.field_name];

        if ((value === null || value === undefined || value === '') && field.default_value) {
          value = field.default_value;
        }

        if (field.transform_type && field.transform_type !== 'none') {
          const config = field.transform_config ? JSON.parse(field.transform_config) : {};
          value = applyTransform(value, field.transform_type, config);
        }

        if (value === null || value === undefined || value === '') {
          value = profile?.null_value || '';
        }

        const tagName = field.field_name.replace(/[^a-zA-Z0-9_]/g, '_');
        lines.push(`      <${tagName}>${escapeXML(value)}</${tagName}>`);
      });

      // Check for errors
      const error = extractedData.errors?.find(e =>
        e.page === (record.Original_Page_No || record.Page_No)
      );
      if (error) {
        lines.push(`      <Error>${escapeXML(error.error || error.message)}</Error>`);
      }

      lines.push('    </Record>');
    });
  }

  lines.push('  </Results>');

  // Errors section
  if (extractedData.errors && extractedData.errors.length > 0) {
    lines.push('  <Errors>');
    extractedData.errors.forEach((error, index) => {
      lines.push(`    <Error index="${index + 1}">`);
      lines.push(`      <Page>${error.page || ''}</Page>`);
      lines.push(`      <Message>${escapeXML(error.error || error.message)}</Message>`);
      lines.push('    </Error>');
    });
    lines.push('  </Errors>');
  }

  lines.push('  <Summary>');
  lines.push(`    <TotalRecords>${extractedData.results?.length || 0}</TotalRecords>`);
  lines.push(`    <TotalErrors>${extractedData.errors?.length || 0}</TotalErrors>`);
  lines.push('  </Summary>');
  lines.push('</ExtractionReport>');

  return lines.join('\n');
}

/**
 * Format output based on profile output_format setting
 */
async function formatWithProfile(extractedData, metadata, clientId = null) {
  const profile = clientId && metadata.categoryId
    ? await getEffectiveProfile(clientId, metadata.categoryId)
    : null;

  const format = profile?.output_format || 'csv';

  switch (format) {
    case 'json':
      return {
        format: 'json',
        data: await generateJSONWithProfile(extractedData, metadata, clientId),
        contentType: 'application/json',
        extension: '.json'
      };
    case 'xlsx':
    case 'excel':
      return {
        format: 'xlsx',
        data: await generateXLSXWithProfile(extractedData, metadata, clientId),
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        extension: '.xlsx',
        isBinary: true
      };
    case 'pdf':
      return {
        format: 'pdf',
        data: await generatePDFWithProfile(extractedData, metadata, clientId),
        contentType: 'application/pdf',
        extension: '.pdf',
        isBinary: true
      };
    case 'docx':
    case 'doc':
      return {
        format: 'docx',
        data: await generateDOCXWithProfile(extractedData, metadata, clientId),
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        extension: '.docx',
        isBinary: true
      };
    case 'txt':
      return {
        format: 'txt',
        data: await generateTXTWithProfile(extractedData, metadata, clientId),
        contentType: 'text/plain',
        extension: '.txt'
      };
    case 'xml':
      return {
        format: 'xml',
        data: await generateXMLWithProfile(extractedData, metadata, clientId),
        contentType: 'application/xml',
        extension: '.xml'
      };
    case 'csv':
    default:
      return {
        format: 'csv',
        data: await generateCSVWithProfile(extractedData, metadata, clientId),
        contentType: 'text/csv',
        extension: '.csv'
      };
  }
}

module.exports = {
  generateJSON,
  generateCSV,
  validateExtractedData,
  formatDate,
  sanitizeForCSV,
  parseConfidenceScore,
  mergeExtractionResults,
  STANDARD_FIELDS,
  // Profile-aware exports
  getEffectiveProfile,
  generateJSONWithProfile,
  generateCSVWithProfile,
  generateXLSXWithProfile,
  generatePDFWithProfile,
  generateDOCXWithProfile,
  generateTXTWithProfile,
  generateXMLWithProfile,
  formatWithProfile,
  applyTransform
};
