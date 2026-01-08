require('dotenv').config();
const { query } = require('./config/database');

async function checkDownloadIssue() {
  try {
    console.log('🔍 Checking download issue for process_id=74...\n');

    const result = await query(
      'SELECT * FROM document_processed WHERE process_id = 74'
    );

    if (result.length === 0) {
      console.log('❌ No document found with process_id=74');
      return;
    }

    const doc = result[0];
    
    console.log('📄 Document Details:');
    console.log('─'.repeat(50));
    console.log('Process ID:', doc.process_id);
    console.log('Original Filename:', doc.original_filename);
    console.log('Doc Name:', doc.doc_name);
    console.log('Status:', doc.processing_status);
    console.log('Client ID:', doc.client_id);
    console.log('\n📁 File Paths:');
    console.log('─'.repeat(50));
    console.log('PDF (link_to_file):', doc.link_to_file || '❌ NULL');
    console.log('CSV (link_to_csv):', doc.link_to_csv || '❌ NULL');
    console.log('JSON (link_to_json):', doc.link_to_json || '❌ NULL');
    console.log('\n☁️  Google Drive IDs:');
    console.log('─'.repeat(50));
    console.log('File ID (gdrive_file_id):', doc.gdrive_file_id || '❌ NULL');
    console.log('JSON ID (json_drive_id):', doc.json_drive_id || '❌ NULL');
    console.log('CSV ID (csv_drive_id):', doc.csv_drive_id || '❌ NULL');
    console.log('\n⏱️  Processing Info:');
    console.log('─'.repeat(50));
    console.log('Time Initiated:', doc.time_initiated);
    console.log('Time Finished:', doc.time_finished || 'Not finished');
    console.log('Total Records:', doc.total_records);
    console.log('Pages:', doc.no_of_pages);
    console.log('Cost:', doc.cost);
    
    if (doc.error_message) {
      console.log('\n❌ Error Message:');
      console.log('─'.repeat(50));
      console.log(doc.error_message);
    }

    // Check if file exists on disk
    if (doc.link_to_file) {
      const fs = require('fs').promises;
      try {
        await fs.access(doc.link_to_file);
        console.log('\n✅ PDF file exists on disk');
      } catch (err) {
        console.log('\n❌ PDF file does NOT exist on disk');
        console.log('   Path:', doc.link_to_file);
      }
    }

    // Diagnostic recommendations
    console.log('\n💡 Recommendations:');
    console.log('─'.repeat(50));
    
    if (!doc.link_to_file && !doc.gdrive_file_id) {
      console.log('❌ ISSUE: No PDF file path or Google Drive ID found');
      console.log('   This document was never properly uploaded or the upload failed');
      console.log('   Solution: Re-upload the document');
    } else if (doc.gdrive_file_id && !doc.link_to_file) {
      console.log('⚠️  File is only on Google Drive (ID: ' + doc.gdrive_file_id + ')');
      console.log('   The backend should handle this, but the gdrive_file_id needs to be');
      console.log('   formatted as a Google Drive URL for the download endpoint to work.');
      console.log('   Solution: Update link_to_file with Google Drive URL or download from Drive');
    } else if (doc.link_to_file && !doc.link_to_file.includes('drive.google.com')) {
      console.log('⚠️  Local file path exists but file may be missing');
      console.log('   Solution: Check if file exists at:', doc.link_to_file);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkDownloadIssue();
