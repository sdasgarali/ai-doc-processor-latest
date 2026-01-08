# Google Drive Service Account Storage Issue - Solutions

## The Problem

Service accounts **cannot upload files to personal "My Drive" folders**. They can only:
- Upload to **Shared Drives** (Team Drives)
- Use **OAuth delegation** with domain-wide authority

Error message:
```
Service Accounts do not have storage quota. Leverage shared drives or use OAuth delegation instead.
```

## Solution 1: Use a Shared Drive (Recommended for Organizations)

### Steps:

1. **Create a Shared Drive**:
   - Go to Google Drive (drive.google.com)
   - Click "Shared drives" in the left sidebar
   - Click "New" → "New shared drive"
   - Name it "EOB Documents"

2. **Add the Service Account as a Member**:
   - Open the new Shared Drive
   - Click the settings icon (⚙️) → "Manage members"
   - Add this email as a **Content Manager** or **Manager**:
     ```
     eob-drive-service@eob-extraction-system.iam.gserviceaccount.com
     ```

3. **Create Folders in the Shared Drive**:
   - Inside the Shared Drive, create two folders:
     - `eobsource` (for incoming PDFs)
     - `eobresults` (for processed results)

4. **Update Your .env File**:
   - Right-click each folder → "Get link"
   - Copy the folder ID from the URL:
     ```
     https://drive.google.com/drive/folders/FOLDER_ID_HERE
     ```
   - Update your `.env` file:
     ```env
     GOOGLE_DRIVE_SOURCE_FOLDER_ID=your_eobsource_folder_id
     GOOGLE_DRIVE_RESULTS_FOLDER_ID=your_eobresults_folder_id
     ```

5. **Test Again**:
   ```bash
   node test-google-drive.js
   ```

---

## Solution 2: Use OAuth2 Instead of Service Account (For Personal Accounts)

If you don't have access to Shared Drives (requires Google Workspace), use OAuth2:

### Steps:

1. **Run the OAuth Setup Script**:
   ```bash
   # Dependencies are already installed
   node generate-oauth-token.js
   ```
   This will:
   - Open your browser
   - Ask you to authorize the app
   - Generate a refresh token

2. **Update .env**:
   The script will automatically add `GOOGLE_REFRESH_TOKEN` to your `.env` file

3. **Test**:
   ```bash
   node test-google-drive.js
   ```

---

## Which Option Should You Choose?

| Feature | Shared Drive (Option 1) | OAuth2 (Option 2) |
|---------|------------------------|-------------------|
| **Best for** | Organizations/Teams | Personal accounts |
| **Requires** | Google Workspace | Any Google account |
| **Automation** | ✅ Fully automated | ✅ Fully automated |
| **Token Expiry** | ✅ Never expires | ⚠️ May need refresh |
| **Sharing** | ✅ Easy team access | ⚠️ Tied to one account |
| **Setup Complexity** | Medium | Easy |

---

## Current Status

Your current setup:
- ✅ Service account created
- ✅ Credentials configured
- ✅ Folder shared with service account
- ❌ **Folder is in "My Drive" (not compatible with service accounts)**

**Action Required**: Choose Option 1 (Shared Drive) or Option 2 (OAuth2)

---

## Need Help?

If you're unsure which option to use or need help setting up:
1. For organizations with Google Workspace → Use **Option 1** (Shared Drive)
2. For personal Gmail accounts → Use **Option 2** (OAuth2)
