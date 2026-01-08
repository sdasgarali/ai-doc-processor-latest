"""
Cost Tracking Module
Handles cost calculations for Document AI and OpenAI usage
"""

import logging
import time
from dataclasses import dataclass
from typing import Optional
from datetime import datetime

import requests

from config import config

logger = logging.getLogger(__name__)


@dataclass
class CostBreakdown:
    """Cost breakdown for document processing"""
    document_ai_cost: float
    openai_cost: float
    total_cost: float
    pages: int
    input_tokens: int
    output_tokens: int
    total_tokens: int
    processing_time_seconds: float
    model_used: str


class CostTracker:
    """Track and calculate processing costs"""

    def __init__(self):
        self.docai_cost_per_page = config.cost.docai_cost_per_page
        self.openai_input_cost_per_1k = config.cost.openai_input_cost_per_1k
        self.openai_output_cost_per_1k = config.cost.openai_output_cost_per_1k
        self.mistral_input_cost_per_1k = config.mistral.input_cost_per_1k
        self.mistral_output_cost_per_1k = config.mistral.output_cost_per_1k
        self.start_time = None
        self.cost_tracking_enabled = config.processing.cost_tracking

    def start_tracking(self):
        """Start tracking processing time"""
        self.start_time = time.time()

    def get_elapsed_time(self) -> float:
        """Get elapsed time in seconds"""
        if self.start_time is None:
            return 0
        return time.time() - self.start_time

    def fetch_model_pricing(self, model_id: int = 2) -> Optional[dict]:
        """Fetch model pricing from backend API with retry logic"""
        # Skip API calls if cost tracking is disabled
        if not self.cost_tracking_enabled:
            return {
                'model_name': config.openai.model,
                'model_code': config.openai.model,
                'input_cost_per_1k': self.openai_input_cost_per_1k,
                'output_cost_per_1k': self.openai_output_cost_per_1k
            }

        max_retries = 3
        backend_url = config.server.backend_url

        for attempt in range(max_retries):
            try:
                response = requests.get(
                    f"{backend_url}/api/admin/openai-models/{model_id}/pricing",
                    timeout=10
                )
                if response.status_code == 200:
                    data = response.json().get('data', {})
                    logger.info(f"Fetched model pricing: {data.get('model_name')}")
                    return {
                        'model_name': data.get('model_name', 'GPT-4o'),
                        'model_code': data.get('model_code', 'gpt-4o'),
                        'input_cost_per_1k': float(data.get('input_cost_per_1k', 0.00015)),
                        'output_cost_per_1k': float(data.get('output_cost_per_1k', 0.0006))
                    }
            except Exception as e:
                logger.warning(f"Failed to fetch model pricing (attempt {attempt + 1}): {e}")
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)

        # Return fallback values
        logger.warning("Using fallback model pricing")
        return {
            'model_name': 'GPT-4o',
            'model_code': 'gpt-4o',
            'input_cost_per_1k': self.openai_input_cost_per_1k,
            'output_cost_per_1k': self.openai_output_cost_per_1k
        }

    def fetch_docai_cost_config(self) -> float:
        """Fetch Document AI cost configuration from backend API"""
        # Skip API calls if cost tracking is disabled
        if not self.cost_tracking_enabled:
            return self.docai_cost_per_page

        max_retries = 3
        backend_url = config.server.backend_url

        for attempt in range(max_retries):
            try:
                response = requests.get(
                    f"{backend_url}/api/admin/config/docai_cost_per_page",
                    timeout=10
                )
                if response.status_code == 200:
                    value = response.json().get('data', {}).get('value', '0.015')
                    cost = float(value)
                    logger.info(f"Fetched DocAI cost per page: ${cost}")
                    return cost
            except Exception as e:
                logger.warning(f"Failed to fetch DocAI cost config (attempt {attempt + 1}): {e}")
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)

        # Return fallback value
        logger.warning("Using fallback DocAI cost per page")
        return self.docai_cost_per_page

    def calculate_document_ai_cost(self, pages: int) -> float:
        """Calculate Document AI processing cost"""
        cost_per_page = self.fetch_docai_cost_config()
        total_cost = pages * cost_per_page
        logger.info(f"Document AI Cost: {pages} pages × ${cost_per_page} = ${total_cost:.4f}")
        return round(total_cost, 4)

    def calculate_openai_cost(self, input_tokens: int, output_tokens: int,
                              model_pricing: dict = None) -> float:
        """Calculate OpenAI API cost"""
        if model_pricing is None:
            model_pricing = self.fetch_model_pricing()

        input_cost = (input_tokens / 1000) * model_pricing['input_cost_per_1k']
        output_cost = (output_tokens / 1000) * model_pricing['output_cost_per_1k']
        total_cost = input_cost + output_cost

        logger.info(f"OpenAI Cost: {input_tokens} input + {output_tokens} output = ${total_cost:.4f}")
        return round(total_cost, 4)

    def calculate_mistral_cost(self, input_tokens: int, output_tokens: int) -> float:
        """Calculate Mistral API cost"""
        input_cost = (input_tokens / 1000) * self.mistral_input_cost_per_1k
        output_cost = (output_tokens / 1000) * self.mistral_output_cost_per_1k
        total_cost = input_cost + output_cost

        logger.info(f"Mistral Cost: {input_tokens} input + {output_tokens} output = ${total_cost:.4f}")
        return round(total_cost, 4)

    def calculate_mistral_ocr_cost(self, pages: int) -> float:
        """Calculate Mistral OCR cost (included in token cost, so essentially 0 for OCR)"""
        # Mistral OCR is included in the token cost, so we return 0 for the OCR portion
        # The actual cost is captured in the token costs
        return 0.0

    def estimate_tokens_from_text(self, text: str) -> int:
        """Estimate token count from text (rough approximation: ~4 chars per token)"""
        return len(text) // 4

    def calculate_total_cost(self, pages: int, input_tokens: int, output_tokens: int,
                             model_used: str = 'GPT-4o', provider: str = 'openai') -> CostBreakdown:
        """Calculate total processing cost based on provider"""
        processing_time = self.get_elapsed_time()

        # If cost tracking is disabled, return minimal cost breakdown
        if not self.cost_tracking_enabled:
            model_name = config.mistral.model if provider == 'mistral' else config.openai.model
            logger.info(f"Cost tracking disabled - skipping cost calculation")
            logger.info(f"Processing Time: {processing_time:.2f} seconds")

            return CostBreakdown(
                document_ai_cost=0.0,
                openai_cost=0.0,
                total_cost=0.0,
                pages=pages,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                total_tokens=input_tokens + output_tokens,
                processing_time_seconds=round(processing_time, 2),
                model_used=model_name
            )

        if provider == 'mistral':
            # Mistral does OCR + extraction in one call, so OCR cost is 0
            ocr_cost = self.calculate_mistral_ocr_cost(pages)
            llm_cost = self.calculate_mistral_cost(input_tokens, output_tokens)
            model_name = config.mistral.model
        else:
            # Google Document AI + OpenAI
            ocr_cost = self.calculate_document_ai_cost(pages)
            model_pricing = self.fetch_model_pricing()
            llm_cost = self.calculate_openai_cost(input_tokens, output_tokens, model_pricing)
            model_name = model_pricing.get('model_name', model_used)

        total_cost = round(ocr_cost + llm_cost, 4)

        logger.info(f"Total Cost: ${total_cost} (OCR: ${ocr_cost} + LLM: ${llm_cost})")
        logger.info(f"Processing Time: {processing_time:.2f} seconds")

        return CostBreakdown(
            document_ai_cost=ocr_cost,
            openai_cost=llm_cost,
            total_cost=total_cost,
            pages=pages,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=input_tokens + output_tokens,
            processing_time_seconds=round(processing_time, 2),
            model_used=model_name
        )


class ProcessingTimer:
    """Context manager for timing operations"""

    def __init__(self, operation_name: str = "Operation"):
        self.operation_name = operation_name
        self.start_time = None
        self.end_time = None

    def __enter__(self):
        self.start_time = time.time()
        logger.debug(f"Starting {self.operation_name}")
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.end_time = time.time()
        elapsed = self.end_time - self.start_time
        logger.info(f"{self.operation_name} completed in {elapsed:.2f}s")

    @property
    def elapsed(self) -> float:
        """Get elapsed time"""
        if self.end_time:
            return self.end_time - self.start_time
        elif self.start_time:
            return time.time() - self.start_time
        return 0
