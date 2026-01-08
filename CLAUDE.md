# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EOB Extraction System - a full-stack document processing platform that accepts PDF uploads, processes them using AI models (Google Document AI, OpenAI), extracts structured data, and provides billing/invoicing features. Multi-tenant architecture with role-based access control.

**Stack:** Node.js/Express backend, React frontend (MUI), MySQL database, Socket.IO for real-time updates.

## Common Commands

```bash
# Install all dependencies
npm run install-all

# Development (runs both backend and frontend)
npm run dev-full

# Backend only (port 5000)
npm run dev

# Frontend only (port 3000)
npm run client

# Production
npm start
```

## Architecture

### Backend Structure
- `server.js` - Express app entry point, Socket.IO setup
- `routes/` - API endpoints (auth, documents, admin, billing, reports)
- `services/` - Business logic (documentProcessor, googleDrive, emailService, invoiceService, paymentService, cronService)
- `middleware/auth.js` - JWT verification, role checks (`superadmin`, `admin`, `client`, `user`), permission system
- `config/database.js` - MySQL connection pool with transaction helpers

### Frontend Structure
- `client/src/App.js` - Main routing
- `client/src/contexts/AuthContext.js` - Authentication state management
- `client/src/pages/` - Page components (Dashboard, Documents, Upload, Admin/, Reports/)
- `client/src/components/` - Shared components (Layout, PrivateRoute)

### Database
MySQL with tables: `user_profile`, `client`, `document_processed`, `doc_category`, `field_table`, `model_version`, `pricing_config`, `invoice`, `mail_log`, `audit_log`

Setup script: `database/setup.sql`

### External Integrations
- **n8n** - Workflow automation for document processing pipeline (workflows in `n8n-workflows/`)
- **Google Drive** - File storage via `services/googleDrive.js`
- **Google Document AI / OpenAI** - Document extraction
- **Stripe** - Payment processing via `services/paymentService.js`
- **SMTP** - Email via `services/emailService.js`

## Key Patterns

- Multi-tenant isolation via `client_id` on most tables
- Real-time updates via Socket.IO rooms (`process_{processId}`)
- JWT tokens stored in localStorage, verified via `middleware/auth.js`
- Database transactions via `executeTransaction()` helper in `config/database.js`
- Large PDFs split at `PDF_SPLIT_PAGE_LIMIT` pages before processing

## Environment

Copy `.env.example` to `.env`. Key variables:
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` - MySQL connection
- `JWT_SECRET`, `JWT_EXPIRE` - Authentication
- `PORT` - Backend port (default 5000)
- `CORS_ORIGIN` - Frontend URL for CORS

## API Authentication

All protected routes require `Authorization: Bearer <token>` header. Roles cascade: superadmin > admin > client > user.

## Testing

Test scripts in root directory:
```bash
node test-login.js
node test-documents-api.js
node test-dashboard.js
```

## n8n Integration (for Claude Code)

Direct access to n8n workflows and executions via CLI helper. This enables Claude Code to analyze, debug, and modify n8n workflows programmatically.

### Setup Requirements

1. **n8n API Key** - Generate at http://localhost:5678/settings/api
2. **Environment Variables** in `.env`:
   ```
   N8N_BASE_URL=http://localhost:5678
   N8N_API_KEY=your_api_key_here
   ```

### CLI Commands

```bash
# List all workflows
node scripts/n8n-cli.js workflows

# Get workflow details (nodes, connections)
node scripts/n8n-cli.js workflow <workflowId>

# List recent executions (last 20)
node scripts/n8n-cli.js executions [workflowId]

# Get execution details with all node outputs
node scripts/n8n-cli.js execution <executionId>

# Get detailed node-by-node output for debugging
node scripts/n8n-cli.js nodes <executionId>

# Get specific node output from execution
node scripts/n8n-cli.js node <executionId> <nodeName>

# Show only errors/failed nodes from execution
node scripts/n8n-cli.js errors <executionId>

# Trigger webhook workflow
node scripts/n8n-cli.js trigger <webhookPath> [jsonData]

# List active workflows
node scripts/n8n-cli.js active

# Search node code for patterns
node scripts/n8n-cli.js search <workflowId> <pattern>

# List configured credentials
node scripts/n8n-cli.js credentials
```

### Workflow Modification Scripts

Scripts for programmatic workflow updates (in `scripts/` folder):
- `fix-n8n-workflow.js` - General workflow fixes
- `fix-openai-prompt.js` - Update OpenAI extraction prompts
- `fix-column-order.js` - Fix CSV/JSON field ordering
- `fix-page-count.js` - Fix page count capture
- `implement-chunking-simple.js` - Account-driven extraction

### Main Workflow

**Workflow ID:** `Y6eWdKJoHaeWZgMX` (EOB Processing with Document Category Routing)

Key nodes:
- `Parse Python Output` - Extracts text from Document AI
- `OpenAI - Extract EOB Data` - AI extraction of records
- `Calculate OpenAI Cost` - Token usage and cost tracking
- `Validate EOB Extraction` - Field validation
- `Prepare JSON` / `Prepare CSV` - Output formatting

### n8n API Pattern

For custom modifications, use this pattern:
```javascript
const axios = require('axios');
const api = axios.create({
  baseURL: process.env.N8N_BASE_URL + '/api/v1',
  headers: {
    'X-N8N-API-KEY': process.env.N8N_API_KEY,
    'Content-Type': 'application/json'
  }
});

// Get workflow
const { data: workflow } = await api.get('/workflows/WORKFLOW_ID');

// Modify nodes
workflow.nodes = workflow.nodes.map(node => {
  if (node.name === 'NodeName') {
    node.parameters.jsCode = 'new code';
  }
  return node;
});

// Save workflow
await api.put('/workflows/WORKFLOW_ID', {
  name: workflow.name,
  nodes: workflow.nodes,
  connections: workflow.connections,
  settings: workflow.settings,
  staticData: workflow.staticData
});
```
