const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');

// Initialize Google Drive API
let driveClient = null;

function initializeDriveClient() {
  if (driveClient) return driveClient;
  
  try {
    // Check if Google Drive is enabled
    if (process.env.ENABLE_GOOGLE_DRIVE !== 'true') {
      console.log('ℹ️  Google Drive integration is DISABLED (using local storage)');
      console.log('   To enable: Set ENABLE_GOOGLE_DRIVE=true in .env file');
      return null;
    }
    
    // Check if we have the necessary credentials
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.warn('Google Drive credentials not configured');
      return null;
    }

    // Check if we have a service account key file
    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH) {
      try {
        const keyFile = require(path.resolve(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH));
  const auth = new google.auth.GoogleAuth({
    credentials: keyFile,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
        driveClient = google.drive({ version: 'v3', auth });
        console.log('✓ Google Drive initialized with Service Account');
        return driveClient;
      } catch (err) {
        console.error('Failed to load service account key:', err.message);
      }
    }

    // Check if we have a refresh token for OAuth
    if (process.env.GOOGLE_REFRESH_TOKEN) {
      const auth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );
      
      auth.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN
      });
      
      driveClient = google.drive({ version: 'v3', auth });
      console.log('✓ Google Drive initialized with OAuth2');
      return driveClient;
    }

    // If no valid auth method, warn and return null
    console.warn('⚠️  Google Drive not configured: Need either GOOGLE_SERVICE_ACCOUNT_KEY_PATH or GOOGLE_REFRESH_TOKEN in .env');
    console.warn('   Files will be stored locally only. See GOOGLE_DRIVE_SETUP.md for setup instructions.');
    return null;
    
  } catch (error) {
    console.error('Failed to initialize Google Drive client:', error);
    return null;
  }
}

// Get or create folder
async function getOrCreateFolder(folderName) {
  const drive = initializeDriveClient();
  if (!drive) return null;
  
  try {
    // Search for existing folder
    const response = await drive.files.list({
      q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive'
    });
    
    if (response.data.files.length > 0) {
      return response.data.files[0].id;
    }
    
    // Create folder if it doesn't exist
    const folderMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    };
    
    const folder = await drive.files.create({
      resource: folderMetadata,
      fields: 'id'
    });
    
    return folder.data.id;
  } catch (error) {
    console.error('Error getting/creating folder:', error);
    return null;
  }
}

// Upload file to Google Drive
async function uploadToGoogleDrive(filePath, originalName, processId, isResult = false) {
  const drive = initializeDriveClient();
  
  if (!drive) {
    console.warn('Google Drive client not initialized, skipping upload');
    return { fileId: null, fileName: originalName, webViewLink: null };
  }
  
  try {
    // Determine target folder - use folder ID if provided, otherwise search by name
    let folderId;
    
    if (isResult && process.env.GOOGLE_DRIVE_RESULTS_FOLDER_ID) {
      // Use provided results folder ID
      folderId = process.env.GOOGLE_DRIVE_RESULTS_FOLDER_ID;
      console.log(`Using configured results folder ID: ${folderId}`);
    } else if (!isResult && process.env.GOOGLE_DRIVE_SOURCE_FOLDER_ID) {
      // Use provided source folder ID
      folderId = process.env.GOOGLE_DRIVE_SOURCE_FOLDER_ID;
      console.log(`Using configured source folder ID: ${folderId}`);
    } else {
      // Fall back to searching/creating by name
      const folderName = isResult 
        ? process.env.GOOGLE_DRIVE_FOLDER_RESULTS || 'eobresults'
        : process.env.GOOGLE_DRIVE_FOLDER_SOURCE || 'eobsource';
      
      folderId = await getOrCreateFolder(folderName);
    }
    
    // Prepare file stream
    const fileName = isResult ? originalName : `Processed_${originalName}`;
    
    // Prepare metadata
    const fileMetadata = {
      name: fileName,
      parents: folderId ? [folderId] : []
    };
    
    // Determine MIME type
    const ext = path.extname(filePath).toLowerCase();
    let mimeType = 'application/octet-stream';
    if (ext === '.pdf') mimeType = 'application/pdf';
    else if (ext === '.csv') mimeType = 'text/csv';
    else if (ext === '.json') mimeType = 'application/json';
    
    // Create file stream
    const fileStream = require('fs').createReadStream(filePath);
    
    // Upload file
    const response = await drive.files.create({
      resource: fileMetadata,
      media: {
        mimeType,
        body: fileStream
      },
      fields: 'id, name, webViewLink, webContentLink',
      supportsAllDrives: true
    });
    
    console.log(`Uploaded ${fileName} to Google Drive (ID: ${response.data.id})`);
    
    return {
      fileId: response.data.id,
      fileName: response.data.name,
      webViewLink: response.data.webViewLink,
      webContentLink: response.data.webContentLink
    };
  } catch (error) {
    console.error('Error uploading to Google Drive:', error);
    // Return minimal info if upload fails
    return { fileId: null, fileName: originalName, webViewLink: null };
  }
}

// Download file from Google Drive
async function downloadFromGoogleDrive(fileId, destinationPath) {
  const drive = initializeDriveClient();
  if (!drive) {
    throw new Error('Google Drive client not initialized');
  }

  try {
    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    );

    const dest = require('fs').createWriteStream(destinationPath);

    return new Promise((resolve, reject) => {
      response.data
        .on('end', () => resolve(destinationPath))
        .on('error', reject)
        .pipe(dest);
    });
  } catch (error) {
    console.error('Error downloading from Google Drive:', error);
    throw error;
  }
}

// List files in folder
async function listFilesInFolder(folderName) {
  const drive = initializeDriveClient();
  if (!drive) return [];
  
  try {
    const folderId = await getOrCreateFolder(folderName);
    if (!folderId) return [];
    
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id, name, mimeType, createdTime, modifiedTime, size)',
      orderBy: 'createdTime desc',
      pageSize: 100
    });
    
    return response.data.files || [];
  } catch (error) {
    console.error('Error listing files:', error);
    return [];
  }
}

// Monitor folder for new files (polling approach)
async function monitorFolder(folderName, callback, intervalMs = 60000) {
  let lastCheck = new Date();
  
  const checkForNewFiles = async () => {
    try {
      const files = await listFilesInFolder(folderName);
      
      // Filter files created after last check
      const newFiles = files.filter(file => {
        const fileCreated = new Date(file.createdTime);
        return fileCreated > lastCheck;
      });
      
      if (newFiles.length > 0) {
        console.log(`Found ${newFiles.length} new file(s) in ${folderName}`);
        for (const file of newFiles) {
          await callback(file);
        }
      }
      
      lastCheck = new Date();
    } catch (error) {
      console.error('Error monitoring folder:', error);
    }
  };
  
  // Initial check
  await checkForNewFiles();
  
  // Set up interval
  const intervalId = setInterval(checkForNewFiles, intervalMs);
  
  return intervalId;
}

// Delete file from Google Drive
async function deleteFromGoogleDrive(fileId) {
  const drive = initializeDriveClient();
  if (!drive) return false;
  
  try {
    await drive.files.delete({ fileId });
    console.log(`Deleted file ${fileId} from Google Drive`);
    return true;
  } catch (error) {
    console.error('Error deleting file from Google Drive:', error);
    return false;
  }
}

// Get file metadata
async function getFileMetadata(fileId) {
  const drive = initializeDriveClient();
  if (!drive) return null;
  
  try {
    const response = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType, size, createdTime, modifiedTime, webViewLink'
    });
    
    return response.data;
  } catch (error) {
    console.error('Error getting file metadata:', error);
    return null;
  }
}

module.exports = {
  initializeDriveClient,
  uploadToGoogleDrive,
  downloadFromGoogleDrive,
  listFilesInFolder,
  monitorFolder,
  deleteFromGoogleDrive,
  getFileMetadata,
  getOrCreateFolder
};
