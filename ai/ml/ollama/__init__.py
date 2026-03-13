"""
US-IA-010 - Ollama Enrichment Module

Enrichissement sémantique des recommandations via Qwen2.5:7b
"""

from .ollama_enricher import OllamaEnricher, ValidationError
from .prompt_templates import SEMANTIC_TAGS, ENRICHMENT_PROMPT

__all__ = ["OllamaEnricher", "ValidationError", "SEMANTIC_TAGS", "ENRICHMENT_PROMPT"]
