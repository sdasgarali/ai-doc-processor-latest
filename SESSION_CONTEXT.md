# Session Context - Processing Engine Configuration

## Current Task
Implement "Processing Engine Configuration" submenu under Admin Panel to manage configuration settings that override .env file.

## Requirements
1. New submenu "Processing Engine Configuration" under Admin Panel
2. Default/global configuration for all clients/models/doc categories
3. Per-doc-category configuration that overrides default
4. .env file as fallback when configuration is missing
5. Configuration applies to document processing

## Implementation Status: COMPLETED

### Phase 1: Database Schema - DONE
- Created `processing_config` table in `database/processing_config.sql`
- Table stores config key-value pairs with optional doc_category_id
- Supports encrypted values for sensitive data (API keys)
- 21 default configuration entries created

### Phase 2: Backend API - DONE
- Created `routes/processingConfig.js` with endpoints:
  - GET /api/admin/processing-config - List all configs
  - GET /api/admin/processing-config/default - Get default config
  - GET /api/admin/processing-config/category/:categoryId - Get category config
  - GET /api/admin/processing-config/effective/:categoryId - Get merged config for processing
  - POST /api/admin/processing-config - Create/update config
  - POST /api/admin/processing-config/bulk - Bulk update configs (fixed for NULL handling)
  - POST /api/admin/processing-config/copy-to-category/:categoryId - Copy defaults to category
  - DELETE /api/admin/processing-config/:id - Delete config
- Added route registration in server.js

### Phase 3: Frontend Components - DONE
- Created `client/src/pages/Admin/ProcessingEngineConfig.js`
  - Tabs for Default vs Category-specific configuration
  - Accordion sections for different config groups (Provider, OpenAI, Mistral, etc.)
  - Support for text, number, select, password, and textarea fields
  - Password masking with show/hide toggle
  - Copy defaults to category button
  - Save functionality with bulk update
- Added route in App.js
- Added tab in AdminPanel.js

### Phase 4: Python Processor Integration - DONE
- Added `DynamicConfig` class in `config.py`
- Added `get_dynamic_config(category_id)` function
- Added `fetch_api_config()` to get config from backend API
- Config priority: API config > .env file > defaults
- Modified orchestrator.py to load dynamic config per document category

### Phase 5: Bug Fixes - DONE
- Fixed MySQL NULL handling in bulk save (unique constraint doesn't work with NULL)
- Created `scripts/fix-config.js` to clean duplicates and populate from .env
- Populated default configuration values from python_processor/.env

## Configuration Keys Supported
- OCR_PROVIDER (google/mistral)
- LLM_PROVIDER (openai/mistral)
- DOCAI_PROJECT_ID, DOCAI_LOCATION, DOCAI_PROCESSOR_ID, DOCAI_COST_PER_PAGE
- OPENAI_API_KEY, OPENAI_MODEL, OPENAI_MAX_TOKENS, OPENAI_TEMPERATURE
- OPENAI_INPUT_COST_PER_1K, OPENAI_OUTPUT_COST_PER_1K
- MISTRAL_API_KEY, MISTRAL_MODEL, MISTRAL_INPUT_COST_PER_1K, MISTRAL_OUTPUT_COST_PER_1K
- MAX_PAGES_PER_SPLIT, MAX_PARALLEL_WORKERS, DOCUMENT_AI_TIMEOUT
- USE_BATCH_PROCESSING
- EXTRACTION_PROMPT (custom per category)

## Files Created/Modified
- database/processing_config.sql (NEW)
- routes/processingConfig.js (NEW)
- client/src/pages/Admin/ProcessingEngineConfig.js (NEW)
- scripts/fix-config.js (NEW)
- server.js (MODIFIED - added route)
- client/src/App.js (MODIFIED - added route)
- client/src/pages/Admin/AdminPanel.js (MODIFIED - added tab)
- python_processor/config.py (MODIFIED - added DynamicConfig)
- python_processor/orchestrator.py (MODIFIED - uses dynamic config)

## How It Works
1. Admin configures settings in Admin Panel > Processing Engine
2. Can set default (global) settings that apply to all categories
3. Can override settings for specific document categories
4. Python processor fetches effective config from API before processing
5. If API call fails or value missing, falls back to .env file
6. .env file values are used as ultimate fallback

## Known Issues Fixed
- MySQL unique constraint doesn't work with NULL values - fixed by using explicit SELECT before UPDATE/INSERT
- Duplicate config entries - fixed with cleanup script
- Empty values after save - fixed by proper NULL handling in bulk save API

## Testing
- Access http://localhost:3000/admin/processing-config as admin
- Configure default settings in "Default Configuration" tab
- Configure category-specific overrides in "Category-Specific Configuration" tab
- Process a document to verify config is applied

## Git Commits
- `0f6baa7` - Add Processing Engine Configuration management
- `7c3bbe5` - Fix processing config save and populate default values

## Last Updated
2026-01-08
