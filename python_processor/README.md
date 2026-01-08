# Python Document Processor

A complete Python-based document processing system that replaces the n8n workflow. This system processes EOB (Explanation of Benefits), Facesheet, and Invoice documents using Google Cloud Document AI for OCR and OpenAI for intelligent data extraction.

## Features

- **Document AI Integration**: OCR and text extraction using Google Cloud Document AI
- **OpenAI Extraction**: Intelligent data extraction with GPT-4o
- **Multi-Document Support**: Handles EOB, Facesheet, and Invoice documents
- **Google Drive Integration**: Upload/download files from Google Drive
- **Cost Tracking**: Tracks processing costs for Document AI and OpenAI
- **Webhook Server**: FastAPI-based webhook server for integration
- **File Watcher**: Automatic processing of new files in a watched folder
- **Validation**: Quality validation with confidence scoring

## Project Structure

```
python_processor/
├── __init__.py              # Package initialization
├── main.py                  # Main entry point
├── server.py                # FastAPI webhook server
├── orchestrator.py          # Main workflow orchestrator
├── document_ai_processor.py # Google Cloud Document AI processing
├── openai_extractor.py      # OpenAI data extraction
├── google_drive_service.py  # Google Drive API integration
├── cost_tracker.py          # Cost calculation and tracking
├── config.py                # Configuration management
├── file_watcher.py          # Folder monitoring for auto-processing
├── requirements.txt         # Python dependencies
├── setup.bat               # Windows setup script
├── .env.example            # Example environment configuration
└── README.md               # This file
```

## Installation

### Prerequisites

- Python 3.10 or later
- Google Cloud account with Document AI API enabled
- OpenAI API key
- Google Cloud service account credentials JSON file

### Setup

1. **Clone or copy the `python_processor` folder to your desired location**

2. **Run the setup script (Windows):**
   ```batch
   setup.bat
   ```

   Or manually:
   ```batch
   python -m venv venv
   venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Configure environment variables:**
   ```batch
   copy .env.example .env
   ```
   Edit `.env` and update:
   - `OPENAI_API_KEY`: Your OpenAI API key
   - Folder paths as needed
   - Other configuration options

4. **Place Google Cloud credentials file:**
   - Copy your service account JSON file to the parent directory
   - The file should be named like `optical-valor-*.json`

## Usage

### Start the Webhook Server

```batch
venv\Scripts\activate
python main.py server
```

The server will start on `http://0.0.0.0:8000` by default.

### API Endpoints

- `POST /webhook/eob-process` - Process document asynchronously
- `POST /webhook/eob-process-sync` - Process document synchronously
- `GET /health` - Health check
- `GET /jobs` - List processing jobs
- `GET /jobs/{process_id}` - Get job status

### Process a Single File

```batch
venv\Scripts\activate
python main.py process /path/to/document.pdf --category 1
```

Document categories:
- 1 = EOB (Explanation of Benefits)
- 2 = Facesheet (Patient Demographics)
- 3 = Invoice

### Watch Folder for New Files

```batch
venv\Scripts\activate
python file_watcher.py --folder "H:/My Drive/Documents" --category 1
```

### Validate Configuration

```batch
venv\Scripts\activate
python main.py validate
```

## Webhook Request Format

```json
{
  "processId": "abc123",
  "filename": "document.pdf",
  "originalFilename": "document.pdf",
  "driveFileId": "1234567890abcdef",
  "userid": "user123",
  "clientId": "client123",
  "sessionId": "session123",
  "modelId": 2,
  "docCategory": 1
}
```

## Response Format

```json
{
  "processId": "abc123",
  "status": "Processed",
  "jsonDriveUrl": "https://drive.google.com/...",
  "csvDriveUrl": "https://drive.google.com/...",
  "jsonDriveId": "file_id",
  "csvDriveId": "file_id",
  "processingTimeSeconds": 45.2,
  "documentAiCost": 0.15,
  "openAiCost": 0.02,
  "totalCost": 0.17,
  "totalRecords": 5,
  "noOfPages": 10
}
```

## Configuration Options

| Variable | Description | Default |
|----------|-------------|---------|
| `PROJECT_ID` | Google Cloud project ID | optical-valor-477121-d0 |
| `LOCATION` | Document AI location | us |
| `PROCESSOR_ID` | Document AI processor ID | c159d8b2fb74ffc9 |
| `OPENAI_API_KEY` | OpenAI API key | (required) |
| `OPENAI_MODEL` | OpenAI model to use | gpt-4o |
| `SERVER_HOST` | Server host | 0.0.0.0 |
| `SERVER_PORT` | Server port | 8000 |
| `BACKEND_URL` | Backend API URL | http://127.0.0.1:3000 |

## Comparison with n8n Workflow

This Python implementation provides the same functionality as the n8n workflow:

| n8n Node | Python Module |
|----------|---------------|
| Webhook Trigger | `server.py` (FastAPI) |
| Validate Input Data | `orchestrator.py._validate_input()` |
| Route by Document Category | `orchestrator.py._extract_data()` |
| Get Model Pricing | `cost_tracker.py.fetch_model_pricing()` |
| Download PDF from Drive | `google_drive_service.py.download_file()` |
| Execute Python - Document AI | `document_ai_processor.py` |
| OpenAI Extract Data | `openai_extractor.py` |
| Calculate Costs | `cost_tracker.py` |
| Prepare JSON/CSV | `orchestrator.py._prepare_json_output()` |
| Upload to Drive | `google_drive_service.py.upload_*()` |
| Send Results | `orchestrator.py._send_results_to_backend()` |

## Benefits Over n8n

1. **Native Python**: Full control over code without n8n abstractions
2. **Better Debugging**: Direct access to logs and stack traces
3. **Easier Customization**: Modify extraction prompts and logic directly
4. **Lower Latency**: No n8n overhead
5. **Single Deployment**: One Python process vs n8n container
6. **Cost Effective**: No n8n licensing considerations

## Logging

Logs are written to:
- Console (stdout)
- `document_processor.log` file

Configure log level by modifying `main.py`.

## Error Handling

- Automatic retry with exponential backoff for API calls
- Validation of extraction quality with confidence scoring
- Error logging and reporting to backend API
- Graceful handling of missing files and invalid inputs

## License

MIT License
