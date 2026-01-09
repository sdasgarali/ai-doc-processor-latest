"""
Configuration module for Document Processor
Loads settings from environment variables and .env file
Supports fetching config from backend API with .env as fallback
"""

import os
import logging
from pathlib import Path
from dataclasses import dataclass
from typing import Optional, Dict, Any
from dotenv import load_dotenv
import requests

logger = logging.getLogger(__name__)

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


def fetch_api_config(category_id: Optional[int] = None) -> Dict[str, str]:
    """
    Fetch configuration from backend API.
    Returns a dict of config_key -> config_value.
    Falls back to empty dict on any error.
    """
    try:
        backend_url = os.getenv('BACKEND_URL', 'http://localhost:5000')
        url = f"{backend_url}/api/admin/processing-config/effective"
        if category_id:
            url = f"{url}/{category_id}"

        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                logger.info(f"Fetched API config for category {category_id}: {len(data.get('data', {}))} settings")
                return data.get('data', {})
    except Exception as e:
        logger.warning(f"Could not fetch API config (using .env fallback): {e}")

    return {}


def get_config_value(api_config: Dict[str, str], key: str, default: str = '') -> str:
    """
    Get config value with priority: API config > .env > default
    """
    # First check API config
    if key in api_config and api_config[key]:
        return api_config[key]

    # Then check environment variable
    env_value = os.getenv(key)
    if env_value is not None:
        return env_value

    # Finally return default
    return default


class DynamicConfig:
    """
    Dynamic configuration that can be loaded based on document category.
    Fetches from API with .env as fallback.
    """

    def __init__(self, category_id: Optional[int] = None):
        self.category_id = category_id
        self._api_config = None
        self._loaded = False

    def _ensure_loaded(self):
        """Ensure API config is fetched"""
        if not self._loaded:
            self._api_config = fetch_api_config(self.category_id)
            self._loaded = True

    def get(self, key: str, default: str = '') -> str:
        """Get a config value"""
        self._ensure_loaded()
        return get_config_value(self._api_config or {}, key, default)

    def get_int(self, key: str, default: int = 0) -> int:
        """Get an integer config value"""
        try:
            return int(self.get(key, str(default)))
        except ValueError:
            return default

    def get_float(self, key: str, default: float = 0.0) -> float:
        """Get a float config value"""
        try:
            return float(self.get(key, str(default)))
        except ValueError:
            return default

    def get_bool(self, key: str, default: bool = False) -> bool:
        """Get a boolean config value"""
        value = self.get(key, 'YES' if default else 'NO')
        return value.upper() in ('YES', 'TRUE', '1')

    @property
    def ocr_provider(self) -> str:
        return self.get('OCR_PROVIDER', 'google')

    @property
    def llm_provider(self) -> str:
        return self.get('LLM_PROVIDER', 'openai')

    @property
    def openai_api_key(self) -> str:
        return self.get('OPENAI_API_KEY', '')

    @property
    def openai_model(self) -> str:
        return self.get('OPENAI_MODEL', 'gpt-4o')

    @property
    def openai_max_tokens(self) -> int:
        return self.get_int('OPENAI_MAX_TOKENS', 16384)

    @property
    def openai_temperature(self) -> float:
        return self.get_float('OPENAI_TEMPERATURE', 0)

    @property
    def mistral_api_key(self) -> str:
        return self.get('MISTRAL_API_KEY', '')

    @property
    def mistral_model(self) -> str:
        return self.get('MISTRAL_MODEL', 'pixtral-large-latest')

    @property
    def docai_project_id(self) -> str:
        return self.get('DOCAI_PROJECT_ID', '') or self.get('PROJECT_ID', '')

    @property
    def docai_location(self) -> str:
        return self.get('DOCAI_LOCATION', 'us') or self.get('LOCATION', 'us')

    @property
    def docai_processor_id(self) -> str:
        return self.get('DOCAI_PROCESSOR_ID', '') or self.get('PROCESSOR_ID', '')

    @property
    def max_pages_per_split(self) -> int:
        return self.get_int('MAX_PAGES_PER_SPLIT', 15)

    @property
    def use_batch_processing(self) -> bool:
        return self.get_bool('USE_BATCH_PROCESSING', True)

    @property
    def extraction_prompt(self) -> str:
        """Custom extraction prompt (empty means use default)"""
        return self.get('EXTRACTION_PROMPT', '')


def get_dynamic_config(category_id: Optional[int] = None) -> DynamicConfig:
    """
    Get a dynamic config instance for the given category.
    Use this when processing documents to get category-specific config.
    """
    return DynamicConfig(category_id)


# Global config instance (for backward compatibility)
config = Config()
