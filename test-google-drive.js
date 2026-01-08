const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function testGoogleDrive() {
  console.log('\n🔍 Testing Google Drive Integration...\n');
  
  try {
    // Check environment variables
    console.log('1. Checking environment variables:');
    console.log(`   SERVICE_ACCOUNT_KEY_PATH: ${process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || 'NOT SET'}`);
    console.log(`   CLIENT_ID: ${process.env.GOOGLE_CLIENT_ID ? 'SET' : 'NOT SET'}`);
    console.log(`   CLIENT_SECRET: ${process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'NOT SET'}`);
    console.log(`   FOLDER_SOURCE: ${process.env.GOOGLE_DRIVE_FOLDER_SOURCE || 'NOT SET'}`);
    
    // Try to load service account key
    console.log('\n2. Loading service account key...');
    const keyPath = path.resolve(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH);
    console.log(`   Key path: ${keyPath}`);
    
    if (!fs.existsSync(keyPath)) {
      console.error('   ❌ Key file does not exist!');
      return;
    }
    
    const keyFile = require(keyPath);
    console.log(`   ✓ Key file loaded`);
    console.log(`   Service account email: ${keyFile.client_email}`);
    
    // Initialize auth
    console.log('\n3. Initializing authentication...');
  const auth = new google.auth.GoogleAuth({
    credentials: keyFile,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
    
    const authClient = await auth.getClient();
    console.log('   ✓ Authentication successful');
    
    // Initialize Drive API
    console.log('\n4. Initializing Drive API...');
    const drive = google.drive({ version: 'v3', auth: authClient });
    console.log('   ✓ Drive API initialized');
    
    // Test listing files
    console.log('\n5. Testing Drive API access...');
    
    // Use configured folder ID directly
    let folderId = process.env.GOOGLE_DRIVE_SOURCE_FOLDER_ID;
    
    if (folderId) {
      console.log(`   Using configured folder ID: ${folderId}`);
      
      // Verify folder exists and we have access
      try {
        const folderInfo = await drive.files.get({
          fileId: folderId,
          fields: 'id, name, capabilities'
        });
        console.log(`   ✓ Folder accessible: ${folderInfo.data.name}`);
        console.log(`   ✓ Can create files: ${folderInfo.data.capabilities?.canAddChildren !== false}`);
      } catch (err) {
        console.error(`   ❌ Cannot access folder: ${err.message}`);
        throw new Error('Folder not accessible. Make sure it\'s shared with the service account.');
      }
    } else {
      // Fall back to searching by name
      const folderName = process.env.GOOGLE_DRIVE_FOLDER_SOURCE || 'eobsource';
      console.log(`   Searching for folder: ${folderName}`);
      const folderSearch = await drive.files.list({
        q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive'
      });
      
      if (folderSearch.data.files.length > 0) {
        folderId = folderSearch.data.files[0].id;
        console.log(`   ✓ Found folder: ${folderName} (ID: ${folderId})`);
      } else {
        throw new Error(`Folder '${folderName}' not found. Please create it and share with service account.`);
      }
    }
    
    // Create a test file
    console.log('\n6. Creating test file...');
    const testFileName = `test-${Date.now()}.txt`;
    const testFilePath = path.join(__dirname, testFileName);
    
    // Write test content to file
    fs.writeFileSync(testFilePath, 'This is a test file for Google Drive integration');
    
    const fileMetadata = {
      name: testFileName,
      parents: [folderId]
    };
    
    // Create stream from file
    const fileStream = fs.createReadStream(testFilePath);
    
    const media = {
      mimeType: 'text/plain',
      body: fileStream
    };
    
    console.log(`   Uploading test file: ${testFileName}`);
    const file = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink',
      supportsAllDrives: true
    });
    
    console.log(`   ✓ File uploaded successfully!`);
    console.log(`   File ID: ${file.data.id}`);
    console.log(`   File name: ${file.data.name}`);
    console.log(`   View link: ${file.data.webViewLink}`);
    
    // List files in folder
    console.log('\n7. Listing files in folder...');
    const fileList = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id, name, createdTime)',
      orderBy: 'createdTime desc',
      pageSize: 5
    });
    
    console.log(`   Found ${fileList.data.files.length} file(s):`);
    fileList.data.files.forEach(f => {
      console.log(`   - ${f.name} (ID: ${f.id})`);
    });
    
    console.log('\n✅ Google Drive integration test PASSED!');
    console.log('\n📌 Next steps:');
    console.log(`   1. Check your Google Drive folder "${folderName}"`);
    console.log(`   2. You should see the test file: ${testFileName}`);
    console.log(`   3. Try uploading a PDF through the web interface`);
    
  } catch (error) {
    console.error('\n❌ Test FAILED:');
    console.error(`   Error: ${error.message}`);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Details: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    console.error('\n💡 Common issues:');
    console.error('   1. Service account key file not found or invalid');
    console.error('   2. Drive API not enabled in Google Cloud Console');
    console.error('   3. Service account doesn\'t have permission to create folders');
    console.error('   4. Folder name has special characters or spaces');
  }
}

testGoogleDrive();
