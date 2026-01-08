#!/usr/bin/env python3
"""
Document Processor Main Entry Point
Run this script to start the document processing server or process files directly
"""

import argparse
import logging
import sys
import json
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from config import config
from server import run_server

# Lazy import for orchestrator to avoid loading all processors at startup
def get_orchestrator():
    from orchestrator import DocumentOrchestrator
    return DocumentOrchestrator()

def get_process_request():
    from orchestrator import ProcessRequest
    return ProcessRequest

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('document_processor.log', encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)


def process_single_file(file_path: str, doc_category: int = 1, process_id: str = None):
    """Process a single PDF file directly using configured providers"""
    import uuid
    from datetime import datetime
    from cost_tracker import CostTracker

    if not Path(file_path).exists():
        logger.error(f"File not found: {file_path}")
        return None

    if process_id is None:
        process_id = str(uuid.uuid4())[:8]

    filename = Path(file_path).name

    logger.info(f"Processing file: {filename}")
    logger.info(f"Process ID: {process_id}")
    logger.info(f"Document Category: {doc_category}")
    logger.info(f"Using providers: {config.get_provider_info()}")

    cost_tracker = CostTracker()
    cost_tracker.start_tracking()

    use_mistral_ocr = config.providers.ocr_provider == 'mistral'
    use_mistral_llm = config.providers.llm_provider == 'mistral'

    try:
        if use_mistral_ocr and use_mistral_llm:
            # Use Mistral for both OCR and extraction
            from mistral_processor import MistralProcessor, DocumentCategory
            category_map = {1: DocumentCategory.EOB, 2: DocumentCategory.FACESHEET, 3: DocumentCategory.INVOICE}
            category = category_map.get(doc_category, DocumentCategory.EOB)

            use_batch = config.processing.use_batch_processing
            processor = MistralProcessor(use_batch=use_batch)
            extraction_result = processor.process_pdf(file_path, category, filename)

            # Get page count
            from PyPDF2 import PdfReader
            reader = PdfReader(file_path)
            total_pages = len(reader.pages)
            provider_info = 'Mistral (OCR + LLM)'

        else:
            # Use Google Document AI + OpenAI
            from document_ai_processor import EOBProcessor
            from openai_extractor import OpenAIExtractor, DocumentCategory

            eob_processor = EOBProcessor()
            docai_result = eob_processor.process_file(file_path)

            if not docai_result or docai_result.get('status') != 'success':
                logger.error(f"Document AI processing failed: {docai_result.get('error', 'Unknown error')}")
                return None

            category_map = {1: DocumentCategory.EOB, 2: DocumentCategory.FACESHEET, 3: DocumentCategory.INVOICE}
            category = category_map.get(doc_category, DocumentCategory.EOB)

            openai_extractor = OpenAIExtractor()
            extraction_result = openai_extractor.extract_data(
                docai_result['raw_data'],
                category,
                filename
            )
            total_pages = docai_result['total_pages']
            provider_info = 'Google DocAI + OpenAI'

        # Calculate costs
        cost_breakdown = cost_tracker.calculate_total_cost(
            pages=total_pages,
            input_tokens=extraction_result.input_tokens,
            output_tokens=extraction_result.output_tokens,
            provider=config.providers.llm_provider
        )

        result = {
            'process_id': process_id,
            'filename': filename,
            'status': 'success',
            'provider': provider_info,
            'total_pages': total_pages,
            'total_records': len(extraction_result.records),
            'processing_time_seconds': cost_breakdown.processing_time_seconds,
            'costs': {
                'ocr': cost_breakdown.document_ai_cost,
                'llm': cost_breakdown.openai_cost,
                'total': cost_breakdown.total_cost
            },
            'data': extraction_result.data
        }

        # Save result to JSON file
        output_path = Path(config.folders.results_folder) / f"result_{process_id}.json"
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)

        logger.info(f"Results saved to: {output_path}")
        return result

    except Exception as e:
        logger.error(f"Processing failed: {e}", exc_info=True)
        return None


def validate_configuration():
    """Validate configuration before starting"""
    logger.info("Validating configuration...")
    issues = config.validate()

    if issues:
        logger.warning("Configuration issues found:")
        for issue in issues:
            logger.warning(f"  - {issue}")
        return False

    logger.info("Configuration validated successfully")
    logger.info(f"  Providers: {config.get_provider_info()}")
    logger.info(f"  Upload Folder: {config.folders.upload_folder}")
    logger.info(f"  Results Folder: {config.folders.results_folder}")

    # Show provider-specific info
    if config.providers.ocr_provider == 'mistral':
        logger.info(f"  Mistral Model: {config.mistral.model}")
    else:
        logger.info(f"  Google Cloud Project: {config.google_cloud.project_id}")

    if config.providers.llm_provider == 'openai':
        logger.info(f"  OpenAI Model: {config.openai.model}")

    return True


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='Document Processor - EOB, Facesheet, and Invoice Processing',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Start the webhook server
  python main.py server

  # Process a single PDF file
  python main.py process /path/to/document.pdf --category 1

  # Validate configuration
  python main.py validate

Document Categories:
  1 = EOB (Explanation of Benefits)
  2 = Facesheet (Patient Demographics)
  3 = Invoice
        """
    )

    subparsers = parser.add_subparsers(dest='command', help='Available commands')

    # Server command
    server_parser = subparsers.add_parser('server', help='Start the webhook server')
    server_parser.add_argument('--host', default=None, help='Server host')
    server_parser.add_argument('--port', type=int, default=None, help='Server port')

    # Process command
    process_parser = subparsers.add_parser('process', help='Process a single PDF file')
    process_parser.add_argument('file', help='Path to PDF file')
    process_parser.add_argument('--category', '-c', type=int, default=1,
                                choices=[1, 2, 3],
                                help='Document category (1=EOB, 2=Facesheet, 3=Invoice)')
    process_parser.add_argument('--id', help='Process ID (auto-generated if not provided)')

    # Validate command
    validate_parser = subparsers.add_parser('validate', help='Validate configuration')

    args = parser.parse_args()

    if args.command == 'server':
        # Override config if specified
        if args.host:
            config.server.host = args.host
        if args.port:
            config.server.port = args.port

        logger.info("Starting Document Processing Server...")

        if not validate_configuration():
            logger.warning("Starting server with configuration warnings...")

        run_server()

    elif args.command == 'process':
        if not validate_configuration():
            logger.error("Cannot process files with invalid configuration")
            sys.exit(1)

        result = process_single_file(args.file, args.category, args.id)

        if result:
            print("\n=== Processing Complete ===")
            print(f"Process ID: {result['process_id']}")
            print(f"Status: {result['status']}")
            print(f"Provider: {result.get('provider', 'N/A')}")
            print(f"Total Pages: {result['total_pages']}")
            print(f"Total Records: {result['total_records']}")
            print(f"Processing Time: {result['processing_time_seconds']}s")
            print(f"Total Cost: ${result['costs']['total']:.4f}")
            print(f"  - OCR: ${result['costs'].get('ocr', result['costs'].get('document_ai', 0)):.4f}")
            print(f"  - LLM: ${result['costs'].get('llm', result['costs'].get('openai', 0)):.4f}")
        else:
            print("\nProcessing failed. Check logs for details.")
            sys.exit(1)

    elif args.command == 'validate':
        if validate_configuration():
            print("\nConfiguration is valid!")
            sys.exit(0)
        else:
            print("\nConfiguration has issues. Check warnings above.")
            sys.exit(1)

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
