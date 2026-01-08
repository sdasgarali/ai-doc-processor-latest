"""
Configuration module for Document Processor
Loads settings from environment variables and .env file
"""

import os
from pathlib import Path
from dataclasses import dataclass
from typing import Optional
from dotenv import load_dotenv

# Load .env file - try current directory first, then parent directory
current_dir_env = Path(__file__).parent / '.env'
parent_dir_env = Path(__file__).parent.parent / '.env'

if current_dir_env.exists():
    load_dotenv(current_dir_env)
elif parent_dir_env.exists():
    load_dotenv(parent_dir_env)


@dataclass
class GoogleCloudConfig:
    """Google Cloud Document AI Configuration"""
    project_id: str = os.getenv('PROJECT_ID', 'optical-valor-477121-d0')
    location: str = os.getenv('LOCATION', 'us')
    processor_id: str = os.getenv('PROCESSOR_ID', 'c159d8b2fb74ffc9')
    credentials_file: str = ''

    def __post_init__(self):
        # Find credentials file in parent directory
        parent_dir = Path(__file__).parent
        cred_files = list(parent_dir.glob('optical-valor-*.json'))
        if cred_files:
            self.credentials_file = str(cred_files[0])
            os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = self.credentials_file


@dataclass
class FolderConfig:
    """Folder paths for document processing"""
    upload_folder: str = os.getenv('UPLOAD_FOLDER', 'H:/My Drive/AAA AI-Training/Document Processing/EOB-Extractor/eob-source')
    results_folder: str = os.getenv('RESULTS_FOLDER', 'H:/My Drive/AAA AI-Training/Document Processing/EOB-Extractor/eob-results')
    raw_data_folder: str = os.getenv('RAW_DATA_FOLDER', 'H:/My Drive/AAA AI-Training/Document Processing/EOB-Extractor/eob-results/raw_data')

    def __post_init__(self):
        # Try to create folders if they don't exist (silently fail if not possible)
        for folder in [self.upload_folder, self.results_folder, self.raw_data_folder]:
            try:
                Path(folder).mkdir(parents=True, exist_ok=True)
            except (OSError, FileNotFoundError):
                # Folder creation failed (e.g., drive not mounted)
                pass

    def validate_folders(self) -> list:
        """Validate that folders exist or can be created"""
        issues = []
        for name, folder in [('upload', self.upload_folder),
                            ('results', self.results_folder),
                            ('raw_data', self.raw_data_folder)]:
            if not Path(folder).exists():
                issues.append(f"{name} folder does not exist: {folder}")
        return issues


@dataclass
class ProcessingConfig:
    """Processing configuration"""
    max_pages_per_split: int = int(os.getenv('MAX_PAGES_PER_SPLIT', '15'))
    max_parallel_workers: int = int(os.getenv('MAX_PARALLEL_WORKERS', '8'))
    document_ai_timeout: int = int(os.getenv('DOCUMENT_AI_TIMEOUT', '300000'))
    cost_tracking: bool = os.getenv('COST_TRACKING', 'NO').upper() != 'NO'
    use_batch_processing: bool = os.getenv('USE_BATCH_PROCESSING', 'YES').upper() == 'YES'


@dataclass
class ProviderConfig:
    """Provider selection configuration"""
    ocr_provider: str = os.getenv('OCR_PROVIDER', 'mistral')  # 'mistral' or 'google'
    llm_provider: str = os.getenv('LLM_PROVIDER', 'mistral')  # 'mistral' or 'openai'


@dataclass
class MistralConfig:
    """Mistral AI Configuration"""
    api_key: str = os.getenv('MISTRAL_API_KEY', '')
    model: str = os.getenv('MISTRAL_MODEL', 'pixtral-large-latest')
    input_cost_per_1k: float = float(os.getenv('MISTRAL_INPUT_COST_PER_1K', '0.002'))
    output_cost_per_1k: float = float(os.getenv('MISTRAL_OUTPUT_COST_PER_1K', '0.006'))


@dataclass
class LlamaCloudConfig:
    """LlamaCloud Configuration"""
    api_key: str = os.getenv('LLAMA_CLOUD_API_KEY', '')


@dataclass
class OpenAIConfig:
    """OpenAI API Configuration"""
    api_key: str = os.getenv('OPENAI_API_KEY', '')
    model: str = os.getenv('OPENAI_MODEL', 'gpt-4o')
    max_tokens: int = int(os.getenv('OPENAI_MAX_TOKENS', '16384'))
    temperature: float = float(os.getenv('OPENAI_TEMPERATURE', '0'))


@dataclass
class ServerConfig:
    """Server configuration for webhook"""
    host: str = os.getenv('SERVER_HOST', '0.0.0.0')
    port: int = int(os.getenv('SERVER_PORT', '8001'))
    backend_url: str = os.getenv('BACKEND_URL', 'http://127.0.0.1:8000')


@dataclass
class CostConfig:
    """Cost configuration for pricing calculations"""
    docai_cost_per_page: float = float(os.getenv('DOCAI_COST_PER_PAGE', '0.015'))
    openai_input_cost_per_1k: float = float(os.getenv('OPENAI_INPUT_COST_PER_1K', '0.00015'))
    openai_output_cost_per_1k: float = float(os.getenv('OPENAI_OUTPUT_COST_PER_1K', '0.0006'))


@dataclass
class GoogleDriveConfig:
    """Google Drive configuration"""
    results_folder_id: str = os.getenv('GDRIVE_RESULTS_FOLDER_ID', '140_11GaATZVV3Ez7aQE7FGJJ4DHWXVFR')
    credentials_file: str = ''

    def __post_init__(self):
        # Use same credentials as Document AI
        parent_dir = Path(__file__).parent
        cred_files = list(parent_dir.glob('optical-valor-*.json'))
        if cred_files:
            self.credentials_file = str(cred_files[0])


class Config:
    """Main configuration class"""

    def __init__(self):
        self.google_cloud = GoogleCloudConfig()
        self.folders = FolderConfig()
        self.processing = ProcessingConfig()
        self.providers = ProviderConfig()
        self.mistral = MistralConfig()
        self.llama_cloud = LlamaCloudConfig()
        self.openai = OpenAIConfig()
        self.server = ServerConfig()
        self.cost = CostConfig()
        self.google_drive = GoogleDriveConfig()

    def validate(self) -> list:
        """Validate configuration and return list of issues"""
        issues = []

        # Validate based on selected providers
        if self.providers.ocr_provider == 'google':
            if not self.google_cloud.credentials_file:
                issues.append("Google Cloud credentials file not found (required for Google OCR)")
        elif self.providers.ocr_provider == 'mistral':
            if not self.mistral.api_key:
                issues.append("Mistral API key not configured (required for Mistral OCR)")

        if self.providers.llm_provider == 'openai':
            if not self.openai.api_key:
                issues.append("OpenAI API key not configured (required for OpenAI LLM)")
        elif self.providers.llm_provider == 'mistral':
            if not self.mistral.api_key:
                issues.append("Mistral API key not configured (required for Mistral LLM)")

        # Check folders
        folder_issues = self.folders.validate_folders()
        issues.extend(folder_issues)

        return issues

    def get_provider_info(self) -> str:
        """Get a summary of current provider configuration"""
        return f"OCR: {self.providers.ocr_provider.upper()}, LLM: {self.providers.llm_provider.upper()}"


# Global config instance
config = Config()
