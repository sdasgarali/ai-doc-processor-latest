"""
FastAPI Webhook Server
Replaces n8n webhook trigger for document processing
"""

import logging
import asyncio
from typing import Optional
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, BackgroundTasks, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import os
import shutil

from config import config

# Lazy imports to avoid loading all processors at module import time
def get_orchestrator():
    from orchestrator import DocumentOrchestrator
    return DocumentOrchestrator()

def get_process_request_class():
    from orchestrator import ProcessRequest
    return ProcessRequest

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# Pydantic models for request/response
class ProcessDocumentRequest(BaseModel):
    """Request model for document processing"""
    processId: str | int = Field(..., description="Unique process identifier")
    filename: str = Field(..., description="Filename of the document")
    originalFilename: Optional[str] = Field(None, description="Original filename")
    driveFileId: str = Field(..., description="Google Drive file ID")
    userid: Optional[str | int] = Field(None, description="User ID")
    clientId: Optional[str | int] = Field(None, description="Client ID")
    sessionId: Optional[str] = Field(None, description="Session ID")
    modelId: Optional[int] = Field(2, description="OpenAI model ID")
    docCategory: int = Field(1, description="Document category (1=EOB, 2=Facesheet, 3=Invoice)")
    extractionPrompt: Optional[str] = Field(None, description="Custom extraction prompt from output profile")

    class Config:
        json_schema_extra = {
            "example": {
                "processId": "abc123",
                "filename": "sample_eob.pdf",
                "driveFileId": "1234567890abcdef",
                "docCategory": 1
            }
        }


class ProcessDocumentResponse(BaseModel):
    """Response model for document processing"""
    processId: str | int
    status: str
    message: str
    jsonDriveUrl: Optional[str] = None
    csvDriveUrl: Optional[str] = None
    jsonDriveId: Optional[str] = None
    csvDriveId: Optional[str] = None
    processingTimeSeconds: Optional[float] = None
    documentAiCost: Optional[float] = None
    openAiCost: Optional[float] = None
    totalCost: Optional[float] = None
    totalRecords: Optional[int] = None
    noOfPages: Optional[int] = None
    errorMessage: Optional[str] = None


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    timestamp: str
    version: str = "1.0.0"


# In-memory job tracking
processing_jobs = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    # Startup
    logger.info("Starting Document Processing Server...")
    issues = config.validate()
    if issues:
        for issue in issues:
            logger.warning(f"Configuration issue: {issue}")
    logger.info(f"Server starting on {config.server.host}:{config.server.port}")
    yield
    # Shutdown
    logger.info("Shutting down Document Processing Server...")


# Create FastAPI app
app = FastAPI(
    title="Document Processing API",
    description="API for processing EOB, Facesheet, and Invoice documents using Document AI and OpenAI",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def process_document_sync(request_data: dict, process_id: str):
    """Synchronous document processing for background task"""
    try:
        processing_jobs[process_id] = {"status": "processing", "started_at": datetime.now().isoformat()}

        orchestrator = get_orchestrator()
        ProcessRequest = get_process_request_class()
        request = ProcessRequest.from_dict(request_data)
        result = orchestrator.process_document(request)

        processing_jobs[process_id] = {
            "status": "completed" if result.status == "Processed" else "failed",
            "completed_at": datetime.now().isoformat(),
            "result": {
                "status": result.status,
                "totalRecords": result.total_records,
                "totalCost": result.total_cost,
                "processingTimeSeconds": result.processing_time_seconds,
                "errorMessage": result.error_message
            }
        }

    except Exception as e:
        logger.error(f"Error processing document {process_id}: {e}", exc_info=True)
        processing_jobs[process_id] = {
            "status": "failed",
            "completed_at": datetime.now().isoformat(),
            "error": str(e)
        }


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now().isoformat()
    )


@app.post("/webhook/eob-process", response_model=ProcessDocumentResponse)
async def process_eob_document(
    request: ProcessDocumentRequest,
    background_tasks: BackgroundTasks
):
    """
    Process EOB/Facesheet/Invoice document (webhook endpoint)

    This endpoint replaces the n8n webhook trigger and starts document processing.
    Processing happens in the background and results are sent to the backend API.
    """
    logger.info(f"Received processing request for: {request.filename}")
    logger.info(f"Process ID: {request.processId}, Category: {request.docCategory}")

    # Validate request
    if request.docCategory not in [1, 2, 3]:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid docCategory: {request.docCategory}. Must be 1 (EOB), 2 (Facesheet), or 3 (Invoice)"
        )

    if not request.filename.lower().endswith('.pdf'):
        logger.warning(f"Filename doesn't end with .pdf: {request.filename}")

    # Prepare request data
    request_data = {
        "processId": request.processId,
        "filename": request.filename,
        "originalFilename": request.originalFilename or request.filename,
        "driveFileId": request.driveFileId,
        "userid": request.userid,
        "clientId": request.clientId,
        "sessionId": request.sessionId,
        "modelId": request.modelId,
        "docCategory": request.docCategory,
        "extractionPrompt": request.extractionPrompt
    }

    # Start background processing
    background_tasks.add_task(process_document_sync, request_data, request.processId)

    return ProcessDocumentResponse(
        processId=request.processId,
        status="Processing",
        message="Document processing started in background"
    )


@app.post("/webhook/eob-process-sync", response_model=ProcessDocumentResponse)
async def process_eob_document_sync(request: ProcessDocumentRequest):
    """
    Process EOB/Facesheet/Invoice document synchronously

    This endpoint processes the document and waits for completion.
    Use this for testing or when you need immediate results.
    """
    logger.info(f"Received sync processing request for: {request.filename}")

    # Validate request
    if request.docCategory not in [1, 2, 3]:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid docCategory: {request.docCategory}"
        )

    # Prepare request data
    request_data = {
        "processId": request.processId,
        "filename": request.filename,
        "originalFilename": request.originalFilename or request.filename,
        "driveFileId": request.driveFileId,
        "userid": request.userid,
        "clientId": request.clientId,
        "sessionId": request.sessionId,
        "modelId": request.modelId,
        "docCategory": request.docCategory,
        "extractionPrompt": request.extractionPrompt
    }

    try:
        orchestrator = get_orchestrator()
        ProcessRequest = get_process_request_class()
        proc_request = ProcessRequest.from_dict(request_data)
        result = orchestrator.process_document(proc_request)

        return ProcessDocumentResponse(
            processId=result.process_id,
            status=result.status,
            message="Processing completed",
            jsonDriveUrl=result.json_drive_url,
            csvDriveUrl=result.csv_drive_url,
            jsonDriveId=result.json_drive_id,
            csvDriveId=result.csv_drive_id,
            processingTimeSeconds=result.processing_time_seconds,
            documentAiCost=result.document_ai_cost,
            openAiCost=result.openai_cost,
            totalCost=result.total_cost,
            totalRecords=result.total_records,
            noOfPages=result.no_of_pages,
            errorMessage=result.error_message
        )

    except Exception as e:
        logger.error(f"Error processing document: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/process")
async def process_uploaded_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    process_id: str = Form(...),
    category: int = Form(1),
    filename: str = Form(None)
):
    """
    Process an uploaded PDF file directly (without Google Drive)
    This endpoint accepts file uploads from Laravel
    """
    actual_filename = filename or file.filename
    logger.info(f"Received file upload: {actual_filename}, process_id: {process_id}, category: {category}")

    # Save uploaded file to upload folder
    upload_path = os.path.join(config.folders.upload_folder, actual_filename)
    try:
        with open(upload_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        logger.info(f"File saved to: {upload_path}")
    except Exception as e:
        logger.error(f"Failed to save file: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    # Prepare request data for orchestrator
    request_data = {
        "processId": process_id,
        "filename": actual_filename,
        "originalFilename": actual_filename,
        "driveFileId": None,  # No drive file - using local file
        "localFilePath": upload_path,  # Pass local file path
        "userid": None,
        "clientId": None,
        "sessionId": None,
        "modelId": 2,
        "docCategory": category
    }

    # Start background processing
    background_tasks.add_task(process_document_sync, request_data, process_id)

    return {
        "success": True,
        "processId": process_id,
        "status": "processing",
        "message": "Document processing started"
    }


@app.get("/api/status/{process_id}")
async def get_api_status(process_id: str):
    """Get processing status for Laravel polling"""
    if process_id not in processing_jobs:
        return {
            "status": "pending",
            "progress": 0,
            "message": "Not found or not started"
        }

    job = processing_jobs[process_id]
    result = job.get("result", {})

    return {
        "status": job.get("status", "unknown"),
        "progress": 100 if job.get("status") == "completed" else 50,
        "total_pages": result.get("noOfPages"),
        "total_records": result.get("totalRecords"),
        "processing_time": result.get("processingTimeSeconds"),
        "error_message": result.get("errorMessage") or job.get("error")
    }


@app.get("/jobs/{process_id}")
async def get_job_status(process_id: str):
    """Get the status of a processing job"""
    if process_id not in processing_jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    return processing_jobs[process_id]


@app.get("/jobs")
async def list_jobs():
    """List all processing jobs"""
    return processing_jobs


def run_server():
    """Run the FastAPI server"""
    import uvicorn
    uvicorn.run(
        "server:app",
        host=config.server.host,
        port=config.server.port,
        reload=False,
        log_level="info"
    )


if __name__ == "__main__":
    run_server()
