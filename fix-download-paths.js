require('dotenv').config();
const { query } = require('./config/database');

async function fixDownloadPaths() {
  try {
    console.log('🔧 Fixing download paths for documents with Google Drive IDs...\n');

    // Find all documents where link_to_file doesn't contain 'drive.google.com' but has a gdrive_file_id
    const result = await query(
      `SELECT process_id, original_filename, link_to_file, gdrive_file_id 
       FROM document_processed 
       WHERE gdrive_file_id IS NOT NULL 
       AND (link_to_file IS NULL OR link_to_file NOT LIKE '%drive.google.com%')`
    );

    if (result.length === 0) {
      console.log('✅ No documents need fixing');
      process.exit(0);
    }

    console.log(`Found ${result.length} document(s) to fix:\n`);

    for (const doc of result) {
      const googleDriveUrl = `https://drive.google.com/file/d/${doc.gdrive_file_id}/view?usp=drivesdk`;
      
      console.log(`📄 Process ID: ${doc.process_id}`);
      console.log(`   Filename: ${doc.original_filename}`);
      console.log(`   Old Path: ${doc.link_to_file || 'NULL'}`);
      console.log(`   New URL:  ${googleDriveUrl}`);
      
      await query(
        'UPDATE document_processed SET link_to_file = ? WHERE process_id = ?',
        [googleDriveUrl, doc.process_id]
      );
      
      console.log(`   ✅ Updated\n`);
    }

    console.log(`\n✅ Fixed ${result.length} document(s)`);
    console.log('Downloads should now work properly!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixDownloadPaths();
