# Quick Start Guide - EOB Extraction System

Get the system up and running in **5 minutes**!

## Prerequisites Check

Before starting, ensure you have:

- ✅ Node.js 18+ installed (`node --version`)
- ✅ MySQL 8.0+ running (`mysql --version`)
- ✅ npm installed (`npm --version`)

## Step 1: Install Dependencies (2 minutes)

```powershell
# Install backend dependencies
npm install

# Install frontend dependencies
cd client
npm install
cd ..
```

Or as a single command:
```powershell
npm install; cd client; npm install; cd ..
```

## Step 2: Setup Database (1 minute)

### Option A: Automatic Setup (Recommended)
The system will automatically create the database when you first start the server.

### Option B: Manual Setup
```bash
mysql -u root -p < database/setup.sql
```

Enter password: **AdminRootDBAli** when prompted

## Step 3: Start the Application (1 minute)

### Terminal 1 - Backend Server
```bash
npm run dev
```

Wait for: `✓ Database connection established successfully`

### Terminal 2 - Frontend Client
```bash
cd client
npm start
```

Browser will automatically open to: http://localhost:3000

## Step 4: First Login (30 seconds)

**Default Admin Credentials:**
- Email: `admin@eobsystem.com`
- Password: `Admin@123`

⚠️ **IMPORTANT:** Change the password immediately after first login!

## Step 5: Test the System (30 seconds)

1. **Upload a Document**
   - Click "Upload" in the sidebar
   - Select document type: "eob"
   - Drop a PDF file (or click to browse)
   - Click "Upload Document"

2. **View Processing**
   - Go to "Documents" to see processing status
   - Real-time updates will show progress

3. **Download Results**
   - Once processed, download PDF, CSV, JSON, or ZIP
   - Click on Process ID to view extracted data

## 🎉 You're Ready!

The system is now fully operational. Here's what you can do:

### For Users
- Upload PDF documents
- Monitor processing status
- Download results in multiple formats
- View extracted data in table format

### For Administrators
- Go to "Admin Panel"
- Create new users
- Manage clients
- Configure extraction models
- Manage field mappings
- View audit logs

## Common Issues & Solutions

### Port Already in Use
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Database Connection Failed
```bash
# Start MySQL service (Windows)
net start MySQL80

# Test connection
mysql -u root -p
# Password: AdminRootDBAli
```

### npm install errors
```bash
# Clear cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules
npm install
```

## Optional: n8n Integration

If you want full n8n integration:

1. **Install n8n** (if not already installed)
   ```bash
   npm install n8n -g
   ```

2. **Start n8n**
   ```bash
   n8n start
   ```

3. **Import Workflow**
   - Open http://localhost:5678
   - Import: `C:\Users\AsgarAliSayed\Downloads\EOB_data_Extract_OCR-API__n8n_latest_v8_eob_assistant (2).json`
   - Activate the workflow

4. **Update .env**
   ```env
   N8N_WEBHOOK_URL=http://localhost:5678/webhook/eob-process
   ```

## Optional: Google Drive Integration

To enable Google Drive integration:

1. **Get Google API Credentials**
   - Visit: https://console.cloud.google.com/
   - Create project
   - Enable Google Drive API
   - Create OAuth 2.0 credentials

2. **Update .env**
   ```env
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   ```

3. **Restart Server**

## Next Steps

1. **Change Default Password**
   - Profile → Change Password

2. **Create Users**
   - Admin Panel → Users → Create User

3. **Configure Models**
   - Admin Panel → Models → Create Model

4. **Customize Fields**
   - Admin Panel → Fields → Add/Edit Fields

## Need Help?

- 📖 Full documentation: See [README.md](README.md)
- 🐛 Troubleshooting: Check README troubleshooting section
- 📝 API docs: See README API documentation section

## System URLs

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **API Health**: http://localhost:5000/health
- **n8n** (optional): http://localhost:5678

---

**Pro Tip:** Keep both terminal windows open to monitor logs in real-time!
