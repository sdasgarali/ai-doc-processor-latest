"""
AI Engine - Model-Agnostic Provider Layer.

IMPORTANT: This is the ONLY file where AI provider logic is allowed.
All AI integrations must go through this module.

Default provider: Groq
Fallback: Local LLM (Ollama) for air-gapped environments
"""

import os
from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from typing import Any

import httpx


class AIProvider(Enum):
    """Supported AI providers."""

    GROQ = "groq"
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    LOCAL = "local"  # Ollama or other local LLM


@dataclass
class AIResponse:
    """Standardized AI response."""

    content: str
    model: str
    provider: AIProvider
    tokens_used: int
    metadata: dict[str, Any]


class BaseAIProvider(ABC):
    """Abstract base class for AI providers."""

    @abstractmethod
    def complete(self, prompt: str, **kwargs: Any) -> AIResponse:
        """Generate a completion for the given prompt."""
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """Check if the provider is available."""
        pass


class GroqProvider(BaseAIProvider):
    """Groq AI provider implementation (DEFAULT)."""

    API_URL = "https://api.groq.com/openai/v1/chat/completions"

    def __init__(self) -> None:
        self.api_key = os.getenv("GROQ_API_KEY")
        self.model = os.getenv("GROQ_MODEL", "llama-3.1-70b-versatile")

    def complete(self, prompt: str, **kwargs: Any) -> AIResponse:
        """Generate completion using Groq."""
        if not self.is_available():
            raise RuntimeError("Groq provider not configured")

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": kwargs.get("temperature", 0.1),
            "max_tokens": kwargs.get("max_tokens", 2048),
        }

        with httpx.Client(timeout=60.0) as client:
            response = client.post(self.API_URL, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()

        content = data["choices"][0]["message"]["content"]
        tokens_used = data.get("usage", {}).get("total_tokens", 0)

        return AIResponse(
            content=content,
            model=self.model,
            provider=AIProvider.GROQ,
            tokens_used=tokens_used,
            metadata=data,
        )

    def is_available(self) -> bool:
        """Check if Groq is configured."""
        return bool(self.api_key)


class OpenAIProvider(BaseAIProvider):
    """OpenAI provider implementation."""

    API_URL = "https://api.openai.com/v1/chat/completions"

    def __init__(self) -> None:
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.model = os.getenv("OPENAI_MODEL", "gpt-4")

    def complete(self, prompt: str, **kwargs: Any) -> AIResponse:
        """Generate completion using OpenAI."""
        if not self.is_available():
            raise RuntimeError("OpenAI provider not configured")

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": kwargs.get("temperature", 0.1),
            "max_tokens": kwargs.get("max_tokens", 2048),
        }

        with httpx.Client(timeout=60.0) as client:
            response = client.post(self.API_URL, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()

        content = data["choices"][0]["message"]["content"]
        tokens_used = data.get("usage", {}).get("total_tokens", 0)

        return AIResponse(
            content=content,
            model=self.model,
            provider=AIProvider.OPENAI,
            tokens_used=tokens_used,
            metadata=data,
        )

    def is_available(self) -> bool:
        """Check if OpenAI is configured."""
        return bool(self.api_key)


class AnthropicProvider(BaseAIProvider):
    """Anthropic provider implementation."""

    API_URL = "https://api.anthropic.com/v1/messages"

    def __init__(self) -> None:
        self.api_key = os.getenv("ANTHROPIC_API_KEY")
        self.model = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")

    def complete(self, prompt: str, **kwargs: Any) -> AIResponse:
        """Generate completion using Anthropic."""
        if not self.is_available():
            raise RuntimeError("Anthropic provider not configured")

        headers = {
            "x-api-key": self.api_key,
            "Content-Type": "application/json",
            "anthropic-version": "2023-06-01",
        }

        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": kwargs.get("max_tokens", 2048),
        }

        with httpx.Client(timeout=60.0) as client:
            response = client.post(self.API_URL, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()

        content = data["content"][0]["text"]
        tokens_used = data.get("usage", {}).get("input_tokens", 0) + data.get(
            "usage", {}
        ).get("output_tokens", 0)

        return AIResponse(
            content=content,
            model=self.model,
            provider=AIProvider.ANTHROPIC,
            tokens_used=tokens_used,
            metadata=data,
        )

    def is_available(self) -> bool:
        """Check if Anthropic is configured."""
        return bool(self.api_key)


class LocalProvider(BaseAIProvider):
    """
    Local LLM provider (Ollama).

    For air-gapped / zero-cloud environments.
    Requires Ollama running locally: ollama serve

    Setup:
        ollama pull llama3.1:70b
        ollama serve
    """

    def __init__(self) -> None:
        self.base_url = os.getenv("LOCAL_LLM_URL", "http://localhost:11434")
        self.model = os.getenv("LOCAL_LLM_MODEL", "llama3.1:70b")

    def complete(self, prompt: str, **kwargs: Any) -> AIResponse:
        """Generate completion using local Ollama."""
        url = f"{self.base_url}/api/generate"

        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
        }

        try:
            with httpx.Client(timeout=120.0) as client:
                response = client.post(url, json=payload)
                response.raise_for_status()
                data = response.json()

            content = data.get("response", "")

            return AIResponse(
                content=content,
                model=self.model,
                provider=AIProvider.LOCAL,
                tokens_used=0,  # Ollama doesn't always report tokens
                metadata=data,
            )
        except Exception as e:
            raise RuntimeError(f"Local LLM error: {e}") from e

    def is_available(self) -> bool:
        """Check if local Ollama is running."""
        try:
            with httpx.Client(timeout=5.0) as client:
                response = client.get(f"{self.base_url}/api/tags")
                return response.status_code == 200
        except Exception:
            return False


class AIEngine:
    """
    Model-agnostic AI engine with automatic fallback.

    Priority order:
    1. Environment-specified provider (AI_PROVIDER)
    2. Groq (free, fast)
    3. Anthropic
    4. OpenAI
    5. Local (Ollama) - fallback for air-gapped environments

    Automatic fallback: If primary provider fails, tries Local.
    """

    PROVIDER_PRIORITY = [
        AIProvider.GROQ,
        AIProvider.ANTHROPIC,
        AIProvider.OPENAI,
        AIProvider.LOCAL,
    ]

    def __init__(self, provider: AIProvider | None = None) -> None:
        self._providers: dict[AIProvider, BaseAIProvider] = {
            AIProvider.GROQ: GroqProvider(),
            AIProvider.OPENAI: OpenAIProvider(),
            AIProvider.ANTHROPIC: AnthropicProvider(),
            AIProvider.LOCAL: LocalProvider(),
        }
        self._active_provider = provider or self._select_provider()
        self._fallback_enabled = os.getenv("AI_FALLBACK_ENABLED", "true").lower() == "true"

    def _select_provider(self) -> AIProvider:
        """Select the first available provider based on priority."""
        # Check environment override
        override = os.getenv("AI_PROVIDER")
        if override:
            try:
                provider = AIProvider(override.lower())
                if provider in self._providers and self._providers[provider].is_available():
                    return provider
            except ValueError:
                pass

        # Fall back to priority list
        for provider in self.PROVIDER_PRIORITY:
            if self._providers[provider].is_available():
                return provider

        raise RuntimeError(
            "No AI provider available. "
            "Set GROQ_API_KEY, run 'ollama serve', or configure another provider."
        )

    def complete(self, prompt: str, **kwargs: Any) -> AIResponse:
        """
        Generate a completion using the active provider.

        Falls back to local LLM if primary provider fails and fallback is enabled.
        """
        try:
            provider = self._providers[self._active_provider]
            return provider.complete(prompt, **kwargs)
        except Exception as primary_error:
            # Try fallback to local if enabled and not already using local
            if (
                self._fallback_enabled
                and self._active_provider != AIProvider.LOCAL
                and self._providers[AIProvider.LOCAL].is_available()
            ):
                print(f"[AI] Primary provider failed: {primary_error}")
                print("[AI] Falling back to local LLM...")
                return self._providers[AIProvider.LOCAL].complete(prompt, **kwargs)
            raise

    @property
    def provider(self) -> AIProvider:
        """Get the active provider."""
        return self._active_provider

    def switch_provider(self, provider: AIProvider) -> None:
        """Switch to a different provider."""
        if not self._providers[provider].is_available():
            raise RuntimeError(f"Provider {provider.value} is not available")
        self._active_provider = provider


# Module-level convenience functions
def get_engine(provider: AIProvider | None = None) -> AIEngine:
    """Get an AI engine instance."""
    return AIEngine(provider=provider)


def ask_ai(prompt: str, **kwargs: Any) -> str:
    """
    Convenience function to get AI response as a string.

    Args:
        prompt: The prompt to send to the AI.
        **kwargs: Additional arguments passed to the provider.

    Returns:
        The AI response content as a string.
    """
    engine = get_engine()
    response = engine.complete(prompt, **kwargs)
    return response.content
