// Load environment variables
require('dotenv').config();

const mysql = require('mysql2/promise');
const { downloadFromGoogleDrive } = require('./services/googleDrive');
const fs = require('fs').promises;
const path = require('path');

(async () => {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'AdminRootDBAli',
      database: 'eob_extraction'
    });

    console.log('✓ Connected to database');

    // Get all processed documents that don't have data in extracted_data table
    const [documents] = await connection.execute(`
      SELECT dp.process_id, dp.json_drive_id, dp.link_to_json, dp.total_records
      FROM document_processed dp
      WHERE dp.processing_status = 'Processed'
        AND dp.total_records > 0
        AND NOT EXISTS (
          SELECT 1 FROM extracted_data ed WHERE ed.process_id = dp.process_id
        )
    `);

    console.log(`\nFound ${documents.length} document(s) to migrate\n`);

    if (documents.length === 0) {
      console.log('No documents need migration. All done!');
      await connection.end();
      return;
    }

    const tempDir = path.join(__dirname, 'temp');
    await fs.mkdir(tempDir, { recursive: true });

    for (const doc of documents) {
      const { process_id, json_drive_id, link_to_json, total_records } = doc;

      console.log(`\n📄 Processing document: process_id=${process_id}, expected records=${total_records}`);

      try {
        let jsonData;

        // Download from Google Drive if we have the file ID
        if (json_drive_id) {
          const tempPath = path.join(tempDir, `${process_id}_migrate.json`);

          console.log(`  📥 Downloading from Google Drive (ID: ${json_drive_id})...`);
          await downloadFromGoogleDrive(json_drive_id, tempPath);
          jsonData = await fs.readFile(tempPath, 'utf8');
          await fs.unlink(tempPath).catch(() => {});

        } else if (link_to_json && link_to_json.includes('drive.google.com')) {
          // Extract file ID from URL
          const fileIdMatch = link_to_json.match(/\/d\/([a-zA-Z0-9_-]+)/);
          if (fileIdMatch) {
            const fileId = fileIdMatch[1];
            const tempPath = path.join(tempDir, `${process_id}_migrate.json`);

            console.log(`  📥 Downloading from Google Drive (extracted ID: ${fileId})...`);
            await downloadFromGoogleDrive(fileId, tempPath);
            jsonData = await fs.readFile(tempPath, 'utf8');
            await fs.unlink(tempPath).catch(() => {});
          } else {
            throw new Error('Could not extract file ID from Google Drive URL');
          }
        } else if (link_to_json) {
          // Try reading from local path
          console.log(`  📁 Reading from local file: ${link_to_json}`);
          jsonData = await fs.readFile(link_to_json, 'utf8');
        } else {
          throw new Error('No JSON file location available');
        }

        // Parse JSON
        const parsedData = JSON.parse(jsonData);
        // Try both 'data' and 'results' keys for compatibility
        const results = parsedData.data || parsedData.results || [];

        console.log(`  📊 Found ${results.length} records in JSON file`);

        if (results.length === 0) {
          console.log(`  ⚠️  No records found in JSON file`);
          continue;
        }

        // Insert records into extracted_data
        for (let i = 0; i < results.length; i++) {
          await connection.execute(
            'INSERT INTO extracted_data (process_id, row_data) VALUES (?, ?)',
            [process_id, JSON.stringify(results[i])]
          );
        }

        console.log(`  ✓ Inserted ${results.length} records into extracted_data table`);

        // Update total_records if it doesn't match
        if (results.length !== total_records) {
          await connection.execute(
            'UPDATE document_processed SET total_records = ? WHERE process_id = ?',
            [results.length, process_id]
          );
          console.log(`  ✓ Updated total_records from ${total_records} to ${results.length}`);
        }

      } catch (error) {
        console.error(`  ❌ Error migrating process_id ${process_id}:`, error.message);
      }
    }

    await connection.end();
    console.log('\n✅ Migration completed!');

  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
})();
