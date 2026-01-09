const { stringify } = require('csv-stringify/sync');
const { query } = require('../config/database');

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
  formatWithProfile,
  applyTransform
};
